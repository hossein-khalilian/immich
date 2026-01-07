<script lang="ts">
  import { scrollMemory } from '$lib/actions/scroll-memory';
  import LibraryControls from '$lib/components/library-page/library-controls.svelte';
  import Folders from '$lib/components/folder-page/folders-list.svelte';
  import Albums from '$lib/components/album-page/albums-list.svelte';
  import UserPageLayout from '$lib/components/layouts/user-page-layout.svelte';
  import EmptyPlaceholder from '$lib/components/shared-components/empty-placeholder.svelte';
  import { AppRoute } from '$lib/constants';
  import GroupTab from '$lib/elements/GroupTab.svelte';
  import SearchBar from '$lib/elements/SearchBar.svelte';
  import { FolderFilter, folderViewSettings, AlbumFilter, albumViewSettings } from '$lib/stores/preferences.store';
  import { invalidateAll } from '$app/navigation';
  import { t } from 'svelte-i18n';
  import { modalManager } from '@immich/ui';
  import FolderCreateModal from '$lib/modals/FolderCreateModal.svelte';
  import { mdiFolderOutline, mdiImageAlbum } from '@mdi/js';
  import { Icon } from '@immich/ui';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let searchQuery = $state('');
  let folderGroups: string[] = $state([]);
  let albumGroups: string[] = $state([]);

  const totalFolders = $derived(data.folders.length + data.sharedFolders.length);
  const totalAlbums = $derived(data.albums.length + data.sharedAlbums.length);
  const totalItems = $derived(totalFolders + totalAlbums);
</script>

<UserPageLayout title={data.meta.title} use={[[scrollMemory, { routeStartsWith: AppRoute.FOLDERS }]]}>
  {#snippet buttons()}
    <div class="flex place-items-center gap-2">
      <LibraryControls {folderGroups} {albumGroups} bind:searchQuery />
    </div>
  {/snippet}

  <div class="xl:hidden">
    <div class="w-fit h-14 dark:text-immich-dark-fg py-2">
      <GroupTab
        label={$t('library')}
        filters={[FolderFilter.All, FolderFilter.Owned, FolderFilter.Shared]}
        selected={$folderViewSettings.filter}
        onSelect={(selected) => {
          // Update both folder and album filters to match
          $folderViewSettings.filter = selected;
          $albumViewSettings.filter = selected;
        }}
      />
    </div>
    <div class="w-60">
      <SearchBar placeholder={$t('search')} bind:name={searchQuery} showLoadingSpinner={false} />
    </div>
  </div>

  <!-- Folders Section -->
  {#if totalFolders > 0}
    <div class="mb-8">
      <div class="flex items-center gap-2 mb-4">
        <Icon icon={mdiFolderOutline} size="20" class="text-immich-primary dark:text-immich-dark-primary" />
        <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          {$t('folders')} ({totalFolders})
        </h2>
      </div>
      <Folders
        ownedFolders={data.folders}
        sharedFolders={data.sharedFolders}
        userSettings={$folderViewSettings}
        allowEdit
        {searchQuery}
        bind:folderGroupIds={folderGroups}
        onlyRootFolders={true}
      >
        {#snippet empty()}
          <EmptyPlaceholder
            text={$t('no_folders_message')}
            onClick={async () => {
              const result = await modalManager.show(FolderCreateModal, {});
              if (result) {
                await invalidateAll();
              }
            }}
            class="mt-10 mx-auto"
          />
        {/snippet}
      </Folders>
    </div>
  {/if}

  <!-- Separator between Folders and Albums -->
  {#if totalFolders > 0 && totalAlbums > 0}
    <hr class="my-8 border-gray-300 dark:border-gray-600" />
  {/if}

  <!-- Albums Section -->
  {#if totalAlbums > 0}
    <div class="mt-6">
      <div class="flex items-center gap-2 mb-4">
        <Icon icon={mdiImageAlbum} size="20" class="text-immich-primary dark:text-immich-dark-primary" />
        <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          {$t('albums')} ({totalAlbums})
        </h2>
      </div>
      <Albums
        ownedAlbums={data.albums}
        sharedAlbums={data.sharedAlbums}
        userSettings={$albumViewSettings}
        allowEdit
        {searchQuery}
        bind:albumGroupIds={albumGroups}
      >
        {#snippet empty()}
          <EmptyPlaceholder text={$t('no_albums_message')} onClick={() => {}} class="mt-10 mx-auto" />
        {/snippet}
      </Albums>
    </div>
  {/if}

  <!-- Empty State when both are empty -->
  {#if totalItems === 0}
    <EmptyPlaceholder
      text={$t('no_folders_message')}
      onClick={async () => {
        const result = await modalManager.show(FolderCreateModal, {});
        if (result) {
          await invalidateAll();
        }
      }}
      class="mt-10 mx-auto"
    />
  {/if}
</UserPageLayout>
