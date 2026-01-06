<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { AppRoute, dateFormats } from '$lib/constants';
  import { locale } from '$lib/stores/preferences.store';
  import { formatDateWithCalendar } from '$lib/utils/date-locale';
  import { user } from '$lib/stores/user.store';
  import type { ContextMenuPosition } from '$lib/utils/context-menu';
  // @ts-expect-error - Folder SDK functions will be available after SDK regeneration
  import type { FolderResponseDto } from '@immich/sdk';
  import { Icon } from '@immich/ui';
  import { mdiShareVariantOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';

  interface Props {
    folder: FolderResponseDto;
    onShowContextMenu?: ((position: ContextMenuPosition, folder: FolderResponseDto) => unknown) | undefined;
  }

  let { folder, onShowContextMenu = undefined }: Props = $props();

  const showContextMenu = (position: ContextMenuPosition) => {
    onShowContextMenu?.(position, folder);
  };

  const dateLocaleString = (dateString: string) => {
    return formatDateWithCalendar(new Date(dateString), dateFormats.album);
  };

  const oncontextmenu = (event: MouseEvent) => {
    event.preventDefault();
    showContextMenu({ x: event.x, y: event.y });
  };
</script>

<tr
  class="flex w-full place-items-center border-3 border-transparent p-2 text-center even:bg-subtle/20 odd:bg-subtle/80 hover:cursor-pointer hover:border-immich-primary/75 odd:dark:bg-immich-dark-gray/75 even:dark:bg-immich-dark-gray/50 dark:hover:border-immich-dark-primary/75 md:px-5 md:py-2"
  onclick={() => goto(resolve(`${AppRoute.FOLDERS}/${folder.id}`))}
  {oncontextmenu}
>
  <td class="text-md text-ellipsis text-start w-8/12 sm:w-4/12 md:w-4/12 xl:w-[30%] 2xl:w-[40%] items-center">
    {folder.folderName}
    {#if folder.shared}
      <Icon
        icon={mdiShareVariantOutline}
        size="16"
        class="inline ms-1 opacity-70"
        title={folder.ownerId === $user.id
          ? $t('shared_by_you')
          : $t('shared_by_user', { values: { user: folder.owner.name } })}
      />
    {/if}
  </td>
  <td class="text-md text-ellipsis text-center sm:w-2/12 md:w-2/12 xl:w-[15%] 2xl:w-[12%]">
    {#if folder.subfolderCount && folder.subfolderCount > 0}
      {$t('subfolders_count', { values: { count: folder.subfolderCount } })}
    {:else}
      {$t('items_count', { values: { count: folder.assetCount } })}
    {/if}
  </td>
  <td class="text-md hidden text-ellipsis text-center sm:block w-3/12 xl:w-[15%] 2xl:w-[12%]">
    {dateLocaleString(folder.updatedAt)}
  </td>
  <td class="text-md hidden text-ellipsis text-center sm:block w-3/12 xl:w-[15%] 2xl:w-[12%]">
    {dateLocaleString(folder.createdAt)}
  </td>
  <td class="text-md text-ellipsis text-center hidden xl:block xl:w-[15%] 2xl:w-[12%]">
    {#if folder.endDate}
      {dateLocaleString(folder.endDate)}
    {:else}
      -
    {/if}
  </td>
  <td class="text-md text-ellipsis text-center hidden xl:block xl:w-[15%] 2xl:w-[12%]">
    {#if folder.startDate}
      {dateLocaleString(folder.startDate)}
    {:else}
      -
    {/if}
  </td>
</tr>
