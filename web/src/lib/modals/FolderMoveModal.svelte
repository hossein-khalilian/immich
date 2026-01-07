<script lang="ts">
  import { getAllFolders } from '$lib/utils/folder-api';
  import { Modal, ModalBody, Button, Text } from '@immich/ui';
  import { mdiFolderOutline, mdiFolderMove } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import { onMount } from 'svelte';
  import type { FolderResponseDto } from '$lib/types/folder-sdk';
  import { Icon } from '@immich/ui';

  type Props = {
    onClose: (folderId: string | null | undefined) => void;
    excludeFolderId?: string; // Folder to exclude (can't move into itself or descendants)
    currentParentId?: string | null; // Current parent folder ID
  };

  let { onClose, excludeFolderId, currentParentId }: Props = $props();
  let folders: FolderResponseDto[] = $state([]);
  let selectedFolderId: string | null = $state(null);
  let loading = $state(true);

  onMount(async () => {
    try {
      const allFolders = await getAllFolders();
      // Filter out the folder being moved and its descendants (if we had that info)
      // For now, just filter out the folder itself
      folders = allFolders.filter((f) => f.id !== excludeFolderId);
      loading = false;
    } catch (error) {
      console.error('Failed to load folders:', error);
      loading = false;
    }
  });

  const handleSelect = (folderId: string | null) => {
    selectedFolderId = folderId;
  };

  const handleSubmit = () => {
    onClose(selectedFolderId);
  };

  const handleCancel = () => {
    onClose(undefined);
  };
</script>

<Modal icon={mdiFolderMove} title={$t('move_to_folder')} size="medium" onClose={handleCancel}>
  <ModalBody>
    <div class="flex flex-col gap-4 p-4">
      <Text class="text-sm text-gray-600 dark:text-gray-400">
        {$t('move_to_folder')}
      </Text>

      {#if loading}
        <div class="flex justify-center py-8">
          <Text>{$t('loading')}...</Text>
        </div>
      {:else}
        <div class="max-h-96 overflow-y-auto border rounded-lg dark:border-immich-dark-gray">
          <!-- Option to move to root (no parent) -->
          <button
            type="button"
            class="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-immich-dark-gray flex items-center gap-2 {selectedFolderId === null
              ? 'bg-immich-primary/10 dark:bg-immich-dark-primary/20'
              : ''}"
            onclick={() => handleSelect(null)}
          >
            <Icon icon={mdiFolderOutline} size="20" />
            <Text class="font-medium">{$t('library')}</Text>
          </button>

          <!-- List of folders -->
          {#each folders as folder (folder.id)}
            <button
              type="button"
              class="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-immich-dark-gray flex items-center gap-2 {selectedFolderId === folder.id
                ? 'bg-immich-primary/10 dark:bg-immich-dark-primary/20'
                : ''}"
              onclick={() => handleSelect(folder.id)}
            >
              <Icon icon={mdiFolderOutline} size="20" />
              <Text class="font-medium">{folder.folderName}</Text>
            </button>
          {/each}

          {#if folders.length === 0}
            <div class="p-4 text-center text-gray-500 dark:text-gray-400">
              <Text>{$t('no_folders_message')}</Text>
            </div>
          {/if}
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onclick={handleCancel}>
            {$t('cancel')}
          </Button>
          <Button onclick={handleSubmit} disabled={selectedFolderId === currentParentId}>
            {$t('move')}
          </Button>
        </div>
      {/if}
    </div>
  </ModalBody>
</Modal>
