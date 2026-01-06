// Temporary type definitions for folder SDK functions
// These will be replaced when the SDK is regenerated from the OpenAPI spec

import type { AlbumUserRole } from '@immich/sdk';

export interface FolderAlbumResponseDto {
  id: string;
  albumName: string;
  description: string;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
  albumThumbnailAssetId?: string | null;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface FolderResponseDto {
  id: string;
  ownerId: string;
  folderName: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  folderThumbnailAssetId: string | null;
  deletedAt: string | null;
  isActivityEnabled: boolean;
  order: string;
  updateId: string;
  assetCount: number;
  albumCount: number;
  shared: boolean;
  hasSharedLink?: boolean;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
  folderUsers?: Array<{
    user: {
      id: string;
      name: string;
      email: string;
    };
    role: AlbumUserRole;
  }>;
  albums?: FolderAlbumResponseDto[];
  startDate?: string;
  endDate?: string;
  parentId?: string | null;
  subfolderCount?: number;
}

export interface CreateFolderDto {
  folderName: string;
  description?: string;
  folderUsers?: Array<{
    userId: string;
    role: AlbumUserRole;
  }>;
  assetIds?: string[];
  parentId?: string;
}

export interface UpdateFolderDto {
  folderName?: string;
  description?: string;
  folderThumbnailAssetId?: string;
  isActivityEnabled?: boolean;
  order?: string;
  parentId?: string | null;
}

export interface FolderUserAddDto {
  userId: string;
  role?: AlbumUserRole;
}

export interface AddFolderUsersDto {
  folderUsers: FolderUserAddDto[];
}

export interface GetFoldersDto {
  shared?: boolean;
  assetId?: string;
  parentId?: string | null;
}

export interface BulkIdResponseDto {
  id: string;
  success: boolean;
  error?: string;
}

// Temporary function declarations
declare module '@immich/sdk' {
  export function getAllFolders(params?: GetFoldersDto): Promise<FolderResponseDto[]>;
  export function getFolderInfo(params: { id: string }): Promise<FolderResponseDto>;
  export function createFolder(params: { createFolderDto: CreateFolderDto }): Promise<FolderResponseDto>;
  export function updateFolderInfo(params: { id: string; updateFolderDto: UpdateFolderDto }): Promise<FolderResponseDto>;
  export function deleteFolder(params: { id: string }): Promise<void>;
  export function addUsersToFolder(params: { id: string; addFolderUsersDto: AddFolderUsersDto }): Promise<FolderResponseDto>;
  export function removeUserFromFolder(params: { id: string; userId: string }): Promise<void>;
  export function updateFolderUser(params: { id: string; userId: string; updateFolderUserDto: { role: AlbumUserRole } }): Promise<FolderResponseDto>;
  export function getFolderStatistics(params: { id: string }): Promise<any>;
  export function addAssetsToFolder(params: { id: string; assetIds: string[] }): Promise<BulkIdResponseDto[]>;
  export function removeAssetsFromFolder(params: { id: string; assetIds: string[] }): Promise<BulkIdResponseDto[]>;
  export function downloadFolderArchive(params: { id: string }): Promise<Blob>;
  export function getSubfolders(params: { id: string }): Promise<FolderResponseDto[]>;
  export function getFolderAncestors(params: { id: string }): Promise<FolderResponseDto[]>;
  
  // Extend getAllSharedLinks to support folderId (will be added when SDK is regenerated)
  // For now, using @ts-expect-error in FolderShareModal
  
  export type { FolderResponseDto, CreateFolderDto, UpdateFolderDto, FolderUserAddDto, AddFolderUsersDto, BulkIdResponseDto };
}
