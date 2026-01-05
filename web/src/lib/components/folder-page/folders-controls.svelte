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
    SortOrder,
  } from '$lib/stores/preferences.store';
  import {
    type FolderGroupOptionMetadata,
    type FolderSortOptionMetadata,
    collapseAllFolderGroups,
    createFolderAndRedirect,
    expandAllFolderGroups,
    findFilterOption,
    findGroupOptionMetadata,
    findSortOptionMetadata,
    getSelectedFolderGroupOption,
    groupOptionsMetadata,
    sortOptionsMetadata,
  } from '$lib/utils/folder-utils';
  import { Button, IconButton, Text } from '@immich/ui';
  import {
    mdiArrowDownThin,
    mdiArrowUpThin,
    mdiFolderArrowDownOutline,
    mdiFolderArrowUpOutline,
    mdiFolderRemoveOutline,
    mdiFormatListBulletedSquare,
    mdiPlusBoxOutline,
    mdiUnfoldLessHorizontal,
    mdiUnfoldMoreHorizontal,
    mdiViewGridOutline,
  } from '@mdi/js';
  import { t } from 'svelte-i18n';

  interface Props {
    folderGroups: string[];
    searchQuery: string;
  }

  let { folderGroups, searchQuery = $bindable() }: Props = $props();

  const flipOrdering = (ordering: string) => {
    return ordering === SortOrder.Asc ? SortOrder.Desc : SortOrder.Asc;
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

  const handleChangeSortBy = ({ id, defaultOrder }: FolderSortOptionMetadata) => {
    if ($folderViewSettings.sortBy === id) {
      $folderViewSettings.sortOrder = flipOrdering($folderViewSettings.sortOrder);
    } else {
      $folderViewSettings.sortBy = id;
      $folderViewSettings.sortOrder = defaultOrder;
    }
  };

  const handleChangeListMode = () => {
    $folderViewSettings.view =
      $folderViewSettings.view === FolderViewMode.Cover ? FolderViewMode.List : FolderViewMode.Cover;
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
</script>

<!-- Filter Folders by Sharing Status (All, Owned, Shared) -->
<div class="hidden xl:block h-10">
  <GroupTab
    label={$t('show_folders')}
    filters={Object.values(folderFilterNames)}
    selected={selectedFilterOption}
    onSelect={(selected) => handleChangeFolderFilter(selected, FolderFilter.All)}
  />
</div>

<!-- Search Folders -->
<div class="hidden xl:block h-10 xl:w-60 2xl:w-80">
  <SearchBar placeholder={$t('search_folders')} bind:name={searchQuery} showLoadingSpinner={false} />
</div>

<!-- Create Folder -->
<Button
  leadingIcon={mdiPlusBoxOutline}
  onclick={() => createFolderAndRedirect()}
  size="small"
  variant="ghost"
  color="secondary"
>
  <p class="hidden md:block">{$t('create_folder')}</p>
</Button>

<!-- Sort Folders -->
<Dropdown
  title={$t('sort_folders_by')}
  options={Object.values(sortOptionsMetadata)}
  selectedOption={selectedSortOption}
  onSelect={handleChangeSortBy}
  render={({ id }) => ({
    title: folderSortByNames[id],
    icon: sortIcon,
  })}
/>

<!-- Group Folders -->
<Dropdown
  title={$t('group_folders_by')}
  options={Object.values(groupOptionsMetadata)}
  selectedOption={selectedGroupOption}
  onSelect={handleChangeGroupBy}
  render={({ id, isDisabled }) => ({
    title: folderGroupByNames[id],
    icon: groupIcon,
    disabled: isDisabled(),
  })}
/>

{#if getSelectedFolderGroupOption($folderViewSettings) !== FolderGroupBy.None}
  <span in:fly={{ x: -50, duration: 250 }}>
    <!-- Expand Folder Groups -->
    <div class="hidden xl:flex gap-0">
      <div class="block">
        <IconButton
          title={$t('expand_all')}
          onclick={() => expandAllFolderGroups()}
          variant="ghost"
          color="secondary"
          shape="round"
          icon={mdiUnfoldMoreHorizontal}
          aria-label={$t('expand_all')}
        />
      </div>

      <!-- Collapse Folder Groups -->
      <div class="block">
        <IconButton
          title={$t('collapse_all')}
          onclick={() => collapseAllFolderGroups(folderGroups)}
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

<!-- Cover/List Display Toggle -->
{#if $folderViewSettings.view === FolderViewMode.List}
  <Button
    leadingIcon={mdiViewGridOutline}
    onclick={() => handleChangeListMode()}
    size="small"
    variant="ghost"
    color="secondary"
  >
    <Text class="hidden md:block">{$t('covers')}</Text>
  </Button>
{:else}
  <Button
    leadingIcon={mdiFormatListBulletedSquare}
    onclick={() => handleChangeListMode()}
    size="small"
    variant="ghost"
    color="secondary"
  >
    <Text class="hidden md:block">{$t('list')}</Text>
  </Button>
{/if}
