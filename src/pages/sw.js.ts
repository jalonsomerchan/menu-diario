import { defaultLocale } from '../config/site';
import { getLocalizedPath } from '../i18n/ui';
import { getBasePath, withBasePath } from '../utils/paths';

export function GET() {
  const basePath = getBasePath();
  const preCacheUrls = [
    withBasePath(''),
    withBasePath('dashboard'),
    withBasePath('planificacion'),
    withBasePath('configurar'),
    withBasePath('compra'),
    withBasePath('tuppers'),
    withBasePath('mis-platos'),
    withBasePath('platos'),
    withBasePath('historico'),
    withBasePath('ajustes'),
    withBasePath('admin/platos'),
    withBasePath('resumen-semanal'),
    withBasePath('manifest.webmanifest'),
    withBasePath('favicon.svg'),
    withBasePath('og-image.svg'),
    getLocalizedPath('/', defaultLocale),
  ];

  const source = `
const CACHE_VERSION = 'menu-diario-static-v3';
const BASE_PATH = ${JSON.stringify(basePath)};
const PRE_CACHE_URLS = ${JSON.stringify([...new Set(preCacheUrls)])};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRE_CACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE_PATH)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(BASE_PATH)))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const copy = response.clone();
        if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
`;

  return new Response(source.trim(), {
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/javascript; charset=utf-8',
    },
  });
}
