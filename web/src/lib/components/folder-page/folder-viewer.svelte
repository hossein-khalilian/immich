<script lang="ts">
  import { shortcut } from '$lib/actions/shortcut';
  import CastButton from '$lib/cast/cast-button.svelte';
  import DownloadAction from '$lib/components/timeline/actions/DownloadAction.svelte';
  import AssetSelectControlBar from '$lib/components/timeline/AssetSelectControlBar.svelte';
  import { handleDownloadFolder } from '$lib/services/folder.service';
  import { AssetInteraction } from '$lib/stores/asset-interaction.svelte';
  import { dragAndDropFilesStore } from '$lib/stores/drag-and-drop-files.store';
  import { mobileDevice } from '$lib/stores/mobile-device.svelte';
  import { handlePromiseError } from '$lib/utils';
  import { cancelMultiselect, downloadArchive } from '$lib/utils/asset-utils';
  import { fileUploadHandler, openFileUploadDialog } from '$lib/utils/file-uploader';
  import { toTimelineAsset } from '$lib/utils/timeline-util';
  import type { SharedLinkResponseDto, UserResponseDto } from '@immich/sdk';
  import { IconButton, Logo } from '@immich/ui';
  import { mdiDownload, mdiFileImagePlusOutline, mdiSelectAll } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import ControlAppBar from '../shared-components/control-app-bar.svelte';
  import ThemeButton from '../shared-components/theme-button.svelte';
  import GalleryViewer from '../shared-components/gallery-viewer/gallery-viewer.svelte';
  import type { Viewport } from '$lib/managers/timeline-manager/types';
  import type { FolderResponseDto } from '$lib/types/folder-sdk';

  interface Props {
    sharedLink: SharedLinkResponseDto;
    user?: UserResponseDto | undefined;
  }

  let { sharedLink, user = undefined }: Props = $props();

  const folder = sharedLink.folder as FolderResponseDto | undefined;
  
  // Debug: log shared link data to help diagnose issues
  $effect(() => {
    if (sharedLink.type === 'FOLDER' && !folder) {
      console.error('Folder shared link missing folder data:', {
        type: sharedLink.type,
        folder: sharedLink.folder,
        sharedLinkId: sharedLink.id,
      });
    }
  });

  const viewport: Viewport = $state({ width: 0, height: 0 });
  const assetInteraction = new AssetInteraction();

  let assets = $derived(sharedLink.assets?.map((a) => toTimelineAsset(a)) || []);

  dragAndDropFilesStore.subscribe((value) => {
    if (value.isDragging && value.files.length > 0) {
      handlePromiseError(fileUploadHandler({ files: value.files, folderId: folder.id }));
      dragAndDropFilesStore.set({ isDragging: false, files: [] });
    }
  });

  const downloadAssets = async () => {
    await downloadArchive(`${folder.folderName}.zip`, { assetIds: assets.map((asset) => asset.id) });
  };

  const handleSelectAll = () => {
    assetInteraction.selectAssets(assets);
  };
</script>

<svelte:document
  use:shortcut={{
    shortcut: { key: 'Escape' },
    onShortcut: () => {
      if (assetInteraction.selectionActive) {
        cancelMultiselect(assetInteraction);
      }
    },
  }}
/>

{#if !folder}
  <main
    class="relative h-dvh overflow-hidden px-6 max-md:pt-(--navbar-height-md) pt-(--navbar-height) sm:px-12 md:px-24 lg:px-40"
  >
    <div class="flex flex-col items-center justify-center mt-20">
      <div class="text-2xl font-bold text-primary">{$t('folder_not_found')}</div>
      <div class="mt-4 text-lg text-primary">{$t('errors.unable_to_get_shared_link')}</div>
    </div>
  </main>
{:else}
  <main class="relative h-dvh overflow-hidden px-2 md:px-6 max-md:pt-(--navbar-height-md) pt-(--navbar-height)">
    <section class="pt-8 md:pt-24 px-2 md:px-0">
      <!-- FOLDER TITLE -->
      <h1 class="text-2xl md:text-4xl lg:text-6xl text-primary outline-none transition-all">
        {folder.folderName}
      </h1>

    {#if folder.assetCount > 0 || (folder.subfolderCount && folder.subfolderCount > 0)}
      <span class="my-2 flex gap-2 text-sm font-medium text-gray-500">
        {#if folder.assetCount > 0}
          <span>{$t('items_count', { values: { count: folder.assetCount } })}</span>
        {/if}
        {#if folder.subfolderCount && folder.subfolderCount > 0}
          {#if folder.assetCount > 0}
            <span>•</span>
          {/if}
          <span>{$t('subfolders_count', { values: { count: folder.subfolderCount } })}</span>
        {/if}
      </span>
    {/if}

    <!-- FOLDER DESCRIPTION -->
    {#if folder.description}
      <p
        class="whitespace-pre-line mb-12 mt-6 w-full pb-2 text-start font-medium text-base text-black dark:text-gray-300"
      >
        {folder.description}
      </p>
    {/if}
  </section>

  {#if assets.length > 0}
    <section class="my-40 mx-4" bind:clientHeight={viewport.height} bind:clientWidth={viewport.width}>
      <GalleryViewer {assets} {assetInteraction} {viewport} />
    </section>
  {:else}
    <section class="flex items-center justify-center h-[calc(100vh-200px)]">
      <p class="text-gray-500 dark:text-gray-400">{$t('empty_folder')}</p>
    </section>
  {/if}
  </main>
{/if}

<header>
  {#if assetInteraction.selectionActive}
    <AssetSelectControlBar
      ownerId={user?.id}
      assets={assetInteraction.selectedAssets}
      clearSelect={() => cancelMultiselect(assetInteraction)}
    >
      <IconButton
        shape="round"
        color="secondary"
        variant="ghost"
        aria-label={$t('select_all')}
        icon={mdiSelectAll}
        onclick={handleSelectAll}
      />
      {#if sharedLink.allowDownload && folder}
        <DownloadAction filename="{folder.folderName}.zip" />
      {/if}
    </AssetSelectControlBar>
  {:else}
    <ControlAppBar showBackButton={false}>
      {#snippet leading()}
        <a data-sveltekit-preload-data="hover" class="ms-4" href="/">
          <Logo variant={mobileDevice.maxMd ? 'icon' : 'inline'} class="min-w-10" />
        </a>
      {/snippet}

      {#snippet trailing()}
        <CastButton />

        {#if sharedLink.allowUpload && folder}
          <IconButton
            shape="round"
            color="secondary"
            variant="ghost"
            aria-label={$t('add_photos')}
            onclick={() => openFileUploadDialog({ folderId: folder.id })}
            icon={mdiFileImagePlusOutline}
          />
        {/if}

        {#if assets.length > 0 && sharedLink.allowDownload}
          <IconButton
            shape="round"
            color="secondary"
            variant="ghost"
            aria-label={$t('download')}
            onclick={downloadAssets}
            icon={mdiDownload}
          />
        {/if}
        <ThemeButton />
      {/snippet}
    </ControlAppBar>
  {/if}
</header>
