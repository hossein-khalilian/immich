import { authenticate } from '$lib/utils/auth';
import { getFolderInfo, getSubfolders } from '$lib/utils/folder-api';
import { getAssetInfoFromParam } from '$lib/utils/navigation';
import type { PageLoad } from './$types';

export const load = (async ({ params, url }) => {
  await authenticate(url);
  const [folder, asset, subfolders] = await Promise.all([
    getFolderInfo(params.folderId),
    getAssetInfoFromParam(params),
    getSubfolders(params.folderId), // Direct children (subfolders) of this folder
  ]);

  return {
    folder,
    asset,
    subfolders,
    meta: {
      title: folder.folderName,
    },
  };
}) satisfies PageLoad;
