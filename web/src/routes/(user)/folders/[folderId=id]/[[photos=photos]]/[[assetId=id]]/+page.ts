import { authenticate } from '$lib/utils/auth';
import { getAssetInfoFromParam } from '$lib/utils/navigation';
import { getFolderInfo } from '$lib/utils/folder-api';
import type { PageLoad } from './$types';

export const load = (async ({ params, url }) => {
  await authenticate(url);
  const [folder, asset] = await Promise.all([
    getFolderInfo(params.folderId),
    getAssetInfoFromParam(params),
  ]);

  return {
    folder,
    asset,
    meta: {
      title: folder.folderName,
    },
  };
}) satisfies PageLoad;
