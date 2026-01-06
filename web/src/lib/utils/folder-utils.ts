import { goto } from '$app/navigation';
import { AppRoute } from '$lib/constants';
import {
  FolderFilter,
  FolderGroupBy,
  FolderSortBy,
  SortOrder,
  folderViewSettings,
  locale,
  type FolderViewSettings,
} from '$lib/stores/preferences.store';
import { handleError } from '$lib/utils/handle-error';
import type { FolderResponseDto } from '$lib/types/folder-sdk';
import { createFolder as createFolderApi } from '$lib/utils/folder-api';
import { orderBy } from 'lodash-es';
import { t } from 'svelte-i18n';
import { get } from 'svelte/store';

/**
 * -------------------------
 * Folders General Management
 * -------------------------
 */
export const createFolder = async (name?: string, assetIds?: string[], parentId?: string) => {
  try {
    const newFolder: FolderResponseDto = await createFolderApi({
      folderName: name ?? '',
      assetIds,
      parentId,
    });
    return newFolder;
  } catch (error) {
    const $t = get(t);
    handleError(error, $t('errors.failed_to_create_folder'));
  }
};

export const createFolderAndRedirect = async (name?: string, assetIds?: string[], parentId?: string) => {
  const newFolder = await createFolder(name, assetIds, parentId);
  if (newFolder) {
    await goto(`${AppRoute.FOLDERS}/${newFolder.id}`);
  }
};

export const createSubfolder = async (parentId: string, name?: string) => {
  return createFolder(name, [], parentId);
};

export const createSubfolderAndRedirect = async (parentId: string, name?: string) => {
  const newFolder = await createSubfolder(parentId, name);
  if (newFolder) {
    await goto(`${AppRoute.FOLDERS}/${newFolder.id}`);
  }
};

/**
 * -------------
 * Folder Sorting
 * -------------
 */
export interface FolderSortOptionMetadata {
  id: FolderSortBy;
  defaultOrder: SortOrder;
  columnStyle: string;
}

export const sortOptionsMetadata: FolderSortOptionMetadata[] = [
  {
    id: FolderSortBy.Title,
    defaultOrder: SortOrder.Asc,
    columnStyle: 'text-start w-8/12 sm:w-4/12 md:w-4/12 xl:w-[30%] 2xl:w-[40%]',
  },
  {
    id: FolderSortBy.ItemCount,
    defaultOrder: SortOrder.Desc,
    columnStyle: 'text-center w-4/12 m:w-2/12 md:w-2/12 xl:w-[15%] 2xl:w-[12%]',
  },
  {
    id: FolderSortBy.DateModified,
    defaultOrder: SortOrder.Desc,
    columnStyle: 'text-center hidden sm:block w-3/12 xl:w-[15%] 2xl:w-[12%]',
  },
  {
    id: FolderSortBy.DateCreated,
    defaultOrder: SortOrder.Desc,
    columnStyle: 'text-center hidden sm:block w-3/12 xl:w-[15%] 2xl:w-[12%]',
  },
  {
    id: FolderSortBy.MostRecentPhoto,
    defaultOrder: SortOrder.Desc,
    columnStyle: 'text-center hidden xl:block xl:w-[15%] 2xl:w-[12%]',
  },
  {
    id: FolderSortBy.OldestPhoto,
    defaultOrder: SortOrder.Desc,
    columnStyle: 'text-center hidden xl:block xl:w-[15%] 2xl:w-[12%]',
  },
];

export const findSortOptionMetadata = (sortBy: string) => {
  // Default is sort by most recent photo
  const defaultSortOption = sortOptionsMetadata[4];
  return sortOptionsMetadata.find(({ id }) => sortBy === id) ?? defaultSortOption;
};

export const findFilterOption = (filter: string) => {
  // Default is All filter
  const defaultFilterOption = FolderFilter.All;
  return Object.values(FolderFilter).find((key) => filter === FolderFilter[key]) ?? defaultFilterOption;
};

/**
 * --------------
 * Folder Grouping
 * --------------
 */
export interface FolderGroup {
  id: string;
  name: string;
  folders: FolderResponseDto[];
}

export interface FolderGroupOptionMetadata {
  id: FolderGroupBy;
  defaultOrder: SortOrder;
  isDisabled: () => boolean;
}

export const groupOptionsMetadata: FolderGroupOptionMetadata[] = [
  {
    id: FolderGroupBy.None,
    defaultOrder: SortOrder.Asc,
    isDisabled: () => false,
  },
  {
    id: FolderGroupBy.Year,
    defaultOrder: SortOrder.Desc,
    isDisabled() {
      const disabledWithSortOptions: string[] = [FolderSortBy.DateCreated, FolderSortBy.DateModified];
      return disabledWithSortOptions.includes(get(folderViewSettings).sortBy);
    },
  },
  {
    id: FolderGroupBy.Owner,
    defaultOrder: SortOrder.Asc,
    isDisabled: () => false,
  },
];

export const findGroupOptionMetadata = (groupBy: string) => {
  // Default is no grouping
  const defaultGroupOption = groupOptionsMetadata[0];
  return groupOptionsMetadata.find(({ id }) => groupBy === id) ?? defaultGroupOption;
};

export const getSelectedFolderGroupOption = (settings: FolderViewSettings) => {
  const defaultGroupOption = FolderGroupBy.None;
  const folderGroupOption = settings.groupBy ?? defaultGroupOption;

  if (findGroupOptionMetadata(folderGroupOption).isDisabled()) {
    return defaultGroupOption;
  }
  return folderGroupOption;
};

/**
 * ----------------------------
 * Folder Groups Collapse/Expand
 * ----------------------------
 */
const getCollapsedFolderGroups = (settings: FolderViewSettings) => {
  settings.collapsedGroups ??= {};
  const { collapsedGroups, groupBy } = settings;
  collapsedGroups[groupBy] ??= [];
  return collapsedGroups[groupBy];
};

export const isFolderGroupCollapsed = (settings: FolderViewSettings, groupId: string) => {
  if (settings.groupBy === FolderGroupBy.None) {
    return false;
  }
  return getCollapsedFolderGroups(settings).includes(groupId);
};

export const toggleFolderGroupCollapsing = (groupId: string) => {
  const settings = get(folderViewSettings);
  if (settings.groupBy === FolderGroupBy.None) {
    return;
  }
  const collapsedGroups = getCollapsedFolderGroups(settings);
  const groupIndex = collapsedGroups.indexOf(groupId);
  if (groupIndex === -1) {
    // Collapse
    collapsedGroups.push(groupId);
  } else {
    // Expand
    collapsedGroups.splice(groupIndex, 1);
  }
  folderViewSettings.set(settings);
};

export const collapseAllFolderGroups = (groupIds: string[]) => {
  folderViewSettings.update((settings) => {
    const collapsedGroups = getCollapsedFolderGroups(settings);
    collapsedGroups.length = 0;
    collapsedGroups.push(...groupIds);
    return settings;
  });
};

export const expandAllFolderGroups = () => {
  collapseAllFolderGroups([]);
};

interface FolderSortOption {
  [option: string]: (order: SortOrder, folders: FolderResponseDto[]) => FolderResponseDto[];
}

const sortUnknownYearFolders = (a: FolderResponseDto, b: FolderResponseDto) => {
  if (!a.endDate) {
    return 1;
  }
  if (!b.endDate) {
    return -1;
  }
  return 0;
};

export const stringToSortOrder = (order: string) => {
  return order === 'desc' ? SortOrder.Desc : SortOrder.Asc;
};

const sortOptions: FolderSortOption = {
  /** Sort by folder title */
  [FolderSortBy.Title]: (order, folders) => {
    const sortSign = order === SortOrder.Desc ? -1 : 1;
    return folders.slice().sort((a, b) => a.folderName.localeCompare(b.folderName, get(locale)) * sortSign);
  },

  /** Sort by asset count */
  [FolderSortBy.ItemCount]: (order, folders) => {
    return orderBy(folders, 'assetCount', [order]);
  },

  /** Sort by last modified */
  [FolderSortBy.DateModified]: (order, folders) => {
    return orderBy(folders, [({ updatedAt }) => new Date(updatedAt)], [order]);
  },

  /** Sort by creation date */
  [FolderSortBy.DateCreated]: (order, folders) => {
    return orderBy(folders, [({ createdAt }) => new Date(createdAt)], [order]);
  },

  /** Sort by the most recent photo date */
  [FolderSortBy.MostRecentPhoto]: (order, folders) => {
    folders = orderBy(folders, [({ endDate }) => (endDate ? new Date(endDate) : '')], [order]);
    return folders.sort(sortUnknownYearFolders);
  },

  /** Sort by the oldest photo date */
  [FolderSortBy.OldestPhoto]: (order, folders) => {
    folders = orderBy(folders, [({ startDate }) => (startDate ? new Date(startDate) : '')], [order]);
    return folders.sort(sortUnknownYearFolders);
  },
};

export const sortFolders = (folders: FolderResponseDto[], { sortBy, orderBy }: { sortBy: string; orderBy: string }) => {
  const sort = sortOptions[sortBy] ?? sortOptions[FolderSortBy.DateModified];
  const order = stringToSortOrder(orderBy);

  return sort(order, folders);
};
