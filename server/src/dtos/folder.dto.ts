import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsString, ValidateNested } from 'class-validator';
import _ from 'lodash';
import { FolderUser, AuthSharedLink, User } from 'src/database';
import { BulkIdErrorReason } from 'src/dtos/asset-ids.response.dto';
import { AssetResponseDto, MapAsset, mapAsset } from 'src/dtos/asset-response.dto';
import { AuthDto } from 'src/dtos/auth.dto';
import { UserResponseDto, mapUser } from 'src/dtos/user.dto';
import { AlbumUserRole, AssetOrder } from 'src/enum';
import { Optional, ValidateBoolean, ValidateEnum, ValidateUUID } from 'src/validation';

export class FolderInfoDto {
  @ValidateBoolean({ optional: true })
  withoutAssets?: boolean;
}

export class FolderUserAddDto {
  @ValidateUUID()
  userId!: string;

  @ValidateEnum({ enum: AlbumUserRole, name: 'AlbumUserRole', default: AlbumUserRole.Editor })
  role?: AlbumUserRole;
}

export class AddFolderUsersDto {
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => FolderUserAddDto)
  folderUsers!: FolderUserAddDto[];
}

export class FolderUserCreateDto {
  @ValidateUUID()
  userId!: string;

  @ValidateEnum({ enum: AlbumUserRole, name: 'AlbumUserRole' })
  role!: AlbumUserRole;
}

export class CreateFolderDto {
  @IsString()
  @ApiProperty()
  folderName!: string;

  @IsString()
  @Optional()
  description?: string;

  @Optional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FolderUserCreateDto)
  folderUsers?: FolderUserCreateDto[];

  @ValidateUUID({ optional: true, each: true })
  assetIds?: string[];

  @ValidateUUID({ optional: true })
  parentId?: string;
}

export class FoldersAddAssetsDto {
  @ValidateUUID({ each: true })
  folderIds!: string[];

  @ValidateUUID({ each: true })
  assetIds!: string[];
}

export class FoldersAddAssetsResponseDto {
  success!: boolean;
  @ValidateEnum({ enum: BulkIdErrorReason, name: 'BulkIdErrorReason', optional: true })
  error?: BulkIdErrorReason;
}

export class UpdateFolderDto {
  @Optional()
  @IsString()
  folderName?: string;

  @Optional()
  @IsString()
  description?: string;

  @ValidateUUID({ optional: true })
  folderThumbnailAssetId?: string;

  @ValidateBoolean({ optional: true })
  isActivityEnabled?: boolean;

  @ValidateEnum({ enum: AssetOrder, name: 'AssetOrder', optional: true })
  order?: AssetOrder;

  @ValidateUUID({ optional: true })
  parentId?: string | null;
}

export class GetFoldersDto {
  @ValidateBoolean({ optional: true })
  /**
   * true: only shared folders
   * false: only non-shared own folders
   * undefined: shared and owned folders
   */
  shared?: boolean;

  /**
   * Only returns folders that contain the asset
   * Ignores the shared parameter
   * undefined: get all folders
   */
  @ValidateUUID({ optional: true })
  assetId?: string;

  /**
   * Filter by parent folder ID
   * null: only root folders (no parent)
   * undefined: all folders regardless of parent
   * uuid: only direct children of the specified folder
   */
  @ValidateUUID({ optional: true })
  parentId?: string | null;
}

export class FolderStatisticsResponseDto {
  @ApiProperty({ type: 'integer' })
  owned!: number;

  @ApiProperty({ type: 'integer' })
  shared!: number;

  @ApiProperty({ type: 'integer' })
  notShared!: number;
}

export class UpdateFolderUserDto {
  @ValidateEnum({ enum: AlbumUserRole, name: 'AlbumUserRole' })
  role!: AlbumUserRole;
}

export class FolderUserResponseDto {
  user!: UserResponseDto;
  @ValidateEnum({ enum: AlbumUserRole, name: 'AlbumUserRole' })
  role!: AlbumUserRole;
}

export class ContributorCountResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ type: 'integer' })
  assetCount!: number;
}

export class FolderResponseDto {
  id!: string;
  ownerId!: string;
  folderName!: string;
  description!: string;
  createdAt!: Date;
  updatedAt!: Date;
  folderThumbnailAssetId!: string | null;
  shared!: boolean;
  folderUsers!: FolderUserResponseDto[];
  hasSharedLink!: boolean;
  assets!: AssetResponseDto[];
  owner!: UserResponseDto;
  @ApiProperty({ type: 'integer' })
  assetCount!: number;
  lastModifiedAssetTimestamp?: Date;
  startDate?: Date;
  endDate?: Date;
  isActivityEnabled!: boolean;
  @ValidateEnum({ enum: AssetOrder, name: 'AssetOrder', optional: true })
  order?: AssetOrder;
  parentId?: string | null;
  @ApiProperty({ type: 'integer' })
  subfolderCount?: number;

  // Optional per-user contribution counts for shared folders
  @Type(() => ContributorCountResponseDto)
  @ApiProperty({ type: [ContributorCountResponseDto], required: false })
  contributorCounts?: ContributorCountResponseDto[];
}

export type MapFolderDto = {
  folderUsers?: FolderUser[];
  assets?: MapAsset[];
  sharedLinks?: AuthSharedLink[];
  folderName: string;
  description: string;
  folderThumbnailAssetId: string | null;
  createdAt: Date;
  updatedAt: Date;
  id: string;
  ownerId: string;
  owner: User;
  isActivityEnabled: boolean;
  order: AssetOrder;
  parentId?: string | null;
  subfolderCount?: number;
};

export const mapFolder = (entity: MapFolderDto, withAssets: boolean, auth?: AuthDto): FolderResponseDto => {
  const folderUsers: FolderUserResponseDto[] = [];

  if (entity.folderUsers) {
    for (const folderUser of entity.folderUsers) {
      const user = mapUser(folderUser.user);
      folderUsers.push({
        user,
        role: folderUser.role,
      });
    }
  }

  const folderUsersSorted = _.orderBy(folderUsers, ['role', 'user.name']);

  const assets = entity.assets || [];

  const hasSharedLink = !!entity.sharedLinks && entity.sharedLinks.length > 0;
  const hasSharedUser = folderUsers.length > 0;

  let startDate = assets.at(0)?.localDateTime;
  let endDate = assets.at(-1)?.localDateTime;
  // Swap dates if start date is greater than end date.
  if (startDate && endDate && startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  return {
    folderName: entity.folderName,
    description: entity.description,
    folderThumbnailAssetId: entity.folderThumbnailAssetId,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    id: entity.id,
    ownerId: entity.ownerId,
    owner: mapUser(entity.owner),
    folderUsers: folderUsersSorted,
    shared: hasSharedUser || hasSharedLink,
    hasSharedLink,
    startDate,
    endDate,
    assets: (withAssets ? assets : []).map((asset) => mapAsset(asset, { auth })),
    assetCount: entity.assets?.length || 0,
    isActivityEnabled: entity.isActivityEnabled,
    order: entity.order,
    parentId: entity.parentId ?? null,
    subfolderCount: entity.subfolderCount ?? 0,
  };
};

export const mapFolderWithAssets = (entity: MapFolderDto) => mapFolder(entity, true);
export const mapFolderWithoutAssets = (entity: MapFolderDto) => mapFolder(entity, false);
