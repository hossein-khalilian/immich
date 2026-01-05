<script lang="ts">
  import FolderCover from '$lib/components/folder-page/folder-cover.svelte';
  import { handleUpdateFolder } from '$lib/services/folder.service';
  // @ts-expect-error - Folder SDK functions will be available after SDK regeneration
  import { type FolderResponseDto } from '@immich/sdk';
  import { Field, FormModal, Input, Textarea } from '@immich/ui';
  import { mdiRenameOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';

  type Props = {
    folder: FolderResponseDto;
    onClose: () => void;
  };

  let { folder, onClose }: Props = $props();

  let folderName = $state(folder.folderName);
  let description = $state(folder.description);

  const onSubmit = async () => {
    const success = await handleUpdateFolder(folder, { folderName, description });
    if (success) {
      onClose();
    }
  };
</script>

<FormModal icon={mdiRenameOutline} title={$t('edit_folder')} size="medium" {onClose} {onSubmit}>
  <div class="flex items-center gap-8 m-4">
    <FolderCover {folder} class="h-50 w-50 shadow-lg hidden sm:flex" />

    <div class="grow flex flex-col gap-4">
      <Field label={$t('name')}>
        <Input bind:value={folderName} />
      </Field>

      <Field label={$t('description')}>
        <Textarea bind:value={description} />
      </Field>
    </div>
  </div>
</FormModal>
