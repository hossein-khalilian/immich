<script lang="ts">
  import { goto } from '$app/navigation';
  import type { Action } from '$lib/components/asset-viewer/actions/action';
  import GalleryViewer from '$lib/components/shared-components/gallery-viewer/gallery-viewer.svelte';
  import UserPageLayout from '$lib/components/layouts/user-page-layout.svelte';
  import type { Viewport } from '$lib/managers/timeline-manager/types';
  import { AssetInteraction } from '$lib/stores/asset-interaction.svelte';
  import { assetViewingStore } from '$lib/stores/asset-viewing.store';
  import { handlePromiseError } from '$lib/utils';
  import { navigate } from '$lib/utils/navigation';
  import { toTimelineAsset } from '$lib/utils/timeline-util';
  import { getAllSharedLinks, getAssetInfo, SharedLinkType, type AssetResponseDto, type SharedLinkResponseDto } from '@immich/sdk';
  import { AppRoute } from '$lib/constants';
  import { loadUser } from '$lib/utils/auth';
  import { Container, LoadingSpinner, Button } from '@immich/ui';
  import { mdiImageOffOutline, mdiLogin } from '@mdi/js';
  import { Icon } from '@immich/ui';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';
  import { page } from '$app/stores';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const viewport: Viewport = $state({ width: 0, height: 0 });
  const assetInteraction = new AssetInteraction();
  let sharedLinks: SharedLinkResponseDto[] = $state([]);
  let isLoading = $state(true);
  let allAssets: AssetResponseDto[] = $state([]);
  let isAuthenticated = $state(false);
  let authError = $state(false);

  const loadAllSharedPhotos = async () => {
    isLoading = true;
    authError = false;
    isAuthenticated = false;
    
    try {
      // Check if user is authenticated
      let user;
      try {
        user = await loadUser();
      } catch (authCheckError) {
        // If loadUser fails, user is not authenticated
        console.log('User not authenticated:', authCheckError);
        user = null;
      }
      
      isAuthenticated = !!user;

      if (!user) {
        // User is not authenticated, show empty state with login button
        isLoading = false;
        return;
      }

      // Try to load shared links - this requires authentication
      try {
        sharedLinks = await getAllSharedLinks({});
      } catch (apiError) {
        // If API call fails, user might not be authenticated after all
        console.error('Failed to load shared links:', apiError);
        isAuthenticated = false;
        isLoading = false;
        return;
      }
      
      // Aggregate all assets from all shared links
      const aggregatedAssets: AssetResponseDto[] = [];
      const seenAssetIds = new Set<string>();

      for (const sharedLink of sharedLinks) {
        if (sharedLink.type === SharedLinkType.Individual) {
          // For individual shared links, get assets directly
          for (const asset of sharedLink.assets || []) {
            if (!seenAssetIds.has(asset.id)) {
              aggregatedAssets.push(asset);
              seenAssetIds.add(asset.id);
            }
          }
        } else if (sharedLink.type === SharedLinkType.Album && sharedLink.album?.assets) {
          // For album shared links, get assets from the album
          for (const asset of sharedLink.album.assets) {
            if (!seenAssetIds.has(asset.id)) {
              aggregatedAssets.push(asset);
              seenAssetIds.add(asset.id);
            }
          }
        }
      }

      // Sort by creation date (newest first)
      allAssets = aggregatedAssets.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
    } catch (error) {
      console.error('Failed to load shared photos:', error);
      authError = true;
      isAuthenticated = false;
    } finally {
      isLoading = false;
    }
  };

  // Handle assetId from URL after assets are loaded
  $effect(() => {
    if (!isLoading && allAssets.length > 0 && $page.params.assetId) {
      const asset = allAssets.find((a) => a.id === $page.params.assetId);
      if (asset) {
        assetViewingStore.setAsset(asset);
        assetViewingStore.showAssetViewer(true);
      }
    } else if (data.asset && !isLoading) {
      // If asset was loaded from page loader, set it
      assetViewingStore.setAsset(data.asset);
      assetViewingStore.showAssetViewer(true);
    }
  });

  // Load photos immediately when component mounts
  onMount(() => {
    loadAllSharedPhotos();
  });

  let assets = $derived(allAssets.map((a) => toTimelineAsset(a)));

  const handleAction = async (action: Action) => {
    // Handle actions if needed
  };

  let galleryElement: HTMLElement;
</script>

<svelte:head>
  <title>{data.meta.title}</title>
</svelte:head>

<UserPageLayout title={data.meta.title} scrollbar={true}>
  {#snippet buttons()}
    {#if !isAuthenticated}
      <Button
        leadingIcon={mdiLogin}
        href={AppRoute.AUTH_LOGIN}
        size="small"
        variant="ghost"
        color="secondary"
      >
        {$t('login') || 'Login'}
      </Button>
    {/if}
  {/snippet}

  <Container center size="medium">
    {#if isLoading}
      <div class="flex justify-center py-16 items-center">
        <LoadingSpinner size="giant" />
      </div>
    {:else if !isAuthenticated}
      <div class="flex min-h-[calc(66vh-11rem)] w-full place-content-center items-center dark:text-white">
        <div class="flex flex-col content-center items-center text-center gap-6">
          <Icon icon={mdiImageOffOutline} size="3.5em" />
          <div class="flex flex-col gap-4 items-center">
            <p class="text-3xl font-medium">{$t('welcome_to_immich') || 'Welcome to Immich'}</p>
            <p class="text-base font-normal">{$t('login_to_view_shared_photos') || 'Please login to view shared photos'}</p>
            <Button
              leadingIcon={mdiLogin}
              href={AppRoute.AUTH_LOGIN}
              size="medium"
              shape="round"
            >
              {$t('login') || 'Login'}
            </Button>
          </div>
        </div>
      </div>
    {:else if assets.length === 0}
      <div class="flex min-h-[calc(66vh-11rem)] w-full place-content-center items-center dark:text-white">
        <div class="flex flex-col content-center items-center text-center gap-6">
          <Icon icon={mdiImageOffOutline} size="3.5em" />
          <p class="text-3xl font-medium">{$t('no_shared_photos') || 'No Shared Photos'}</p>
          <p class="text-base font-normal">{$t('no_shared_photos_description') || $t('you_dont_have_any_shared_links') || 'You don\'t have any shared links yet'}</p>
        </div>
      </div>
    {:else}
      <section
        class="mb-12 bg-immich-bg dark:bg-immich-dark-bg"
        bind:clientHeight={viewport.height}
        bind:clientWidth={viewport.width}
        bind:this={galleryElement}
      >
        <div class="mb-4 text-sm text-immich-fg/75 dark:text-immich-dark-fg/75">
          {$t('total_shared_photos_count', { values: { count: assets.length } }) || `${assets.length} ${$t('photos')}`}
        </div>
        <GalleryViewer
          assets={assets}
          {assetInteraction}
          {viewport}
          showArchiveIcon={false}
          pageHeaderOffset={galleryElement?.offsetTop || 0}
        />
      </section>
    {/if}
  </Container>
</UserPageLayout>

{#if $assetViewingStore.isViewing}
  {#await import('$lib/components/asset-viewer/asset-viewer.svelte') then { default: AssetViewer }}
    <AssetViewer
      asset={$assetViewingStore.asset}
      showNavigation={assets.length > 1}
      onAction={handleAction}
      onPrevious={async () => {
        const currentIndex = assets.findIndex((a) => a.id === $assetViewingStore.asset?.id);
        if (currentIndex > 0) {
          const prevAsset = assets[currentIndex - 1];
          handlePromiseError(navigate({ targetRoute: 'current', assetId: prevAsset.id }));
          return { id: prevAsset.id };
        }
        return undefined;
      }}
      onNext={async () => {
        const currentIndex = assets.findIndex((a) => a.id === $assetViewingStore.asset?.id);
        if (currentIndex < assets.length - 1) {
          const nextAsset = assets[currentIndex + 1];
          handlePromiseError(navigate({ targetRoute: 'current', assetId: nextAsset.id }));
          return { id: nextAsset.id };
        }
        return undefined;
      }}
      onRandom={async () => {
        const randomIndex = Math.floor(Math.random() * assets.length);
        const randomAsset = assets[randomIndex];
        handlePromiseError(navigate({ targetRoute: 'current', assetId: randomAsset.id }));
        return { id: randomAsset.id };
      }}
      onClose={() => {
        assetViewingStore.showAssetViewer(false);
        handlePromiseError(navigate({ targetRoute: 'current', assetId: null }));
      }}
    />
  {/await}
{/if}
