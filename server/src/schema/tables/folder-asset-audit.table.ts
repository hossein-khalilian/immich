import { PrimaryGeneratedUuidV7Column } from 'src/decorators';
import { FolderTable } from 'src/schema/tables/folder.table';
import { Column, CreateDateColumn, ForeignKeyColumn, Generated, Table, Timestamp } from 'src/sql-tools';

@Table('folder_asset_audit')
export class FolderAssetAuditTable {
  @PrimaryGeneratedUuidV7Column()
  id!: Generated<string>;

  @ForeignKeyColumn(() => FolderTable, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  folderId!: string;

  @Column({ type: 'uuid', index: true })
  assetId!: string;

  @CreateDateColumn({ default: () => 'clock_timestamp()', index: true })
  deletedAt!: Generated<Timestamp>;
}
