import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

function readJson(path) {
  return JSON.parse(readText(path));
}

describe('PWA offline support', () => {
  it('keeps PWA files and service worker registration available', () => {
    [
      'src/pages/sw.js.ts',
      'src/scripts/pwa-register.ts',
      'src/lib/pwa/network-status.ts',
      'src/lib/pwa/offline-cache.ts',
      'src/lib/pwa/offline-sync.ts',
      'src/styles/pwa.css',
      'docs/pwa-offline.md',
    ].forEach((path) => assert.equal(existsSync(join(root, path)), true, `${path} should exist`));

    const layout = readText('src/layouts/BaseLayout.astro');
    const register = readText('src/scripts/pwa-register.ts');

    assert.match(layout, /pwa-register/);
    assert.match(layout, /apple-mobile-web-app-capable/);
    assert.match(layout, /theme-color/);
    assert.match(register, /navigator\.serviceWorker/);
    assert.match(register, /import\.meta\.env\.BASE_URL/);
    assert.match(register, /scope: basePath/);
  });

  it('keeps manifest install metadata base-aware', () => {
    const manifest = readText('src/pages/manifest.webmanifest.ts');

    assert.match(manifest, /start_url: getBasePath\(\)/);
    assert.match(manifest, /scope: getBasePath\(\)/);
    assert.match(manifest, /id: getBasePath\(\)/);
    assert.match(manifest, /display_override/);
    assert.match(manifest, /orientation: 'portrait-primary'/);
    assert.match(manifest, /shortcuts/);
    assert.match(manifest, /withBasePath\('dashboard'\)/);
    assert.match(manifest, /withBasePath\('configurar'\)/);
    assert.match(manifest, /purpose: 'any maskable'/);
  });

  it('keeps service worker cache strategy scoped to base path', () => {
    const sw = readText('src/pages/sw.js.ts');

    assert.match(sw, /getBasePath/);
    assert.match(sw, /withBasePath/);
    assert.match(sw, /CACHE_VERSION/);
    assert.match(sw, /PRE_CACHE_URLS/);
    assert.match(sw, /request\.mode === 'navigate'/);
    assert.match(sw, /url\.pathname\.startsWith\(BASE_PATH\)/);
    assert.match(sw, /caches\.open/);
    assert.match(sw, /caches\.delete/);
  });

  it('keeps offline dashboard cache read-only and versioned', () => {
    const dashboard = readText('src/scripts/dashboard-app.ts');
    const cache = readText('src/lib/pwa/offline-cache.ts');
    const sync = readText('src/lib/pwa/offline-sync.ts');

    assert.match(dashboard, /readLastOfflineMenuCache/);
    assert.match(dashboard, /saveOfflineMenuCache/);
    assert.match(dashboard, /shouldBlockOfflineWrites/);
    assert.match(dashboard, /data-offline-banner/);
    assert.match(dashboard, /disabled aria-disabled/);
    assert.match(cache, /cacheVersion = 1/);
    assert.match(cache, /lastCacheKey/);
    assert.match(cache, /localStorage/);
    assert.match(sync, /read-only/);
    assert.match(sync, /conflict-risk/);
  });

  it('keeps offline UI translated and documented', () => {
    const es = readJson('src/i18n/translations/es.json');
    const en = readJson('src/i18n/translations/en.json');
    const docs = readText('docs/pwa-offline.md');

    [
      'pwa.offlineTitle',
      'pwa.offlineCached',
      'pwa.offlineReadOnly',
      'pwa.offlineNoCache',
      'pwa.backOnline',
    ].forEach((key) => {
      assert.ok(es[key], `es.json should include ${key}`);
      assert.ok(en[key], `en.json should include ${key}`);
    });

    assert.match(docs, /modo solo lectura/);
    assert.match(docs, /No se implementa cola de cambios/);
    assert.match(docs, /BASE_URL/);
    assert.match(docs, /GitHub Pages/);
  });
});
