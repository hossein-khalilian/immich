import { Injectable } from '@nestjs/common';
import { ExpressionBuilder, Insertable, Kysely, NotNull, sql, SqlBool, Updateable } from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import { InjectKysely } from 'nestjs-kysely';
import { columns } from 'src/database';
import { Chunked, ChunkedArray, ChunkedSet, DummyValue, GenerateSql } from 'src/decorators';
import { FolderUserCreateDto } from 'src/dtos/folder.dto';
import { DB } from 'src/schema';
import { FolderTable } from 'src/schema/tables/folder.table';

export interface FolderAlbumCount {
  folderId: string;
  albumCount: number;
  startDate: Date | null;
  endDate: Date | null;
  lastModifiedAlbumTimestamp: Date | null;
}

export interface FolderInfoOptions {
  withAlbums: boolean;
}

export interface FolderSubfolderCount {
  folderId: string;
  subfolderCount: number;
}

const withOwner = (eb: ExpressionBuilder<DB, 'folder'>) => {
  return jsonObjectFrom(eb.selectFrom('user').select(columns.user).whereRef('user.id', '=', 'folder.ownerId'))
    .$notNull()
    .as('owner');
};

const withFolderUsers = (eb: ExpressionBuilder<DB, 'folder'>) => {
  return jsonArrayFrom(
    eb
      .selectFrom('folder_user')
      .select('folder_user.role')
      .select((eb) =>
        jsonObjectFrom(eb.selectFrom('user').select(columns.user).whereRef('user.id', '=', 'folder_user.userId'))
          .$notNull()
          .as('user'),
      )
      .whereRef('folder_user.folderId', '=', 'folder.id'),
  )
    .$notNull()
    .as('folderUsers');
};

const withSharedLink = (eb: ExpressionBuilder<DB, 'folder'>) => {
  // Note: shared_link table currently only has albumId, not folderId
  // This will need to be updated when shared links support folders
  // For now, return empty array since folders don't support shared links yet
  return jsonArrayFrom(
    eb.selectFrom('shared_link').selectAll().where(sql<SqlBool>`false`)
  ).as('sharedLinks');
};

const withAlbums = (eb: ExpressionBuilder<DB, 'folder'>) => {
  return eb
    .selectFrom((eb) =>
      eb
        .selectFrom('album')
        .select(['album.id', 'album.albumName', 'album.albumThumbnailAssetId'])
        .select((eb) =>
          eb
            .selectFrom('album_asset')
            .select((eb) => sql<number>`${eb.fn.count('album_asset.assetId')}::int`.as('assetCount'))
            .whereRef('album_asset.albumId', '=', 'album.id')
            .as('assetCount')
        )
        .innerJoin('folder_album', 'folder_album.albumId', 'album.id')
        .whereRef('folder_album.folderId', '=', 'folder.id')
        .where('album.deletedAt', 'is', null)
        .orderBy('album.createdAt', 'desc')
        .as('album'),
    )
    .select((eb) => eb.fn.jsonAgg('album').as('albums'))
    .as('albums');
};

@Injectable()
export class FolderRepository {
  constructor(@InjectKysely() private db: Kysely<DB>) {}

  @GenerateSql({ params: [DummyValue.UUID, { withAlbums: true }] })
  async getById(id: string, options: FolderInfoOptions) {
    return this.db
      .selectFrom('folder')
      .selectAll('folder')
      .where('folder.id', '=', id)
      .where('folder.deletedAt', 'is', null)
      .select(withOwner)
      .select(withFolderUsers)
      .select(withSharedLink)
      .$if(options.withAlbums, (eb) => eb.select(withAlbums))
      .$narrowType<{ albums: NotNull }>()
      .executeTakeFirst();
  }

  @GenerateSql({ params: [DummyValue.UUID, DummyValue.UUID] })
  async getByAlbumId(ownerId: string, albumId: string) {
    return this.db
      .selectFrom('folder')
      .selectAll('folder')
      .innerJoin('folder_album', 'folder_album.folderId', 'folder.id')
      .where((eb) =>
        eb.or([
          eb('folder.ownerId', '=', ownerId),
          eb.exists(
            eb
              .selectFrom('folder_user')
              .whereRef('folder_user.folderId', '=', 'folder.id')
              .where('folder_user.userId', '=', ownerId),
          ),
        ]),
      )
      .where('folder_album.albumId', '=', albumId)
      .where('folder.deletedAt', 'is', null)
      .orderBy('folder.createdAt', 'desc')
      .select(withOwner)
      .select(withFolderUsers)
      .orderBy('folder.createdAt', 'desc')
      .execute();
  }

  @GenerateSql({ params: [[DummyValue.UUID]] })
  @ChunkedArray()
  async getMetadataForIds(ids: string[]): Promise<FolderAlbumCount[]> {
    // Guard against running invalid query when ids list is empty.
    if (ids.length === 0) {
      return [];
    }

    return (
      this.db
        .selectFrom('album')
        .innerJoin('folder_album', 'folder_album.albumId', 'album.id')
        .select('folder_album.folderId as folderId')
        .select((eb) => eb.fn.min(sql<Date>`("album"."createdAt" AT TIME ZONE 'UTC'::text)::date`).as('startDate'))
        .select((eb) => eb.fn.max(sql<Date>`("album"."createdAt" AT TIME ZONE 'UTC'::text)::date`).as('endDate'))
        .select((eb) => eb.fn.max('album.updatedAt').as('lastModifiedAlbumTimestamp'))
        .select((eb) => sql<number>`${eb.fn.count('album.id')}::int`.as('albumCount'))
        .where('folder_album.folderId', 'in', ids)
        .where('album.deletedAt', 'is', null)
        .groupBy('folder_album.folderId')
        .execute()
    );
  }

  @GenerateSql({ params: [DummyValue.UUID] })
  async getOwned(ownerId: string, parentId?: string | null) {
    return this.db
      .selectFrom('folder')
      .selectAll('folder')
      .select(withOwner)
      .select(withFolderUsers)
      .select(withSharedLink)
      .where('folder.ownerId', '=', ownerId)
      .where('folder.deletedAt', 'is', null)
      .$if(parentId === null, (qb) => qb.where('folder.parentId', 'is', null))
      .$if(parentId !== undefined && parentId !== null, (qb) => qb.where('folder.parentId', '=', parentId!))
      .orderBy('folder.createdAt', 'desc')
      .execute();
  }

  /**
   * Get direct subfolders of a folder
   */
  @GenerateSql({ params: [DummyValue.UUID, DummyValue.UUID] })
  async getSubfolders(ownerId: string, parentId: string) {
    return this.db
      .selectFrom('folder')
      .selectAll('folder')
      .select(withOwner)
      .select(withFolderUsers)
      .select(withSharedLink)
      .where('folder.parentId', '=', parentId)
      .where('folder.deletedAt', 'is', null)
      .where((eb) =>
        eb.or([
          eb('folder.ownerId', '=', ownerId),
          eb.exists(
            eb
              .selectFrom('folder_user')
              .whereRef('folder_user.folderId', '=', 'folder.id')
              .where('folder_user.userId', '=', ownerId),
          ),
        ]),
      )
      .orderBy('folder.folderName', 'asc')
      .execute();
  }

  /**
   * Get root folders (folders without a parent)
   */
  @GenerateSql({ params: [DummyValue.UUID] })
  async getRootFolders(ownerId: string) {
    return this.db
      .selectFrom('folder')
      .selectAll('folder')
      .select(withOwner)
      .select(withFolderUsers)
      .select(withSharedLink)
      .where('folder.ownerId', '=', ownerId)
      .where('folder.deletedAt', 'is', null)
      .where('folder.parentId', 'is', null)
      .orderBy('folder.createdAt', 'desc')
      .execute();
  }

  /**
   * Get ancestor folders (path from root to folder)
   */
  @GenerateSql({ params: [DummyValue.UUID] })
  async getAncestors(folderId: string) {
    return this.db
      .selectFrom('folder')
      .selectAll('folder')
      .select(withOwner)
      .innerJoin('folder_closure', 'folder_closure.id_ancestor', 'folder.id')
      .where('folder_closure.id_descendant', '=', folderId)
      .where('folder.deletedAt', 'is', null)
      .where('folder.id', '!=', folderId) // exclude self
      .orderBy('folder.createdAt', 'asc')
      .execute();
  }

  /**
   * Get all descendant folders (all nested subfolders)
   */
  @GenerateSql({ params: [DummyValue.UUID] })
  async getDescendants(folderId: string) {
    return this.db
      .selectFrom('folder')
      .selectAll('folder')
      .select(withOwner)
      .innerJoin('folder_closure', 'folder_closure.id_descendant', 'folder.id')
      .where('folder_closure.id_ancestor', '=', folderId)
      .where('folder.deletedAt', 'is', null)
      .where('folder.id', '!=', folderId) // exclude self
      .orderBy('folder.folderName', 'asc')
      .execute();
  }

  /**
   * Get subfolder counts for given folder IDs
   */
  @GenerateSql({ params: [[DummyValue.UUID]] })
  @ChunkedArray()
  async getSubfolderCounts(folderIds: string[]): Promise<FolderSubfolderCount[]> {
    if (folderIds.length === 0) {
      return [];
    }

    return this.db
      .selectFrom('folder')
      .select('folder.parentId as folderId')
      .select((eb) => sql<number>`${eb.fn.count('folder.id')}::int`.as('subfolderCount'))
      .where('folder.parentId', 'in', folderIds)
      .where('folder.deletedAt', 'is', null)
      .groupBy('folder.parentId')
      .execute() as Promise<FolderSubfolderCount[]>;
  }

  /**
   * Get folders shared with and shared by owner.
   */
  @GenerateSql({ params: [DummyValue.UUID] })
  async getShared(ownerId: string) {
    return this.db
      .selectFrom('folder')
      .selectAll('folder')
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom('folder_user')
            .whereRef('folder_user.folderId', '=', 'folder.id')
            .where((eb) => eb.or([eb('folder.ownerId', '=', ownerId), eb('folder_user.userId', '=', ownerId)])),
        )
        // Note: shared_link table currently only has albumId, not folderId
        // This will need to be updated when shared links support folders
      )
      .where('folder.deletedAt', 'is', null)
      .select(withFolderUsers)
      .select(withOwner)
      .select(withSharedLink)
      .orderBy('folder.createdAt', 'desc')
      .execute();
  }

  /**
   * Get folders of owner that are _not_ shared
   */
  @GenerateSql({ params: [DummyValue.UUID] })
  async getNotShared(ownerId: string) {
    return this.db
      .selectFrom('folder')
      .selectAll('folder')
      .where('folder.ownerId', '=', ownerId)
      .where('folder.deletedAt', 'is', null)
      .where((eb) => eb.not(eb.exists(eb.selectFrom('folder_user').whereRef('folder_user.folderId', '=', 'folder.id'))))
      // Note: shared_link table currently only has albumId, not folderId
      // This will need to be updated when shared links support folders
      .select(withOwner)
      .orderBy('folder.createdAt', 'desc')
      .execute();
  }

  async restoreAll(userId: string): Promise<void> {
    await this.db.updateTable('folder').set({ deletedAt: null }).where('ownerId', '=', userId).execute();
  }

  async softDeleteAll(userId: string): Promise<void> {
    await this.db.updateTable('folder').set({ deletedAt: new Date() }).where('ownerId', '=', userId).execute();
  }

  async deleteAll(userId: string): Promise<void> {
    await this.db.deleteFrom('folder').where('ownerId', '=', userId).execute();
  }

  @GenerateSql({ params: [[DummyValue.UUID]] })
  @Chunked()
  async removeAlbumsFromAll(albumIds: string[]): Promise<void> {
    await this.db.deleteFrom('folder_album').where('folder_album.albumId', 'in', albumIds).execute();
  }

  @Chunked({ paramIndex: 1 })
  async removeAlbumIds(folderId: string, albumIds: string[]): Promise<void> {
    if (albumIds.length === 0) {
      return;
    }

    await this.db
      .deleteFrom('folder_album')
      .where('folder_album.folderId', '=', folderId)
      .where('folder_album.albumId', 'in', albumIds)
      .execute();
  }

  /**
   * Get album IDs for the given folder ID.
   *
   * @param folderId Folder ID to get album IDs for.
   * @param albumIds Optional list of album IDs to filter on.
   * @returns Set of Album IDs for the given folder ID.
   */
  @GenerateSql({ params: [DummyValue.UUID, [DummyValue.UUID]] })
  @ChunkedSet({ paramIndex: 1 })
  async getAlbumIds(folderId: string, albumIds: string[]): Promise<Set<string>> {
    if (albumIds.length === 0) {
      return new Set();
    }

    return this.db
      .selectFrom('folder_album')
      .selectAll()
      .where('folder_album.folderId', '=', folderId)
      .where('folder_album.albumId', 'in', albumIds)
      .execute()
      .then((results) => new Set(results.map(({ albumId }) => albumId)));
  }

  async addAlbumIds(folderId: string, albumIds: string[]): Promise<void> {
    await this.addAlbums(this.db, folderId, albumIds);
  }

  create(folder: Insertable<FolderTable>, albumIds: string[], folderUsers: FolderUserCreateDto[]) {
    return this.db.transaction().execute(async (tx) => {
      const newFolder = await tx.insertInto('folder').values(folder).returning(['folder.id', 'folder.parentId']).executeTakeFirst();

      if (!newFolder) {
        throw new Error('Failed to create folder');
      }

      // Update closure table - add self reference
      await tx
        .insertInto('folder_closure')
        .values({ id_ancestor: newFolder.id, id_descendant: newFolder.id })
        .onConflict((oc) => oc.doNothing())
        .execute();

      // If has parent, add all ancestors from parent
      if (newFolder.parentId) {
        await tx
          .insertInto('folder_closure')
          .columns(['id_ancestor', 'id_descendant'])
          .expression(
            tx
              .selectFrom('folder_closure')
              .select(['id_ancestor', sql.raw<string>(`'${newFolder.id}'`).as('id_descendant')])
              .where('id_descendant', '=', newFolder.parentId),
          )
          .onConflict((oc) => oc.doNothing())
          .execute();
      }

      if (albumIds.length > 0) {
        await this.addAlbums(tx, newFolder.id, albumIds);
      }

      if (folderUsers.length > 0) {
        await tx
          .insertInto('folder_user')
          .values(
            folderUsers.map((folderUser) => ({ folderId: newFolder.id, userId: folderUser.userId, role: folderUser.role })),
          )
          .execute();
      }

      return tx
        .selectFrom('folder')
        .selectAll()
        .where('id', '=', newFolder.id)
        .select(withOwner)
        .select(withAlbums)
        .select(withFolderUsers)
        .$narrowType<{ albums: NotNull }>()
        .executeTakeFirstOrThrow();
    });
  }

  update(id: string, folder: Updateable<FolderTable>) {
    return this.db
      .updateTable('folder')
      .set(folder)
      .where('id', '=', id)
      .returningAll('folder')
      .returning(withOwner)
      .returning(withSharedLink)
      .returning(withFolderUsers)
      .executeTakeFirstOrThrow();
  }

  /**
   * Update folder parent and rebuild closure table
   */
  async updateParent(id: string, newParentId: string | null) {
    return this.db.transaction().execute(async (tx) => {
      // Get all descendants (including self)
      const descendants = await tx
        .selectFrom('folder_closure')
        .select('id_descendant')
        .where('id_ancestor', '=', id)
        .execute();

      const descendantIds = descendants.map((d) => d.id_descendant);

      // Remove all ancestor relationships for this subtree (except self-references within subtree)
      await tx
        .deleteFrom('folder_closure')
        .where('id_descendant', 'in', descendantIds)
        .where('id_ancestor', 'not in', descendantIds)
        .execute();

      // Update the folder's parent
      await tx.updateTable('folder').set({ parentId: newParentId }).where('id', '=', id).execute();

      // Add new ancestor relationships if there's a new parent
      if (newParentId) {
        // For each descendant, add relationships to all new ancestors
        for (const descendantId of descendantIds) {
          await tx
            .insertInto('folder_closure')
            .columns(['id_ancestor', 'id_descendant'])
            .expression(
              tx
                .selectFrom('folder_closure')
                .select(['id_ancestor', sql.raw<string>(`'${descendantId}'`).as('id_descendant')])
                .where('id_descendant', '=', newParentId),
            )
            .onConflict((oc) => oc.doNothing())
            .execute();
        }
      }

      return tx
        .selectFrom('folder')
        .selectAll()
        .where('id', '=', id)
        .select(withOwner)
        .select(withSharedLink)
        .select(withFolderUsers)
        .executeTakeFirstOrThrow();
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.deleteFrom('folder').where('id', '=', id).execute();
  }

  @Chunked({ paramIndex: 2, chunkSize: 30_000 })
  private async addAlbums(db: Kysely<DB>, folderId: string, albumIds: string[]): Promise<void> {
    if (albumIds.length === 0) {
      return;
    }

    await db
      .insertInto('folder_album')
      .values(albumIds.map((albumId) => ({ folderId, albumId })))
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  @Chunked({ chunkSize: 30_000 })
  async addAlbumIdsToFolders(values: { folderId: string; albumId: string }[]): Promise<void> {
    if (values.length === 0) {
      return;
    }
    await this.db.insertInto('folder_album').values(values).onConflict((oc) => oc.doNothing()).execute();
  }

  /**
   * Makes sure all thumbnails for folders are updated by:
   * - Setting a thumbnail from the first album's thumbnail when none is set
   * - Removing references of thumbnails when invalid
   *
   * @returns Amount of updated folder thumbnails or undefined when unknown
   */
  async updateThumbnails(): Promise<number | undefined> {
    const result = await this.db
      .updateTable('folder')
      .set((eb) => ({
        folderThumbnailAssetId: eb
          .selectFrom('folder_album')
          .innerJoin('album', (join) =>
            join.onRef('folder_album.albumId', '=', 'album.id').on('album.deletedAt', 'is', null),
          )
          .whereRef('folder_album.folderId', '=', 'folder.id')
          .select('album.albumThumbnailAssetId')
          .orderBy('album.createdAt', 'desc')
          .limit(1),
      }))
      .where((eb) =>
        eb.or([
          eb.and([
            eb('folderThumbnailAssetId', 'is', null),
            eb.exists(
              eb
                .selectFrom('folder_album')
                .innerJoin('album', (join) =>
                  join.onRef('folder_album.albumId', '=', 'album.id').on('album.deletedAt', 'is', null),
                )
                .whereRef('folder_album.folderId', '=', 'folder.id')
                .where('album.albumThumbnailAssetId', 'is not', null)
                .select(sql`1`.as('1')),
            ),
          ]),
          eb.and([
            eb('folderThumbnailAssetId', 'is not', null),
            eb.not(
              eb.exists(
                eb
                  .selectFrom('asset')
                  .whereRef('asset.id', '=', 'folder.folderThumbnailAssetId')
                  .where('asset.deletedAt', 'is', null)
                  .select(sql`1`.as('1')),
              ),
            ),
          ]),
        ]),
      )
      .execute();

    return Number(result[0].numUpdatedRows);
  }

  /**
   * Get per-user album contribution counts for a single folder.
   * Orders by count desc.
   */
  @GenerateSql({ params: [DummyValue.UUID] })
  getContributorCounts(id: string) {
    return this.db
      .selectFrom('folder_album')
      .innerJoin('album', 'album.id', 'albumId')
      .where('album.deletedAt', 'is', sql.lit(null))
      .where('folder_album.folderId', '=', id)
      .select('album.ownerId as userId')
      .select((eb) => eb.fn.countAll<number>().as('albumCount'))
      .groupBy('album.ownerId')
      .orderBy('albumCount', 'desc')
      .execute();
  }
}
