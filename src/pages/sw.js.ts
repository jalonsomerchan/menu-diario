import { defaultLocale } from '../config/site';
import { getLocalizedPath } from '../i18n/ui';
import { getBasePath, withBasePath } from '../utils/paths';

const appShellRoutes = [
  '',
  'dashboard',
  'planificacion',
  'configurar',
  'compra',
  'tuppers',
  'mis-platos',
  'platos',
  'historico',
  'ajustes',
  'admin/platos',
  'resumen-semanal',
];

const staticAssets = ['manifest.webmanifest', 'favicon.svg', 'og-image.svg'];

export function GET() {
  const basePath = getBasePath();
  const preCacheUrls = [
    ...appShellRoutes.map((route) => withBasePath(route)),
    ...staticAssets.map((asset) => withBasePath(asset)),
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
