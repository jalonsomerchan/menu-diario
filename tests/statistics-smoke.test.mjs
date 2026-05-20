import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

describe('statistics feature smoke checks', () => {
  it('keeps statistics routes, app component, script and helpers available', () => {
    [
      'src/pages/estadisticas.astro',
      'src/pages/[locale]/estadisticas.astro',
      'src/components/StatisticsApp.astro',
      'src/scripts/statistics-app.ts',
      'src/lib/menu/statistics.mjs',
      'src/styles/statistics.css',
      'src/i18n/statistics.ts',
      'src/i18n/translations/statistics/es.json',
      'src/i18n/translations/statistics/en.json',
    ].forEach((path) => assert.equal(existsSync(join(root, path)), true, `${path} should exist`));
  });

  it('keeps statistics translations aligned across locales', () => {
    const es = readJson('src/i18n/translations/statistics/es.json');
    const en = readJson('src/i18n/translations/statistics/en.json');
    assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort());
    ['title', 'description', 'range7', 'range30', 'range90', 'topDishes', 'staleDishes', 'emptyTitle'].forEach((key) => {
      assert.ok(es[key], `Spanish statistics translations should include ${key}`);
      assert.ok(en[key], `English statistics translations should include ${key}`);
    });
  });

  it('wires statistics into localized routing, navigation and app shell', () => {
    const localizedPage = readText('src/pages/[locale]/estadisticas.astro');
    const header = readText('src/components/Header.astro');
    const dashboard = readText('src/components/DashboardApp.astro');
    const serviceWorker = readText('src/pages/sw.js.ts');

    assert.match(localizedPage, /getStaticPaths/);
    assert.match(localizedPage, /locales/);
    assert.match(localizedPage, /isLocale/);
    assert.match(localizedPage, /<StatisticsApp/);
    assert.match(header, /getLocalizedPath\('\/estadisticas'/);
    assert.match(header, /useStatisticsTranslations/);
    assert.match(dashboard, /statisticsPath/);
    assert.match(dashboard, /useStatisticsTranslations/);
    assert.match(serviceWorker, /estadisticas/);
  });

  it('keeps statistics UI dependency-free and route-safe', () => {
    const component = readText('src/components/StatisticsApp.astro');
    const script = readText('src/scripts/statistics-app.ts');
    assert.match(component, /data-statistics-app/);
    assert.match(component, /aria-live/);
    assert.match(component, /data-bars/);
    assert.match(script, /watchUserMenusByWeekRange/);
    assert.match(script, /buildMenuStatistics/);
    assert.doesNotMatch(component, /href=\"\//);
    assert.doesNotMatch(script, /chart\.js|recharts|d3/i);
  });
});
