<script lang="ts">
  import { scrollMemory } from '$lib/actions/scroll-memory';
  import FoldersControls from '$lib/components/folder-page/folders-controls.svelte';
  import Folders from '$lib/components/folder-page/folders-list.svelte';
  import UserPageLayout from '$lib/components/layouts/user-page-layout.svelte';
  import EmptyPlaceholder from '$lib/components/shared-components/empty-placeholder.svelte';
  import { AppRoute } from '$lib/constants';
  import GroupTab from '$lib/elements/GroupTab.svelte';
  import SearchBar from '$lib/elements/SearchBar.svelte';
  import { FolderFilter, folderViewSettings } from '$lib/stores/preferences.store';
  import { invalidateAll } from '$app/navigation';
  import { t } from 'svelte-i18n';
  import { modalManager } from '@immich/ui';
  import FolderCreateModal from '$lib/modals/FolderCreateModal.svelte';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let searchQuery = $state('');
  let folderGroups: string[] = $state([]);
</script>

<UserPageLayout title={data.meta.title} use={[[scrollMemory, { routeStartsWith: AppRoute.FOLDERS }]]}>
  {#snippet buttons()}
    <div class="flex place-items-center gap-2">
      <FoldersControls {folderGroups} bind:searchQuery />
    </div>
  {/snippet}

  <div class="xl:hidden">
    <div class="w-fit h-14 dark:text-immich-dark-fg py-2">
      <GroupTab
        label={$t('show_folders')}
        filters={Object.keys(FolderFilter)}
        selected={$folderViewSettings.filter}
        onSelect={(selected) => ($folderViewSettings.filter = selected)}
      />
    </div>
    <div class="w-60">
      <SearchBar placeholder={$t('search_folders')} bind:name={searchQuery} showLoadingSpinner={false} />
    </div>
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
</UserPageLayout>
