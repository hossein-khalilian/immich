import { getAssetThumbnailUrl, setSharedLink } from '$lib/utils';
import { authenticate } from '$lib/utils/auth';
import { getFolderInfoWithQuery, getSubfoldersWithQuery } from '$lib/utils/folder-api';
import { getFormatter } from '$lib/utils/i18n';
import { getAssetInfoFromParam } from '$lib/utils/navigation';
import { getMySharedLink, isHttpError } from '@immich/sdk';

export const asQueryString = ({ slug, key }: { slug?: string; key?: string }) => {
  const params = new URLSearchParams();
  if (slug) {
    params.set('slug', slug);
  }

  if (key) {
    params.set('key', key);
  }

  return params.toString();
};

export const loadSharedLink = async ({
  url,
  params,
  fetch: fetchFn = fetch,
}: {
  url: URL;
  params: { key?: string; slug?: string; assetId?: string };
  fetch?: typeof fetch;
}) => {
  const { key, slug } = params;
  await authenticate(url, { public: true });

  const common = { key, slug };

  const $t = await getFormatter();

  try {
    const [sharedLink, asset] = await Promise.all([getMySharedLink({ key, slug }), getAssetInfoFromParam(params)]);
    const hydratedSharedLink = await hydrateSharedLinkFolder(sharedLink, { key, slug, fetch: fetchFn });
    setSharedLink(hydratedSharedLink);
    const assetCount = sharedLink.assets.length;
    const assetId =
      hydratedSharedLink.album?.albumThumbnailAssetId ||
      hydratedSharedLink.folder?.folderThumbnailAssetId ||
      hydratedSharedLink.assets[0]?.id;
    const assetPath = assetId ? getAssetThumbnailUrl(assetId) : '/feature-panel.png';

    // Determine title based on shared link type
    let title = $t('public_share');
    if (hydratedSharedLink.album) {
      title = hydratedSharedLink.album.albumName;
    } else if (hydratedSharedLink.folder) {
      title = hydratedSharedLink.folder.folderName;
    }

    return {
      ...common,
      sharedLink: hydratedSharedLink,
      asset,
      meta: {
        title,
        description: sharedLink.description || $t('shared_photos_and_videos_count', { values: { assetCount } }),
        imageUrl: assetPath,
      },
    };
  } catch (error) {
    if (isHttpError(error) && error.data.message === 'Invalid password') {
      return {
        ...common,
        passwordRequired: true,
        meta: {
          title: $t('password_required'),
        },
      };
    }

    throw error;
  }
};

export const hydrateSharedLinkFolder = async (
  sharedLink: Awaited<ReturnType<typeof getMySharedLink>>,
  {
    key,
    slug,
    fetch: fetchFn = fetch,
  }: {
    key?: string;
    slug?: string;
    fetch?: typeof fetch;
  },
) => {
  if (!sharedLink.folder?.id) {
    return sharedLink;
  }

  const query = { key, slug };
  const [folder, subfolders] = await Promise.all([
    getFolderInfoWithQuery(sharedLink.folder.id, query, fetchFn),
    getSubfoldersWithQuery(sharedLink.folder.id, query, fetchFn),
  ]);

  return {
    ...sharedLink,
    folder: {
      ...folder,
      subfolders,
    },
  };
};
