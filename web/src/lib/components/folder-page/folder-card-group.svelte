<script lang="ts">
  import { resolve } from '$app/paths';
  import FolderCard from '$lib/components/folder-page/folder-card.svelte';
  import { AppRoute } from '$lib/constants';
  import { folderViewSettings } from '$lib/stores/preferences.store';
  import { type FolderGroup, isFolderGroupCollapsed, toggleFolderGroupCollapsing } from '$lib/utils/folder-utils';
  import type { ContextMenuPosition } from '$lib/utils/context-menu';
  // @ts-expect-error - Folder SDK functions will be available after SDK regeneration
  import type { FolderResponseDto } from '@immich/sdk';
  import { Icon } from '@immich/ui';
  import { mdiChevronRight } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import { flip } from 'svelte/animate';
  import { slide } from 'svelte/transition';

  interface Props {
    folders: FolderResponseDto[];
    group?: FolderGroup | undefined;
    showOwner?: boolean;
    showDateRange?: boolean;
    showItemCount?: boolean;
    onShowContextMenu?: ((position: ContextMenuPosition, folder: FolderResponseDto) => unknown) | undefined;
  }

  let {
    folders,
    group = undefined,
    showOwner = false,
    showDateRange = false,
    showItemCount = false,
    onShowContextMenu = undefined,
  }: Props = $props();

  let isCollapsed = $derived(!!group && isFolderGroupCollapsed($folderViewSettings, group.id));

  const showContextMenu = (position: ContextMenuPosition, folder: FolderResponseDto) => {
    onShowContextMenu?.(position, folder);
  };

  let iconRotation = $derived(isCollapsed ? 'rotate-0' : 'rotate-90');

  const oncontextmenu = (event: MouseEvent, folder: FolderResponseDto) => {
    event.preventDefault();
    showContextMenu({ x: event.x, y: event.y }, folder);
  };
</script>

{#if group}
  <div class="grid">
    <button
      type="button"
      onclick={() => toggleFolderGroupCollapsing(group.id)}
      class="w-full text-start mt-2 pt-2 pe-2 pb-2 rounded-md transition-colors cursor-pointer dark:text-immich-dark-fg hover:text-primary hover:bg-subtle dark:hover:bg-immich-dark-gray"
      aria-expanded={!isCollapsed}
    >
      <Icon icon={mdiChevronRight} size="24" class="inline-block -mt-2.5 transition-all duration-250 {iconRotation}" />
      <span class="font-bold text-3xl text-black dark:text-white">{group.name}</span>
      <span class="ms-1.5">({$t('folders_count', { values: { count: folders.length } })})</span>
    </button>
    <hr class="dark:border-immich-dark-gray" />
  </div>
{/if}

<div class="mt-4">
  {#if !isCollapsed}
    <div class="grid grid-auto-fill-56 gap-y-4" transition:slide={{ duration: 300 }}>
      {#each folders as folder, index (folder.id)}
        <a
          href={resolve(`${AppRoute.FOLDERS}/${folder.id}`)}
          animate:flip={{ duration: 400 }}
          oncontextmenu={(event) => oncontextmenu(event, folder)}
        >
          <FolderCard
            {folder}
            {showOwner}
            {showDateRange}
            {showItemCount}
            preload={index < 20}
            onShowContextMenu={onShowContextMenu ? (position) => showContextMenu(position, folder) : undefined}
          />
        </a>
      {/each}
    </div>
  {/if}
</div>
