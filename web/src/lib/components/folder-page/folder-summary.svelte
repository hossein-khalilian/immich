<script lang="ts">
  import { getFolderDateRange } from '$lib/utils/date-time';
  import type { FolderResponseDto } from '$lib/types/folder-sdk';
  import { t } from 'svelte-i18n';

  interface Props {
    folder: FolderResponseDto;
  }

  let { folder }: Props = $props();
</script>

<span class="my-2 flex gap-2 text-sm font-medium text-gray-500" data-testid="folder-details">
  <span>{getFolderDateRange(folder)}</span>
  <span>•</span>
  <span>{$t('items_count', { values: { count: folder.assetCount } })}</span>
</span>
