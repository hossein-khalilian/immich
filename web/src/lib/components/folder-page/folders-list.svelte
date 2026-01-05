<script lang="ts">
  // Note: This component requires SDK functions: getAllFolders, addUsersToFolder, etc.
  // The SDK needs to be regenerated from the OpenAPI spec to include folder endpoints.
  
  import FolderCardGroup from '$lib/components/folder-page/folder-card-group.svelte';
  import FoldersTable from '$lib/components/folder-page/folders-table.svelte';
  import OnEvents from '$lib/components/OnEvents.svelte';
  import MenuOption from '$lib/components/shared-components/context-menu/menu-option.svelte';
  import RightClickContextMenu from '$lib/components/shared-components/context-menu/right-click-context-menu.svelte';
  import FolderEditModal from '$lib/modals/FolderEditModal.svelte';
  import FolderShareModal from '$lib/modals/FolderShareModal.svelte';
  import SharedLinkCreateModal from '$lib/modals/SharedLinkCreateModal.svelte';
  import { handleDeleteFolder, handleDownloadFolder } from '$lib/services/folder.service';
  import {
    FolderFilter,
    FolderGroupBy,
    FolderSortBy,
    FolderViewMode,
    SortOrder,
    locale,
    lang,
    type FolderViewSettings,
  } from '$lib/stores/preferences.store';
  import { user } from '$lib/stores/user.store';
  import { userInteraction } from '$lib/stores/user.svelte';
  import { getSelectedFolderGroupOption, sortFolders, stringToSortOrder, type FolderGroup } from '$lib/utils/folder-utils';
  import type { ContextMenuPosition } from '$lib/utils/context-menu';
  import { handleError } from '$lib/utils/handle-error';
  import { normalizeSearchString } from '$lib/utils/string-utils';
  import { addUsersToFolder } from '$lib/utils/folder-api';
  import type { FolderResponseDto, FolderUserAddDto } from '$lib/types/folder-sdk';
  import { modalManager } from '@immich/ui';
  import { mdiDeleteOutline, mdiDownload, mdiRenameOutline, mdiShareVariantOutline } from '@mdi/js';
  import { groupBy } from 'lodash-es';
  import { onMount, type Snippet } from 'svelte';
  import { t } from 'svelte-i18n';
  import { get } from 'svelte/store';

  interface Props {
    ownedFolders?: FolderResponseDto[];
    sharedFolders?: FolderResponseDto[];
    searchQuery?: string;
    userSettings: FolderViewSettings;
    allowEdit?: boolean;
    showOwner?: boolean;
    folderGroupIds?: string[];
    empty?: Snippet;
  }

  let {
    ownedFolders = $bindable([]),
    sharedFolders = $bindable([]),
    searchQuery = '',
    userSettings,
    allowEdit = false,
    showOwner = false,
    folderGroupIds = $bindable([]),
    empty,
  }: Props = $props();

  interface FolderGroupOption {
    [option: string]: (order: SortOrder, folders: FolderResponseDto[]) => FolderGroup[];
  }

  const groupOptions: FolderGroupOption = {
    /** No grouping */
    [FolderGroupBy.None]: (order, folders): FolderGroup[] => {
      return [
        {
          id: $t('folders'),
          name: $t('folders'),
          folders,
        },
      ];
    },

    /** Group by year */
    [FolderGroupBy.Year]: (order, folders): FolderGroup[] => {
      const unknownYear = $t('unknown_year');
      const useStartDate = userSettings.sortBy === FolderSortBy.OldestPhoto;
      const currentLang = get(lang);
      const isPersian = currentLang === 'fa';

      const getPersianYearFromDate = (dateString: string): number | string => {
        try {
          const date = new Date(dateString);
          if (isNaN(date.getTime())) {
            return unknownYear;
          }
          
          if (isPersian) {
            const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
              year: 'numeric',
              calendar: 'persian'
            });
            const parts = formatter.formatToParts(date);
            const yearPart = parts.find(part => part.type === 'year');
            if (yearPart && yearPart.value) {
              const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
              const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
              let year = yearPart.value;
              for (let i = 0; i < 10; i++) {
                year = year.replace(new RegExp(persianDigits[i], 'g'), i.toString());
                year = year.replace(new RegExp(arabicDigits[i], 'g'), i.toString());
              }
              return parseInt(year, 10);
            }
          }
          
          return date.getFullYear();
        } catch {
          return unknownYear;
        }
      };

      const grouped = groupBy(folders, (folder) => {
        const date = useStartDate ? folder.startDate : folder.endDate;
        return date ? getPersianYearFromDate(date.toString()) : unknownYear;
      });

      return Object.entries(grouped)
        .sort(([a], [b]) => {
          if (a === unknownYear) return 1;
          if (b === unknownYear) return -1;
          return order === SortOrder.Desc ? Number(b) - Number(a) : Number(a) - Number(b);
        })
        .map(([year, folders]) => ({
          id: year,
          name: isPersian ? year : year,
          folders,
        }));
    },

    /** Group by owner */
    [FolderGroupBy.Owner]: (order, folders): FolderGroup[] => {
      const grouped = groupBy(folders, ({ owner }) => owner.name);
      return Object.entries(grouped)
        .sort(([a], [b]) => (order === SortOrder.Desc ? b.localeCompare(a) : a.localeCompare(b)))
        .map(([ownerName, folders]) => ({
          id: ownerName,
          name: ownerName,
          folders,
        }));
    },
  };

  let albums = $derived.by(() => {
    const filter = userSettings.filter;
    if (filter === FolderFilter.Owned) {
      return ownedFolders;
    }
    if (filter === FolderFilter.Shared) {
      return sharedFolders;
    }
    return [...ownedFolders, ...sharedFolders];
  });

  const normalizedSearchQuery = $derived(normalizeSearchString(searchQuery));
  let filteredFolders = $derived(
    normalizedSearchQuery
      ? albums.filter(({ folderName }) => normalizeSearchString(folderName).includes(normalizedSearchQuery))
      : albums,
  );

  let folderGroupOption = $derived(getSelectedFolderGroupOption(userSettings));
  let groupedFolders = $derived.by(() => {
    const groupFunc = groupOptions[folderGroupOption] ?? groupOptions[FolderGroupBy.None];
    const groupedFolders = groupFunc(stringToSortOrder(userSettings.groupOrder), filteredFolders);

    return groupedFolders.map((group) => ({
      id: group.id,
      name: group.name,
      folders: sortFolders(group.folders, { sortBy: userSettings.sortBy, orderBy: userSettings.sortOrder }),
    }));
  });

  let contextMenuPosition: ContextMenuPosition = $state({ x: 0, y: 0 });
  let selectedFolder: FolderResponseDto | undefined = $state();
  let isOpen = $state(false);

  $effect(() => {
    folderGroupIds = groupedFolders.map(({ id }) => id);
  });

  let showFullContextMenu = $derived(allowEdit && selectedFolder && selectedFolder.ownerId === $user.id);

  onMount(async () => {
    if (allowEdit) {
      await removeFoldersIfEmpty();
    }
  });

  const showFolderContextMenu = (contextMenuDetail: ContextMenuPosition, folder: FolderResponseDto) => {
    selectedFolder = folder;
    contextMenuPosition = {
      x: contextMenuDetail.x,
      y: contextMenuDetail.y,
    };
    isOpen = true;
  };

  const closeFolderContextMenu = () => {
    isOpen = false;
  };

  const handleSelect = async (action: 'edit' | 'share' | 'download' | 'delete') => {
    closeFolderContextMenu();

    if (!selectedFolder) {
      return;
    }

    switch (action) {
      case 'edit': {
        await modalManager.show(FolderEditModal, { folder: selectedFolder });
        break;
      }

      case 'share': {
        const result = await modalManager.show(FolderShareModal, { folder: selectedFolder });
        switch (result?.action) {
          case 'sharedUsers': {
            await handleAddUsers(selectedFolder, result.data);
            break;
          }

          case 'sharedLink': {
            const success = await modalManager.show(SharedLinkCreateModal, { folderId: selectedFolder.id });
            if (success) {
              selectedFolder.shared = true;
              selectedFolder.hasSharedLink = true;
              onUpdate(selectedFolder);
            }
            break;
          }
        }
        break;
      }

      case 'download': {
        await handleDownloadFolder(selectedFolder);
        break;
      }

      case 'delete': {
        await handleDeleteFolder(selectedFolder);
        break;
      }
    }
  };

  const removeFoldersIfEmpty = async () => {
    const foldersToRemove = ownedFolders.filter((folder) => folder.assetCount === 0 && !folder.folderName);
    await Promise.allSettled(foldersToRemove.map((folder) => handleDeleteFolder(folder, { prompt: false, notify: false })));
  };

  const findAndUpdate = (folders: FolderResponseDto[], folder: FolderResponseDto) => {
    const target = folders.find(({ id }) => id === folder.id);
    if (target) {
      Object.assign(target, folder);
    }

    return folders;
  };

  const onUpdate = (folder: FolderResponseDto) => {
    ownedFolders = findAndUpdate(ownedFolders, folder);
    sharedFolders = findAndUpdate(sharedFolders, folder);
  };

  const handleAddUsers = async (folder: FolderResponseDto, folderUsers: FolderUserAddDto[]) => {
    try {
      const updatedFolder = await addUsersToFolder(folder.id, { folderUsers });
      onUpdate(updatedFolder);
    } catch (error) {
      handleError(error, $t('errors.unable_to_add_folder_users'));
    }
  };

  const onFolderUpdate = (folder: FolderResponseDto) => {
    onUpdate(folder);
    userInteraction.recentFolders = findAndUpdate(userInteraction.recentFolders || [], folder);
  };

  const onFolderDelete = (folder: FolderResponseDto) => {
    ownedFolders = ownedFolders.filter(({ id }) => id !== folder.id);
    sharedFolders = sharedFolders.filter(({ id }) => id !== folder.id);
  };
</script>

<OnEvents {onFolderUpdate} {onFolderDelete} />

{#if albums.length > 0}
  {#if userSettings.view === FolderViewMode.Cover}
    <!-- Folder Cards -->
    {#if folderGroupOption === FolderGroupBy.None}
      <FolderCardGroup
        folders={groupedFolders[0].folders}
        {showOwner}
        showDateRange
        showItemCount
        onShowContextMenu={showFolderContextMenu}
      />
    {:else}
      {#each groupedFolders as folderGroup (folderGroup.id)}
        <FolderCardGroup
          folders={folderGroup.folders}
          group={folderGroup}
          {showOwner}
          showDateRange
          showItemCount
          onShowContextMenu={showFolderContextMenu}
        />
      {/each}
    {/if}
  {:else if userSettings.view === FolderViewMode.List}
    <!-- Folder Table -->
    <FoldersTable {groupedFolders} {folderGroupOption} onShowContextMenu={showFolderContextMenu} />
  {/if}
{:else}
  <!-- Empty Message -->
  {@render empty?.()}
{/if}

<!-- Context Menu -->
<RightClickContextMenu title={$t('folder_options')} {...contextMenuPosition} {isOpen} onClose={closeFolderContextMenu}>
  {#if showFullContextMenu}
    <MenuOption icon={mdiRenameOutline} text={$t('edit_folder')} onClick={() => handleSelect('edit')} />
    <MenuOption icon={mdiShareVariantOutline} text={$t('share')} onClick={() => handleSelect('share')} />
  {/if}
  <MenuOption icon={mdiDownload} text={$t('download')} onClick={() => handleSelect('download')} />
  {#if showFullContextMenu}
    <MenuOption icon={mdiDeleteOutline} text={$t('delete')} onClick={() => handleSelect('delete')} />
  {/if}
</RightClickContextMenu>
