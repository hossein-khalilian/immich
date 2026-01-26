import { authenticate } from '$lib/utils/auth';
import { getFormatter } from '$lib/utils/i18n';
import { getAssetInfoFromParam } from '$lib/utils/navigation';
import type { PageLoad } from './$types';

export const load = (async ({ params, url }) => {
  // Make this page public - don't require authentication
  await authenticate(url, { public: true });
  const $t = await getFormatter();
  const asset = await getAssetInfoFromParam(params);

  return {
    asset,
    meta: {
      title: $t('all_shared_photos') || 'All Shared Photos',
    },
  };
}) satisfies PageLoad;
