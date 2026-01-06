import { FolderTable } from 'src/schema/tables/folder.table';
import { ForeignKeyColumn, Table } from 'src/sql-tools';

@Table('folder_closure')
export class FolderClosureTable {
  @ForeignKeyColumn(() => FolderTable, { primary: true, onDelete: 'CASCADE', onUpdate: 'NO ACTION', index: true })
  id_ancestor!: string;

  @ForeignKeyColumn(() => FolderTable, { primary: true, onDelete: 'CASCADE', onUpdate: 'NO ACTION', index: true })
  id_descendant!: string;
}
