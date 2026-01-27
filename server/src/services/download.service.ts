import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'node:path';
import { StorageCore } from 'src/cores/storage.core';
import { AssetIdsDto } from 'src/dtos/asset.dto';
import { AuthDto } from 'src/dtos/auth.dto';
import { DownloadArchiveInfo, DownloadInfoDto, DownloadResponseDto } from 'src/dtos/download.dto';
import { Permission } from 'src/enum';
import { ImmichReadStream } from 'src/repositories/storage.repository';
import { BaseService } from 'src/services/base.service';
import { HumanReadableSize } from 'src/utils/bytes';
import { getPreferences } from 'src/utils/preferences';

@Injectable()
export class DownloadService extends BaseService {
  async getDownloadInfo(auth: AuthDto, dto: DownloadInfoDto): Promise<DownloadResponseDto> {
    let assets;

    if (dto.assetIds) {
      const assetIds = dto.assetIds;
      await this.requireAccess({ auth, permission: Permission.AssetDownload, ids: assetIds });
      assets = this.downloadRepository.downloadAssetIds(assetIds);
    } else if (dto.albumId) {
      const albumId = dto.albumId;
      await this.requireAccess({ auth, permission: Permission.AlbumDownload, ids: [albumId] });
      assets = this.downloadRepository.downloadAlbumId(albumId);
    } else if (dto.folderId) {
      const folderId = dto.folderId;
      await this.requireAccess({ auth, permission: Permission.FolderDownload, ids: [folderId] });
      assets = this.downloadRepository.downloadFolderId(folderId);
    } else if (dto.userId) {
      const userId = dto.userId;
      await this.requireAccess({ auth, permission: Permission.TimelineDownload, ids: [userId] });
      assets = this.downloadRepository.downloadUserId(userId);
    } else {
      throw new BadRequestException('assetIds, albumId, folderId, or userId is required');
    }

    const targetSize = dto.archiveSize || HumanReadableSize.GiB * 4;
    const metadata = await this.userRepository.getMetadata(auth.user.id);
    const preferences = getPreferences(metadata);
    const motionIds = new Set<string>();
    const archives: DownloadArchiveInfo[] = [];
    let archive: DownloadArchiveInfo = { size: 0, assetIds: [] };

    const addToArchive = ({ id, size }: { id: string; size: number | null }) => {
      archive.assetIds.push(id);
      archive.size += Number(size || 0);

      if (archive.size > targetSize) {
        archives.push(archive);
        archive = { size: 0, assetIds: [] };
      }
    };

    for await (const asset of assets) {
      // motion part of live photos
      if (asset.livePhotoVideoId) {
        motionIds.add(asset.livePhotoVideoId);
      }

      addToArchive(asset);
    }

    if (motionIds.size > 0) {
      const motionAssets = this.downloadRepository.downloadMotionAssetIds([...motionIds]);
      for await (const motionAsset of motionAssets) {
        if (StorageCore.isAndroidMotionPath(motionAsset.originalPath) && !preferences.download.includeEmbeddedVideos) {
          continue;
        }

        addToArchive(motionAsset);
      }
    }

    if (archive.assetIds.length > 0) {
      archives.push(archive);
    }

    let totalSize = 0;
    for (const archive of archives) {
      totalSize += archive.size;
    }

    return { totalSize, archives };
  }

  async downloadArchive(auth: AuthDto, dto: AssetIdsDto): Promise<ImmichReadStream> {
    const zip = this.storageRepository.createZipStream();

    // Handle folder download with hierarchy
    if (dto.folderId) {
      await this.requireAccess({ auth, permission: Permission.FolderDownload, ids: [dto.folderId] });
      return this.downloadFolderHierarchy(auth, dto.folderId, dto.assetIds, zip);
    }

    // Standard flat download
    await this.requireAccess({ auth, permission: Permission.AssetDownload, ids: dto.assetIds });

    const assets = await this.assetRepository.getByIds(dto.assetIds);
    const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
    const paths: Record<string, number> = {};

    for (const assetId of dto.assetIds) {
      const asset = assetMap.get(assetId);
      if (!asset) {
        continue;
      }

      const { originalPath, originalFileName } = asset;

      let filename = originalFileName;
      const count = paths[filename] || 0;
      paths[filename] = count + 1;
      if (count !== 0) {
        const parsedFilename = parse(originalFileName);
        filename = `${parsedFilename.name}+${count}${parsedFilename.ext}`;
      }

      let realpath = originalPath;
      try {
        realpath = await this.storageRepository.realpath(originalPath);
      } catch {
        this.logger.warn('Unable to resolve realpath', { originalPath });
      }

      zip.addFile(realpath, filename);
    }

    void zip.finalize();

    return { stream: zip.stream };
  }

  private async downloadFolderHierarchy(
    auth: AuthDto,
    folderId: string,
    assetIds: string[],
    zip: ReturnType<typeof this.storageRepository.createZipStream>,
  ): Promise<ImmichReadStream> {
    // Get folder hierarchy
    const hierarchy = await this.downloadRepository.getFolderHierarchyForDownload(folderId);
    const { folders, albums, assets } = hierarchy;

    // Get root folder
    const rootFolder = folders.find((f) => f.id === folderId);
    if (!rootFolder) {
      throw new BadRequestException('Folder not found');
    }
    const rootFolderId = folderId;

    // Build folder path map (folderId -> full path from root)
    const folderMap = new Map<string, { name: string; parentId: string | null }>();
    for (const folder of folders) {
      folderMap.set(folder.id, { name: folder.folderName || 'Untitled Folder', parentId: folder.parentId });
    }

    // Build folder path strings (relative to root folder)
    const folderPaths = new Map<string, string>();
    folderPaths.set(rootFolderId, ''); // Root folder has empty path

    const buildFolderPaths = (parentId: string, parentPath: string) => {
      // Find all folders with this parent
      for (const [id, folder] of folderMap.entries()) {
        // Skip root folder itself
        if (id === rootFolderId) {
          continue;
        }
        if (folder.parentId === parentId) {
          const folderName = this.sanitizePath(folder.name);
          const currentPath = parentPath ? `${parentPath}/${folderName}` : folderName;
          folderPaths.set(id, currentPath);
          // Recursively build paths for subfolders
          buildFolderPaths(id, currentPath);
        }
      }
    };

    // Start building from root folder (empty path)
    buildFolderPaths(rootFolderId, '');

    const getFolderPath = (folderId: string): string => {
      return folderPaths.get(folderId) || '';
    };

    // Build album path map (albumId -> { folderPath, albumName })
    const albumMap = new Map<string, { folderPath: string; albumName: string }>();
    for (const album of albums) {
      const folderPath = getFolderPath(album.folderId);
      albumMap.set(album.id, {
        folderPath,
        albumName: album.albumName || 'Untitled Album',
      });
    }

    // Get assets and build file paths
    const assetsToDownload = assets.filter((asset) => assetIds.includes(asset.id));
    const assetDetails = await this.assetRepository.getByIds(assetsToDownload.map((a) => a.id));
    const assetDetailsMap = new Map(assetDetails.map((asset) => [asset.id, asset]));

    // Track duplicate filenames per path
    const pathCounts: Record<string, number> = {};

    for (const assetInfo of assetsToDownload) {
      const asset = assetDetailsMap.get(assetInfo.id);
      if (!asset) {
        continue;
      }

      const albumInfo = albumMap.get(assetInfo.albumId);
      if (!albumInfo) {
        continue;
      }

      // Build full path: folderPath/albumName/filename
      const albumPath = this.sanitizePath(albumInfo.albumName);
      const fullPath = albumInfo.folderPath
        ? `${albumInfo.folderPath}/${albumPath}`
        : albumPath;

      const { originalPath, originalFileName } = asset;
      let filename = originalFileName;

      // Handle duplicate filenames
      const fileKey = `${fullPath}/${filename}`;
      const count = pathCounts[fileKey] || 0;
      pathCounts[fileKey] = count + 1;
      if (count !== 0) {
        const parsedFilename = parse(originalFileName);
        filename = `${parsedFilename.name}+${count}${parsedFilename.ext}`;
      }

      const zipPath = `${fullPath}/${filename}`;

      let realpath = originalPath;
      try {
        realpath = await this.storageRepository.realpath(originalPath);
      } catch {
        this.logger.warn('Unable to resolve realpath', { originalPath });
      }

      zip.addFile(realpath, zipPath);
    }

    void zip.finalize();

    return { stream: zip.stream };
  }

  private sanitizePath(name: string): string {
    // Remove or replace characters that are invalid in file paths
    return name
      .replace(/[<>:"|?*\x00-\x1f]/g, '_') // Replace invalid characters
      .replace(/\.\./g, '_') // Replace .. to prevent path traversal
      .replace(/^\.+/, '_') // Replace leading dots
      .replace(/\s+$/, '') // Trim trailing whitespace
      .trim() || 'Untitled'; // Fallback to 'Untitled' if empty
  }
}
