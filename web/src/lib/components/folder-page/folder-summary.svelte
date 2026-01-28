<script lang="ts">
  import { getFolderDateRange } from '$lib/utils/date-time';
  import type { FolderResponseDto } from '$lib/types/folder-sdk';
  import { t } from 'svelte-i18n';

  interface Props {
    folder: FolderResponseDto;
  }

  let { folder }: Props = $props();

  let dateRange = $derived(getFolderDateRange(folder));
  let subfolderCount = $derived(folder?.subfolderCount ?? 0);
  let assetCount = $derived(folder?.assetCount ?? 0);
</script>

<span class="my-2 flex gap-2 text-sm font-medium text-gray-500" data-testid="folder-details">
  {#if dateRange}
    <span>{dateRange}</span>
  {/if}
  {#if subfolderCount > 0}
    {#if dateRange}<span>•</span>{/if}
    <span>{$t('subfolders_count', { values: { count: subfolderCount } })}</span>
  {/if}
  {#if assetCount > 0}
    {#if dateRange || subfolderCount > 0}<span>•</span>{/if}
    <span>{$t('items_count', { values: { count: assetCount } })}</span>
  {/if}
</span>
