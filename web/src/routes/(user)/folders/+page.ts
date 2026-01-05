import { authenticate } from '$lib/utils/auth';
import { getFormatter } from '$lib/utils/i18n';
import { getAllFolders } from '$lib/utils/folder-api';
import type { PageLoad } from './$types';

export const load = (async ({ url, fetch }) => {
  await authenticate(url);
  const sharedFolders = await getAllFolders({ shared: true }, fetch);
  const folders = await getAllFolders({}, fetch);
  const $t = await getFormatter();

  return {
    folders,
    sharedFolders,
    meta: {
      title: $t('folders'),
    },
  };
}) satisfies PageLoad;
