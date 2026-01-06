<script lang="ts">
  import FolderCover from '$lib/components/folder-page/folder-cover.svelte';
  import { user } from '$lib/stores/user.store';
  import { getContextMenuPositionFromEvent, type ContextMenuPosition } from '$lib/utils/context-menu';
  import { getShortDateRange } from '$lib/utils/date-time';
  // @ts-expect-error - Folder SDK functions will be available after SDK regeneration
  import type { FolderResponseDto } from '@immich/sdk';
  import { IconButton } from '@immich/ui';
  import { mdiDotsVertical } from '@mdi/js';
  import { t } from 'svelte-i18n';

  interface Props {
    folder: FolderResponseDto;
    showOwner?: boolean;
    showDateRange?: boolean;
    showItemCount?: boolean;
    preload?: boolean;
    onShowContextMenu?: ((position: ContextMenuPosition) => unknown) | undefined;
  }

  let {
    folder,
    showOwner = false,
    showDateRange = false,
    showItemCount = false,
    preload = false,
    onShowContextMenu = undefined,
  }: Props = $props();

  const showFolderContextMenu = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onShowContextMenu?.(getContextMenuPositionFromEvent(e));
  };
</script>

<div
  class="group relative rounded-2xl border border-transparent p-5 hover:bg-gray-100 hover:border-gray-200 dark:hover:border-gray-800 dark:hover:bg-gray-900"
  data-testid="folder-card"
>
  {#if onShowContextMenu}
    <div
      id="icon-{folder.id}"
      class="absolute end-6 top-6 opacity-0 group-hover:opacity-100 focus-within:opacity-100"
      data-testid="context-button-parent"
    >
      <IconButton
        color="secondary"
        aria-label={$t('show_folder_options')}
        icon={mdiDotsVertical}
        shape="round"
        variant="filled"
        size="medium"
        class="icon-white-drop-shadow"
        onclick={showFolderContextMenu}
      />
    </div>
  {/if}

  <FolderCover {folder} {preload} class="transition-all duration-300 hover:shadow-lg" />

  <div class="mt-4">
    <p
      class="w-full leading-6 text-lg line-clamp-2 font-semibold text-black dark:text-white group-hover:text-primary"
      data-testid="folder-name"
      title={folder.folderName}
    >
      {folder.folderName}
    </p>

    {#if showDateRange && folder.startDate && folder.endDate}
      <p class="flex text-sm dark:text-immich-dark-fg capitalize">
        {getShortDateRange(folder.startDate, folder.endDate)}
      </p>
    {/if}

    <span class="flex gap-2 text-sm dark:text-immich-dark-fg" data-testid="folder-details">
      {#if folder.subfolderCount && folder.subfolderCount > 0}
        <p>
          {$t('subfolders_count', { values: { count: folder.subfolderCount } })}
        </p>
      {/if}

      {#if showItemCount && folder.assetCount > 0}
        {#if folder.subfolderCount && folder.subfolderCount > 0}
          <p>•</p>
        {/if}
        <p>
          {$t('items_count', { values: { count: folder.assetCount } })}
        </p>
      {/if}

      {#if (showOwner || folder.shared) && ((folder.subfolderCount && folder.subfolderCount > 0) || (showItemCount && folder.assetCount > 0))}
        <p>•</p>
      {/if}

      {#if showOwner}
        {#if $user.id === folder.ownerId}
          <p>{$t('owned')}</p>
        {:else if folder.owner}
          <p>{$t('shared_by_user', { values: { user: folder.owner.name } })}</p>
        {:else}
          <p>{$t('shared')}</p>
        {/if}
      {:else if folder.shared}
        <p>{$t('shared')}</p>
      {/if}
    </span>
  </div>
</div>
