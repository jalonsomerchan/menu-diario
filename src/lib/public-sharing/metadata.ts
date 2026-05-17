import { siteConfig } from '../../config/site';
import { getAbsoluteUrl, withBasePath } from '../../utils/paths';

export type PublicShareType = 'menu' | 'recipe' | 'dish';

export type PublicShareMetadataInput = {
  title: string;
  description: string;
  routePath: string;
  image?: string;
  type?: PublicShareType;
  indexable?: boolean;
};

export type PublicShareMetadata = {
  canonicalUrl: string;
  imageUrl: string;
  robots: 'index,follow' | 'noindex,nofollow';
  ogType: 'website' | 'article';
  title: string;
  description: string;
};

export function getPublicShareRobots(indexable = false): PublicShareMetadata['robots'] {
  return indexable ? 'index,follow' : 'noindex,nofollow';
}

export function createPublicShareMetadata(input: PublicShareMetadataInput): PublicShareMetadata {
  return {
    canonicalUrl: getAbsoluteUrl(withBasePath(input.routePath), siteConfig.url),
    imageUrl: getAbsoluteUrl(withBasePath(input.image ?? 'og-image.svg'), siteConfig.url),
    robots: getPublicShareRobots(input.indexable),
    ogType: input.type === 'recipe' ? 'article' : 'website',
    title: input.title,
    description: input.description,
  };
}

export function isPublicShareIdSafe(value: string) {
  return /^[a-zA-Z0-9_-]{12,96}$/.test(value);
}
