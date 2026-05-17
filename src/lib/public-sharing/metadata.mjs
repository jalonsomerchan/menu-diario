const defaultSiteUrl = 'https://jalonsomerchan.github.io';

function trimSlashes(value = '') {
  return value.replace(/^\/+|\/+$/g, '');
}

function getSiteUrl(siteUrl) {
  return (siteUrl || process.env.ASTRO_SITE || defaultSiteUrl).replace(/\/$/, '');
}

function withConfiguredBasePath(path, basePath = process.env.ASTRO_BASE || '') {
  const cleanPath = `/${trimSlashes(path)}`;
  const cleanBase = trimSlashes(basePath);
  return cleanBase ? `/${cleanBase}${cleanPath === '/' ? '' : cleanPath}` : cleanPath;
}

function getAbsolutePublicUrl(path, siteUrl, basePath) {
  return `${getSiteUrl(siteUrl)}${withConfiguredBasePath(path, basePath)}`;
}

export function getPublicShareRobots(indexable = false) {
  return indexable ? 'index,follow' : 'noindex,nofollow';
}

export function createPublicShareMetadata(input) {
  return {
    canonicalUrl: getAbsolutePublicUrl(input.routePath, input.siteUrl, input.basePath),
    imageUrl: getAbsolutePublicUrl(input.image ?? 'og-image.svg', input.siteUrl, input.basePath),
    robots: getPublicShareRobots(input.indexable),
    ogType: input.type === 'recipe' ? 'article' : 'website',
    title: input.title,
    description: input.description,
  };
}

export function isPublicShareIdSafe(value) {
  return /^[a-zA-Z0-9_-]{12,96}$/.test(value);
}
