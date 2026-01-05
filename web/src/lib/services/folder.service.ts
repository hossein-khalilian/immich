import { goto } from '$app/navigation';
import ToastAction from '$lib/components/ToastAction.svelte';
import { AppRoute } from '$lib/constants';
import { eventManager } from '$lib/managers/event-manager.svelte';
import { downloadArchive } from '$lib/utils/asset-utils';
import { handleError } from '$lib/utils/handle-error';
import { getFormatter } from '$lib/utils/i18n';
import { deleteFolder, updateFolderInfo } from '$lib/utils/folder-api';
import type { FolderResponseDto, UpdateFolderDto } from '$lib/types/folder-sdk';
import { modalManager, toastManager } from '@immich/ui';

export const handleUpdateFolder = async ({ id }: { id: string }, dto: UpdateFolderDto) => {
  const $t = await getFormatter();

  try {
    const response = await updateFolderInfo(id, dto);
    eventManager.emit('FolderUpdate', response);
    toastManager.custom({
      component: ToastAction,
      props: {
        color: 'primary',
        title: $t('success'),
        description: $t('folder_info_updated'),
        button: {
          text: $t('view_folder'),
          color: 'primary',
          onClick() {
            return goto(`${AppRoute.FOLDERS}/${id}`);
          },
        },
      },
    });

    return true;
  } catch (error) {
    handleError(error, $t('errors.unable_to_update_folder_info'));
  }
};

export const handleDeleteFolder = async (folder: FolderResponseDto, options?: { prompt?: boolean; notify?: boolean }) => {
  const $t = await getFormatter();
  const { prompt = true, notify = true } = options ?? {};

  if (prompt) {
    const confirmation =
      folder.folderName.length > 0
        ? $t('folder_delete_confirmation', { values: { folder: folder.folderName } })
        : $t('unnamed_folder_delete_confirmation');
    const description = $t('folder_delete_confirmation_description');
    const success = await modalManager.showDialog({ prompt: `${confirmation} ${description}` });
    if (!success) {
      return false;
    }
  }

  try {
    await deleteFolder(folder.id);
    eventManager.emit('FolderDelete', folder);
    if (notify) {
      toastManager.success();
    }
    return true;
  } catch (error) {
    handleError(error, $t('errors.unable_to_delete_folder'));
    return false;
  }
};

export const handleDownloadFolder = async (folder: FolderResponseDto) => {
  // TODO: Update downloadArchive to support folderId when SDK is regenerated
  // For now, we'll need to get the asset IDs from the folder first
  // await downloadArchive(`${folder.folderName}.zip`, { folderId: folder.id });
  
  // Temporary workaround: download using assetIds if available
  // This will be fixed when the SDK is regenerated with folder support
  const $t = await getFormatter();
  handleError(new Error('Folder download not yet implemented'), $t('errors.unable_to_download_files'));
};

export const handleConfirmFolderDelete = async (folder: FolderResponseDto) => {
  const $t = await getFormatter();
  const confirmation =
    folder.folderName.length > 0
      ? $t('folder_delete_confirmation', { values: { folder: folder.folderName } })
      : $t('unnamed_folder_delete_confirmation');

  const description = $t('folder_delete_confirmation_description');
  const prompt = `${confirmation} ${description}`;

  return modalManager.showDialog({ prompt });
};
