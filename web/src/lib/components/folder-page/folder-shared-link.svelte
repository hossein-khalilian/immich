<script lang="ts">
  import ActionButton from '$lib/components/ActionButton.svelte';
  import { getSharedLinkActions } from '$lib/services/shared-link.service';
  import { locale } from '$lib/stores/preferences.store';
  // @ts-expect-error - Folder SDK functions will be available after SDK regeneration
  import type { FolderResponseDto, SharedLinkResponseDto } from '@immich/sdk';
  import { Text } from '@immich/ui';
  import { DateTime } from 'luxon';
  import { t } from 'svelte-i18n';

  type Props = {
    folder: FolderResponseDto;
    sharedLink: SharedLinkResponseDto;
  };

  const { folder, sharedLink }: Props = $props();

  const getShareProperties = () =>
    [
      DateTime.fromISO(sharedLink.createdAt).toLocaleString(
        {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        },
        { locale: $locale },
      ),
      sharedLink.allowUpload && $t('upload'),
      sharedLink.allowDownload && $t('download'),
      sharedLink.showMetadata && $t('exif').toUpperCase(),
      sharedLink.password && $t('password'),
    ]
      .filter(Boolean)
      .join(' • ');

  const { ViewQrCode, Copy } = $derived(getSharedLinkActions($t, sharedLink));
</script>

<div class="flex justify-between items-center">
  <div class="flex flex-col gap-1">
    <Text size="small">{sharedLink.description || folder.folderName}</Text>
    <Text size="tiny" color="muted">{getShareProperties()}</Text>
  </div>
  <div class="flex">
    <ActionButton action={ViewQrCode} />
    <ActionButton action={Copy} />
  </div>
</div>
