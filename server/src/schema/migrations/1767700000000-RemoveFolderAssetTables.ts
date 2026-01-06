import { Kysely, sql } from 'kysely';

/**
 * Migration to remove folder_asset related tables.
 * Folders should only contain albums and subfolders, not assets directly.
 * Assets are contained within albums.
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Drop trigger first
  await sql`DROP TRIGGER IF EXISTS "folder_asset_updatedAt" ON "folder_asset"`.execute(db);
  await sql`DROP TRIGGER IF EXISTS "folder_asset_delete_audit" ON "folder_asset"`.execute(db);
  
  // Drop the folder_asset_audit table
  await sql`DROP TABLE IF EXISTS "folder_asset_audit" CASCADE`.execute(db);
  
  // Drop the folder_asset table
  await sql`DROP TABLE IF EXISTS "folder_asset" CASCADE`.execute(db);
  
  // Drop the folder_asset_delete_audit function
  await sql`DROP FUNCTION IF EXISTS "folder_asset_delete_audit"`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Recreate folder_asset_delete_audit function
  await sql`
    CREATE OR REPLACE FUNCTION folder_asset_delete_audit() RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO folder_asset_audit ("folderId", "assetId")
      SELECT "folderId", "assetId" FROM OLD
      WHERE "folderId" IN (SELECT "id" FROM folder WHERE "id" IN (SELECT "folderId" FROM OLD));
      RETURN NULL;
    END;
    $$ LANGUAGE PLPGSQL
  `.execute(db);

  // Recreate folder_asset table
  await sql`
    CREATE TABLE "folder_asset" (
      "folderId" uuid NOT NULL,
      "assetId" uuid NOT NULL,
      "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
      "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
      "updateId" uuid NOT NULL DEFAULT immich_uuid_v7(),
      CONSTRAINT "folder_asset_pkey" PRIMARY KEY ("folderId", "assetId"),
      CONSTRAINT "folder_asset_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folder" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT "folder_asset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset" ("id") ON UPDATE CASCADE ON DELETE CASCADE
    )
  `.execute(db);

  // Recreate folder_asset_audit table
  await sql`
    CREATE TABLE "folder_asset_audit" (
      "id" uuid NOT NULL DEFAULT immich_uuid_v7(),
      "folderId" uuid NOT NULL,
      "assetId" uuid NOT NULL,
      "deletedAt" timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT "folder_asset_audit_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "folder_asset_audit_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folder" ("id") ON UPDATE CASCADE ON DELETE CASCADE
    )
  `.execute(db);

  // Recreate index on folder_asset_audit
  await sql`CREATE INDEX IF NOT EXISTS "IDX_folder_asset_audit_assetId" ON "folder_asset_audit" ("assetId")`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS "IDX_folder_asset_audit_deletedAt" ON "folder_asset_audit" ("deletedAt")`.execute(db);

  // Recreate triggers
  await sql`
    CREATE TRIGGER "folder_asset_updatedAt"
    BEFORE UPDATE ON "folder_asset"
    FOR EACH ROW EXECUTE FUNCTION updated_at()
  `.execute(db);

  await sql`
    CREATE TRIGGER "folder_asset_delete_audit"
    AFTER DELETE ON "folder_asset"
    REFERENCING OLD TABLE AS old
    FOR EACH STATEMENT
    WHEN (pg_trigger_depth() <= 1)
    EXECUTE FUNCTION folder_asset_delete_audit()
  `.execute(db);
}
