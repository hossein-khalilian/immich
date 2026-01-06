import { authenticate } from '$lib/utils/auth';
import { getFormatter } from '$lib/utils/i18n';
import { getAllFolders } from '$lib/utils/folder-api';
import { getAllAlbums } from '@immich/sdk';
import type { PageLoad } from './$types';

export const load = (async ({ url, fetch }) => {
  await authenticate(url);
  const sharedFolders = await getAllFolders({ shared: true, parentId: null }, fetch);
  const folders = await getAllFolders({ parentId: null }, fetch); // Only root folders (no parent)
  const sharedAlbums = await getAllAlbums({ shared: true });
  const albums = await getAllAlbums({});
  const $t = await getFormatter();

  return {
    folders,
    sharedFolders,
    albums,
    sharedAlbums,
    meta: {
      title: $t('library'),
    },
  };
}) satisfies PageLoad;
