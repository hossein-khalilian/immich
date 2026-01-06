import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE TABLE "folder_album" (
      "folderId" uuid NOT NULL,
      "albumId" uuid NOT NULL,
      "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
      "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
      "updateId" uuid NOT NULL DEFAULT immich_uuid_v7(),
      CONSTRAINT "folder_album_pkey" PRIMARY KEY ("folderId", "albumId"),
      CONSTRAINT "folder_album_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folder" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT "folder_album_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "album" ("id") ON UPDATE CASCADE ON DELETE CASCADE
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS "IDX_folder_album_updateId" ON "folder_album" ("updateId")
  `.execute(db);

  await sql`
    CREATE TRIGGER "folder_album_updatedAt"
      BEFORE UPDATE ON "folder_album"
      FOR EACH ROW
      EXECUTE FUNCTION updated_at()
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS "folder_album_updatedAt" ON "folder_album"`.execute(db);
  await sql`DROP TABLE IF EXISTS "folder_album"`.execute(db);
}
