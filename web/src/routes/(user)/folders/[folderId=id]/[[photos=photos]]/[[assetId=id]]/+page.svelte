<script lang="ts">
  import { afterNavigate, goto, onNavigate } from '$app/navigation';
  import { scrollMemoryClearer } from '$lib/actions/scroll-memory';
  import CastButton from '$lib/cast/cast-button.svelte';
  import ActivityStatus from '$lib/components/asset-viewer/activity-status.svelte';
  import ActivityViewer from '$lib/components/asset-viewer/activity-viewer.svelte';
  import FolderDescription from '$lib/components/folder-page/folder-description.svelte';
  import FolderSummary from '$lib/components/folder-page/folder-summary.svelte';
  import FolderTitle from '$lib/components/folder-page/folder-title.svelte';
  import OnEvents from '$lib/components/OnEvents.svelte';
  import ButtonContextMenu from '$lib/components/shared-components/context-menu/button-context-menu.svelte';
  import MenuOption from '$lib/components/shared-components/context-menu/menu-option.svelte';
  import ControlAppBar from '$lib/components/shared-components/control-app-bar.svelte';
  import UserAvatar from '$lib/components/shared-components/user-avatar.svelte';
  import AddToAlbum from '$lib/components/timeline/actions/AddToAlbumAction.svelte';
  import ArchiveAction from '$lib/components/timeline/actions/ArchiveAction.svelte';
  import ChangeDate from '$lib/components/timeline/actions/ChangeDateAction.svelte';
  import ChangeDescription from '$lib/components/timeline/actions/ChangeDescriptionAction.svelte';
  import ChangeLocation from '$lib/components/timeline/actions/ChangeLocationAction.svelte';
  import CreateSharedLink from '$lib/components/timeline/actions/CreateSharedLinkAction.svelte';
  import DeleteAssets from '$lib/components/timeline/actions/DeleteAssetsAction.svelte';
  import DownloadAction from '$lib/components/timeline/actions/DownloadAction.svelte';
  import FavoriteAction from '$lib/components/timeline/actions/FavoriteAction.svelte';
  import SelectAllAssets from '$lib/components/timeline/actions/SelectAllAction.svelte';
  import SetVisibilityAction from '$lib/components/timeline/actions/SetVisibilityAction.svelte';
  import TagAction from '$lib/components/timeline/actions/TagAction.svelte';
  import AssetSelectControlBar from '$lib/components/timeline/AssetSelectControlBar.svelte';
  import Timeline from '$lib/components/timeline/Timeline.svelte';
  import { AlbumPageViewMode, AppRoute } from '$lib/constants';
  import { activityManager } from '$lib/managers/activity-manager.svelte';
  import { TimelineManager } from '$lib/managers/timeline-manager/timeline-manager.svelte';
  import type { TimelineAsset } from '$lib/managers/timeline-manager/types';
  import FolderOptionsModal from '$lib/modals/FolderOptionsModal.svelte';
  import FolderShareModal from '$lib/modals/FolderShareModal.svelte';
  import FolderUsersModal from '$lib/modals/FolderUsersModal.svelte';
  import SharedLinkCreateModal from '$lib/modals/SharedLinkCreateModal.svelte';
  import { handleDeleteFolder, handleDownloadFolder } from '$lib/services/folder.service';
  import { AssetInteraction } from '$lib/stores/asset-interaction.svelte';
  import { assetViewingStore } from '$lib/stores/asset-viewing.store';
  import { SlideshowNavigation, SlideshowState, slideshowStore } from '$lib/stores/slideshow.store';
  import { preferences, user } from '$lib/stores/user.store';
  import type { FolderResponseDto, FolderUserAddDto } from '$lib/types/folder-sdk';
  import { handlePromiseError } from '$lib/utils';
  import { cancelMultiselect } from '$lib/utils/asset-utils';
  import { openFileUploadDialog } from '$lib/utils/file-uploader';
  import { addAssetsToFolder, addUsersToFolder, getFolderInfo, updateFolderInfo } from '$lib/utils/folder-api';
  import { createSubfolder } from '$lib/utils/folder-utils';
  import { createAlbum } from '$lib/utils/album-utils';
  import { invalidateAll } from '$app/navigation';
  import Folders from '$lib/components/folder-page/folders-list.svelte';
  import AlbumCardGroup from '$lib/components/album-page/album-card-group.svelte';
  import UserPageLayout from '$lib/components/layouts/user-page-layout.svelte';
  import EmptyPlaceholder from '$lib/components/shared-components/empty-placeholder.svelte';
  import { scrollMemory } from '$lib/actions/scroll-memory';
  import { folderViewSettings } from '$lib/stores/preferences.store';
  import { handleError } from '$lib/utils/handle-error';
  import {
    isFoldersRoute,
    isPeopleRoute,
    isSearchRoute,
    navigate,
    type AssetGridRouteSearchParams,
  } from '$lib/utils/navigation';
  import { AlbumUserRole, AssetOrder, AssetVisibility } from '@immich/sdk';
  import { Button, Icon, IconButton, modalManager, toastManager } from '@immich/ui';
  import {
    mdiAccountEye,
    mdiAccountEyeOutline,
    mdiArrowLeft,
    mdiCogOutline,
    mdiDeleteOutline,
    mdiDotsVertical,
    mdiDownload,
    mdiFolderPlusOutline,
    mdiImageOutline,
    mdiImagePlusOutline,
    mdiLink,
    mdiPlus,
    mdiPlusBoxOutline,
    mdiPresentationPlay,
    mdiShareVariantOutline,
    mdiUpload,
  } from '@mdi/js';
  import { onDestroy } from 'svelte';
  import { t } from 'svelte-i18n';
  import { fly } from 'svelte/transition';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data = $bindable() }: Props = $props();

  let { isViewing: showAssetViewer, setAssetId, gridScrollTarget } = assetViewingStore;
  let { slideshowState, slideshowNavigation } = slideshowStore;

  let oldAt: AssetGridRouteSearchParams | null | undefined = $state();

  let backUrl: string = $state(AppRoute.FOLDERS);
  let viewMode: AlbumPageViewMode = $state(AlbumPageViewMode.VIEW);
  let isCreatingSharedFolder = $state(false);
  let isShowActivity = $state(false);
  let folderOrder: AssetOrder | undefined = $state(data.folder.order as AssetOrder | undefined);

  let timelineManager = $state<TimelineManager>() as TimelineManager;
  let showFolderUsers = $derived(timelineManager?.showAssetOwners ?? false);

  const assetInteraction = new AssetInteraction();
  const timelineInteraction = new AssetInteraction();

  afterNavigate(({ from }) => {
    let url: string | undefined = from?.url?.pathname;

    const route = from?.route?.id;
    if (isSearchRoute(route)) {
      url = from?.url.href;
    }

    if (isFoldersRoute(route) || isPeopleRoute(route)) {
      url = AppRoute.FOLDERS;
    }

    backUrl = url || AppRoute.FOLDERS;

    if (
      backUrl === AppRoute.SHARING &&
      folder.folderUsers &&
      folder.folderUsers.length === 0 &&
      !folder.hasSharedLink
    ) {
      isCreatingSharedFolder = true;
    } else if (backUrl === AppRoute.SHARED_LINKS) {
      backUrl = history.state?.backUrl || AppRoute.FOLDERS;
    }
  });

  const handleFavorite = async () => {
    try {
      await activityManager.toggleLike();
    } catch (error) {
      handleError(error, $t('errors.cant_change_asset_favorite'));
    }
  };

  const handleOpenAndCloseActivityTab = () => {
    isShowActivity = !isShowActivity;
  };

  const handleStartSlideshow = async () => {
    const asset =
      $slideshowNavigation === SlideshowNavigation.Shuffle
        ? await timelineManager.getRandomAsset()
        : timelineManager.months[0]?.dayGroups[0]?.viewerAssets[0]?.asset;
    if (asset) {
      handlePromiseError(setAssetId(asset.id).then(() => ($slideshowState = SlideshowState.PlaySlideshow)));
    }
  };

  const handleEscape = async () => {
    timelineManager.suspendTransitions = true;
    if (viewMode === AlbumPageViewMode.SELECT_THUMBNAIL) {
      viewMode = AlbumPageViewMode.VIEW;
      return;
    }
    if (viewMode === AlbumPageViewMode.SELECT_ASSETS) {
      await handleCloseSelectAssets();
      return;
    }
    if (viewMode === AlbumPageViewMode.OPTIONS) {
      viewMode = AlbumPageViewMode.VIEW;
      return;
    }
    if ($showAssetViewer) {
      return;
    }
    if (assetInteraction.selectionActive) {
      cancelMultiselect(assetInteraction);
      return;
    }
    await goto(backUrl);
    return;
  };

  const refreshFolder = async () => {
    folder = await getFolderInfo(folder.id);
  };

  const handleAddAssets = async () => {
    const assetIds = timelineInteraction.selectedAssets.map((asset) => asset.id);

    try {
      const results = await addAssetsToFolder(folder.id, assetIds);

      const count = results.filter(({ success }: { success: boolean }) => success).length;
      toastManager.success($t('assets_added_count', { values: { count } }));

      await refreshFolder();

      timelineInteraction.clearMultiselect();
      await setModeToView();
    } catch (error) {
      handleError(error, $t('errors.error_adding_assets_to_folder'));
    }
  };

  const setModeToView = async () => {
    timelineManager.suspendTransitions = true;
    viewMode = AlbumPageViewMode.VIEW;
    await navigate(
      { targetRoute: 'current', assetId: null, assetGridRouteSearchParams: { at: oldAt?.at } },
      { replaceState: true, forceNavigate: true },
    );
    oldAt = null;
  };

  const handleCloseSelectAssets = async () => {
    timelineInteraction.clearMultiselect();
    await setModeToView();
  };

  const handleSelectFromComputer = async () => {
    await openFileUploadDialog({ folderId: folder.id });
    timelineInteraction.clearMultiselect();
    await setModeToView();
  };

  const handleAddUsers = async (folderUsers: FolderUserAddDto[]) => {
    try {
      await addUsersToFolder(folder.id, { folderUsers });
      await refreshFolder();

      viewMode = AlbumPageViewMode.VIEW;
    } catch (error) {
      handleError(error, $t('errors.error_adding_users_to_folder'));
    }
  };

  const handleSetVisibility = (assetIds: string[]) => {
    timelineManager.removeAssets(assetIds);
    assetInteraction.clearMultiselect();
  };

  const handleRemoveAssets = async (assetIds: string[]) => {
    timelineManager.removeAssets(assetIds);
    await refreshFolder();
  };

  const handleUndoRemoveAssets = async (assets: TimelineAsset[]) => {
    timelineManager.upsertAssets(assets);
    await refreshFolder();
  };

  const handleUpdateThumbnail = async (assetId: string) => {
    if (viewMode !== AlbumPageViewMode.SELECT_THUMBNAIL) {
      return;
    }

    await updateThumbnail(assetId);

    viewMode = AlbumPageViewMode.VIEW;
    assetInteraction.clearMultiselect();
  };

  const updateThumbnailUsingCurrentSelection = async () => {
    if (assetInteraction.selectedAssets.length === 1) {
      const [firstAsset] = assetInteraction.selectedAssets;
      assetInteraction.clearMultiselect();
      await updateThumbnail(firstAsset.id);
    }
  };

  const updateThumbnail = async (assetId: string) => {
    try {
      await updateFolderInfo(folder.id, {
        folderThumbnailAssetId: assetId,
      });
      toastManager.success($t('folder_cover_updated'));
    } catch (error) {
      handleError(error, $t('errors.unable_to_update_folder_cover'));
    }
  };

  onNavigate(async ({ to }) => {
    if (!isFoldersRoute(to?.route.id) && folder.assetCount === 0 && !folder.folderName) {
      await handleDeleteFolder(folder, { notify: false, prompt: false });
    }
  });

  let folder = $derived(data.folder);
  let folderId = $derived(folder.id);
  let folderUsers = $derived(folder.folderUsers || []);
  let subfolders = $derived(data.subfolders || []);
  let albums = $derived(data.albums || []);

  const containsEditors = $derived(folder?.shared && folderUsers.some(({ role }) => role === AlbumUserRole.Editor));
  const folderUsersList = $derived(
    showFolderUsers && containsEditors ? [folder.owner, ...folderUsers.map(({ user }) => user)] : [],
  );

  $effect(() => {
    if (!folder.isActivityEnabled && activityManager.commentCount === 0) {
      isShowActivity = false;
    }
  });

  const options = $derived.by(() => {
    if (viewMode === AlbumPageViewMode.SELECT_ASSETS) {
      return {
        visibility: AssetVisibility.Timeline,
        withPartners: true,
        timelineFolderId: folderId,
      };
    }
    return { folderId, order: folderOrder };
  });

  const isShared = $derived(viewMode === AlbumPageViewMode.SELECT_ASSETS ? false : folderUsers.length > 0);

  $effect(() => {
    if ($showAssetViewer || !isShared) {
      return;
    }

    handlePromiseError(activityManager.init(folder.id));
  });

  onDestroy(() => activityManager.reset());

  let isOwned = $derived($user.id == folder.ownerId);

  let showActivityStatus = $derived(
    folderUsers.length > 0 && !$showAssetViewer && (folder.isActivityEnabled || activityManager.commentCount > 0),
  );
  let isEditor = $derived(
    folderUsers.find(({ user: { id } }) => id === $user.id)?.role === AlbumUserRole.Editor ||
      folder.ownerId === $user.id,
  );

  let folderHasViewers = $derived(folderUsers.some(({ role }) => role === AlbumUserRole.Viewer));
  const isSelectionMode = $derived(
    viewMode === AlbumPageViewMode.SELECT_ASSETS ? true : viewMode === AlbumPageViewMode.SELECT_THUMBNAIL,
  );
  const singleSelect = $derived(
    viewMode === AlbumPageViewMode.SELECT_ASSETS ? false : viewMode === AlbumPageViewMode.SELECT_THUMBNAIL,
  );
  const showArchiveIcon = $derived(viewMode !== AlbumPageViewMode.SELECT_ASSETS);
  const onSelect = ({ id }: { id: string }) => {
    if (viewMode !== AlbumPageViewMode.SELECT_ASSETS) {
      void handleUpdateThumbnail(id);
    }
  };
  const currentAssetIntersection = $derived(
    viewMode === AlbumPageViewMode.SELECT_ASSETS ? timelineInteraction : assetInteraction,
  );

  const handleShare = async () => {
    const result = await modalManager.show(FolderShareModal, { folder });

    switch (result?.action) {
      case 'sharedLink': {
        await handleShareLink();
        return;
      }

      case 'sharedUsers': {
        await handleAddUsers(result.data);
        return;
      }
    }
  };

  const onSharedLinkCreate = async () => {
    await refreshFolder();
  };

  const onFolderDelete = async ({ id }: FolderResponseDto) => {
    if (id === folder.id) {
      await goto(backUrl);
      viewMode = AlbumPageViewMode.VIEW;
    }
  };

  const handleShareLink = async () => {
    await modalManager.show(SharedLinkCreateModal, { folderId: folder.id });
  };

  const handleEditUsers = async () => {
    const changed = await modalManager.show(FolderUsersModal, { folder });

    if (changed) {
      await refreshFolder();
    }
  };

  const handleOptions = async () => {
    const result = await modalManager.show(FolderOptionsModal, { folder, order: folderOrder, user: $user });

    if (!result) {
      return;
    }

    switch (result.action) {
      case 'changeOrder': {
        folderOrder = result.order;
        break;
      }
      case 'shareUser': {
        await handleShare();
        break;
      }
      case 'refreshFolder': {
        await refreshFolder();
        break;
      }
    }
  };
</script>

<OnEvents {onSharedLinkCreate} {onFolderDelete} />

<UserPageLayout title={folder.folderName} use={[[scrollMemory, { routeStartsWith: AppRoute.FOLDERS }]]}>
  {#snippet buttons()}
    <div class="flex place-items-center gap-2">
      <IconButton
        variant="ghost"
        shape="round"
        color="secondary"
        aria-label={$t('back')}
        icon={mdiArrowLeft}
        onclick={() => goto(backUrl)}
      />
      <ButtonContextMenu icon={mdiPlusBoxOutline} title={$t('create')}>
        <MenuOption
          icon={mdiFolderPlusOutline}
          text={$t('create_subfolder')}
          onClick={async () => {
            await createSubfolder(folder.id);
            await invalidateAll();
          }}
        />
        <MenuOption
          icon={mdiImagePlusOutline}
          text={$t('create_album')}
          onClick={async () => {
            await createAlbum();
            await invalidateAll();
          }}
        />
      </ButtonContextMenu>
    </div>
  {/snippet}

  <!-- Subfolders -->
  <Folders
    ownedFolders={subfolders}
    sharedFolders={[]}
    userSettings={$folderViewSettings}
    allowEdit
    searchQuery=""
    folderGroupIds={[]}
    onlyRootFolders={false}
  >
    {#snippet empty()}
      {#if albums.length === 0}
        <EmptyPlaceholder
          text={$t('empty_folder')}
          class="mt-10 mx-auto"
        />
      {/if}
    {/snippet}
  </Folders>

  <!-- Albums -->
  {#if albums.length > 0}
    <div class="mt-8">
      <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase">
        {$t('albums')}
      </h2>
      <AlbumCardGroup
        albums={albums}
        showDateRange={false}
        showItemCount={true}
      />
    </div>
  {/if}
</UserPageLayout>
