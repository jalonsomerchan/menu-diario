import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('dishes page smoke checks', () => {
  it('adds default and localized dishes routes', () => {
    [
      'src/pages/mis-platos.astro',
      'src/pages/[locale]/mis-platos.astro',
      'src/components/DishesApp.astro',
      'src/scripts/dishes-app.ts',
      'src/lib/dishes/helpers.mjs',
      'src/lib/dishes/helpers.d.ts',
      'src/lib/dishes/repository.ts',
      'src/styles/dishes.css',
    ].forEach((path) => {
      assert.equal(existsSync(join(root, path)), true, `${path} should exist`);
    });
  });

  it('keeps dishes translations aligned and complete', () => {
    const es = readJson('src/i18n/translations/es.json');
    const en = readJson('src/i18n/translations/en.json');
    const expectedKeys = Object.keys(es).sort();

    assert.deepEqual(Object.keys(en).sort(), expectedKeys);
    [
      'appNav.dishes',
      'dishes.title',
      'dishes.description',
      'dishes.sortMostUsed',
      'dishes.sortRecent',
      'dishes.sortOldest',
      'dishes.sortName',
      'dishes.empty',
      'dishes.emptySearch',
      'dishes.manageFromSettings',
    ].forEach((key) => {
      assert.ok(es[key], `es.json should include ${key}`);
      assert.ok(en[key], `en.json should include ${key}`);
    });
  });

  it('wires the dishes UI, navigation and settings entry point', () => {
    const defaultRoute = readText('src/pages/mis-platos.astro');
    const localizedRoute = readText('src/pages/[locale]/mis-platos.astro');
    const appHeader = readText('src/components/AppHeader.astro');
    const settingsApp = readText('src/components/SettingsApp.astro');
    const dishesApp = readText('src/components/DishesApp.astro');
    const dishesScript = readText('src/scripts/dishes-app.ts');
    const layout = readText('src/layouts/BaseLayout.astro');

    assert.match(defaultRoute, /<DishesApp/);
    assert.match(localizedRoute, /getStaticPaths/);
    assert.match(localizedRoute, /<DishesApp/);
    assert.match(appHeader, /appNav\.dishes/);
    assert.match(appHeader, /getLocalizedPath\('\/mis-platos'/);
    assert.match(settingsApp, /dishes\.manageFromSettings/);
    assert.match(dishesApp, /data-dishes-app/);
    assert.match(dishesApp, /data-dish-form/);
    assert.match(dishesApp, /data-dish-search/);
    assert.match(dishesApp, /data-dish-sort/);
    assert.match(dishesApp, /aria-live=\"polite\"/);
    assert.match(dishesScript, /createManualDish/);
    assert.match(dishesScript, /renameDish/);
    assert.match(dishesScript, /archiveDish/);
    assert.match(layout, /styles\/dishes\.css/);
  });

  it('keeps dishes data, docs and styles ready for management', () => {
    const repository = readText('src/lib/dishes/repository.ts');
    const helpers = readText('src/lib/dishes/helpers.mjs');
    const types = readText('src/lib/menu/types.ts');
    const styles = readText('src/styles/dishes.css');
    const docs = readText('docs/firebase.md');

    assert.match(repository, /watchUserDishes/);
    assert.match(repository, /createManualDish/);
    assert.match(repository, /renameDish/);
    assert.match(repository, /archiveDish/);
    assert.match(repository, /archived: true/);
    assert.match(helpers, /normalizeDishName/);
    assert.match(helpers, /filterDishes/);
    assert.match(helpers, /sortDishes/);
    assert.match(types, /archived\?: boolean/);
    assert.match(types, /tags\?: string\[\]/);
    assert.match(styles, /dishes-app/);
    assert.match(styles, /dish-card/);
    assert.match(docs, /archived/);
    assert.match(docs, /timesUsed: 0/);
  });
});
