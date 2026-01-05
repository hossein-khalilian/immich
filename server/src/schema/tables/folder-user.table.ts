import { CreateIdColumn, UpdatedAtTrigger, UpdateIdColumn } from 'src/decorators';
import { AlbumUserRole } from 'src/enum';
import { folder_user_after_insert, folder_user_delete_audit } from 'src/schema/functions';
import { FolderTable } from 'src/schema/tables/folder.table';
import { UserTable } from 'src/schema/tables/user.table';
import {
  AfterDeleteTrigger,
  AfterInsertTrigger,
  Column,
  CreateDateColumn,
  ForeignKeyColumn,
  Generated,
  Table,
  Timestamp,
  UpdateDateColumn,
} from 'src/sql-tools';

@Table({ name: 'folder_user' })
// Pre-existing indices from original folder <--> user ManyToMany mapping
@UpdatedAtTrigger('folder_user_updatedAt')
@AfterInsertTrigger({
  name: 'folder_user_after_insert',
  scope: 'statement',
  referencingNewTableAs: 'inserted_rows',
  function: folder_user_after_insert,
})
@AfterDeleteTrigger({
  scope: 'statement',
  function: folder_user_delete_audit,
  referencingOldTableAs: 'old',
  when: 'pg_trigger_depth() <= 1',
})
export class FolderUserTable {
  @ForeignKeyColumn(() => FolderTable, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
    primary: true,
  })
  folderId!: string;

  @ForeignKeyColumn(() => UserTable, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
    primary: true,
  })
  userId!: string;

  @Column({ type: 'character varying', default: AlbumUserRole.Editor })
  role!: Generated<AlbumUserRole>;

  @CreateIdColumn({ index: true })
  createId!: Generated<string>;

  @CreateDateColumn()
  createdAt!: Generated<Timestamp>;

  @UpdateIdColumn({ index: true })
  updateId!: Generated<string>;

  @UpdateDateColumn()
  updatedAt!: Generated<Timestamp>;
}
