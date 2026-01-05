<script lang="ts">
  import { folderViewSettings, SortOrder, FolderSortBy } from '$lib/stores/preferences.store';
  import type { FolderSortOptionMetadata } from '$lib/utils/folder-utils';
  import { t } from 'svelte-i18n';

  interface Props {
    option: FolderSortOptionMetadata;
  }

  let { option }: Props = $props();

  const handleSort = () => {
    if ($folderViewSettings.sortBy === option.id) {
      $folderViewSettings.sortOrder = $folderViewSettings.sortOrder === SortOrder.Asc ? SortOrder.Desc : SortOrder.Asc;
    } else {
      $folderViewSettings.sortBy = option.id;
      $folderViewSettings.sortOrder = option.defaultOrder;
    }
  };

  let folderSortByNames: Record<FolderSortBy, string> = $derived({
    [FolderSortBy.Title]: $t('sort_title'),
    [FolderSortBy.ItemCount]: $t('sort_items'),
    [FolderSortBy.DateModified]: $t('sort_modified'),
    [FolderSortBy.DateCreated]: $t('sort_created'),
    [FolderSortBy.MostRecentPhoto]: $t('sort_recent'),
    [FolderSortBy.OldestPhoto]: $t('sort_oldest'),
  });
</script>

<th class="text-sm font-medium {option.columnStyle}">
  <button
    type="button"
    class="rounded-lg p-2 hover:bg-immich-dark-primary hover:dark:bg-immich-dark-primary/50"
    onclick={handleSort}
  >
    {#if $folderViewSettings.sortBy === option.id}
      {#if $folderViewSettings.sortOrder === SortOrder.Desc}
        &#8595;
      {:else}
        &#8593;
      {/if}
    {/if}
    {folderSortByNames[option.id]}
  </button>
</th>
