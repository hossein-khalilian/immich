<script lang="ts">
  import { getAssetThumbnailUrl } from '$lib/utils';
  // @ts-expect-error - Folder SDK functions will be available after SDK regeneration
  import { type FolderResponseDto } from '@immich/sdk';
  import NoCover from '$lib/components/sharedlinks-page/covers/no-cover.svelte';
  import AssetCover from '$lib/components/sharedlinks-page/covers/asset-cover.svelte';
  import { t } from 'svelte-i18n';

  interface Props {
    folder: FolderResponseDto;
    preload?: boolean;
    class?: string;
  }

  let { folder, preload = false, class: className = '' }: Props = $props();

  let alt = $derived(folder.folderName || $t('unnamed_folder'));
  let thumbnailUrl = $derived(
    folder.folderThumbnailAssetId ? getAssetThumbnailUrl({ id: folder.folderThumbnailAssetId }) : null,
  );
</script>

{#if thumbnailUrl}
  <AssetCover {alt} class={className} src={thumbnailUrl} {preload} />
{:else}
  <NoCover {alt} class={className} {preload} />
{/if}
