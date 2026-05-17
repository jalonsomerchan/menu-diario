import { siteConfig } from '../../config/site.ts';
import { getAbsoluteUrl, withBasePath } from '../../utils/paths.ts';

export function getPublicShareRobots(indexable = false) {
  return indexable ? 'index,follow' : 'noindex,nofollow';
}

export function createPublicShareMetadata(input) {
  return {
    canonicalUrl: getAbsoluteUrl(withBasePath(input.routePath), siteConfig.url),
    imageUrl: getAbsoluteUrl(withBasePath(input.image ?? 'og-image.svg'), siteConfig.url),
    robots: getPublicShareRobots(input.indexable),
    ogType: input.type === 'recipe' ? 'article' : 'website',
    title: input.title,
    description: input.description,
  };
}

export function isPublicShareIdSafe(value) {
  return /^[a-zA-Z0-9_-]{12,96}$/.test(value);
}
