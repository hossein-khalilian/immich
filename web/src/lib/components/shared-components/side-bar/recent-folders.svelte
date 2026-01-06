<script lang="ts">
  import { userInteraction } from '$lib/stores/user.svelte';
  import { getAssetThumbnailUrl } from '$lib/utils';
  import { handleError } from '$lib/utils/handle-error';
  import { getAllFolders } from '$lib/utils/folder-api';
  import type { FolderResponseDto } from '$lib/types/folder-sdk';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  // Always filter to only show root folders (no parent)
  let folders = $derived.by(() => {
    if (!userInteraction.recentFolders) {
      return [];
    }
    return userInteraction.recentFolders
      .filter((folder) => !folder.parentId)
      .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
      .slice(0, 3);
  });

  // Clean cache immediately to ensure it only contains root folders
  $effect(() => {
    if (userInteraction.recentFolders && userInteraction.recentFolders.length > 0) {
      const rootFolders = userInteraction.recentFolders.filter((folder) => !folder.parentId);
      // Only update if there are child folders to remove (to avoid infinite loop)
      if (rootFolders.length !== userInteraction.recentFolders.length) {
        userInteraction.recentFolders = rootFolders
          .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
          .slice(0, 3);
      }
    }
  });

  onMount(async () => {
    if (userInteraction.recentFolders && userInteraction.recentFolders.length > 0) {
      // Cache exists, but we'll use the derived value which filters it
      return;
    }
    try {
      // Only fetch root folders (folders with no parent)
      const rootFolders = await getAllFolders({ parentId: null });
      const sortedFolders = rootFolders.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1)).slice(0, 3);
      userInteraction.recentFolders = sortedFolders;
    } catch (error) {
      handleError(error, $t('failed_to_load_assets'));
    }
  });
</script>

{#each folders as folder (folder.id)}
  <a
    href={'/folders/' + folder.id}
    title={folder.folderName}
    class="flex w-full place-items-center justify-between gap-4 rounded-e-full py-3 transition-[padding] delay-100 duration-100 hover:cursor-pointer hover:bg-subtle hover:text-immich-primary dark:text-immich-dark-fg dark:hover:bg-immich-dark-gray dark:hover:text-immich-dark-primary ps-10 group-hover:sm:px-10 md:px-10"
  >
    <div>
      <div
        class="h-6 w-6 bg-cover rounded bg-gray-200 dark:bg-gray-600"
        style={folder.folderThumbnailAssetId
          ? `background-image:url('${getAssetThumbnailUrl({ id: folder.folderThumbnailAssetId })}')`
          : ''}
      ></div>
    </div>
    <div class="grow text-sm font-medium truncate">
      {folder.folderName}
    </div>
  </a>
{/each}
