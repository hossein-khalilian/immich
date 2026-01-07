<script lang="ts">
  import FolderTableHeader from '$lib/components/folder-page/folders-table-header.svelte';
  import FolderTableRow from '$lib/components/folder-page/folders-table-row.svelte';
  import { FolderGroupBy, folderViewSettings } from '$lib/stores/preferences.store';
  import {
    isFolderGroupCollapsed,
    sortOptionsMetadata,
    toggleFolderGroupCollapsing,
    type FolderGroup,
  } from '$lib/utils/folder-utils';
  import type { ContextMenuPosition } from '$lib/utils/context-menu';
  // @ts-expect-error - Folder SDK functions will be available after SDK regeneration
  import type { FolderResponseDto } from '@immich/sdk';
  import { Icon } from '@immich/ui';
  import { mdiChevronRight } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import { slide } from 'svelte/transition';

  interface Props {
    groupedFolders: FolderGroup[];
    folderGroupOption?: string;
    onShowContextMenu?: ((position: ContextMenuPosition, folder: FolderResponseDto) => unknown) | undefined;
  }

  let { groupedFolders, folderGroupOption = FolderGroupBy.None, onShowContextMenu }: Props = $props();
</script>

<table class="mt-2 w-full text-start">
  <thead
    class="mb-4 flex h-12 w-full rounded-md border bg-gray-50 text-primary dark:border-immich-dark-gray dark:bg-immich-dark-gray"
  >
    <tr class="flex w-full place-items-center p-2 md:p-5">
      {#each sortOptionsMetadata as option, index (index)}
        <FolderTableHeader {option} />
      {/each}
      {#if onShowContextMenu}
        <th class="text-sm font-medium w-12"></th>
      {/if}
    </tr>
  </thead>
  {#if folderGroupOption === FolderGroupBy.None}
    <tbody class="block w-full overflow-y-auto rounded-md border dark:border-immich-dark-gray dark:text-immich-dark-fg">
      {#each groupedFolders[0].folders as folder (folder.id)}
        <FolderTableRow {folder} {onShowContextMenu} />
      {/each}
    </tbody>
  {:else}
    {#each groupedFolders as folderGroup (folderGroup.id)}
      {@const isCollapsed = isFolderGroupCollapsed($folderViewSettings, folderGroup.id)}
      {@const iconRotation = isCollapsed ? 'rotate-0' : 'rotate-90'}
      <tbody
        class="block w-full overflow-y-auto rounded-md border dark:border-immich-dark-gray dark:text-immich-dark-fg mt-4"
      >
        <tr
          class="flex w-full place-items-center p-2 md:ps-5 md:pe-5 md:pt-3 md:pb-3"
          onclick={() => toggleFolderGroupCollapsing(folderGroup.id)}
          aria-expanded={!isCollapsed}
        >
          <td class="text-md text-start -mb-1">
            <Icon
              icon={mdiChevronRight}
              size="20"
              class="inline-block -mt-2 transition-all duration-250 {iconRotation}"
            />
            <span class="font-bold text-2xl">{folderGroup.name}</span>
            <span class="ms-1.5">
              ({$t('folders_count', { values: { count: folderGroup.folders.length } })})
            </span>
          </td>
        </tr>
      </tbody>
      {#if !isCollapsed}
        <tbody
          class="block w-full overflow-y-auto rounded-md border dark:border-immich-dark-gray dark:text-immich-dark-fg mt-4"
          transition:slide={{ duration: 300 }}
        >
          {#each folderGroup.folders as folder (folder.id)}
            <FolderTableRow {folder} {onShowContextMenu} />
          {/each}
        </tbody>
      {/if}
    {/each}
  {/if}
</table>
