<script lang="ts">
  import Dropdown from '$lib/elements/Dropdown.svelte';
  import GroupTab from '$lib/elements/GroupTab.svelte';
  import SearchBar from '$lib/elements/SearchBar.svelte';
  import {
    FolderFilter,
    FolderGroupBy,
    FolderSortBy,
    FolderViewMode,
    folderViewSettings,
    AlbumFilter,
    AlbumGroupBy,
    AlbumSortBy,
    AlbumViewMode,
    albumViewSettings,
    SortOrder,
  } from '$lib/stores/preferences.store';
  import {
    type FolderGroupOptionMetadata,
    type FolderSortOptionMetadata,
    collapseAllFolderGroups,
    expandAllFolderGroups,
    findFilterOption,
    findGroupOptionMetadata,
    findSortOptionMetadata,
    getSelectedFolderGroupOption,
    groupOptionsMetadata,
    sortOptionsMetadata,
  } from '$lib/utils/folder-utils';
  import {
    type AlbumGroupOptionMetadata,
    type AlbumSortOptionMetadata,
    collapseAllAlbumGroups,
    expandAllAlbumGroups,
    findFilterOption as findAlbumFilterOption,
    findGroupOptionMetadata as findAlbumGroupOptionMetadata,
    findSortOptionMetadata as findAlbumSortOptionMetadata,
    getSelectedAlbumGroupOption,
    groupOptionsMetadata as albumGroupOptionsMetadata,
    sortOptionsMetadata as albumSortOptionsMetadata,
  } from '$lib/utils/album-utils';
  import { invalidateAll } from '$app/navigation';
  import { Button, IconButton, Text, modalManager } from '@immich/ui';
  import FolderCreateModal from '$lib/modals/FolderCreateModal.svelte';
  import AlbumCreateModal from '$lib/modals/AlbumCreateModal.svelte';
  import ButtonContextMenu from '$lib/components/shared-components/context-menu/button-context-menu.svelte';
  import MenuOption from '$lib/components/shared-components/context-menu/menu-option.svelte';
  import {
    mdiArrowDownThin,
    mdiArrowUpThin,
    mdiFolderArrowDownOutline,
    mdiFolderArrowUpOutline,
    mdiFolderRemoveOutline,
    mdiFolderPlusOutline,
    mdiFormatListBulletedSquare,
    mdiImagePlusOutline,
    mdiPlusBoxOutline,
    mdiUnfoldLessHorizontal,
    mdiUnfoldMoreHorizontal,
    mdiViewGridOutline,
  } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import { fly } from 'svelte/transition';

  interface Props {
    folderGroups: string[];
    albumGroups: string[];
    searchQuery: string;
    currentFolderId?: string; // Current folder ID when viewing a folder
  }

  let { folderGroups, albumGroups, searchQuery = $bindable(), currentFolderId }: Props = $props();

  const flipOrdering = (ordering: string) => {
    return ordering === SortOrder.Asc ? SortOrder.Desc : SortOrder.Asc;
  };

  const handleChangeUnifiedFilter = (filter: string) => {
    // Map the filter string to the enum values
    const folderFilter = Object.keys(folderFilterNames).find(
      (key) => folderFilterNames[key as FolderFilter] === filter,
    ) as FolderFilter;
    const albumFilter = Object.keys(albumFilterNames).find(
      (key) => albumFilterNames[key as AlbumFilter] === filter,
    ) as AlbumFilter;

    if (folderFilter) {
      $folderViewSettings.filter = folderFilter;
    }
    if (albumFilter) {
      $albumViewSettings.filter = albumFilter;
    }
  };

  const handleChangeFolderFilter = (filter: string, defaultFilter: FolderFilter) => {
    $folderViewSettings.filter =
      Object.keys(folderFilterNames).find((key) => folderFilterNames[key as FolderFilter] === filter) ?? defaultFilter;
  };

  const handleChangeGroupBy = ({ id, defaultOrder }: FolderGroupOptionMetadata) => {
    if ($folderViewSettings.groupBy === id) {
      $folderViewSettings.groupOrder = flipOrdering($folderViewSettings.groupOrder);
    } else {
      $folderViewSettings.groupBy = id;
      $folderViewSettings.groupOrder = defaultOrder;
    }
  };

  const handleChangeUnifiedGroupBy = ({ id, defaultOrder }: FolderGroupOptionMetadata) => {
    // Update both folder and album group settings together
    const newOrder = $folderViewSettings.groupBy === id
      ? flipOrdering($folderViewSettings.groupOrder)
      : defaultOrder;
    
    $folderViewSettings.groupBy = id;
    $folderViewSettings.groupOrder = newOrder;
    
    // Map folder group to album group (they have the same enum values)
    $albumViewSettings.groupBy = id as AlbumGroupBy;
    $albumViewSettings.groupOrder = newOrder;
  };

  const handleExpandAllGroups = () => {
    expandAllFolderGroups();
    expandAllAlbumGroups();
  };

  const handleCollapseAllGroups = () => {
    collapseAllFolderGroups(folderGroups);
    collapseAllAlbumGroups(albumGroups);
  };

  const handleChangeSortBy = ({ id, defaultOrder }: FolderSortOptionMetadata) => {
    if ($folderViewSettings.sortBy === id) {
      $folderViewSettings.sortOrder = flipOrdering($folderViewSettings.sortOrder);
    } else {
      $folderViewSettings.sortBy = id;
      $folderViewSettings.sortOrder = defaultOrder;
    }
  };

  const handleChangeUnifiedSortBy = ({ id, defaultOrder }: FolderSortOptionMetadata) => {
    // Update both folder and album sort settings together
    const newOrder = $folderViewSettings.sortBy === id 
      ? flipOrdering($folderViewSettings.sortOrder) 
      : defaultOrder;
    
    $folderViewSettings.sortBy = id;
    $folderViewSettings.sortOrder = newOrder;
    
    // Map folder sort to album sort (they have the same enum values)
    $albumViewSettings.sortBy = id as AlbumSortBy;
    $albumViewSettings.sortOrder = newOrder;
  };

  const handleChangeListMode = () => {
    $folderViewSettings.view =
      $folderViewSettings.view === FolderViewMode.Cover ? FolderViewMode.List : FolderViewMode.Cover;
  };

  const handleChangeUnifiedListMode = () => {
    // Toggle both folder and album view modes together
    const newView = $folderViewSettings.view === FolderViewMode.Cover ? FolderViewMode.List : FolderViewMode.Cover;
    $folderViewSettings.view = newView;
    $albumViewSettings.view = newView === FolderViewMode.Cover ? AlbumViewMode.Cover : AlbumViewMode.List;
  };

  const handleChangeAlbumFilter = (filter: string, defaultFilter: AlbumFilter) => {
    $albumViewSettings.filter =
      Object.keys(albumFilterNames).find((key) => albumFilterNames[key as AlbumFilter] === filter) ?? defaultFilter;
  };

  const handleChangeAlbumGroupBy = ({ id, defaultOrder }: AlbumGroupOptionMetadata) => {
    if ($albumViewSettings.groupBy === id) {
      $albumViewSettings.groupOrder = flipOrdering($albumViewSettings.groupOrder);
    } else {
      $albumViewSettings.groupBy = id;
      $albumViewSettings.groupOrder = defaultOrder;
    }
  };

  const handleChangeAlbumSortBy = ({ id, defaultOrder }: AlbumSortOptionMetadata) => {
    if ($albumViewSettings.sortBy === id) {
      $albumViewSettings.sortOrder = flipOrdering($albumViewSettings.sortOrder);
    } else {
      $albumViewSettings.sortBy = id;
      $albumViewSettings.sortOrder = defaultOrder;
    }
  };

  const handleChangeAlbumListMode = () => {
    $albumViewSettings.view =
      $albumViewSettings.view === AlbumViewMode.Cover ? AlbumViewMode.List : AlbumViewMode.Cover;
  };

  let groupIcon = $derived.by(() => {
    if (selectedGroupOption?.id === FolderGroupBy.None) {
      return mdiFolderRemoveOutline;
    }
    return $folderViewSettings.groupOrder === SortOrder.Desc ? mdiFolderArrowDownOutline : mdiFolderArrowUpOutline;
  });

  let folderFilterNames: Record<FolderFilter, string> = $derived({
    [FolderFilter.All]: $t('all'),
    [FolderFilter.Owned]: $t('owned'),
    [FolderFilter.Shared]: $t('shared'),
  });

  // Unified filter names (same for both folders and albums)
  let unifiedFilterNames: Record<string, string> = $derived({
    all: $t('all'),
    owned: $t('owned'),
    shared: $t('shared'),
  });

  // Get the current unified filter selection (use folder filter as the source of truth, or album if they differ)
  let selectedUnifiedFilter = $derived.by(() => {
    const folderFilter = folderFilterNames[findFilterOption($folderViewSettings.filter)];
    const albumFilter = albumFilterNames[findAlbumFilterOption($albumViewSettings.filter)];
    // If both are the same, use that. Otherwise default to "all"
    return folderFilter === albumFilter ? folderFilter : folderFilterNames[FolderFilter.All];
  });

  let selectedFilterOption = $derived(folderFilterNames[findFilterOption($folderViewSettings.filter)]);
  let selectedSortOption = $derived(findSortOptionMetadata($folderViewSettings.sortBy));
  let selectedGroupOption = $derived(findGroupOptionMetadata($folderViewSettings.groupBy));
  let sortIcon = $derived($folderViewSettings.sortOrder === SortOrder.Desc ? mdiArrowDownThin : mdiArrowUpThin);

  let folderSortByNames: Record<FolderSortBy, string> = $derived({
    [FolderSortBy.Title]: $t('sort_title'),
    [FolderSortBy.ItemCount]: $t('sort_items'),
    [FolderSortBy.DateModified]: $t('sort_modified'),
    [FolderSortBy.DateCreated]: $t('sort_created'),
    [FolderSortBy.MostRecentPhoto]: $t('sort_recent'),
    [FolderSortBy.OldestPhoto]: $t('sort_oldest'),
  });

  let folderGroupByNames: Record<FolderGroupBy, string> = $derived({
    [FolderGroupBy.None]: $t('group_no'),
    [FolderGroupBy.Owner]: $t('group_owner'),
    [FolderGroupBy.Year]: $t('group_year'),
  });

  let albumGroupIcon = $derived.by(() => {
    if (selectedAlbumGroupOption?.id === AlbumGroupBy.None) {
      return mdiFolderRemoveOutline;
    }
    return $albumViewSettings.groupOrder === SortOrder.Desc ? mdiFolderArrowDownOutline : mdiFolderArrowUpOutline;
  });

  let albumFilterNames: Record<AlbumFilter, string> = $derived({
    [AlbumFilter.All]: $t('all'),
    [AlbumFilter.Owned]: $t('owned'),
    [AlbumFilter.Shared]: $t('shared'),
  });

  let selectedAlbumFilterOption = $derived(albumFilterNames[findAlbumFilterOption($albumViewSettings.filter)]);
  let selectedAlbumSortOption = $derived(findAlbumSortOptionMetadata($albumViewSettings.sortBy));
  let selectedAlbumGroupOption = $derived(findAlbumGroupOptionMetadata($albumViewSettings.groupBy));
  let albumSortIcon = $derived($albumViewSettings.sortOrder === SortOrder.Desc ? mdiArrowDownThin : mdiArrowUpThin);

  let albumSortByNames: Record<AlbumSortBy, string> = $derived({
    [AlbumSortBy.Title]: $t('sort_title'),
    [AlbumSortBy.ItemCount]: $t('sort_items'),
    [AlbumSortBy.DateModified]: $t('sort_modified'),
    [AlbumSortBy.DateCreated]: $t('sort_created'),
    [AlbumSortBy.MostRecentPhoto]: $t('sort_recent'),
    [AlbumSortBy.OldestPhoto]: $t('sort_oldest'),
  });

  let albumGroupByNames: Record<AlbumGroupBy, string> = $derived({
    [AlbumGroupBy.None]: $t('group_no'),
    [AlbumGroupBy.Owner]: $t('group_owner'),
    [AlbumGroupBy.Year]: $t('group_year'),
  });
</script>

<!-- Unified Ownership Filter (applies to both folders and albums) -->
<div class="hidden xl:block h-10">
  <GroupTab
    label={$t('library')}
    filters={Object.values(unifiedFilterNames)}
    selected={selectedUnifiedFilter}
    onSelect={(selected) => handleChangeUnifiedFilter(selected)}
  />
</div>

<!-- Unified Search (for both folders and albums) -->
<div class="hidden xl:block h-10 xl:w-60 2xl:w-80">
  <SearchBar placeholder={$t('search')} bind:name={searchQuery} showLoadingSpinner={false} />
</div>

<!-- Unified Create Menu -->
<ButtonContextMenu icon={mdiPlusBoxOutline} title={$t('create')}>
  <MenuOption
    icon={mdiFolderPlusOutline}
    text={$t('create_folder')}
    onClick={async () => {
      const result = await modalManager.show(FolderCreateModal, { parentId: currentFolderId });
      if (result) {
        await invalidateAll();
      }
    }}
  />
  <MenuOption
    icon={mdiImagePlusOutline}
    text={$t('create_album')}
    onClick={async () => {
      const result = await modalManager.show(AlbumCreateModal, { folderId: currentFolderId });
      if (result) {
        await invalidateAll();
      }
    }}
  />
</ButtonContextMenu>

<!-- Unified Sort (for both folders and albums) -->
<Dropdown
  title={$t('sort_albums_by')}
  options={Object.values(sortOptionsMetadata)}
  selectedOption={selectedSortOption}
  onSelect={handleChangeUnifiedSortBy}
  render={({ id }) => ({
    title: folderSortByNames[id],
    icon: sortIcon,
  })}
/>

<!-- Unified Group By (for both folders and albums) -->
<Dropdown
  title={$t('group_albums_by')}
  options={Object.values(groupOptionsMetadata)}
  selectedOption={selectedGroupOption}
  onSelect={handleChangeUnifiedGroupBy}
  render={({ id, isDisabled }) => ({
    title: folderGroupByNames[id],
    icon: groupIcon,
    disabled: isDisabled(),
  })}
/>

<!-- Unified Expand/Collapse Groups (for both folders and albums) -->
{#if getSelectedFolderGroupOption($folderViewSettings) !== FolderGroupBy.None || getSelectedAlbumGroupOption($albumViewSettings) !== AlbumGroupBy.None}
  <span in:fly={{ x: -50, duration: 250 }}>
    <div class="hidden xl:flex gap-0">
      <div class="block">
        <IconButton
          title={$t('expand_all')}
          onclick={() => handleExpandAllGroups()}
          variant="ghost"
          color="secondary"
          shape="round"
          icon={mdiUnfoldMoreHorizontal}
          aria-label={$t('expand_all')}
        />
      </div>

      <div class="block">
        <IconButton
          title={$t('collapse_all')}
          onclick={() => handleCollapseAllGroups()}
          variant="ghost"
          color="secondary"
          shape="round"
          icon={mdiUnfoldLessHorizontal}
          aria-label={$t('collapse_all')}
        />
      </div>
    </div>
  </span>
{/if}

<!-- Unified Cover/List Display Toggle (for both folders and albums) -->
{#if $folderViewSettings.view === FolderViewMode.List}
  <Button
    leadingIcon={mdiViewGridOutline}
    onclick={() => handleChangeUnifiedListMode()}
    size="small"
    variant="ghost"
    color="secondary"
  >
    <Text class="hidden md:block">{$t('covers')}</Text>
  </Button>
{:else}
  <Button
    leadingIcon={mdiFormatListBulletedSquare}
    onclick={() => handleChangeUnifiedListMode()}
    size="small"
    variant="ghost"
    color="secondary"
  >
    <Text class="hidden md:block">{$t('list')}</Text>
  </Button>
{/if}
