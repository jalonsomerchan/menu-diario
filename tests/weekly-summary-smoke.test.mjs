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

describe('weekly summary smoke checks', () => {
  it('exposes root and localized weekly summary routes', () => {
    [
      'src/pages/resumen-semanal.astro',
      'src/pages/[locale]/resumen-semanal.astro',
      'src/components/WeeklySummaryApp.astro',
      'src/scripts/weekly-summary-app.ts',
      'src/lib/menu/weekly-stats.mjs',
      'src/lib/menu/weekly-stats.d.ts',
    ].forEach((path) => assert.equal(existsSync(join(root, path)), true, `${path} should exist`));
  });

  it('wires the weekly summary into localized navigation', () => {
    const header = readText('src/components/Header.astro');
    const rootPage = readText('src/pages/resumen-semanal.astro');
    const localizedPage = readText('src/pages/[locale]/resumen-semanal.astro');

    assert.match(header, /getLocalizedPath\('\/resumen-semanal'/);
    assert.match(header, /appNav\.summary/);
    assert.match(rootPage, /<WeeklySummaryApp locale=\{locale\}/);
    assert.match(localizedPage, /getStaticPaths/);
    assert.match(localizedPage, /<WeeklySummaryApp locale=\{locale\}/);
  });

  it('keeps summary UI texts translated in all configured locales', () => {
    const es = readJson('src/i18n/translations/es.json');
    const en = readJson('src/i18n/translations/en.json');
    const keys = [
      'appNav.summary',
      'summary.title',
      'summary.description',
      'summary.plannedMeals',
      'summary.emptyMeals',
      'summary.eatingOutMeals',
      'summary.topDishes',
      'summary.recommendation.emptyWeek',
      'summary.recommendation.staleDish',
      'summary.dishesLink',
    ];

    keys.forEach((key) => {
      assert.ok(es[key], `es.json should include ${key}`);
      assert.ok(en[key], `en.json should include ${key}`);
    });
    assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
  });

  it('keeps statistics logic outside the component and prepares integrations', () => {
    const component = readText('src/components/WeeklySummaryApp.astro');
    const script = readText('src/scripts/weekly-summary-app.ts');
    const helpers = readText('src/lib/menu/weekly-stats.mjs');
    const docs = readText('docs/navigation.md');

    assert.match(component, /data-weekly-summary-app/);
    assert.match(component, /weekly-summary-card/);
    assert.match(component, /weekly-summary-readiness/);
    assert.doesNotMatch(component, /summarizeWeek\(/);
    assert.match(script, /buildWeeklySummary/);
    assert.match(script, /watchUserMenus/);
    assert.match(script, /watchUserDishes/);
    assert.match(helpers, /summarizeWeek/);
    assert.match(helpers, /buildWeeklyRecommendations/);
    assert.match(docs, /resumen-semanal/);
  });
});
