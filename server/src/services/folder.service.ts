import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AddFolderUsersDto,
  FolderInfoDto,
  FolderResponseDto,
  FoldersAddAlbumsDto,
  FoldersAddAlbumsResponseDto,
  FolderStatisticsResponseDto,
  CreateFolderDto,
  GetFoldersDto,
  mapFolder,
  MapFolderDto,
  mapFolderWithAlbums,
  mapFolderWithoutAlbums,
  UpdateFolderDto,
  UpdateFolderUserDto,
} from 'src/dtos/folder.dto';
import { BulkIdErrorReason, BulkIdResponseDto, BulkIdsDto } from 'src/dtos/asset-ids.response.dto';
import { AuthDto } from 'src/dtos/auth.dto';
import { Permission } from 'src/enum';
import { FolderAlbumCount, FolderInfoOptions, FolderSubfolderCount } from 'src/repositories/folder.repository';
import { BaseService } from 'src/services/base.service';
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

  async getAll({ user: { id: ownerId } }: AuthDto, { albumId, shared, parentId }: GetFoldersDto): Promise<FolderResponseDto[]> {
    await this.folderRepository.updateThumbnails();

    let folders: MapFolderDto[];
    if (albumId) {
      folders = await this.folderRepository.getByAlbumId(ownerId, albumId);
    } else if (shared === true) {
      folders = await this.folderRepository.getShared(ownerId);
    } else if (shared === false) {
      folders = await this.folderRepository.getNotShared(ownerId);
    } else {
      folders = await this.folderRepository.getOwned(ownerId, parentId);
    }

    // Get album count for each folder. Then map the result to an object:
    // { [folderId]: albumCount }
    const folderIds = folders.map((folder) => folder.id);
    const results = await this.folderRepository.getMetadataForIds(folderIds);
    const folderMetadata: Record<string, FolderAlbumCount> = {};
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
      ...mapFolderWithoutAlbums(folder),
      sharedLinks: undefined,
      startDate: folderMetadata[folder.id]?.startDate ?? undefined,
      endDate: folderMetadata[folder.id]?.endDate ?? undefined,
      albumCount: folderMetadata[folder.id]?.albumCount ?? 0,
      subfolderCount: subfolderCounts[folder.id]?.subfolderCount ?? 0,
      // lastModifiedAlbumTimestamp is only used in mobile app, please remove if not need
      lastModifiedAlbumTimestamp: folderMetadata[folder.id]?.lastModifiedAlbumTimestamp ?? undefined,
    }));
  }

  async get(auth: AuthDto, id: string, dto: FolderInfoDto): Promise<FolderResponseDto> {
    await this.requireAccess({ auth, permission: Permission.FolderRead, ids: [id] });
    await this.folderRepository.updateThumbnails();
    const withAlbums = dto.withoutAlbums === undefined ? true : !dto.withoutAlbums;
    const folder = await this.findOrFail(id, { withAlbums });
    const [folderMetadataForIds] = await this.folderRepository.getMetadataForIds([folder.id]);

    const hasSharedUsers = folder.folderUsers && folder.folderUsers.length > 0;
    const hasSharedLink = folder.sharedLinks && folder.sharedLinks.length > 0;
    const isShared = hasSharedUsers || hasSharedLink;

    return {
      ...mapFolder(folder, withAlbums, auth),
      startDate: folderMetadataForIds?.startDate ?? undefined,
      endDate: folderMetadataForIds?.endDate ?? undefined,
      albumCount: folderMetadataForIds?.albumCount ?? 0,
      lastModifiedAlbumTimestamp: folderMetadataForIds?.lastModifiedAlbumTimestamp ?? undefined,
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
      const parentFolder = await this.folderRepository.getById(dto.parentId, { withAlbums: false });
      if (!parentFolder) {
        throw new BadRequestException('Parent folder not found');
      }
    }

    // Validate album access
    const allowedAlbumIdsSet = await this.checkAccess({
      auth,
      permission: Permission.AlbumRead,
      ids: dto.albumIds || [],
    });
    const albumIds = [...allowedAlbumIdsSet].map((id) => id);

    const userMetadata = await this.userRepository.getMetadata(auth.user.id);

    const folder = await this.folderRepository.create(
      {
        ownerId: auth.user.id,
        folderName: dto.folderName || 'Untitled Folder',
        name: dto.folderName || 'Untitled Folder',
        description: dto.description,
        folderThumbnailAssetId: null,
        order: getPreferences(userMetadata).albums.defaultAssetOrder,
        parentId: dto.parentId ?? null,
      },
      albumIds,
      folderUsers,
    );

    for (const { userId } of folderUsers) {
      await this.eventRepository.emit('FolderInvite', { id: folder.id, userId });
    }

    return mapFolderWithAlbums(folder);
  }

  async update(auth: AuthDto, id: string, dto: UpdateFolderDto): Promise<FolderResponseDto> {
    await this.requireAccess({ auth, permission: Permission.FolderUpdate, ids: [id] });

    const folder = await this.findOrFail(id, { withAlbums: true });

    if (dto.folderThumbnailAssetId) {
      // Validate that the thumbnail asset exists and user has access
      const exists = await this.accessRepository.asset.checkOwnerAccess(auth.user.id, new Set([dto.folderThumbnailAssetId]), false);
      if (exists.size === 0) {
        throw new BadRequestException('Invalid folder thumbnail');
      }
    }

    // Handle parent change (moving folder)
    if (dto.parentId !== undefined && dto.parentId !== folder.parentId) {
      // Validate new parent if provided
      if (dto.parentId !== null) {
        await this.requireAccess({ auth, permission: Permission.FolderRead, ids: [dto.parentId] });
        const parentFolder = await this.folderRepository.getById(dto.parentId, { withAlbums: false });
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

    return mapFolderWithoutAlbums({ ...updatedFolder, albums: folder.albums });
  }

  async delete(auth: AuthDto, id: string): Promise<void> {
    await this.requireAccess({ auth, permission: Permission.FolderDelete, ids: [id] });
    await this.folderRepository.delete(id);
  }

  async addAlbums(auth: AuthDto, id: string, dto: BulkIdsDto): Promise<BulkIdResponseDto[]> {
    const folder = await this.findOrFail(id, { withAlbums: false });
    await this.requireAccess({ auth, permission: Permission.FolderUpdate, ids: [id] });

    const results: BulkIdResponseDto[] = [];

    // Check album access
    const allowedAlbumIds = await this.checkAccess({
      auth,
      permission: Permission.AlbumRead,
      ids: dto.ids,
    });

    // Check which albums are already in the folder
    const existingAlbumIds = await this.folderRepository.getAlbumIds(id, [...allowedAlbumIds]);

    for (const albumId of dto.ids) {
      if (!allowedAlbumIds.has(albumId)) {
        results.push({ id: albumId, success: false, error: BulkIdErrorReason.NO_PERMISSION });
        continue;
      }

      if (existingAlbumIds.has(albumId)) {
        results.push({ id: albumId, success: false, error: BulkIdErrorReason.DUPLICATE });
        continue;
      }

      results.push({ id: albumId, success: true });
    }

    const albumsToAdd = results.filter(({ success }) => success).map(({ id }) => id);
    if (albumsToAdd.length > 0) {
      await this.folderRepository.addAlbumIds(id, albumsToAdd);
      await this.folderRepository.update(id, { id, updatedAt: new Date() });

      const allUsersExceptUs = [...folder.folderUsers.map(({ user }) => user.id), folder.owner.id].filter(
        (userId) => userId !== auth.user.id,
      );

      for (const recipientId of allUsersExceptUs) {
        await this.eventRepository.emit('FolderUpdate', { id, recipientId });
      }
    }

    return results;
  }

  async addAlbumsToFolders(auth: AuthDto, dto: FoldersAddAlbumsDto): Promise<FoldersAddAlbumsResponseDto> {
    const results: FoldersAddAlbumsResponseDto = {
      success: false,
      error: BulkIdErrorReason.DUPLICATE,
    };

    const allowedFolderIds = await this.checkAccess({
      auth,
      permission: Permission.FolderUpdate,
      ids: dto.folderIds,
    });
    if (allowedFolderIds.size === 0) {
      results.error = BulkIdErrorReason.NO_PERMISSION;
      return results;
    }

    const allowedAlbumIds = await this.checkAccess({ auth, permission: Permission.AlbumRead, ids: dto.albumIds });
    if (allowedAlbumIds.size === 0) {
      results.error = BulkIdErrorReason.NO_PERMISSION;
      return results;
    }

    const folderAlbumValues: { folderId: string; albumId: string }[] = [];
    const events: { id: string; recipients: string[] }[] = [];
    for (const folderId of allowedFolderIds) {
      const existingAlbumIds = await this.folderRepository.getAlbumIds(folderId, [...allowedAlbumIds]);
      const notPresentAlbumIds = [...allowedAlbumIds].filter((id) => !existingAlbumIds.has(id));
      if (notPresentAlbumIds.length === 0) {
        continue;
      }
      const folder = await this.findOrFail(folderId, { withAlbums: false });
      results.error = undefined;
      results.success = true;

      for (const albumId of notPresentAlbumIds) {
        folderAlbumValues.push({ folderId, albumId });
      }
      await this.folderRepository.update(folderId, {
        id: folderId,
        updatedAt: new Date(),
      });
      const allUsersExceptUs = [...folder.folderUsers.map(({ user }) => user.id), folder.owner.id].filter(
        (userId) => userId !== auth.user.id,
      );
      events.push({ id: folderId, recipients: allUsersExceptUs });
    }

    await this.folderRepository.addAlbumIdsToFolders(folderAlbumValues);
    for (const event of events) {
      for (const recipientId of event.recipients) {
        await this.eventRepository.emit('FolderUpdate', { id: event.id, recipientId });
      }
    }

    return results;
  }

  async removeAlbums(auth: AuthDto, id: string, dto: BulkIdsDto): Promise<BulkIdResponseDto[]> {
    await this.requireAccess({ auth, permission: Permission.FolderUpdate, ids: [id] });

    const folder = await this.findOrFail(id, { withAlbums: false });
    
    const results: BulkIdResponseDto[] = [];

    // Check which albums are in the folder
    const existingAlbumIds = await this.folderRepository.getAlbumIds(id, dto.ids);

    for (const albumId of dto.ids) {
      if (!existingAlbumIds.has(albumId)) {
        results.push({ id: albumId, success: false, error: BulkIdErrorReason.NOT_FOUND });
        continue;
      }
      results.push({ id: albumId, success: true });
    }

    const albumsToRemove = results.filter(({ success }) => success).map(({ id }) => id);
    if (albumsToRemove.length > 0) {
      await this.folderRepository.removeAlbumIds(id, albumsToRemove);
      
      // Update thumbnail if needed
      if (folder.folderThumbnailAssetId) {
        await this.folderRepository.updateThumbnails();
      }
    }

    return results;
  }

  async addUsers(auth: AuthDto, id: string, { folderUsers }: AddFolderUsersDto): Promise<FolderResponseDto> {
    await this.requireAccess({ auth, permission: Permission.FolderShare, ids: [id] });

    const folder = await this.findOrFail(id, { withAlbums: false });

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

    return this.findOrFail(id, { withAlbums: true }).then(mapFolderWithoutAlbums);
  }

  async removeUser(auth: AuthDto, id: string, userId: string | 'me'): Promise<void> {
    if (userId === 'me') {
      userId = auth.user.id;
    }

    const folder = await this.findOrFail(id, { withAlbums: false });

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

    // Get album counts
    const folderIds = folders.map((folder) => folder.id);
    const results = await this.folderRepository.getMetadataForIds(folderIds);
    const folderMetadata: Record<string, FolderAlbumCount> = {};
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
      ...mapFolderWithoutAlbums(folder),
      sharedLinks: undefined,
      startDate: folderMetadata[folder.id]?.startDate ?? undefined,
      endDate: folderMetadata[folder.id]?.endDate ?? undefined,
      albumCount: folderMetadata[folder.id]?.albumCount ?? 0,
      subfolderCount: subfolderCounts[folder.id]?.subfolderCount ?? 0,
      lastModifiedAlbumTimestamp: folderMetadata[folder.id]?.lastModifiedAlbumTimestamp ?? undefined,
    }));
  }

  /**
   * Get ancestor folders (breadcrumb path from root to this folder)
   */
  async getAncestors(auth: AuthDto, id: string): Promise<FolderResponseDto[]> {
    await this.requireAccess({ auth, permission: Permission.FolderRead, ids: [id] });

    const ancestors = await this.folderRepository.getAncestors(id);

    return ancestors.map((folder) => mapFolderWithoutAlbums(folder));
  }

  private async findOrFail(id: string, options: FolderInfoOptions) {
    const folder = await this.folderRepository.getById(id, options);
    if (!folder) {
      throw new BadRequestException('Folder not found');
    }
    return folder;
  }
}
