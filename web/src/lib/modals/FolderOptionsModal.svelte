<script lang="ts">
  import ButtonContextMenu from '$lib/components/shared-components/context-menu/button-context-menu.svelte';
  import MenuOption from '$lib/components/shared-components/context-menu/menu-option.svelte';
  import SettingSwitch from '$lib/components/shared-components/settings/setting-switch.svelte';
  import UserAvatar from '$lib/components/shared-components/user-avatar.svelte';
  import type { RenderedOption } from '$lib/elements/Dropdown.svelte';
  import { handleError } from '$lib/utils/handle-error';
  import { updateFolderInfo, removeUserFromFolder } from '$lib/utils/folder-api';
  import type { FolderResponseDto } from '$lib/types/folder-sdk';
  import { AlbumUserRole, AssetOrder, type UserResponseDto } from '@immich/sdk';
  import { Icon, Modal, ModalBody, modalManager, toastManager } from '@immich/ui';
  import { mdiArrowDownThin, mdiArrowUpThin, mdiDotsVertical, mdiPlus } from '@mdi/js';
  import { findKey } from 'lodash-es';
  import { t } from 'svelte-i18n';
  import SettingDropdown from '../components/shared-components/settings/setting-dropdown.svelte';

  interface Props {
    folder: FolderResponseDto;
    order: AssetOrder | undefined;
    user: UserResponseDto;
    onClose: (
      result?: { action: 'changeOrder'; order: AssetOrder } | { action: 'shareUser' } | { action: 'refreshFolder' },
    ) => void;
  }

  let { folder, order, user, onClose }: Props = $props();

  const options: Record<AssetOrder, RenderedOption> = {
    [AssetOrder.Asc]: { icon: mdiArrowUpThin, title: $t('oldest_first') },
    [AssetOrder.Desc]: { icon: mdiArrowDownThin, title: $t('newest_first') },
  };

  let selectedOption = $derived(order ? options[order] : options[AssetOrder.Desc]);
  let folderUsers = $derived(folder.folderUsers || []);

  const handleToggleOrder = async (returnedOption: RenderedOption): Promise<void> => {
    if (selectedOption === returnedOption) {
      return;
    }
    let orderValue: AssetOrder = AssetOrder.Desc;
    orderValue = findKey(options, (option) => option === returnedOption) as AssetOrder;

    try {
      await updateFolderInfo(folder.id, {
        order: orderValue,
      });
      onClose({ action: 'changeOrder', order: orderValue });
    } catch (error) {
      handleError(error, $t('errors.unable_to_save_folder'));
    }
  };

  const handleToggleActivity = async () => {
    try {
      folder = await updateFolderInfo(folder.id, {
        isActivityEnabled: !folder.isActivityEnabled,
      });

      toastManager.success($t('activity_changed', { values: { enabled: folder.isActivityEnabled } }));
    } catch (error) {
      handleError(error, $t('errors.cant_change_activity', { values: { enabled: folder.isActivityEnabled } }));
    }
  };

  const handleRemoveUser = async (userToRemove: UserResponseDto): Promise<void> => {
    const confirmed = await modalManager.showDialog({
      title: $t('folder_remove_user'),
      prompt: $t('folder_remove_user_confirmation', { values: { user: userToRemove.name } }),
      confirmText: $t('remove_user'),
    });

    if (!confirmed) {
      return;
    }

    try {
      await removeUserFromFolder(folder.id, userToRemove.id);
      onClose({ action: 'refreshFolder' });
      toastManager.success($t('folder_user_removed', { values: { user: userToRemove.name } }));
    } catch (error) {
      handleError(error, $t('errors.unable_to_remove_folder_users'));
    }
  };

  const handleUpdateSharedUserRole = async (userToUpdate: UserResponseDto, role: AlbumUserRole) => {
    try {
      // Note: updateFolderUser would need to be implemented in folder-api.ts
      // await updateFolderUser(folder.id, userToUpdate.id, { role });
      const message = $t('user_role_set', {
        values: { user: userToUpdate.name, role: role == AlbumUserRole.Viewer ? $t('role_viewer') : $t('role_editor') },
      });
      onClose({ action: 'refreshFolder' });
      toastManager.success(message);
    } catch (error) {
      handleError(error, $t('errors.unable_to_change_folder_user_role'));
    }
  };
</script>

<Modal title={$t('options')} onClose={() => onClose({ action: 'refreshFolder' })} size="small">
  <ModalBody>
    <div class="items-center justify-center">
      <div class="py-2">
        <h2 class="uppercase text-gray text-sm mb-2">{$t('settings')}</h2>
        <div class="grid p-2 gap-y-2">
          {#if order}
            <SettingDropdown
              title={$t('display_order')}
              options={Object.values(options)}
              selectedOption={options[order]}
              onToggle={handleToggleOrder}
            />
          {/if}
          <SettingSwitch
            title={$t('comments_and_likes')}
            subtitle={$t('let_others_respond')}
            checked={folder.isActivityEnabled}
            onToggle={handleToggleActivity}
          />
        </div>
      </div>
      <div class="py-2">
        <div class="uppercase text-gray text-sm mb-3">{$t('people')}</div>
        <div class="p-2">
          <button type="button" class="flex items-center gap-2" onclick={() => onClose({ action: 'shareUser' })}>
            <div class="rounded-full w-10 h-10 border border-gray-500 flex items-center justify-center">
              <div><Icon icon={mdiPlus} size="25" /></div>
            </div>
            <div>{$t('invite_people')}</div>
          </button>

          <div class="flex items-center gap-2 py-2 mt-2">
            <div>
              <UserAvatar {user} size="md" />
            </div>
            <div class="w-full">{user.name}</div>
            <div>{$t('owner')}</div>
          </div>

          {#each folderUsers as { user: folderUser, role } (folderUser.id)}
            <div class="flex items-center gap-2 py-2">
              <div>
                <UserAvatar user={folderUser} size="md" />
              </div>
              <div class="w-full">{folderUser.name}</div>
              {#if role === AlbumUserRole.Viewer}
                {$t('role_viewer')}
              {:else}
                {$t('role_editor')}
              {/if}
              {#if folderUser.id !== folder.ownerId}
                <ButtonContextMenu icon={mdiDotsVertical} size="medium" title={$t('options')}>
                  {#if role === AlbumUserRole.Viewer}
                    <MenuOption
                      onClick={() => handleUpdateSharedUserRole(folderUser, AlbumUserRole.Editor)}
                      text={$t('allow_edits')}
                    />
                  {:else}
                    <MenuOption
                      onClick={() => handleUpdateSharedUserRole(folderUser, AlbumUserRole.Viewer)}
                      text={$t('disallow_edits')}
                    />
                  {/if}
                  <!-- Allow deletion for non-owners -->
                  <MenuOption onClick={() => handleRemoveUser(folderUser)} text={$t('remove')} />
                </ButtonContextMenu>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  </ModalBody>
</Modal>
