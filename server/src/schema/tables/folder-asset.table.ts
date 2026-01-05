import { UpdatedAtTrigger, UpdateIdColumn } from 'src/decorators';
import { folder_asset_delete_audit } from 'src/schema/functions';
import { FolderTable } from 'src/schema/tables/folder.table';
import { AssetTable } from 'src/schema/tables/asset.table';
import {
  AfterDeleteTrigger,
  CreateDateColumn,
  ForeignKeyColumn,
  Generated,
  Table,
  Timestamp,
  UpdateDateColumn,
} from 'src/sql-tools';

@Table({ name: 'folder_asset' })
@UpdatedAtTrigger('folder_asset_updatedAt')
@AfterDeleteTrigger({
  scope: 'statement',
  function: folder_asset_delete_audit,
  referencingOldTableAs: 'old',
  when: 'pg_trigger_depth() <= 1',
})
export class FolderAssetTable {
  @ForeignKeyColumn(() => FolderTable, { onDelete: 'CASCADE', onUpdate: 'CASCADE', nullable: false, primary: true })
  folderId!: string;

  @ForeignKeyColumn(() => AssetTable, { onDelete: 'CASCADE', onUpdate: 'CASCADE', nullable: false, primary: true })
  assetId!: string;

  @CreateDateColumn()
  createdAt!: Generated<Timestamp>;

  @UpdateDateColumn()
  updatedAt!: Generated<Timestamp>;

  @UpdateIdColumn({ index: true })
  updateId!: Generated<string>;
}
