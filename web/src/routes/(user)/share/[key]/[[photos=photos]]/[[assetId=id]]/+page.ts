import { loadSharedLink } from '$lib/utils/shared-links';
import type { PageLoad } from './$types';

export const load = (async ({ params, url, fetch }) => loadSharedLink({ params, url, fetch })) satisfies PageLoad;
