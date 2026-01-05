import { Injectable } from '@nestjs/common';
import { Insertable, Kysely, Updateable } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { DummyValue, GenerateSql } from 'src/decorators';
import { AlbumUserRole } from 'src/enum';
import { DB } from 'src/schema';
import { FolderUserTable } from 'src/schema/tables/folder-user.table';

export type FolderPermissionId = {
  folderId: string;
  userId: string;
};

@Injectable()
export class FolderUserRepository {
  constructor(@InjectKysely() private db: Kysely<DB>) {}

  @GenerateSql({ params: [{ userId: DummyValue.UUID, folderId: DummyValue.UUID }] })
  create(folderUser: Insertable<FolderUserTable>) {
    return this.db
      .insertInto('folder_user')
      .values(folderUser)
      .returning(['userId', 'folderId', 'role'])
      .executeTakeFirstOrThrow();
  }

  @GenerateSql({ params: [{ userId: DummyValue.UUID, folderId: DummyValue.UUID }, { role: AlbumUserRole.Viewer }] })
  update({ userId, folderId }: FolderPermissionId, dto: Updateable<FolderUserTable>) {
    return this.db
      .updateTable('folder_user')
      .set(dto)
      .where('userId', '=', userId)
      .where('folderId', '=', folderId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  @GenerateSql({ params: [{ userId: DummyValue.UUID, folderId: DummyValue.UUID }] })
  async delete({ userId, folderId }: FolderPermissionId): Promise<void> {
    await this.db.deleteFrom('folder_user').where('userId', '=', userId).where('folderId', '=', folderId).execute();
  }
}
