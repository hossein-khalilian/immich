import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Endpoint, HistoryBuilder } from 'src/decorators';
import {
  AddFolderUsersDto,
  FolderInfoDto,
  FolderResponseDto,
  FoldersAddAlbumsDto,
  FoldersAddAlbumsResponseDto,
  FolderStatisticsResponseDto,
  CreateFolderDto,
  GetFoldersDto,
  UpdateFolderDto,
  UpdateFolderUserDto,
} from 'src/dtos/folder.dto';
import { BulkIdResponseDto, BulkIdsDto } from 'src/dtos/asset-ids.response.dto';
import { AuthDto } from 'src/dtos/auth.dto';
import { ApiTag, Permission } from 'src/enum';
import { Auth, Authenticated } from 'src/middleware/auth.guard';
import { FolderService } from 'src/services/folder.service';
import { ParseMeUUIDPipe, UUIDParamDto } from 'src/validation';

@ApiTags(ApiTag.Folders)
@Controller('folders')
export class FolderController {
  constructor(private service: FolderService) {}

  @Get()
  @Authenticated({ permission: Permission.FolderRead })
  @Endpoint({
    summary: 'List all folders',
    description: 'Retrieve a list of folders available to the authenticated user.',
    history: new HistoryBuilder().added('v1').beta('v1').stable('v2'),
  })
  getAllFolders(@Auth() auth: AuthDto, @Query() query: GetFoldersDto): Promise<FolderResponseDto[]> {
    return this.service.getAll(auth, query);
  }

  @Post()
  @Authenticated({ permission: Permission.FolderCreate })
  @Endpoint({
    summary: 'Create a folder',
    description: 'Create a new folder. The folder can also be created with initial users and albums.',
    history: new HistoryBuilder().added('v1').beta('v1').stable('v2'),
  })
  createFolder(@Auth() auth: AuthDto, @Body() dto: CreateFolderDto): Promise<FolderResponseDto> {
    return this.service.create(auth, dto);
  }

  @Get('statistics')
  @Authenticated({ permission: Permission.FolderStatistics })
  @Endpoint({
    summary: 'Retrieve folder statistics',
    description: 'Returns statistics about the folders available to the authenticated user.',
    history: new HistoryBuilder().added('v1').beta('v1').stable('v2'),
  })
  getFolderStatistics(@Auth() auth: AuthDto): Promise<FolderStatisticsResponseDto> {
    return this.service.getStatistics(auth);
  }

  @Authenticated({ permission: Permission.FolderRead, sharedLink: true })
  @Get(':id')
  @Endpoint({
    summary: 'Retrieve a folder',
    description: 'Retrieve information about a specific folder by its ID.',
    history: new HistoryBuilder().added('v1').beta('v1').stable('v2'),
  })
  getFolderInfo(
    @Auth() auth: AuthDto,
    @Param() { id }: UUIDParamDto,
    @Query() dto: FolderInfoDto,
  ): Promise<FolderResponseDto> {
    return this.service.get(auth, id, dto);
  }

  @Authenticated({ permission: Permission.FolderRead })
  @Get(':id/subfolders')
  @Endpoint({
    summary: 'Get subfolders',
    description: 'Retrieve direct subfolders of a specific folder by its ID.',
    history: new HistoryBuilder().added('v1').beta('v1').stable('v2'),
  })
  getSubfolders(@Auth() auth: AuthDto, @Param() { id }: UUIDParamDto): Promise<FolderResponseDto[]> {
    return this.service.getSubfolders(auth, id);
  }

  @Authenticated({ permission: Permission.FolderRead })
  @Get(':id/ancestors')
  @Endpoint({
    summary: 'Get folder ancestors',
    description: 'Retrieve the ancestor folders (path from root to folder) for breadcrumb navigation.',
    history: new HistoryBuilder().added('v1').beta('v1').stable('v2'),
  })
  getAncestors(@Auth() auth: AuthDto, @Param() { id }: UUIDParamDto): Promise<FolderResponseDto[]> {
    return this.service.getAncestors(auth, id);
  }

  @Patch(':id')
  @Authenticated({ permission: Permission.FolderUpdate })
  @Endpoint({
    summary: 'Update a folder',
    description:
      'Update the information of a specific folder by its ID. This endpoint can be used to update the folder name, description, sort order, etc. However, it is not used to add or remove albums or users from the folder.',
    history: new HistoryBuilder().added('v1').beta('v1').stable('v2'),
  })
  updateFolderInfo(
    @Auth() auth: AuthDto,
    @Param() { id }: UUIDParamDto,
    @Body() dto: UpdateFolderDto,
  ): Promise<FolderResponseDto> {
    return this.service.update(auth, id, dto);
  }

  @Delete(':id')
  @Authenticated({ permission: Permission.FolderDelete })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Endpoint({
    summary: 'Delete a folder',
    description:
      'Delete a specific folder by its ID. Note: This only deletes the folder structure, not the albums or photos within.',
    history: new HistoryBuilder().added('v1').beta('v1').stable('v2'),
  })
  deleteFolder(@Auth() auth: AuthDto, @Param() { id }: UUIDParamDto) {
    return this.service.delete(auth, id);
  }

  @Put(':id/albums')
  @Authenticated({ permission: Permission.FolderUpdate, sharedLink: true })
  @Endpoint({
    summary: 'Add albums to a folder',
    description: 'Add multiple albums to a specific folder by its ID.',
    history: new HistoryBuilder().added('v1').beta('v1').stable('v2'),
  })
  addAlbumsToFolder(
    @Auth() auth: AuthDto,
    @Param() { id }: UUIDParamDto,
    @Body() dto: BulkIdsDto,
  ): Promise<BulkIdResponseDto[]> {
    return this.service.addAlbums(auth, id, dto);
  }

  @Put('albums')
  @Authenticated({ permission: Permission.FolderUpdate, sharedLink: true })
  @Endpoint({
    summary: 'Add albums to folders',
    description: 'Send a list of album IDs and folder IDs to add each album to each folder.',
    history: new HistoryBuilder().added('v1').beta('v1').stable('v2'),
  })
  addAlbumsToFolders(@Auth() auth: AuthDto, @Body() dto: FoldersAddAlbumsDto): Promise<FoldersAddAlbumsResponseDto> {
    return this.service.addAlbumsToFolders(auth, dto);
  }

  @Delete(':id/albums')
  @Authenticated({ permission: Permission.FolderUpdate })
  @Endpoint({
    summary: 'Remove albums from a folder',
    description: 'Remove multiple albums from a specific folder by its ID.',
    history: new HistoryBuilder().added('v1').beta('v1').stable('v2'),
  })
  removeAlbumFromFolder(
    @Auth() auth: AuthDto,
    @Body() dto: BulkIdsDto,
    @Param() { id }: UUIDParamDto,
  ): Promise<BulkIdResponseDto[]> {
    return this.service.removeAlbums(auth, id, dto);
  }

  @Put(':id/users')
  @Authenticated({ permission: Permission.FolderUserCreate })
  @Endpoint({
    summary: 'Share folder with users',
    description: 'Share a folder with multiple users. Each user can be given a specific role in the folder.',
    history: new HistoryBuilder().added('v1').beta('v1').stable('v2'),
  })
  addUsersToFolder(
    @Auth() auth: AuthDto,
    @Param() { id }: UUIDParamDto,
    @Body() dto: AddFolderUsersDto,
  ): Promise<FolderResponseDto> {
    return this.service.addUsers(auth, id, dto);
  }

  @Put(':id/user/:userId')
  @Authenticated({ permission: Permission.FolderUserUpdate })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Endpoint({
    summary: 'Update user role',
    description: 'Change the role for a specific user in a specific folder.',
    history: new HistoryBuilder().added('v1').beta('v1').stable('v2'),
  })
  updateFolderUser(
    @Auth() auth: AuthDto,
    @Param() { id }: UUIDParamDto,
    @Param('userId', new ParseMeUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: UpdateFolderUserDto,
  ): Promise<void> {
    return this.service.updateUser(auth, id, userId, dto);
  }

  @Delete(':id/user/:userId')
  @Authenticated({ permission: Permission.FolderUserDelete })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Endpoint({
    summary: 'Remove user from folder',
    description: 'Remove a user from a folder. Use an ID of "me" to leave a shared folder.',
    history: new HistoryBuilder().added('v1').beta('v1').stable('v2'),
  })
  removeUserFromFolder(
    @Auth() auth: AuthDto,
    @Param() { id }: UUIDParamDto,
    @Param('userId', new ParseMeUUIDPipe({ version: '4' })) userId: string,
  ): Promise<void> {
    return this.service.removeUser(auth, id, userId);
  }
}
