// Temporary API wrapper functions for folders
// These will be replaced when the SDK is regenerated from the OpenAPI spec

import { authManager } from '$lib/managers/auth-manager.svelte';
import { getBaseUrl } from '@immich/sdk';
import type { FolderResponseDto, CreateFolderDto, UpdateFolderDto, AddFolderUsersDto } from '$lib/types/folder-sdk';

const buildQueryString = (params: Record<string, string | boolean | undefined>) => {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  }
  return searchParams.toString();
};

export const getAllFolders = async (params?: { shared?: boolean; assetId?: string; parentId?: string | null }, fetchFn: typeof fetch = fetch): Promise<FolderResponseDto[]> => {
  const allParams = { ...authManager.params, ...(params || {}) };
  const queryString = buildQueryString(allParams);
  const url = `${getBaseUrl()}/folders${queryString ? `?${queryString}` : ''}`;
  const response = await fetchFn(url, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch folders: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
};

export const getFolderInfo = async (id: string): Promise<FolderResponseDto> => {
  const queryString = buildQueryString(authManager.params);
  const url = `${getBaseUrl()}/folders/${id}${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch folder: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
};

export const createFolder = async (createFolderDto: CreateFolderDto): Promise<FolderResponseDto> => {
  const queryString = buildQueryString(authManager.params);
  const url = `${getBaseUrl()}/folders${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(createFolderDto),
  });
  if (!response.ok) {
    throw new Error(`Failed to create folder: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
};

export const updateFolderInfo = async (id: string, updateFolderDto: UpdateFolderDto): Promise<FolderResponseDto> => {
  const queryString = buildQueryString(authManager.params);
  const url = `${getBaseUrl()}/folders/${id}${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(updateFolderDto),
  });
  if (!response.ok) {
    throw new Error(`Failed to update folder: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
};

export const deleteFolder = async (id: string): Promise<void> => {
  const queryString = buildQueryString(authManager.params);
  const url = `${getBaseUrl()}/folders/${id}${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete folder: ${response.statusText}`);
  }
};

export const addUsersToFolder = async (id: string, addFolderUsersDto: AddFolderUsersDto): Promise<FolderResponseDto> => {
  const queryString = buildQueryString(authManager.params);
  const url = `${getBaseUrl()}/folders/${id}/users${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(addFolderUsersDto),
  });
  if (!response.ok) {
    throw new Error(`Failed to add users to folder: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
};

export const removeUserFromFolder = async (id: string, userId: string): Promise<void> => {
  const queryString = buildQueryString(authManager.params);
  const url = `${getBaseUrl()}/folders/${id}/user/${userId}${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to remove user from folder: ${response.statusText}`);
  }
};

export const addAssetsToFolder = async (id: string, assetIds: string[]): Promise<any> => {
  const queryString = buildQueryString(authManager.params);
  const url = `${getBaseUrl()}/folders/${id}/assets${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ids: assetIds }),
  });
  if (!response.ok) {
    throw new Error(`Failed to add assets to folder: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
};

export const removeAssetFromFolder = async (id: string, assetIds: string[]): Promise<any> => {
  const queryString = buildQueryString(authManager.params);
  const url = `${getBaseUrl()}/folders/${id}/assets${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ids: assetIds }),
  });
  if (!response.ok) {
    throw new Error(`Failed to remove assets from folder: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
};

export const addAlbumsToFolder = async (id: string, albumIds: string[]): Promise<any> => {
  const queryString = buildQueryString(authManager.params);
  const url = `${getBaseUrl()}/folders/${id}/albums${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ids: albumIds }),
  });
  if (!response.ok) {
    throw new Error(`Failed to add albums to folder: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
};

export const removeAlbumsFromFolder = async (id: string, albumIds: string[]): Promise<any> => {
  const queryString = buildQueryString(authManager.params);
  const url = `${getBaseUrl()}/folders/${id}/albums${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ids: albumIds }),
  });
  if (!response.ok) {
    throw new Error(`Failed to remove albums from folder: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
};

export const getSubfolders = async (id: string): Promise<FolderResponseDto[]> => {
  const queryString = buildQueryString(authManager.params);
  const url = `${getBaseUrl()}/folders/${id}/subfolders${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch subfolders: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
};

export const getFolderAncestors = async (id: string): Promise<FolderResponseDto[]> => {
  const queryString = buildQueryString(authManager.params);
  const url = `${getBaseUrl()}/folders/${id}/ancestors${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch folder ancestors: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
};
