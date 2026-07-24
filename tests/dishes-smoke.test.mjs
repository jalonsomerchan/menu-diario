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
      'src/components/DishEditDialog.astro',
      'src/components/ConfirmDialog.astro',
      'src/scripts/dishes-app.ts',
      'src/lib/dishes/editor-state.mjs',
      'src/lib/dishes/render.mjs',
      'src/lib/dishes/helpers.mjs',
      'src/lib/ui/confirm-dialog.ts',
      'src/lib/dishes/helpers.d.ts',
      'src/lib/dishes/repository.ts',
      'src/data/dish-tags.ts',
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
      'dishes.filterFavorites',
      'dishes.filterBlocked',
      'dishes.compactList',
      'dishes.quickTags',
      'dishes.markFavorite',
      'dishes.editCompact',
      'dishes.editTitle',
      'dishes.globalReadOnlyModal',
      'dishes.favoriteField',
      'dishes.blockedField',
      'dishes.statistics',
      'dishes.origin',
      'dishes.block',
      'dishes.empty',
      'dishes.emptySearch',
      'dishes.manageFromSettings',
      'dishTags.quick',
      'dishTags.batch-cooking',
      'dishTags.freezable',
    ].forEach((key) => {
      assert.ok(es[key], `es.json should include ${key}`);
      assert.ok(en[key], `en.json should include ${key}`);
    });
  });

  it('wires the dishes UI, navigation and settings entry point', () => {
    const defaultRoute = readText('src/pages/mis-platos.astro');
    const localizedRoute = readText('src/pages/[locale]/mis-platos.astro');
    const header = readText('src/components/Header.astro');
    const settingsApp = readText('src/components/SettingsApp.astro');
    const dishesApp = readText('src/components/DishesApp.astro');
    const editorDialog = readText('src/components/DishEditDialog.astro');
    const dishesScript = readText('src/scripts/dishes-app.ts');

    assert.match(defaultRoute, /<DishesApp/);
    assert.doesNotMatch(defaultRoute, /<AppHeader/);
    assert.match(localizedRoute, /getStaticPaths/);
    assert.match(localizedRoute, /<DishesApp/);
    assert.doesNotMatch(localizedRoute, /<AppHeader/);
    assert.match(header, /appNav\.dishes/);
    assert.match(header, /getLocalizedPath\('\/mis-platos'/);
    assert.match(settingsApp, /dishes\.manageFromSettings/);
    assert.match(dishesApp, /data-dishes-app/);
    assert.match(dishesApp, /data-dish-form/);
    assert.match(dishesApp, /data-dish-search/);
    assert.match(dishesApp, /data-dish-filter/);
    assert.match(dishesApp, /data-dish-tag-filter/);
    assert.match(dishesApp, /data-dish-sort/);
    assert.match(dishesApp, /data-dishes-list/);
    assert.match(dishesApp, /<DishEditDialog/);
    assert.match(dishesApp, /<ConfirmDialog/);
    assert.match(dishesApp, /quickDishTags/);
    assert.match(dishesApp, /aria-live=\"polite\"/);
    assert.match(editorDialog, /data-dish-editor-dialog/);
    assert.match(editorDialog, /aria-labelledby/);
    assert.match(dishesScript, /createManualDish/);
    assert.match(dishesScript, /saveDishEdits/);
    assert.match(dishesScript, /archiveDish/);
    assert.doesNotMatch(dishesScript, /window\.confirm/);
    assert.match(dishesScript, /updateDishPreferences/);
    assert.match(dishesScript, /data-toggle-favorite/);
    assert.match(dishesScript, /showModal/);
    assert.match(dishesScript, /data-edit-dish/);
    assert.match(dishesApp, /styles\/dishes\.css/);
  });

  it('keeps dishes data, docs and styles ready for management', () => {
    const repository = readText('src/lib/dishes/repository.ts');
    const helpers = readText('src/lib/dishes/helpers.mjs');
    const editorState = readText('src/lib/dishes/editor-state.mjs');
    const renderer = readText('src/lib/dishes/render.mjs');
    const types = readText('src/lib/menu/types.ts');
    const suggestionHelper = readText('src/lib/menu/dish-suggestions.ts');
    const styles = readText('src/styles/dishes.css');
    const docs = readText('docs/firebase.md');

    assert.match(repository, /watchUserDishes/);
    assert.match(repository, /createManualDish/);
    assert.match(repository, /renameDish/);
    assert.match(repository, /saveDishEdits/);
    assert.match(repository, /archiveDish/);
    assert.match(repository, /updateDishPreferences/);
    assert.match(repository, /favorite/);
    assert.match(repository, /blocked/);
    assert.match(repository, /quickTags/);
    assert.match(helpers, /normalizeDishName/);
    assert.match(helpers, /filterDishes/);
    assert.match(helpers, /getSuggestionDishes/);
    assert.match(helpers, /isSuggestableDish/);
    assert.match(editorState, /getDishEditorState/);
    assert.match(editorState, /getNextQuickTags/);
    assert.match(renderer, /renderCompactDishRow/);
    assert.match(renderer, /renderDishEditorBody/);
    assert.match(types, /favorite\?: boolean/);
    assert.match(types, /blocked\?: boolean/);
    assert.match(types, /quickTags\?: string\[\]/);
    assert.match(suggestionHelper, /getSuggestionDishes/);
    assert.match(styles, /dish-row/);
    assert.match(styles, /dish-editor-dialog/);
    assert.match(docs, /quickTags/);
    assert.match(docs, /blocked/);
    assert.match(docs, /timesUsed: 0/);
  });
});
