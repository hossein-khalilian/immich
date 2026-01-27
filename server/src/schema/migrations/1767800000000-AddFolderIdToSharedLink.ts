import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Add folderId column to shared_link table (if it doesn't exist)
  await sql`
    ALTER TABLE "shared_link" 
    ADD COLUMN IF NOT EXISTS "folderId" uuid
  `.execute(db);

  // Add foreign key constraint (if it doesn't exist)
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'shared_link_folderId_fkey'
      ) THEN
        ALTER TABLE "shared_link"
        ADD CONSTRAINT "shared_link_folderId_fkey" 
        FOREIGN KEY ("folderId") 
        REFERENCES "folder"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
      END IF;
    END $$
  `.execute(db);

  // Add index for folderId (if it doesn't exist)
  await sql`
    CREATE INDEX IF NOT EXISTS "IDX_shared_link_folderId" ON "shared_link"("folderId")
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS "IDX_shared_link_folderId"`.execute(db);
  await sql`ALTER TABLE "shared_link" DROP CONSTRAINT IF EXISTS "shared_link_folderId_fkey"`.execute(db);
  await sql`ALTER TABLE "shared_link" DROP COLUMN IF EXISTS "folderId"`.execute(db);
}
