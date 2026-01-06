<script lang="ts">
  import { createAlbum } from '$lib/utils/album-utils';
  import { Field, FormModal, Input } from '@immich/ui';
  import { mdiImagePlusOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';

  type Props = {
    onClose: (album?: { id: string }) => void;
    assetIds?: string[];
    folderId?: string;
  };

  let { onClose, assetIds, folderId }: Props = $props();
  let albumName = $state('');

  const onSubmit = async () => {
    const newAlbum = await createAlbum(albumName.trim() || undefined, assetIds, folderId);
    if (newAlbum) {
      onClose(newAlbum);
    }
  };
</script>

<FormModal
  icon={mdiImagePlusOutline}
  title={$t('create_album')}
  size="small"
  {onClose}
  {onSubmit}
  submitText={$t('create')}
>
  <div class="flex flex-col gap-4 m-4">
    <Field label={$t('name')}>
      <Input bind:value={albumName} autofocus />
    </Field>
  </div>
</FormModal>
