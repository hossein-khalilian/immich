<script lang="ts">
  import ButtonContextMenu from '$lib/components/shared-components/context-menu/button-context-menu.svelte';
  import MenuOption from '$lib/components/shared-components/context-menu/menu-option.svelte';
  import UserAvatar from '$lib/components/shared-components/user-avatar.svelte';
  import { handleError } from '$lib/utils/handle-error';
  import { removeUserFromFolder } from '$lib/utils/folder-api';
  import type { FolderResponseDto } from '$lib/types/folder-sdk';
  import { AlbumUserRole, getMyUser, type UserResponseDto } from '@immich/sdk';
  import { Button, Modal, ModalBody, Text, modalManager, toastManager } from '@immich/ui';
  import { mdiDotsVertical } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  interface Props {
    folder: FolderResponseDto;
    onClose: (changed?: boolean) => void;
  }

  let { folder, onClose }: Props = $props();

  let currentUser: UserResponseDto | undefined = $state();
  let folderUsers = $derived(folder.folderUsers || []);

  let isOwned = $derived(currentUser?.id == folder.ownerId);

  onMount(async () => {
    try {
      currentUser = await getMyUser();
    } catch (error) {
      handleError(error, $t('errors.unable_to_refresh_user'));
    }
  });

  const handleRemoveUser = async (user: UserResponseDto) => {
    if (!user) {
      return;
    }

    const userId = user.id === currentUser?.id ? 'me' : user.id;
    let confirmed: boolean | undefined;

    // eslint-disable-next-line unicorn/prefer-ternary
    if (userId === 'me') {
      confirmed = await modalManager.showDialog({
        title: $t('folder_leave'),
        prompt: $t('folder_leave_confirmation', { values: { folder: folder.folderName } }),
        confirmText: $t('leave'),
      });
    } else {
      confirmed = await modalManager.showDialog({
        title: $t('folder_remove_user'),
        prompt: $t('folder_remove_user_confirmation', { values: { user: user.name } }),
        confirmText: $t('remove_user'),
      });
    }

    if (!confirmed) {
      return;
    }

    try {
      await removeUserFromFolder(folder.id, userId === 'me' ? currentUser!.id : userId);
      const message =
        userId === 'me'
          ? $t('folder_user_left', { values: { folder: folder.folderName } })
          : $t('folder_user_removed', { values: { user: user.name } });
      toastManager.success(message);
      onClose(true);
    } catch (error) {
      handleError(error, $t('errors.unable_to_remove_folder_users'));
    }
  };

  const handleChangeRole = async (user: UserResponseDto, role: AlbumUserRole) => {
    try {
      // Note: updateFolderUser would need to be implemented in folder-api.ts
      // await updateFolderUser(folder.id, user.id, { role });
      const message = $t('user_role_set', {
        values: { user: user.name, role: role == AlbumUserRole.Viewer ? $t('role_viewer') : $t('role_editor') },
      });
      toastManager.success(message);
      onClose(true);
    } catch (error) {
      handleError(error, $t('errors.unable_to_change_folder_user_role'));
    }
  };
</script>

<Modal title={$t('options')} size="small" {onClose}>
  <ModalBody>
    <section class="immich-scrollbar max-h-100 overflow-y-auto pb-4">
      {#if folder.owner}
        <div class="flex w-full place-items-center justify-between gap-4 p-5 rounded-xl transition-colors">
          <div class="flex place-items-center gap-4">
            <UserAvatar user={folder.owner} size="md" />
            <div class="flex flex-col">
              <p class="font-medium">{folder.owner.name}</p>
              <Text color="muted" size="tiny">
                {$t('owner')}
              </Text>
            </div>
          </div>
        </div>
      {/if}
      {#each folderUsers as { user, role } (user.id)}
        <div class="flex w-full place-items-center justify-between gap-4 p-5 rounded-xl transition-colors">
          <div class="flex place-items-center gap-4">
            <UserAvatar {user} size="md" />
            <div class="flex flex-col">
              <p class="font-medium">{user.name}</p>
              <Text color="muted" size="tiny">
                {#if role === AlbumUserRole.Viewer}
                  {$t('role_viewer')}
                {:else}
                  {$t('role_editor')}
                {/if}
              </Text>
            </div>
          </div>

          <div id="icon-{user.id}" class="flex place-items-center">
            {#if isOwned}
              <ButtonContextMenu icon={mdiDotsVertical} size="medium" title={$t('options')}>
                {#if role === AlbumUserRole.Viewer}
                  <MenuOption onClick={() => handleChangeRole(user, AlbumUserRole.Editor)} text={$t('allow_edits')} />
                {:else}
                  <MenuOption
                    onClick={() => handleChangeRole(user, AlbumUserRole.Viewer)}
                    text={$t('disallow_edits')}
                  />
                {/if}
                <MenuOption onClick={() => handleRemoveUser(user)} text={$t('remove')} />
              </ButtonContextMenu>
            {:else if user.id == currentUser?.id}
              <Button shape="round" variant="ghost" leadingIcon={undefined} onclick={() => handleRemoveUser(user)}
                >{$t('leave')}</Button
              >
            {/if}
          </div>
        </div>
      {/each}
    </section>
  </ModalBody>
</Modal>
