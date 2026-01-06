import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Check if folder table exists
  const { rows } = await sql<{ exists: boolean }>`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'folder'
    ) as exists
  `.execute(db);

  if (!rows[0]?.exists) {
    // Folder table doesn't exist, skip this migration as 1767529381498-AddFolderTables should create it
    return;
  }

  // Add missing columns to folder table if they don't exist
  await sql`ALTER TABLE folder ADD COLUMN IF NOT EXISTS "folderName" character varying NOT NULL DEFAULT 'Untitled Folder'`.execute(db);
  await sql`ALTER TABLE folder ADD COLUMN IF NOT EXISTS "order" character varying NOT NULL DEFAULT 'desc'`.execute(db);
  await sql`ALTER TABLE folder ADD COLUMN IF NOT EXISTS "isActivityEnabled" boolean NOT NULL DEFAULT true`.execute(db);

  // Create folder_closure table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS folder_closure (
      id_ancestor uuid NOT NULL,
      id_descendant uuid NOT NULL,
      PRIMARY KEY (id_ancestor, id_descendant),
      FOREIGN KEY (id_ancestor) REFERENCES folder(id) ON DELETE CASCADE ON UPDATE NO ACTION,
      FOREIGN KEY (id_descendant) REFERENCES folder(id) ON DELETE CASCADE ON UPDATE NO ACTION
    )
  `.execute(db);

  // Create folder_user table if it doesn't exist  
  await sql`
    CREATE TABLE IF NOT EXISTS folder_user (
      "folderId" uuid NOT NULL,
      "userId" uuid NOT NULL,
      role character varying NOT NULL DEFAULT 'editor',
      "createId" uuid NOT NULL DEFAULT immich_uuid_v7(),
      "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
      "updateId" uuid NOT NULL DEFAULT immich_uuid_v7(),
      "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
      PRIMARY KEY ("folderId", "userId"),
      FOREIGN KEY ("folderId") REFERENCES folder(id) ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE ON UPDATE CASCADE
    )
  `.execute(db);

  // Create folder_user_audit table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS folder_user_audit (
      id uuid NOT NULL DEFAULT immich_uuid_v7(),
      "folderId" uuid NOT NULL,
      "userId" uuid NOT NULL,
      "deletedAt" timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
      PRIMARY KEY (id)
    )
  `.execute(db);

  // Create indexes (IF NOT EXISTS)
  await sql`CREATE INDEX IF NOT EXISTS "IDX_folder_closure_id_ancestor" ON folder_closure (id_ancestor)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS "IDX_folder_closure_id_descendant" ON folder_closure (id_descendant)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS "IDX_folder_user_createId" ON folder_user ("createId")`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS "IDX_folder_user_updateId" ON folder_user ("updateId")`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS "IDX_folder_user_audit_folderId" ON folder_user_audit ("folderId")`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS "IDX_folder_user_audit_userId" ON folder_user_audit ("userId")`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS "IDX_folder_user_audit_deletedAt" ON folder_user_audit ("deletedAt")`.execute(db);

  // Create trigger functions
  await sql`
    CREATE OR REPLACE FUNCTION folder_user_after_insert() RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
    BEGIN
      UPDATE folder SET "updatedAt" = clock_timestamp(), "updateId" = immich_uuid_v7(clock_timestamp())
      WHERE "id" IN (SELECT DISTINCT "folderId" FROM inserted_rows);
      RETURN NULL;
    END
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION folder_user_delete_audit() RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
    BEGIN
      INSERT INTO folder_audit ("folderId", "userId")
      SELECT "folderId", "userId"
      FROM OLD;

      IF pg_trigger_depth() = 1 THEN
        INSERT INTO folder_user_audit ("folderId", "userId")
        SELECT "folderId", "userId"
        FROM OLD;
      END IF;

      RETURN NULL;
    END
    $$
  `.execute(db);

  // Create triggers on folder_user table
  await sql`
    DROP TRIGGER IF EXISTS folder_user_after_insert ON folder_user;
    CREATE TRIGGER folder_user_after_insert
      AFTER INSERT ON folder_user
      REFERENCING NEW TABLE AS inserted_rows
      FOR EACH STATEMENT
      EXECUTE FUNCTION folder_user_after_insert()
  `.execute(db);

  await sql`
    DROP TRIGGER IF EXISTS folder_user_delete_audit ON folder_user;
    CREATE TRIGGER folder_user_delete_audit
      AFTER DELETE ON folder_user
      REFERENCING OLD TABLE AS old
      FOR EACH STATEMENT
      WHEN (pg_trigger_depth() <= 1)
      EXECUTE FUNCTION folder_user_delete_audit()
  `.execute(db);

  await sql`
    DROP TRIGGER IF EXISTS folder_user_updatedAt ON folder_user;
    CREATE TRIGGER folder_user_updatedAt
      BEFORE UPDATE ON folder_user
      FOR EACH ROW
      EXECUTE FUNCTION updated_at()
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop triggers
  await sql`DROP TRIGGER IF EXISTS folder_user_after_insert ON folder_user`.execute(db);
  await sql`DROP TRIGGER IF EXISTS folder_user_delete_audit ON folder_user`.execute(db);
  await sql`DROP TRIGGER IF EXISTS folder_user_updatedAt ON folder_user`.execute(db);

  // Drop trigger functions
  await sql`DROP FUNCTION IF EXISTS folder_user_after_insert`.execute(db);
  await sql`DROP FUNCTION IF EXISTS folder_user_delete_audit`.execute(db);

  // Drop tables
  await sql`DROP TABLE IF EXISTS folder_user_audit`.execute(db);
  await sql`DROP TABLE IF EXISTS folder_user`.execute(db);
  await sql`DROP TABLE IF EXISTS folder_closure`.execute(db);

  // Remove columns
  await sql`ALTER TABLE folder DROP COLUMN IF EXISTS "folderName"`.execute(db);
  await sql`ALTER TABLE folder DROP COLUMN IF EXISTS "order"`.execute(db);
  await sql`ALTER TABLE folder DROP COLUMN IF EXISTS "isActivityEnabled"`.execute(db);
}
