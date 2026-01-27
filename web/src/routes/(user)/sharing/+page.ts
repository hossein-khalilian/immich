import { authenticate } from '$lib/utils/auth';
import { getAllFolders } from '$lib/utils/folder-api';
import { getFormatter } from '$lib/utils/i18n';
import { PartnerDirection, getAllAlbums, getPartners } from '@immich/sdk';
import type { PageLoad } from './$types';

export const load = (async ({ url, fetch }) => {
  await authenticate(url);
  const sharedAlbums = await getAllAlbums({ shared: true });
  const sharedFolders = await getAllFolders({ shared: true }, fetch);
  const partners = await getPartners({ direction: PartnerDirection.SharedWith });
  const $t = await getFormatter();

  return {
    sharedAlbums,
    sharedFolders,
    partners,
    meta: {
      title: $t('sharing'),
    },
  };
}) satisfies PageLoad;
