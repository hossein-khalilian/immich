import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AddFolderUsersDto,
  FolderInfoDto,
  FolderResponseDto,
  FoldersAddAssetsDto,
  FoldersAddAssetsResponseDto,
  FolderStatisticsResponseDto,
  CreateFolderDto,
  GetFoldersDto,
  mapFolder,
  MapFolderDto,
  mapFolderWithAssets,
  mapFolderWithoutAssets,
  UpdateFolderDto,
  UpdateFolderUserDto,
} from 'src/dtos/folder.dto';
import { BulkIdErrorReason, BulkIdResponseDto, BulkIdsDto } from 'src/dtos/asset-ids.response.dto';
import { AuthDto } from 'src/dtos/auth.dto';
import { Permission } from 'src/enum';
import { FolderAssetCount, FolderInfoOptions, FolderSubfolderCount } from 'src/repositories/folder.repository';
import { BaseService } from 'src/services/base.service';
import { addAssets, removeAssets } from 'src/utils/asset.util';
import { getPreferences } from 'src/utils/preferences';

@Injectable()
export class FolderService extends BaseService {
  async getStatistics(auth: AuthDto): Promise<FolderStatisticsResponseDto> {
    const [owned, shared, notShared] = await Promise.all([
      this.folderRepository.getOwned(auth.user.id),
      this.folderRepository.getShared(auth.user.id),
      this.folderRepository.getNotShared(auth.user.id),
    ]);

    return {
      owned: owned.length,
      shared: shared.length,
      notShared: notShared.length,
    };
  }

  async getAll({ user: { id: ownerId } }: AuthDto, { assetId, shared, parentId }: GetFoldersDto): Promise<FolderResponseDto[]> {
    await this.folderRepository.updateThumbnails();

    let folders: MapFolderDto[];
    if (assetId) {
      folders = await this.folderRepository.getByAssetId(ownerId, assetId);
    } else if (shared === true) {
      folders = await this.folderRepository.getShared(ownerId);
    } else if (shared === false) {
      folders = await this.folderRepository.getNotShared(ownerId);
    } else {
      folders = await this.folderRepository.getOwned(ownerId, parentId);
    }

    // Get asset count for each folder. Then map the result to an object:
    // { [folderId]: assetCount }
    const folderIds = folders.map((folder) => folder.id);
    const results = await this.folderRepository.getMetadataForIds(folderIds);
    const folderMetadata: Record<string, FolderAssetCount> = {};
    for (const metadata of results) {
      folderMetadata[metadata.folderId] = metadata;
    }

    // Get subfolder counts
    const subfolderResults = await this.folderRepository.getSubfolderCounts(folderIds);
    const subfolderCounts: Record<string, FolderSubfolderCount> = {};
    for (const count of subfolderResults) {
      subfolderCounts[count.folderId] = count;
    }

    return folders.map((folder) => ({
      ...mapFolderWithoutAssets(folder),
      sharedLinks: undefined,
      startDate: folderMetadata[folder.id]?.startDate ?? undefined,
      endDate: folderMetadata[folder.id]?.endDate ?? undefined,
      assetCount: folderMetadata[folder.id]?.assetCount ?? 0,
      subfolderCount: subfolderCounts[folder.id]?.subfolderCount ?? 0,
      // lastModifiedAssetTimestamp is only used in mobile app, please remove if not need
      lastModifiedAssetTimestamp: folderMetadata[folder.id]?.lastModifiedAssetTimestamp ?? undefined,
    }));
  }

  async get(auth: AuthDto, id: string, dto: FolderInfoDto): Promise<FolderResponseDto> {
    await this.requireAccess({ auth, permission: Permission.FolderRead, ids: [id] });
    await this.folderRepository.updateThumbnails();
    const withAssets = dto.withoutAssets === undefined ? true : !dto.withoutAssets;
    const folder = await this.findOrFail(id, { withAssets });
    const [folderMetadataForIds] = await this.folderRepository.getMetadataForIds([folder.id]);

    const hasSharedUsers = folder.folderUsers && folder.folderUsers.length > 0;
    const hasSharedLink = folder.sharedLinks && folder.sharedLinks.length > 0;
    const isShared = hasSharedUsers || hasSharedLink;

    return {
      ...mapFolder(folder, withAssets, auth),
      startDate: folderMetadataForIds?.startDate ?? undefined,
      endDate: folderMetadataForIds?.endDate ?? undefined,
      assetCount: folderMetadataForIds?.assetCount ?? 0,
      lastModifiedAssetTimestamp: folderMetadataForIds?.lastModifiedAssetTimestamp ?? undefined,
      contributorCounts: isShared ? await this.folderRepository.getContributorCounts(folder.id) : undefined,
    };
  }

  async create(auth: AuthDto, dto: CreateFolderDto): Promise<FolderResponseDto> {
    const folderUsers = dto.folderUsers || [];

    for (const { userId } of folderUsers) {
      const exists = await this.userRepository.get(userId, {});
      if (!exists) {
        throw new BadRequestException('User not found');
      }

      if (userId == auth.user.id) {
        throw new BadRequestException('Cannot share folder with owner');
      }
    }

    // Validate parent folder if provided
    if (dto.parentId) {
      await this.requireAccess({ auth, permission: Permission.FolderRead, ids: [dto.parentId] });
      const parentFolder = await this.folderRepository.getById(dto.parentId, { withAssets: false });
      if (!parentFolder) {
        throw new BadRequestException('Parent folder not found');
      }
    }

    const allowedAssetIdsSet = await this.checkAccess({
      auth,
      permission: Permission.AssetShare,
      ids: dto.assetIds || [],
    });
    const assetIds = [...allowedAssetIdsSet].map((id) => id);

    const userMetadata = await this.userRepository.getMetadata(auth.user.id);

    const folder = await this.folderRepository.create(
      {
        ownerId: auth.user.id,
        folderName: dto.folderName || 'Untitled Folder',
        name: dto.folderName || 'Untitled Folder',
        description: dto.description,
        folderThumbnailAssetId: assetIds[0] || null,
        order: getPreferences(userMetadata).albums.defaultAssetOrder,
        parentId: dto.parentId ?? null,
      },
      assetIds,
      folderUsers,
    );

    for (const { userId } of folderUsers) {
      await this.eventRepository.emit('FolderInvite', { id: folder.id, userId });
    }

    return mapFolderWithAssets(folder);
  }

  async update(auth: AuthDto, id: string, dto: UpdateFolderDto): Promise<FolderResponseDto> {
    await this.requireAccess({ auth, permission: Permission.FolderUpdate, ids: [id] });

    const folder = await this.findOrFail(id, { withAssets: true });

    if (dto.folderThumbnailAssetId) {
      const results = await this.folderRepository.getAssetIds(id, [dto.folderThumbnailAssetId]);
      if (results.size === 0) {
        throw new BadRequestException('Invalid folder thumbnail');
      }
    }

    // Handle parent change (moving folder)
    if (dto.parentId !== undefined && dto.parentId !== folder.parentId) {
      // Validate new parent if provided
      if (dto.parentId !== null) {
        await this.requireAccess({ auth, permission: Permission.FolderRead, ids: [dto.parentId] });
        const parentFolder = await this.folderRepository.getById(dto.parentId, { withAssets: false });
        if (!parentFolder) {
          throw new BadRequestException('Parent folder not found');
        }

        // Prevent moving a folder into itself or its descendants
        const descendants = await this.folderRepository.getDescendants(id);
        const descendantIds = descendants.map((d) => d.id);
        if (descendantIds.includes(dto.parentId)) {
          throw new BadRequestException('Cannot move folder into its own subfolder');
        }
      }

      // Update parent and closure table
      await this.folderRepository.updateParent(id, dto.parentId);
    }

    const updatedFolder = await this.folderRepository.update(folder.id, {
      id: folder.id,
      folderName: dto.folderName,
      description: dto.description,
      folderThumbnailAssetId: dto.folderThumbnailAssetId,
      isActivityEnabled: dto.isActivityEnabled,
      order: dto.order,
    });

    return mapFolderWithoutAssets({ ...updatedFolder, assets: folder.assets });
  }

  async delete(auth: AuthDto, id: string): Promise<void> {
    await this.requireAccess({ auth, permission: Permission.FolderDelete, ids: [id] });
    await this.folderRepository.delete(id);
  }

  async addAssets(auth: AuthDto, id: string, dto: BulkIdsDto): Promise<BulkIdResponseDto[]> {
    const folder = await this.findOrFail(id, { withAssets: false });
    await this.requireAccess({ auth, permission: Permission.FolderAssetCreate, ids: [id] });

    const results = await addAssets(
      auth,
      { access: this.accessRepository, bulk: this.folderRepository },
      { parentId: id, assetIds: dto.ids },
    );

    const { id: firstNewAssetId } = results.find(({ success }) => success) || {};
    if (firstNewAssetId) {
      await this.folderRepository.update(id, {
        id,
        updatedAt: new Date(),
        folderThumbnailAssetId: folder.folderThumbnailAssetId ?? firstNewAssetId,
      });

      const allUsersExceptUs = [...folder.folderUsers.map(({ user }) => user.id), folder.owner.id].filter(
        (userId) => userId !== auth.user.id,
      );

      for (const recipientId of allUsersExceptUs) {
        await this.eventRepository.emit('FolderUpdate', { id, recipientId });
      }
    }

    return results;
  }

  async addAssetsToFolders(auth: AuthDto, dto: FoldersAddAssetsDto): Promise<FoldersAddAssetsResponseDto> {
    const results: FoldersAddAssetsResponseDto = {
      success: false,
      error: BulkIdErrorReason.DUPLICATE,
    };

    const allowedFolderIds = await this.checkAccess({
      auth,
      permission: Permission.FolderAssetCreate,
      ids: dto.folderIds,
    });
    if (allowedFolderIds.size === 0) {
      results.error = BulkIdErrorReason.NO_PERMISSION;
      return results;
    }

    const allowedAssetIds = await this.checkAccess({ auth, permission: Permission.AssetShare, ids: dto.assetIds });
    if (allowedAssetIds.size === 0) {
      results.error = BulkIdErrorReason.NO_PERMISSION;
      return results;
    }

    const folderAssetValues: { folderId: string; assetId: string }[] = [];
    const events: { id: string; recipients: string[] }[] = [];
    for (const folderId of allowedFolderIds) {
      const existingAssetIds = await this.folderRepository.getAssetIds(folderId, [...allowedAssetIds]);
      const notPresentAssetIds = [...allowedAssetIds].filter((id) => !existingAssetIds.has(id));
      if (notPresentAssetIds.length === 0) {
        continue;
      }
      const folder = await this.findOrFail(folderId, { withAssets: false });
      results.error = undefined;
      results.success = true;

      for (const assetId of notPresentAssetIds) {
        folderAssetValues.push({ folderId, assetId });
      }
      await this.folderRepository.update(folderId, {
        id: folderId,
        updatedAt: new Date(),
        folderThumbnailAssetId: folder.folderThumbnailAssetId ?? notPresentAssetIds[0],
      });
      const allUsersExceptUs = [...folder.folderUsers.map(({ user }) => user.id), folder.owner.id].filter(
        (userId) => userId !== auth.user.id,
      );
      events.push({ id: folderId, recipients: allUsersExceptUs });
    }

    await this.folderRepository.addAssetIdsToFolders(folderAssetValues);
    for (const event of events) {
      for (const recipientId of event.recipients) {
        await this.eventRepository.emit('FolderUpdate', { id: event.id, recipientId });
      }
    }

    return results;
  }

  async removeAssets(auth: AuthDto, id: string, dto: BulkIdsDto): Promise<BulkIdResponseDto[]> {
    await this.requireAccess({ auth, permission: Permission.FolderAssetDelete, ids: [id] });

    const folder = await this.findOrFail(id, { withAssets: false });
    const results = await removeAssets(
      auth,
      { access: this.accessRepository, bulk: this.folderRepository },
      { parentId: id, assetIds: dto.ids, canAlwaysRemove: Permission.FolderDelete },
    );

    const removedIds = results.filter(({ success }) => success).map(({ id }) => id);
    if (removedIds.length > 0 && folder.folderThumbnailAssetId && removedIds.includes(folder.folderThumbnailAssetId)) {
      await this.folderRepository.updateThumbnails();
    }

    return results;
  }

  async addUsers(auth: AuthDto, id: string, { folderUsers }: AddFolderUsersDto): Promise<FolderResponseDto> {
    await this.requireAccess({ auth, permission: Permission.FolderShare, ids: [id] });

    const folder = await this.findOrFail(id, { withAssets: false });

    for (const { userId, role } of folderUsers) {
      if (folder.ownerId === userId) {
        throw new BadRequestException('Cannot be shared with owner');
      }

      const exists = folder.folderUsers.find(({ user: { id } }) => id === userId);
      if (exists) {
        throw new BadRequestException('User already added');
      }

      const user = await this.userRepository.get(userId, {});
      if (!user) {
        throw new BadRequestException('User not found');
      }

      await this.folderUserRepository.create({ userId, folderId: id, role });
      await this.eventRepository.emit('FolderInvite', { id, userId });
    }

    return this.findOrFail(id, { withAssets: true }).then(mapFolderWithoutAssets);
  }

  async removeUser(auth: AuthDto, id: string, userId: string | 'me'): Promise<void> {
    if (userId === 'me') {
      userId = auth.user.id;
    }

    const folder = await this.findOrFail(id, { withAssets: false });

    if (folder.ownerId === userId) {
      throw new BadRequestException('Cannot remove folder owner');
    }

    const exists = folder.folderUsers.find(({ user: { id } }) => id === userId);
    if (!exists) {
      throw new BadRequestException('Folder not shared with user');
    }

    // non-admin can remove themselves
    if (auth.user.id !== userId) {
      await this.requireAccess({ auth, permission: Permission.FolderShare, ids: [id] });
    }

    await this.folderUserRepository.delete({ folderId: id, userId });
  }

  async updateUser(auth: AuthDto, id: string, userId: string, dto: UpdateFolderUserDto): Promise<void> {
    await this.requireAccess({ auth, permission: Permission.FolderShare, ids: [id] });
    await this.folderUserRepository.update({ folderId: id, userId }, { role: dto.role });
  }

  /**
   * Get direct subfolders of a folder
   */
  async getSubfolders(auth: AuthDto, id: string): Promise<FolderResponseDto[]> {
    await this.requireAccess({ auth, permission: Permission.FolderRead, ids: [id] });
    await this.folderRepository.updateThumbnails();

    const folders = await this.folderRepository.getSubfolders(auth.user.id, id);

    // Get asset counts
    const folderIds = folders.map((folder) => folder.id);
    const results = await this.folderRepository.getMetadataForIds(folderIds);
    const folderMetadata: Record<string, FolderAssetCount> = {};
    for (const metadata of results) {
      folderMetadata[metadata.folderId] = metadata;
    }

    // Get subfolder counts
    const subfolderResults = await this.folderRepository.getSubfolderCounts(folderIds);
    const subfolderCounts: Record<string, FolderSubfolderCount> = {};
    for (const count of subfolderResults) {
      subfolderCounts[count.folderId] = count;
    }

    return folders.map((folder) => ({
      ...mapFolderWithoutAssets(folder),
      sharedLinks: undefined,
      startDate: folderMetadata[folder.id]?.startDate ?? undefined,
      endDate: folderMetadata[folder.id]?.endDate ?? undefined,
      assetCount: folderMetadata[folder.id]?.assetCount ?? 0,
      subfolderCount: subfolderCounts[folder.id]?.subfolderCount ?? 0,
      lastModifiedAssetTimestamp: folderMetadata[folder.id]?.lastModifiedAssetTimestamp ?? undefined,
    }));
  }

  /**
   * Get ancestor folders (breadcrumb path from root to this folder)
   */
  async getAncestors(auth: AuthDto, id: string): Promise<FolderResponseDto[]> {
    await this.requireAccess({ auth, permission: Permission.FolderRead, ids: [id] });

    const ancestors = await this.folderRepository.getAncestors(id);

    return ancestors.map((folder) => mapFolderWithoutAssets(folder));
  }

  private async findOrFail(id: string, options: FolderInfoOptions) {
    const folder = await this.folderRepository.getById(id, options);
    if (!folder) {
      throw new BadRequestException('Folder not found');
    }
    return folder;
  }
}
