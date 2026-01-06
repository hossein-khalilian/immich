import { UpdatedAtTrigger, UpdateIdColumn } from 'src/decorators';
import { AlbumTable } from 'src/schema/tables/album.table';
import { FolderTable } from 'src/schema/tables/folder.table';
import {
  CreateDateColumn,
  ForeignKeyColumn,
  Generated,
  Table,
  Timestamp,
  UpdateDateColumn,
} from 'src/sql-tools';

@Table({ name: 'folder_album' })
@UpdatedAtTrigger('folder_album_updatedAt')
export class FolderAlbumTable {
  @ForeignKeyColumn(() => FolderTable, { onDelete: 'CASCADE', onUpdate: 'CASCADE', nullable: false, primary: true })
  folderId!: string;

  @ForeignKeyColumn(() => AlbumTable, { onDelete: 'CASCADE', onUpdate: 'CASCADE', nullable: false, primary: true })
  albumId!: string;

  @CreateDateColumn()
  createdAt!: Generated<Timestamp>;

  @UpdateDateColumn()
  updatedAt!: Generated<Timestamp>;

  @UpdateIdColumn({ index: true })
  updateId!: Generated<string>;
}
