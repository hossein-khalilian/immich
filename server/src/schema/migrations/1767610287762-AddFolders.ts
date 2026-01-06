import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Check if folder table already exists (created by previous migration)
  const { rows } = await sql<{ exists: boolean }>`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'folder'
    ) as exists
  `.execute(db);

  if (rows[0]?.exists) {
    return;
  }

  // Create folder table if it doesn't exist (fallback for databases without previous migration)
  await sql`
    CREATE TABLE "folder" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "ownerId" uuid NOT NULL,
      "name" character varying NOT NULL,
      "parentId" uuid,
      "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
      "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
      "deletedAt" timestamp with time zone,
      "updateId" uuid NOT NULL DEFAULT immich_uuid_v7()
    )
  `.execute(db);

  await sql`COMMENT ON COLUMN "folder"."parentId" IS 'Parent folder ID for hierarchy'`.execute(db);

  await sql`
    CREATE TABLE "folder_asset" (
      "folderId" uuid NOT NULL,
      "assetId" uuid NOT NULL,
      "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
      "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
      "updateId" uuid NOT NULL DEFAULT immich_uuid_v7(),
      PRIMARY KEY ("folderId", "assetId")
    )
  `.execute(db);

  await sql`
    CREATE TABLE "folder_audit" (
      "id" uuid NOT NULL DEFAULT immich_uuid_v7(),
      "folderId" uuid NOT NULL,
      "userId" uuid NOT NULL,
      "deletedAt" timestamp with time zone NOT NULL DEFAULT clock_timestamp()
    )
  `.execute(db);

  await sql`
    CREATE TABLE "folder_asset_audit" (
      "id" uuid NOT NULL DEFAULT immich_uuid_v7(),
      "folderId" uuid NOT NULL,
      "assetId" uuid NOT NULL,
      "deletedAt" timestamp with time zone NOT NULL DEFAULT clock_timestamp()
    )
  `.execute(db);

  await sql`ALTER TABLE "folder" ADD CONSTRAINT "PK_folder" PRIMARY KEY ("id")`.execute(db);
  await sql`ALTER TABLE "folder_audit" ADD CONSTRAINT "PK_folder_audit" PRIMARY KEY ("id")`.execute(db);
  await sql`ALTER TABLE "folder_asset_audit" ADD CONSTRAINT "PK_folder_asset_audit" PRIMARY KEY ("id")`.execute(db);

  await sql`
    ALTER TABLE "folder"
    ADD CONSTRAINT "FK_folder_ownerId"
    FOREIGN KEY ("ownerId") REFERENCES "user"("id")
    ON UPDATE CASCADE ON DELETE CASCADE
  `.execute(db);

  await sql`
    ALTER TABLE "folder"
    ADD CONSTRAINT "FK_folder_parentId"
    FOREIGN KEY ("parentId") REFERENCES "folder"("id")
    ON UPDATE CASCADE ON DELETE CASCADE
  `.execute(db);

  await sql`
    ALTER TABLE "folder_asset"
    ADD CONSTRAINT "FK_folder_asset_folderId"
    FOREIGN KEY ("folderId") REFERENCES "folder"("id")
    ON UPDATE CASCADE ON DELETE CASCADE
  `.execute(db);

  await sql`
    ALTER TABLE "folder_asset"
    ADD CONSTRAINT "FK_folder_asset_assetId"
    FOREIGN KEY ("assetId") REFERENCES "asset"("id")
    ON UPDATE CASCADE ON DELETE CASCADE
  `.execute(db);

  await sql`
    ALTER TABLE "folder_audit"
    ADD CONSTRAINT "FK_folder_audit_folderId"
    FOREIGN KEY ("folderId") REFERENCES "folder"("id")
    ON UPDATE CASCADE ON DELETE CASCADE
  `.execute(db);

  await sql`
    ALTER TABLE "folder_asset_audit"
    ADD CONSTRAINT "FK_folder_asset_audit_folderId"
    FOREIGN KEY ("folderId") REFERENCES "folder"("id")
    ON UPDATE CASCADE ON DELETE CASCADE
  `.execute(db);

  await sql`CREATE INDEX "IDX_folder_ownerId" ON "folder" ("ownerId")`.execute(db);
  await sql`CREATE INDEX "IDX_folder_parentId" ON "folder" ("parentId")`.execute(db);
  await sql`CREATE INDEX "IDX_folder_updateId" ON "folder" ("updateId")`.execute(db);
  await sql`CREATE INDEX "IDX_folder_asset_updateId" ON "folder_asset" ("updateId")`.execute(db);
  await sql`CREATE INDEX "IDX_folder_audit_folderId" ON "folder_audit" ("folderId")`.execute(db);
  await sql`CREATE INDEX "IDX_folder_audit_userId" ON "folder_audit" ("userId")`.execute(db);
  await sql`CREATE INDEX "IDX_folder_audit_deletedAt" ON "folder_audit" ("deletedAt")`.execute(db);
  await sql`CREATE INDEX "IDX_folder_asset_audit_folderId" ON "folder_asset_audit" ("folderId")`.execute(db);
  await sql`CREATE INDEX "IDX_folder_asset_audit_assetId" ON "folder_asset_audit" ("assetId")`.execute(db);
  await sql`CREATE INDEX "IDX_folder_asset_audit_deletedAt" ON "folder_asset_audit" ("deletedAt")`.execute(db);

  await sql`
    CREATE UNIQUE INDEX "IDX_folder_name_parent_unique"
    ON "folder" ("ownerId", "parentId", "name")
    WHERE "deletedAt" IS NULL
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION folder_delete_audit()
    RETURNS TRIGGER
    LANGUAGE PLPGSQL
    AS $$
      BEGIN
        INSERT INTO folder_audit ("folderId", "userId")
        SELECT "id", "ownerId"
        FROM OLD;
        RETURN NULL;
      END
    $$;
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION folder_asset_delete_audit()
    RETURNS TRIGGER
    LANGUAGE PLPGSQL
    AS $$
      BEGIN
        INSERT INTO folder_asset_audit ("folderId", "assetId")
        SELECT "folderId", "assetId" FROM OLD
        WHERE "folderId" IN (SELECT "id" FROM folder WHERE "id" IN (SELECT "folderId" FROM OLD));
        RETURN NULL;
      END
    $$;
  `.execute(db);

  await sql`
    CREATE OR REPLACE TRIGGER "folder_updatedAt"
    BEFORE UPDATE ON "folder"
    FOR EACH ROW
    EXECUTE FUNCTION updated_at();
  `.execute(db);

  await sql`
    CREATE OR REPLACE TRIGGER "folder_delete_audit"
    AFTER DELETE ON "folder"
    REFERENCING OLD TABLE AS "old"
    FOR EACH STATEMENT
    WHEN (pg_trigger_depth() = 0)
    EXECUTE FUNCTION folder_delete_audit();
  `.execute(db);

  await sql`
    CREATE OR REPLACE TRIGGER "folder_asset_updatedAt"
    BEFORE UPDATE ON "folder_asset"
    FOR EACH ROW
    EXECUTE FUNCTION updated_at();
  `.execute(db);

  await sql`
    CREATE OR REPLACE TRIGGER "folder_asset_delete_audit"
    AFTER DELETE ON "folder_asset"
    REFERENCING OLD TABLE AS "old"
    FOR EACH STATEMENT
    WHEN (pg_trigger_depth() <= 1)
    EXECUTE FUNCTION folder_asset_delete_audit();
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS "folder_asset_delete_audit" ON "folder_asset"`.execute(db);
  await sql`DROP TRIGGER IF EXISTS "folder_asset_updatedAt" ON "folder_asset"`.execute(db);
  await sql`DROP TRIGGER IF EXISTS "folder_delete_audit" ON "folder"`.execute(db);
  await sql`DROP TRIGGER IF EXISTS "folder_updatedAt" ON "folder"`.execute(db);
  await sql`DROP FUNCTION IF EXISTS folder_asset_delete_audit`.execute(db);
  await sql`DROP FUNCTION IF EXISTS folder_delete_audit`.execute(db);
  await sql`DROP INDEX IF EXISTS "IDX_folder_name_parent_unique"`.execute(db);
  await sql`DROP INDEX IF EXISTS "IDX_folder_asset_audit_deletedAt"`.execute(db);
  await sql`DROP INDEX IF EXISTS "IDX_folder_asset_audit_assetId"`.execute(db);
  await sql`DROP INDEX IF EXISTS "IDX_folder_asset_audit_folderId"`.execute(db);
  await sql`DROP INDEX IF EXISTS "IDX_folder_audit_deletedAt"`.execute(db);
  await sql`DROP INDEX IF EXISTS "IDX_folder_audit_userId"`.execute(db);
  await sql`DROP INDEX IF EXISTS "IDX_folder_audit_folderId"`.execute(db);
  await sql`DROP INDEX IF EXISTS "IDX_folder_asset_updateId"`.execute(db);
  await sql`DROP INDEX IF EXISTS "IDX_folder_updateId"`.execute(db);
  await sql`DROP INDEX IF EXISTS "IDX_folder_parentId"`.execute(db);
  await sql`DROP INDEX IF EXISTS "IDX_folder_ownerId"`.execute(db);
  await sql`ALTER TABLE "folder_asset_audit" DROP CONSTRAINT IF EXISTS "FK_folder_asset_audit_folderId"`.execute(db);
  await sql`ALTER TABLE "folder_audit" DROP CONSTRAINT IF EXISTS "FK_folder_audit_folderId"`.execute(db);
  await sql`ALTER TABLE "folder_asset" DROP CONSTRAINT IF EXISTS "FK_folder_asset_assetId"`.execute(db);
  await sql`ALTER TABLE "folder_asset" DROP CONSTRAINT IF EXISTS "FK_folder_asset_folderId"`.execute(db);
  await sql`ALTER TABLE "folder" DROP CONSTRAINT IF EXISTS "FK_folder_parentId"`.execute(db);
  await sql`ALTER TABLE "folder" DROP CONSTRAINT IF EXISTS "FK_folder_ownerId"`.execute(db);
  await sql`ALTER TABLE "folder_asset_audit" DROP CONSTRAINT IF EXISTS "PK_folder_asset_audit"`.execute(db);
  await sql`ALTER TABLE "folder_audit" DROP CONSTRAINT IF EXISTS "PK_folder_audit"`.execute(db);
  await sql`ALTER TABLE "folder" DROP CONSTRAINT IF EXISTS "PK_folder"`.execute(db);
  await sql`DROP TABLE IF EXISTS "folder_asset_audit"`.execute(db);
  await sql`DROP TABLE IF EXISTS "folder_audit"`.execute(db);
  await sql`DROP TABLE IF EXISTS "folder_asset"`.execute(db);
  await sql`DROP TABLE IF EXISTS "folder"`.execute(db);
}
