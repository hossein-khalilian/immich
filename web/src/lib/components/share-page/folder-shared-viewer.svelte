<script lang="ts">
  import { shortcut } from '$lib/actions/shortcut';
  import CastButton from '$lib/cast/cast-button.svelte';
  import FolderSummary from '$lib/components/folder-page/folder-summary.svelte';
  import DownloadAction from '$lib/components/timeline/actions/DownloadAction.svelte';
  import SelectAllAssets from '$lib/components/timeline/actions/SelectAllAction.svelte';
  import AssetSelectControlBar from '$lib/components/timeline/AssetSelectControlBar.svelte';
  import Timeline from '$lib/components/timeline/Timeline.svelte';
  import FolderCard from '$lib/components/folder-page/folder-card.svelte';
  import AlbumCard from '$lib/components/album-page/album-card.svelte';
  import EmptyPlaceholder from '$lib/components/shared-components/empty-placeholder.svelte';
  import { TimelineManager } from '$lib/managers/timeline-manager/timeline-manager.svelte';
  import { handleDownloadFolder } from '$lib/services/folder.service';
  import { AssetInteraction } from '$lib/stores/asset-interaction.svelte';
  import { assetViewingStore } from '$lib/stores/asset-viewing.store';
  import { dragAndDropFilesStore } from '$lib/stores/drag-and-drop-files.store';
  import { mobileDevice } from '$lib/stores/mobile-device.svelte';
  import { SlideshowNavigation, SlideshowState, slideshowStore } from '$lib/stores/slideshow.store';
  import { handlePromiseError } from '$lib/utils';
  import { cancelMultiselect } from '$lib/utils/asset-utils';
  import { fileUploadHandler, openFileUploadDialog } from '$lib/utils/file-uploader';
  import { getFolderInfoWithQuery, getSubfoldersWithQuery } from '$lib/utils/folder-api';
  import { handleError } from '$lib/utils/handle-error';
  import type { SharedLinkResponseDto, UserResponseDto, AlbumResponseDto } from '@immich/sdk';
  import type { FolderResponseDto } from '$lib/types/folder-sdk';
  import { IconButton, Logo, Icon } from '@immich/ui';
  import { mdiDownload, mdiFileImagePlusOutline, mdiPresentationPlay, mdiFolderOutline, mdiImageOutline, mdiChevronRight, mdiArrowLeft, mdiHome } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import ControlAppBar from '../shared-components/control-app-bar.svelte';
  import ThemeButton from '../shared-components/theme-button.svelte';
  import AlbumViewer from '$lib/components/album-page/album-viewer.svelte';

  interface Props {
    sharedLink: SharedLinkResponseDto;
    user?: UserResponseDto | undefined;
  }

  let { sharedLink, user = undefined }: Props = $props();

  // Get the shared link key/slug for API calls
  const sharedLinkKey = sharedLink.key;
  const sharedLinkSlug = (sharedLink as any).slug;
  const sharedLinkQuery = { key: sharedLinkKey, slug: sharedLinkSlug };

  // State for navigation within the shared folder
  type ViewMode = 'folder' | 'album';
  let viewMode = $state<ViewMode>('folder');
  let selectedAlbum = $state<AlbumResponseDto | null>(null);

  // Root folder from shared link
  const rootFolder = sharedLink.folder;
  const rootFolderId = rootFolder?.id ?? '';

  // Current folder state (can change as user navigates)
  let currentFolderId = $state(rootFolderId);
  let currentFolder = $state<FolderResponseDto | null>(null);
  let currentSubfolders = $state<FolderResponseDto[]>([]);
  let breadcrumbPath = $state<Array<{ id: string; name: string }>>([]);
  let isLoading = $state(false);

  // Initialize with root folder data
  $effect(() => {
    if (rootFolder && currentFolderId === rootFolderId) {
      currentFolder = {
        ...rootFolder,
        folderName: rootFolder?.folderName ?? '',
        description: rootFolder?.description ?? '',
        assetCount: rootFolder?.assetCount ?? 0,
        albumCount: rootFolder?.albumCount ?? 0,
        subfolderCount: (rootFolder as any)?.subfolderCount ?? 0,
        albums: rootFolder?.albums ?? [],
        id: rootFolder?.id ?? '',
        folderThumbnailAssetId: rootFolder?.folderThumbnailAssetId ?? null,
      } as FolderResponseDto;
      currentSubfolders = (rootFolder as any).subfolders || [];
      breadcrumbPath = [{ id: rootFolderId, name: rootFolder?.folderName ?? 'Folder' }];
    }
  });

  // Navigate to a subfolder
  const navigateToFolder = async (folderId: string, folderName: string) => {
    if (isLoading) return;
    isLoading = true;
    
    try {
      const [folderData, subfolders] = await Promise.all([
        getFolderInfoWithQuery(folderId, sharedLinkQuery),
        getSubfoldersWithQuery(folderId, sharedLinkQuery),
      ]);
      
      currentFolderId = folderId;
      currentFolder = folderData;
      currentSubfolders = subfolders;
      
      // Update breadcrumb
      const existingIndex = breadcrumbPath.findIndex(b => b.id === folderId);
      if (existingIndex >= 0) {
        // Going back in breadcrumb - truncate to that point
        breadcrumbPath = breadcrumbPath.slice(0, existingIndex + 1);
      } else {
        // Going deeper - add to breadcrumb
        breadcrumbPath = [...breadcrumbPath, { id: folderId, name: folderName }];
      }
      
      // Reset view mode to folder
      viewMode = 'folder';
      selectedAlbum = null;
    } catch (error) {
      handleError(error, $t('errors.unable_to_load_folder'));
    } finally {
      isLoading = false;
    }
  };

  // Navigate to view an album
  const navigateToAlbum = (album: AlbumResponseDto) => {
    viewMode = 'album';
    selectedAlbum = album;
  };

  // Go back to folder view from album
  const backToFolder = () => {
    viewMode = 'folder';
    selectedAlbum = null;
  };

  // Go back to parent folder
  const navigateToParent = () => {
    if (breadcrumbPath.length > 1) {
      const parentIndex = breadcrumbPath.length - 2;
      const parent = breadcrumbPath[parentIndex];
      navigateToFolder(parent.id, parent.name);
    }
  };

  // Derived folder data
  const folder = $derived(currentFolder ?? {
    folderName: '',
    description: '',
    assetCount: 0,
    albumCount: 0,
    subfolderCount: 0,
    albums: [],
    id: '',
    folderThumbnailAssetId: null,
  } as FolderResponseDto);

  let { isViewing: showAssetViewer, setAssetId } = assetViewingStore;
  let { slideshowState, slideshowNavigation } = slideshowStore;

  const options = $derived({ folderId: folder.id });
  let timelineManager = $state<TimelineManager>() as TimelineManager;

  const assetInteraction = new AssetInteraction();

  // Get subfolders and albums from current folder data
  let subfolders = $derived(currentSubfolders);
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
  let isAtRoot = $derived(currentFolderId === rootFolderId);
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

{#if viewMode === 'album' && selectedAlbum}
  <!-- Album Viewer Mode -->
  <AlbumViewer sharedLink={{ ...sharedLink, album: selectedAlbum, type: 'ALBUM' as any }} onBack={backToFolder} enableRouting={false} />
{:else}
  <!-- Folder Viewer Mode -->
<main class="relative h-dvh overflow-hidden px-2 md:px-6 max-md:pt-(--navbar-height-md) pt-(--navbar-height)">
  <div class="immich-scrollbar h-full overflow-y-auto pb-20">
    <section class="pt-8 md:pt-24 px-2 md:px-0">
        <!-- Breadcrumb Navigation -->
        {#if breadcrumbPath.length > 1}
          <nav class="flex items-center gap-1 text-sm mb-4 flex-wrap">
            {#each breadcrumbPath as crumb, index}
              {#if index > 0}
                <Icon icon={mdiChevronRight} size="16" class="text-gray-400" />
              {/if}
              {#if index < breadcrumbPath.length - 1}
                <button
                  type="button"
                  onclick={() => navigateToFolder(crumb.id, crumb.name)}
                  class="text-immich-primary dark:text-immich-dark-primary hover:underline cursor-pointer"
                >
                  {index === 0 ? (crumb.name || $t('home')) : crumb.name}
                </button>
              {:else}
                <span class="text-gray-600 dark:text-gray-400">{crumb.name}</span>
              {/if}
            {/each}
          </nav>
        {/if}

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

      <!-- Loading indicator -->
      {#if isLoading}
        <div class="flex justify-center items-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-immich-primary"></div>
        </div>
      {:else}
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
                <div class="grid grid-auto-fill-56 gap-y-4">
                  {#each subfolders as subfolder (subfolder.id)}
                    <FolderCard
                      folder={subfolder}
                      showOwner={false}
                      showDateRange
                      showItemCount
                      onclick={() => navigateToFolder(subfolder.id, subfolder.folderName)}
                    />
                  {/each}
                </div>
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
                <div class="grid grid-auto-fill-56 gap-y-4">
                  {#each folderAlbums as album (album.id)}
                    <AlbumCard
                      {album}
                      showOwner={false}
                      showDateRange
                      showItemCount
                      onclick={() => navigateToAlbum(album)}
                    />
                  {/each}
                </div>
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
    {/if}
  </div>
</main>
{/if}

{#if viewMode === 'folder'}
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
      <ControlAppBar showBackButton={!isAtRoot} onClose={navigateToParent}>
      {#snippet leading()}
          {#if !isAtRoot}
            <IconButton
              shape="round"
              color="secondary"
              variant="ghost"
              aria-label={$t('go_back')}
              onclick={navigateToParent}
              icon={mdiArrowLeft}
            />
          {/if}
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
{/if}
