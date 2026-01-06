import { authenticate } from '$lib/utils/auth';
import { getFormatter } from '$lib/utils/i18n';
import { getAllFolders } from '$lib/utils/folder-api';
import type { PageLoad } from './$types';

export const load = (async ({ url, fetch }) => {
  await authenticate(url);
  const sharedFolders = await getAllFolders({ shared: true, parentId: null }, fetch);
  const folders = await getAllFolders({ parentId: null }, fetch); // Only root folders (no parent)
  const $t = await getFormatter();

  return {
    folders,
    sharedFolders,
    meta: {
      title: $t('folders'),
    },
  };
}) satisfies PageLoad;
