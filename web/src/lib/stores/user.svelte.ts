import { eventManager } from '$lib/managers/event-manager.svelte';
// @ts-expect-error - Folder SDK functions will be available after SDK regeneration
import type {
  AlbumResponseDto,
  FolderResponseDto,
  ServerAboutResponseDto,
  ServerStorageResponseDto,
  ServerVersionHistoryResponseDto,
} from '@immich/sdk';

interface UserInteractions {
  recentAlbums?: AlbumResponseDto[];
  recentFolders?: FolderResponseDto[];
  versions?: ServerVersionHistoryResponseDto[];
  aboutInfo?: ServerAboutResponseDto;
  serverInfo?: ServerStorageResponseDto;
}

const defaultUserInteraction: UserInteractions = {
  recentAlbums: undefined,
  recentFolders: undefined,
  versions: undefined,
  aboutInfo: undefined,
  serverInfo: undefined,
};

export const userInteraction = $state<UserInteractions>(defaultUserInteraction);

const reset = () => {
  Object.assign(userInteraction, defaultUserInteraction);
};

eventManager.on('AuthLogout', () => reset());
