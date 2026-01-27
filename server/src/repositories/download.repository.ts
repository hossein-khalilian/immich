import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { AssetVisibility } from 'src/enum';
import { DB } from 'src/schema';
import { anyUuid } from 'src/utils/database';

const builder = (db: Kysely<DB>) =>
  db
    .selectFrom('asset')
    .innerJoin('asset_exif', 'assetId', 'id')
    .select(['asset.id', 'asset.livePhotoVideoId', 'asset_exif.fileSizeInByte as size'])
    .where('asset.deletedAt', 'is', null);

@Injectable()
export class DownloadRepository {
  constructor(@InjectKysely() private db: Kysely<DB>) {}

  downloadAssetIds(ids: string[]) {
    return builder(this.db).where('asset.id', '=', anyUuid(ids)).stream();
  }

  downloadMotionAssetIds(ids: string[]) {
    return builder(this.db).select(['asset.originalPath']).where('asset.id', '=', anyUuid(ids)).stream();
  }

  downloadAlbumId(albumId: string) {
    return builder(this.db)
      .innerJoin('album_asset', 'asset.id', 'album_asset.assetId')
      .where('album_asset.albumId', '=', albumId)
      .stream();
  }

  downloadFolderId(folderId: string) {
    return builder(this.db)
      .innerJoin('album_asset', 'asset.id', 'album_asset.assetId')
      .innerJoin('folder_album', 'album_asset.albumId', 'folder_album.albumId')
      .where('folder_album.folderId', '=', folderId)
      .stream();
  }

  async getFolderHierarchyForDownload(folderId: string) {
    // Get all descendant folders (including self)
    const allFolders = await this.db
      .selectFrom('folder')
      .selectAll('folder')
      .innerJoin('folder_closure', 'folder_closure.id_descendant', 'folder.id')
      .where('folder_closure.id_ancestor', '=', folderId)
      .where('folder.deletedAt', 'is', null)
      .execute();

    // Get all albums in these folders
    const albums = await this.db
      .selectFrom('album')
      .innerJoin('folder_album', 'folder_album.albumId', 'album.id')
      .select(['album.id', 'album.albumName'])
      .select('folder_album.folderId')
      .where('folder_album.folderId', 'in', allFolders.map((f) => f.id))
      .where('album.deletedAt', 'is', null)
      .execute();

    // Get assets with their album and folder info
    const assets = await this.db
      .selectFrom('asset')
      .innerJoin('asset_exif', 'assetId', 'id')
      .innerJoin('album_asset', 'asset.id', 'album_asset.assetId')
      .innerJoin('folder_album', 'album_asset.albumId', 'folder_album.albumId')
      .select([
        'asset.id',
        'asset.livePhotoVideoId',
        'asset_exif.fileSizeInByte as size',
        'album_asset.albumId',
        'folder_album.folderId',
      ])
      .where('folder_album.folderId', 'in', allFolders.map((f) => f.id))
      .where('asset.deletedAt', 'is', null)
      .execute();

    return { folders: allFolders, albums, assets };
  }

  downloadUserId(userId: string) {
    return builder(this.db)
      .where('asset.ownerId', '=', userId)
      .where('asset.visibility', '!=', AssetVisibility.Hidden)
      .stream();
  }
}
