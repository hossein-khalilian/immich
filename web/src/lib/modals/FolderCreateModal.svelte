<script lang="ts">
  import { createFolder } from '$lib/utils/folder-utils';
  import { Field, FormModal, Input } from '@immich/ui';
  import { mdiFolderPlusOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';

  type Props = {
    onClose: (folder?: { id: string }) => void;
    parentId?: string;
    assetIds?: string[];
  };

  let { onClose, parentId, assetIds }: Props = $props();
  let folderName = $state('');

  const onSubmit = async () => {
    const newFolder = await createFolder(folderName.trim() || undefined, assetIds, parentId);
    if (newFolder) {
      onClose(newFolder);
    }
  };
</script>

<FormModal
  icon={mdiFolderPlusOutline}
  title={$t('create_folder')}
  size="small"
  {onClose}
  {onSubmit}
  submitText={$t('create')}
>
  <div class="flex flex-col gap-4 m-4">
    <Field label={$t('name')}>
      <Input bind:value={folderName} autofocus />
    </Field>
  </div>
</FormModal>
