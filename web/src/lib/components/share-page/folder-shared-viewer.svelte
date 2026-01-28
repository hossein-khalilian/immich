<script lang="ts">
  import { shortcut } from '$lib/actions/shortcut';
  import CastButton from '$lib/cast/cast-button.svelte';
  import FolderSummary from '$lib/components/folder-page/folder-summary.svelte';
  import DownloadAction from '$lib/components/timeline/actions/DownloadAction.svelte';
  import SelectAllAssets from '$lib/components/timeline/actions/SelectAllAction.svelte';
  import AssetSelectControlBar from '$lib/components/timeline/AssetSelectControlBar.svelte';
  import Timeline from '$lib/components/timeline/Timeline.svelte';
  import Folders from '$lib/components/folder-page/folders-list.svelte';
  import Albums from '$lib/components/album-page/albums-list.svelte';
  import EmptyPlaceholder from '$lib/components/shared-components/empty-placeholder.svelte';
  import { TimelineManager } from '$lib/managers/timeline-manager/timeline-manager.svelte';
  import { handleDownloadFolder } from '$lib/services/folder.service';
  import { AssetInteraction } from '$lib/stores/asset-interaction.svelte';
  import { assetViewingStore } from '$lib/stores/asset-viewing.store';
  import { dragAndDropFilesStore } from '$lib/stores/drag-and-drop-files.store';
  import { mobileDevice } from '$lib/stores/mobile-device.svelte';
  import { SlideshowNavigation, SlideshowState, slideshowStore } from '$lib/stores/slideshow.store';
  import { folderViewSettings, albumViewSettings } from '$lib/stores/preferences.store';
  import { handlePromiseError } from '$lib/utils';
  import { cancelMultiselect } from '$lib/utils/asset-utils';
  import { fileUploadHandler, openFileUploadDialog } from '$lib/utils/file-uploader';
  import type { SharedLinkResponseDto, UserResponseDto } from '@immich/sdk';
  import type { FolderResponseDto } from '$lib/types/folder-sdk';
  import { IconButton, Logo, Icon } from '@immich/ui';
  import { mdiDownload, mdiFileImagePlusOutline, mdiPresentationPlay, mdiFolderOutline, mdiImageOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import ControlAppBar from '../shared-components/control-app-bar.svelte';
  import ThemeButton from '../shared-components/theme-button.svelte';

  interface Props {
    sharedLink: SharedLinkResponseDto;
    user?: UserResponseDto | undefined;
  }

  let { sharedLink, user = undefined }: Props = $props();

  // Ensure folder exists and has defaults for missing properties
  const rawFolder = sharedLink.folder;
  const folder = $derived({
    ...rawFolder,
    folderName: rawFolder?.folderName ?? '',
    description: rawFolder?.description ?? '',
    assetCount: rawFolder?.assetCount ?? 0,
    albumCount: rawFolder?.albumCount ?? 0,
    subfolderCount: (rawFolder as any)?.subfolderCount ?? 0,
    albums: rawFolder?.albums ?? [],
    id: rawFolder?.id ?? '',
    folderThumbnailAssetId: rawFolder?.folderThumbnailAssetId ?? null,
  } as FolderResponseDto);

  let { isViewing: showAssetViewer, setAssetId } = assetViewingStore;
  let { slideshowState, slideshowNavigation } = slideshowStore;

  const options = $derived({ folderId: folder.id });
  let timelineManager = $state<TimelineManager>() as TimelineManager;

  const assetInteraction = new AssetInteraction();

  // Get subfolders and albums from the folder data
  let subfolders = $derived((folder as any).subfolders || []);
  let folderAlbums = $derived(folder.albums || []);

  dragAndDropFilesStore.subscribe((value) => {
    if (value.isDragging && value.files.length > 0) {
      handlePromiseError(fileUploadHandler({ files: value.files, folderId: folder.id }));
      dragAndDropFilesStore.set({ isDragging: false, files: [] });
    }
  });

  const handleStartSlideshow = async () => {
    const asset =
      $slideshowNavigation === SlideshowNavigation.Shuffle
        ? await timelineManager.getRandomAsset()
        : timelineManager.months[0]?.dayGroups[0]?.viewerAssets[0]?.asset;
    if (asset) {
      handlePromiseError(setAssetId(asset.id).then(() => ($slideshowState = SlideshowState.PlaySlideshow)));
    }
  };

  // Check if folder has any direct assets (via timeline) or contains subfolders/albums
  let hasSubfoldersOrAlbums = $derived(subfolders.length > 0 || folderAlbums.length > 0);
  let folderGroups: string[] = $state([]);
  let albumGroups: string[] = $state([]);
  let searchQuery = $state('');
</script>

<svelte:document
  use:shortcut={{
    shortcut: { key: 'Escape' },
    onShortcut: () => {
      if (!$showAssetViewer && assetInteraction.selectionActive) {
        cancelMultiselect(assetInteraction);
      }
    },
  }}
/>

<main class="relative h-dvh overflow-hidden px-2 md:px-6 max-md:pt-(--navbar-height-md) pt-(--navbar-height)">
  <div class="immich-scrollbar h-full overflow-y-auto pb-20">
    <section class="pt-8 md:pt-24 px-2 md:px-0">
      <!-- FOLDER TITLE -->
      <h1 class="text-2xl md:text-4xl lg:text-6xl text-primary outline-none transition-all">
        {folder.folderName}
      </h1>

      <FolderSummary {folder} />

      <!-- FOLDER DESCRIPTION -->
      {#if folder.description}
        <p
          class="whitespace-pre-line mb-12 mt-6 w-full pb-2 text-start font-medium text-base text-black dark:text-gray-300"
        >
          {folder.description}
        </p>
      {/if}
    </section>

    <!-- Subfolders and Albums -->
    {#if hasSubfoldersOrAlbums}
      <section class="px-2 md:px-0">
        <!-- Subfolders Section -->
        {#if subfolders.length > 0}
          <div class="mb-8">
            <div class="flex items-center gap-2 mb-4">
              <Icon icon={mdiFolderOutline} size="20" class="text-immich-primary dark:text-immich-dark-primary" />
              <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                {$t('folders')} ({subfolders.length})
              </h2>
            </div>
            <Folders
              ownedFolders={subfolders}
              sharedFolders={[]}
              userSettings={$folderViewSettings}
              allowEdit={false}
              {searchQuery}
              bind:folderGroupIds={folderGroups}
              onlyRootFolders={false}
            >
              {#snippet empty()}
                <!-- Empty handled above -->
              {/snippet}
            </Folders>
          </div>
        {/if}

        <!-- Albums Section -->
        {#if folderAlbums.length > 0}
          <div class="mt-6">
            <div class="flex items-center gap-2 mb-4">
              <Icon icon={mdiImageOutline} size="20" class="text-immich-primary dark:text-immich-dark-primary" />
              <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                {$t('albums')} ({folderAlbums.length})
              </h2>
            </div>
            <Albums
              ownedAlbums={folderAlbums}
              sharedAlbums={[]}
              userSettings={$albumViewSettings}
              allowEdit={false}
              {searchQuery}
              bind:albumGroupIds={albumGroups}
            >
              {#snippet empty()}
                <!-- Empty handled above -->
              {/snippet}
            </Albums>
          </div>
        {/if}
      </section>
    {/if}

    <!-- Assets Timeline -->
    {#if folder.id}
      <section class="px-2 md:px-0 mt-8">
        <Timeline enableRouting={true} bind:timelineManager {options} {assetInteraction}>
          {#snippet empty()}
            {#if !hasSubfoldersOrAlbums}
              <EmptyPlaceholder text={$t('empty_folder')} class="mt-10 mx-auto" />
            {/if}
          {/snippet}
        </Timeline>
      </section>
    {/if}
  </div>
</main>

<header>
  {#if assetInteraction.selectionActive}
    <AssetSelectControlBar
      ownerId={user?.id}
      assets={assetInteraction.selectedAssets}
      clearSelect={() => assetInteraction.clearMultiselect()}
    >
      <SelectAllAssets {timelineManager} {assetInteraction} />
      {#if sharedLink.allowDownload}
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

        {#if sharedLink.allowUpload}
          <IconButton
            shape="round"
            color="secondary"
            variant="ghost"
            aria-label={$t('add_photos')}
            onclick={() => openFileUploadDialog({ folderId: folder.id })}
            icon={mdiFileImagePlusOutline}
          />
        {/if}

        {#if folder.assetCount > 0 && sharedLink.allowDownload}
          <IconButton
            shape="round"
            variant="ghost"
            color="secondary"
            aria-label={$t('slideshow')}
            onclick={handleStartSlideshow}
            icon={mdiPresentationPlay}
          />
        {/if}
        
        {#if sharedLink.allowDownload}
          <IconButton
            shape="round"
            color="secondary"
            variant="ghost"
            aria-label={$t('download')}
            onclick={() => handleDownloadFolder(folder)}
            icon={mdiDownload}
          />
        {/if}
        <ThemeButton />
      {/snippet}
    </ControlAppBar>
  {/if}
</header>
