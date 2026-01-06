import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE TABLE "folder" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "ownerId" uuid NOT NULL,
    "name" character varying NOT NULL,
    "parentId" uuid,
    "description" text NOT NULL DEFAULT '',
    "folderThumbnailAssetId" uuid,
    "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
    "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "deletedAt" timestamp with time zone,
    "updateId" uuid NOT NULL DEFAULT immich_uuid_v7(),
    CONSTRAINT "folder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "folder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT "folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "folder" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT "folder_folderThumbnailAssetId_fkey" FOREIGN KEY ("folderThumbnailAssetId") REFERENCES "asset" ("id") ON UPDATE CASCADE ON DELETE SET NULL
  );`.execute(db);

  await sql`CREATE TABLE "folder_asset" (
    "folderId" uuid NOT NULL,
    "assetId" uuid NOT NULL,
    "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
    "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "updateId" uuid NOT NULL DEFAULT immich_uuid_v7(),
    CONSTRAINT "folder_asset_pkey" PRIMARY KEY ("folderId", "assetId"),
    CONSTRAINT "folder_asset_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folder" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT "folder_asset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset" ("id") ON UPDATE CASCADE ON DELETE CASCADE
  );`.execute(db);

  await sql`CREATE TABLE "folder_audit" (
    "id" uuid NOT NULL DEFAULT immich_uuid_v7(),
    "folderId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "deletedAt" timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT "folder_audit_pkey" PRIMARY KEY ("id")
  );`.execute(db);

  await sql`CREATE TABLE "folder_asset_audit" (
    "id" uuid NOT NULL DEFAULT immich_uuid_v7(),
    "folderId" uuid NOT NULL,
    "assetId" uuid NOT NULL,
    "deletedAt" timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT "folder_asset_audit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "folder_asset_audit_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folder" ("id") ON UPDATE CASCADE ON DELETE CASCADE
  );`.execute(db);

  // Indexes
  await sql`CREATE INDEX "folder_ownerId_parentId_idx" ON "folder" ("ownerId", "parentId");`.execute(db);
  await sql`CREATE INDEX "folder_ownerId_parentId_name_idx" ON "folder" ("ownerId", "parentId", "name") WHERE "deletedAt" IS NULL;`.execute(db);
  await sql`CREATE INDEX "folder_updateId_idx" ON "folder" ("updateId");`.execute(db);
  await sql`CREATE INDEX "folder_asset_updateId_idx" ON "folder_asset" ("updateId");`.execute(db);
  await sql`CREATE INDEX "folder_audit_folderId_idx" ON "folder_audit" ("folderId");`.execute(db);
  await sql`CREATE INDEX "folder_audit_userId_idx" ON "folder_audit" ("userId");`.execute(db);
  await sql`CREATE INDEX "folder_audit_deletedAt_idx" ON "folder_audit" ("deletedAt");`.execute(db);
  await sql`CREATE INDEX "folder_asset_audit_folderId_idx" ON "folder_asset_audit" ("folderId");`.execute(db);
  await sql`CREATE INDEX "folder_asset_audit_assetId_idx" ON "folder_asset_audit" ("assetId");`.execute(db);
  await sql`CREATE INDEX "folder_asset_audit_deletedAt_idx" ON "folder_asset_audit" ("deletedAt");`.execute(db);
  await sql`CREATE UNIQUE INDEX "folder_name_parent_unique" ON "folder" ("ownerId", "parentId", "name") WHERE "deletedAt" IS NULL;`.execute(db);

  // Functions
  await sql`CREATE OR REPLACE FUNCTION folder_delete_audit()
    RETURNS TRIGGER
    LANGUAGE PLPGSQL
    AS $$
      BEGIN
        INSERT INTO folder_audit ("folderId", "userId")
        SELECT "id", "ownerId"
        FROM OLD;
        RETURN NULL;
      END
    $$;`.execute(db);

  await sql`CREATE OR REPLACE FUNCTION folder_asset_delete_audit()
    RETURNS TRIGGER
    LANGUAGE PLPGSQL
    AS $$
      BEGIN
        INSERT INTO folder_asset_audit ("folderId", "assetId")
        SELECT "folderId", "assetId" FROM OLD
        WHERE "folderId" IN (SELECT "id" FROM folder WHERE "id" IN (SELECT "folderId" FROM OLD));
        RETURN NULL;
      END
    $$;`.execute(db);

  // Triggers
  await sql`CREATE OR REPLACE TRIGGER "folder_updatedAt"
    BEFORE UPDATE ON "folder"
    FOR EACH ROW
    EXECUTE FUNCTION updated_at();`.execute(db);

  await sql`CREATE OR REPLACE TRIGGER "folder_delete_audit"
    AFTER DELETE ON "folder"
    REFERENCING OLD TABLE AS "old"
    FOR EACH STATEMENT
    WHEN (pg_trigger_depth() = 0)
    EXECUTE FUNCTION folder_delete_audit();`.execute(db);

  await sql`CREATE OR REPLACE TRIGGER "folder_asset_updatedAt"
    BEFORE UPDATE ON "folder_asset"
    FOR EACH ROW
    EXECUTE FUNCTION updated_at();`.execute(db);

  await sql`CREATE OR REPLACE TRIGGER "folder_asset_delete_audit"
    AFTER DELETE ON "folder_asset"
    REFERENCING OLD TABLE AS "old"
    FOR EACH STATEMENT
    WHEN (pg_trigger_depth() <= 1)
    EXECUTE FUNCTION folder_asset_delete_audit();`.execute(db);

  // Migration overrides
  await sql`INSERT INTO "migration_overrides" ("name", "value") VALUES ('function_folder_delete_audit', '{"type":"function","name":"folder_delete_audit","sql":"CREATE OR REPLACE FUNCTION folder_delete_audit()\\n  RETURNS TRIGGER\\n  LANGUAGE PLPGSQL\\n  AS $$\\n    BEGIN\\n      INSERT INTO folder_audit (\\"folderId\\", \\"userId\\")\\n      SELECT \\"id\\", \\"ownerId\\"\\n      FROM OLD;\\n      RETURN NULL;\\n    END\\n  $$;"}'::jsonb);`.execute(db);
  await sql`INSERT INTO "migration_overrides" ("name", "value") VALUES ('function_folder_asset_delete_audit', '{"type":"function","name":"folder_asset_delete_audit","sql":"CREATE OR REPLACE FUNCTION folder_asset_delete_audit()\\n  RETURNS TRIGGER\\n  LANGUAGE PLPGSQL\\n  AS $$\\n    BEGIN\\n      INSERT INTO folder_asset_audit (\\"folderId\\", \\"assetId\\")\\n      SELECT \\"folderId\\", \\"assetId\\" FROM OLD\\n      WHERE \\"folderId\\" IN (SELECT \\"id\\" FROM folder WHERE \\"id\\" IN (SELECT \\"folderId\\" FROM OLD));\\n      RETURN NULL;\\n    END\\n  $$;"}'::jsonb);`.execute(db);
  await sql`INSERT INTO "migration_overrides" ("name", "value") VALUES ('trigger_folder_delete_audit', '{"type":"trigger","name":"folder_delete_audit","sql":"CREATE OR REPLACE TRIGGER \\"folder_delete_audit\\"\\n  AFTER DELETE ON \\"folder\\"\\n  REFERENCING OLD TABLE AS \\"old\\"\\n  FOR EACH STATEMENT\\n  WHEN (pg_trigger_depth() = 0)\\n  EXECUTE FUNCTION folder_delete_audit();"}'::jsonb);`.execute(db);
  await sql`INSERT INTO "migration_overrides" ("name", "value") VALUES ('trigger_folder_asset_delete_audit', '{"type":"trigger","name":"folder_asset_delete_audit","sql":"CREATE OR REPLACE TRIGGER \\"folder_asset_delete_audit\\"\\n  AFTER DELETE ON \\"folder_asset\\"\\n  REFERENCING OLD TABLE AS \\"old\\"\\n  FOR EACH STATEMENT\\n  WHEN (pg_trigger_depth() <= 1)\\n  EXECUTE FUNCTION folder_asset_delete_audit();"}'::jsonb);`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS "folder_delete_audit" ON "folder";`.execute(db);
  await sql`DROP TRIGGER IF EXISTS "folder_asset_delete_audit" ON "folder_asset";`.execute(db);
  await sql`DROP TRIGGER IF EXISTS "folder_updatedAt" ON "folder";`.execute(db);
  await sql`DROP TRIGGER IF EXISTS "folder_asset_updatedAt" ON "folder_asset";`.execute(db);
  await sql`DROP FUNCTION IF EXISTS folder_delete_audit;`.execute(db);
  await sql`DROP FUNCTION IF EXISTS folder_asset_delete_audit;`.execute(db);
  await sql`DROP TABLE IF EXISTS "folder_asset_audit";`.execute(db);
  await sql`DROP TABLE IF EXISTS "folder_audit";`.execute(db);
  await sql`DROP TABLE IF EXISTS "folder_asset";`.execute(db);
  await sql`DROP TABLE IF EXISTS "folder";`.execute(db);
  await sql`DELETE FROM "migration_overrides" WHERE "name" = 'function_folder_delete_audit';`.execute(db);
  await sql`DELETE FROM "migration_overrides" WHERE "name" = 'function_folder_asset_delete_audit';`.execute(db);
  await sql`DELETE FROM "migration_overrides" WHERE "name" = 'trigger_folder_delete_audit';`.execute(db);
  await sql`DELETE FROM "migration_overrides" WHERE "name" = 'trigger_folder_asset_delete_audit';`.execute(db);
}
