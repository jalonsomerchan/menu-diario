import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

function parseConstString(source, name) {
  const match = source.match(new RegExp(`export\\s+const\\s+${name}\\s*=\\s*['\"]([^'\"]+)['\"]`));
  assert.ok(match, `Could not find exported const ${name}`);
  return match[1];
}

function parseConstStringArray(source, name) {
  const match = source.match(new RegExp(`export\\s+const\\s+${name}\\s*=\\s*\\[([^\\]]+)\\]`));
  assert.ok(match, `Could not find exported array const ${name}`);
  const values = [...match[1].matchAll(/['\"]([^'\"]+)['\"]/g)].map(([, value]) => value);
  assert.ok(values.length > 0, `${name} should contain at least one value`);
  return values;
}

function getConfiguredI18n() {
  const siteConfig = readText('src/config/site.ts');
  return {
    defaultLocale: parseConstString(siteConfig, 'defaultLocale'),
    locales: parseConstStringArray(siteConfig, 'locales'),
  };
}

describe('project smoke checks', () => {
  it('has the minimum files needed by Astro', () => {
    [
      'package.json',
      'astro.config.mjs',
      'src/pages/index.astro',
      'src/pages/dashboard.astro',
      'src/pages/configurar.astro',
      'src/pages/ajustes.astro',
      'src/pages/historico.astro',
      'src/pages/mis-platos.astro',
      'src/pages/platos.astro',
      'src/pages/[locale]/index.astro',
      'src/pages/[locale]/dashboard.astro',
      'src/pages/[locale]/configurar.astro',
      'src/pages/[locale]/ajustes.astro',
      'src/pages/[locale]/historico.astro',
      'src/pages/[locale]/mis-platos.astro',
      'src/pages/[locale]/platos.astro',
      'src/pages/404.astro',
      'src/pages/manifest.webmanifest.ts',
      'src/pages/robots.txt.ts',
      'src/layouts/BaseLayout.astro',
      'src/config/site.ts',
      'src/i18n/ui.ts',
      'src/i18n/translations',
      'src/lib/menu/day-editor.ts',
      'src/lib/menu/day-form.ts',
      'src/lib/menu/day-state.ts',
      'src/lib/menu/dish-suggestions.ts',
      'src/lib/ai/pending-meal-recommendations.ts',
      'src/lib/dishes/helpers.mjs',
      'src/lib/dishes/repository.ts',
      'src/lib/ui/debounced-task-map.ts',
      'src/lib/ui/save-feedback.ts',
      'src/utils/paths.ts',
      'src/styles/global.css',
      'src/styles/dishes.css',
      'data/global-dishes.seed.json',
    ].forEach((path) => {
      assert.equal(existsSync(join(root, path)), true, `${path} should exist`);
    });
  });

  it('keeps shared and app components available', () => {
    ['Button', 'Container', 'Footer', 'Header', 'AuthGate', 'DashboardApp', 'ConfiguratorApp', 'DayEditModal', 'DishEditDialog', 'SettingsApp', 'HistoryApp', 'DishesApp', 'MenuApp'].forEach((component) => {
      assert.equal(existsSync(join(root, `src/components/${component}.astro`)), true, `${component}.astro should exist`);
    });
    assert.equal(existsSync(join(root, 'src/components/AppHeader.astro')), false);
  });

  it('keeps project metadata and expected npm scripts available', () => {
    ['.nvmrc', '.env.example', '.gitignore', '.prettierrc', '.prettierignore', 'README.md'].forEach((path) =>
      assert.equal(existsSync(join(root, path)), true, `${path} should exist`)
    );
    const pkg = readJson('package.json');
    assert.equal(pkg.name, 'menu-diario');
    assert.equal(pkg.scripts?.dev, 'astro dev');
    assert.equal(pkg.scripts?.build, 'astro build');
    assert.equal(pkg.scripts?.preview, 'astro preview');
    assert.ok(pkg.scripts?.test?.includes('node --test'));
    assert.ok(pkg.scripts?.clean?.includes('scripts/clean.mjs'));
  });

  it('keeps Astro i18n enabled and aligned with site config', () => {
    const astroConfig = readText('astro.config.mjs');
    const readme = readText('README.md');
    const { defaultLocale, locales } = getConfiguredI18n();
    assert.match(astroConfig, /i18n/);
    assert.match(astroConfig, new RegExp(`defaultLocale:\\s*['\"]${defaultLocale}['\"]`));
    locales.forEach((locale) => {
      assert.match(astroConfig, new RegExp(`['\"]${locale}['\"]`));
      assert.equal(existsSync(join(root, `src/i18n/translations/${locale}.json`)), true);
    });
    assert.match(readme, /i18n/);
    assert.match(readme, /src\/i18n\/translations/);
  });

  it('keeps translation files aligned with configured locales', () => {
    const { defaultLocale, locales } = getConfiguredI18n();
    const defaultTranslations = readJson(`src/i18n/translations/${defaultLocale}.json`);
    const expectedKeys = Object.keys(defaultTranslations).sort();
    const translationFiles = readdirSync(join(root, 'src/i18n/translations'))
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace(/\.json$/, ''));
    assert.deepEqual([...translationFiles].sort(), [...locales].sort());
    locales.forEach((locale) => {
      const translations = readJson(`src/i18n/translations/${locale}.json`);
      assert.deepEqual(Object.keys(translations).sort(), expectedKeys);
      [
        'home.title',
        'nav.main',
        'dashboard.title',
        'dashboard.moreActions',
        'dashboard.noDay',
        'dashboard.removePlate',
        'dashboard.showDishOptions',
        'dashboard.dishSuggestions',
        'ai.pendingMealsTitle',
        'ai.pendingMealsDescription',
        'ai.pendingMealsGenerate',
        'history.title',
        'group.title',
        'appNav.settings',
        'appNav.openMenu',
        'appNav.closeMenu',
        'appNav.dishes',
        'dishes.title',
        'dishes.globalBadge',
        'dishes.groupBadge',
        'dishes.duplicateAsGroup',
        'dishes.notEditable',
        'menu.signInGoogle',
      ].forEach((key) => {
        assert.ok(translations[key], `${locale}.json should include ${key}`);
      });
    });
  });

  it('keeps routing and assets compatible with root and subpath deployments', () => {
    const layout = readText('src/layouts/BaseLayout.astro');
    const header = readText('src/components/Header.astro');
    const manifest = readText('src/pages/manifest.webmanifest.ts');
    const robots = readText('src/pages/robots.txt.ts');
    const i18nHelper = readText('src/i18n/ui.ts');
    const pathHelpers = readText('src/utils/paths.ts');
    [layout, header, manifest, robots, i18nHelper].forEach((source) => {
      assert.match(source, /withBasePath|getLocalizedPath|stripBasePath/);
      assert.doesNotMatch(source, /href=\"\//);
      assert.doesNotMatch(source, /src=\"\//);
    });
    assert.match(pathHelpers, /withBasePath/);
    assert.match(pathHelpers, /stripBasePath/);
    assert.match(pathHelpers, /getAbsoluteUrl/);
    assert.match(manifest, /start_url/);
    assert.match(robots, /sitemap-index\.xml/);
  });

  it('uses one reusable header across main pages', () => {
    const layout = readText('src/layouts/BaseLayout.astro');
    const header = readText('src/components/Header.astro');
    const headerScript = readText('src/scripts/app-header.ts');
    const styles = readText('src/styles/global.css');
    const pages = [
      'src/pages/index.astro',
      'src/pages/dashboard.astro',
      'src/pages/configurar.astro',
      'src/pages/ajustes.astro',
      'src/pages/historico.astro',
      'src/pages/mis-platos.astro',
      'src/pages/[locale]/dashboard.astro',
      'src/pages/[locale]/configurar.astro',
      'src/pages/[locale]/ajustes.astro',
      'src/pages/[locale]/historico.astro',
      'src/pages/[locale]/mis-platos.astro',
    ].map(readText);
    assert.match(layout, /<Header locale=\{locale\}/);
    assert.match(header, /data-site-header/);
    assert.match(header, /data-site-menu-toggle/);
    assert.match(header, /aria-expanded=\"false\"/);
    assert.match(header, /aria-controls=\{panelId\}/);
    assert.match(header, /getLocalizedPath\('\/dashboard'/);
    assert.match(header, /getLocalizedPath\('\/configurar'/);
    assert.match(header, /getLocalizedPath\('\/mis-platos'/);
    assert.match(header, /getLocalizedPath\('\/historico'/);
    assert.match(header, /getLocalizedPath\('\/ajustes'/);
    assert.match(headerScript, /data-site-header/);
    assert.match(headerScript, /data-site-menu-toggle/);
    assert.match(headerScript, /Escape/);
    assert.match(headerScript, /closest\('a'\)/);
    assert.match(headerScript, /data-global-theme/);
    assert.match(styles, /site-header__toggle/);
    assert.match(styles, /site-header\[data-menu-open='true'\]/);
    pages.forEach((source) => {
      assert.doesNotMatch(source, /<AppHeader/);
      assert.doesNotMatch(source, /from ['\"].*AppHeader\.astro['\"]/);
    });
  });

  it('keeps app navigation and feature wiring available', () => {
    const home = readText('src/pages/index.astro');
    const dashboard = readText('src/pages/dashboard.astro');
    const configure = readText('src/pages/configurar.astro');
    const settings = readText('src/pages/ajustes.astro');
    const history = readText('src/pages/historico.astro');
    const dishesPage = readText('src/pages/mis-platos.astro');
    const authGate = readText('src/components/AuthGate.astro');
    const dashboardApp = readText('src/components/DashboardApp.astro');
    const configuratorApp = readText('src/components/ConfiguratorApp.astro');
    const settingsApp = readText('src/components/SettingsApp.astro');
    const historyApp = readText('src/components/HistoryApp.astro');
    const dishesApp = readText('src/components/DishesApp.astro');
    assert.match(home, /<AuthGate/);
    assert.match(dashboard, /<DashboardApp/);
    assert.match(configure, /<ConfiguratorApp/);
    assert.match(settings, /<SettingsApp/);
    assert.match(history, /<HistoryApp/);
    assert.match(dishesPage, /<DishesApp/);
    assert.match(authGate, /data-auth-gate/);
    assert.match(dashboardApp, /<DayEditModal/);
    assert.match(dashboardApp, /data-notifications/);
    assert.match(dashboardApp, /dashboard\.showDishOptions/);
    assert.match(dashboardApp, /dashboard-app\.ts/);
    assert.match(configuratorApp, /data-configurator-app/);
    assert.match(configuratorApp, /data-ai-generate/);
    assert.match(configuratorApp, /data-ai-results/);
    assert.match(configuratorApp, /<DayEditModal/);
    assert.match(configuratorApp, /ai\.pendingMealsTitle/);
    assert.match(configuratorApp, /configurator-app\.ts/);
    assert.match(configuratorApp, /dashboard\.showDishOptions/);
    assert.match(configuratorApp, /dish-combobox:focus-within/);
    assert.match(configuratorApp, /dish-suggestions\[hidden\]/);
    assert.match(settingsApp, /data-settings-app/);
    assert.match(settingsApp, /settings-app\.ts/);
    assert.match(historyApp, /data-history-app/);
    assert.match(historyApp, /<DayEditModal/);
    assert.match(historyApp, /dashboard\.showDishOptions/);
    assert.match(dishesApp, /data-dishes-app/);
    assert.match(dishesApp, /dishes\.globalBadge/);
  });

  it('keeps scoped dish catalog logic, permissions and deduplication wired', () => {
    const types = readText('src/lib/menu/types.ts');
    const dishHelpers = readText('src/lib/dishes/helpers.mjs');
    const dishRepository = readText('src/lib/dishes/repository.ts');
    const menuRepository = readText('src/lib/menu/repository.ts');
    const dishesScript = readText('src/scripts/dishes-app.ts');
    const rules = readText('firestore.rules');
    const docs = readText('docs/firebase.md');
    const seed = readJson('data/global-dishes.seed.json');
    assert.match(types, /DishScope = 'global' \| 'group' \| 'user'/);
    assert.match(types, /isGlobal: boolean/);
    assert.match(types, /editable: boolean/);
    assert.match(types, /archivedAt\?: Date/);
    assert.match(dishHelpers, /normalizeDishName/);
    assert.match(dishHelpers, /isGlobalDish/);
    assert.match(dishHelpers, /isEditableDish/);
    assert.match(dishHelpers, /getDuplicateDish/);
    assert.match(dishRepository, /watchCatalogDishes/);
    assert.match(dishRepository, /recordMenuDishUsage/);
    assert.match(dishRepository, /duplicateGlobalDish/);
    assert.match(dishRepository, /dish-duplicate-global/);
    assert.match(dishRepository, /dish-not-editable/);
    assert.match(menuRepository, /recordMenuDishUsage/);
    assert.match(dishesScript, /data-dish-editor-duplicate/);
    assert.match(dishesScript, /labels\.globalReadOnlyModal/);
    assert.match(dishesScript, /isEditableDish/);
    assert.match(rules, /isAdmin/);
    assert.match(rules, /isGlobalDishData/);
    assert.match(rules, /isGroupDishData/);
    assert.match(rules, /request.auth.token.admin == true/);
    assert.match(rules, /allow delete: if false/);
    assert.match(docs, /scope: global/);
    assert.match(docs, /duplicated-global/);
    assert.match(docs, /data\/global-dishes\.seed\.json/);
    assert.ok(Array.isArray(seed));
    assert.ok(seed.length > 0);
    seed.forEach((dish) => {
      assert.equal(dish.scope, 'global');
      assert.equal(dish.isGlobal, true);
      assert.equal(dish.editable, false);
      assert.equal(dish.source, 'admin');
      assert.ok(dish.normalizedName);
    });
  });

  it('keeps data layer helpers and UI styles wired', () => {
    const repository = readText('src/lib/menu/repository.ts');
    const dayEditor = readText('src/lib/menu/day-editor.ts');
    const dayEditDraft = readText('src/lib/menu/day-edit-draft.mjs');
    const dayEditModal = readText('src/lib/menu/day-edit-modal.ts');
    const suggestionHelper = readText('src/lib/menu/dish-suggestions.ts');
    const types = readText('src/lib/menu/types.ts');
    const dashboardScript = readText('src/scripts/dashboard-app.ts');
    const configuratorScript = readText('src/scripts/configurator-app.ts');
    const settingsScript = readText('src/scripts/settings-app.ts');
    const historyScript = readText('src/scripts/history-app.ts');
    const headerScript = readText('src/scripts/app-header.ts');
    const dates = readText('src/lib/menu/dates.ts');
    const dishesScript = readText('src/scripts/dishes-app.ts');
    const tuppersScript = readText('src/scripts/tuppers-app.ts');
    const styles = readText('src/styles/global.css');
    const dayEditModalComponent = readText('src/components/DayEditModal.astro');
    const dishStyles = readText('src/styles/dishes.css');
    const rules = readText('firestore.rules');
    assert.match(repository, /ensureDefaultGroup/);
    assert.match(repository, /getOrCreateWeekMenus/);
    assert.match(repository, /watchWeekMenusByIds/);
    assert.match(repository, /joinGroupByInviteCode/);
    assert.match(repository, /clearMenuDay/);
    assert.match(dates, /getWeekStartForDate/);
    assert.match(dates, /getUpcomingDates/);
    assert.match(dates, /getWeekStartsForDates/);
    assert.match(dayEditor, /renderDayEditor/);
    assert.match(dayEditor, /renderPlateRow/);
    assert.match(dayEditor, /dish-combobox/);
    assert.match(dayEditor, /role=\"combobox\"/);
    assert.match(dayEditor, /data-suggestion-toggle/);
    assert.match(dayEditor, /dish-suggestions/);
    assert.match(dayEditor, /data-suggestion-list/);
    assert.match(dayEditor, /data-add-plate/);
    assert.match(dayEditor, /data-remove-plate/);
    assert.match(dayEditor, /data-field=\"skipped\"/);
    assert.match(dayEditor, /data-day-mode/);
    assert.match(dayEditor, /data-day-skip-fields/);
    assert.match(dayEditor, /data-day-meals-block/);
    assert.doesNotMatch(dayEditor, /<datalist/);
    assert.match(dayEditDraft, /setDaySkippedDraft/);
    assert.match(dayEditDraft, /applyRecommendedMealDraft/);
    assert.match(suggestionHelper, /attachDishSuggestions/);
    assert.match(suggestionHelper, /suggestionLimit = 6/);
    assert.match(suggestionHelper, /focusin/);
    assert.match(suggestionHelper, /ArrowDown/);
    assert.match(suggestionHelper, /pointerdown/);
    assert.match(suggestionHelper, /selectSuggestion/);
    assert.match(suggestionHelper, /closest<HTMLElement>\('\.plate-row'\)/);
    assert.match(suggestionHelper, /aria-expanded/);
    assert.match(suggestionHelper, /CSS\.escape/);
    assert.match(types, /type MenuGroup/);
    assert.match(types, /MealSlot = 'breakfast' \| 'lunch' \| 'dinner'/);
    assert.match(types, /skipNote/);
    assert.match(dayEditModal, /renderDayEditor/);
    assert.match(dayEditModal, /data-day-edit-modal/);
    assert.match(dayEditModal, /data-day-edit-save/);
    assert.match(dayEditModal, /readDayDraft/);
    assert.match(dayEditModal, /fields\.addEventListener\('input'/);
    assert.match(dayEditModal, /target\.dataset\.field === 'skipped'/);
    assert.match(dayEditModal, /setDaySkippedDraft/);
    assert.match(dayEditModal, /await options\.onSaveDay/);
    assert.match(dayEditModal, /modal\.close\(\)/);
    assert.match(dayEditModal, /returnFocusTo/);
    assert.match(dayEditModal, /applyRecommendedDishes/);
    assert.match(dayEditModalComponent, /aria-labelledby=\"day-edit-modal-title\"/);
    assert.match(dayEditModalComponent, /data-day-edit-number/);
    assert.match(dayEditModalComponent, /day-edit-modal__close/);
    assert.match(dayEditModalComponent, /data-day-edit-cancel-footer/);
    assert.match(dayEditModalComponent, /data-day-edit-save-state/);
    assert.match(dayEditModalComponent, /aria-live=\"polite\"/);
    assert.match(dashboardScript, /createDayEditModalController/);
    assert.match(dashboardScript, /attachDishSuggestions/);
    assert.match(dashboardScript, /currentProfile\?\.groupId/);
    assert.match(dashboardScript, /data-quick-edit/);
    assert.match(dashboardScript, /clearMenuDay/);
    assert.match(configuratorScript, /createDayEditModalController/);
    assert.match(configuratorScript, /attachDishSuggestions/);
    assert.match(configuratorScript, /currentProfile\?\.groupId/);
    assert.match(configuratorScript, /data-config-edit/);
    assert.match(settingsScript, /addPendingGroupEmail/);
    assert.match(settingsScript, /leaveGroup/);
    assert.match(historyScript, /createDayEditModalController/);
    assert.match(historyScript, /attachDishSuggestions/);
    assert.match(historyScript, /watchUserMenus/);
    assert.match(historyScript, /currentProfile\?\.groupId/);
    assert.match(headerScript, /data-site-menu-toggle/);
    assert.match(headerScript, /data-global-theme/);
    assert.match(styles, /site-header__toggle/);
    assert.match(styles, /day-actions/);
    assert.match(styles, /dish-suggestions/);
    assert.match(dishStyles, /dish-row/);
    assert.match(dishStyles, /dish-editor-dialog/);
    assert.match(dishStyles, /dishes-list/);
    assert.match(styles, /icon-button/);
    assert.match(styles, /day-skip-toggle/);
    assert.match(styles, /quick-edit-modal/);
    assert.match(dayEditModalComponent, /day-edit-modal__box/);
    assert.match(styles, /confirm-dialog/);
    assert.match(styles, /next-day-card__number/);
    assert.doesNotMatch(dishesScript, /window\.confirm/);
    assert.doesNotMatch(tuppersScript, /window\.confirm/);
    assert.match(rules, /match \/groups/);
  });

  it('keeps explicit day-save helpers wired in editable apps', () => {
    const dashboardScript = readText('src/scripts/dashboard-app.ts');
    const configuratorScript = readText('src/scripts/configurator-app.ts');
    const historyScript = readText('src/scripts/history-app.ts');
    const dishesScript = readText('src/scripts/dishes-app.ts');
    const menuRepository = readText('src/lib/menu/repository.ts');
    const designSystem = readText('docs/design-system.md');

    [dashboardScript, configuratorScript, historyScript].forEach((source) => {
      assert.match(source, /updateMenuDay/);
      assert.match(source, /onSaveDay/);
      assert.match(source, /getWriteErrorMessage/);
      assert.doesNotMatch(source, /createDebouncedTaskMap/);
      assert.doesNotMatch(source, /updateMenuPatch/);
    });
    assert.match(dishesScript, /createSaveFeedback/);
    assert.match(menuRepository, /export async function updateMenuDay/);
    assert.match(menuRepository, /getAddedDishNames/);
    assert.match(designSystem, /Guardado y estado/);
  });

  it('includes GitHub workflows for CI and Pages', () => {
    const pagesWorkflow = readText('.github/workflows/pages.yml');
    const ciWorkflow = readText('.github/workflows/ci.yml');
    assert.match(pagesWorkflow, /actions\/deploy-pages@v4/);
    assert.match(pagesWorkflow, /npm run build/);
    assert.match(pagesWorkflow, /npm test/);
    assert.match(ciWorkflow, /pull_request/);
    assert.match(ciWorkflow, /npm run build/);
    assert.match(ciWorkflow, /npm test/);
  });

  it('keeps useful project documentation available', () => {
    const readme = readText('README.md');
    const firebaseDocs = readText('docs/firebase.md');
    const navigationDocs = readText('docs/navigation.md');
    assert.match(readme, /Menu Diario/);
    assert.match(readme, /Catálogo dual/);
    assert.match(firebaseDocs, /enabledMeals/);
    assert.match(firebaseDocs, /theme/);
    assert.match(firebaseDocs, /Plato general/);
    assert.match(navigationDocs, /Header único/);
    assert.match(navigationDocs, /getLocalizedPath/);
    assert.equal(existsSync(join(root, 'agents.md')), true);
    assert.equal(existsSync(join(root, 'docs/design-system.md')), true);
    assert.equal(existsSync(join(root, 'docs/firebase.md')), true);
    assert.equal(existsSync(join(root, 'docs/navigation.md')), true);
    assert.equal(existsSync(join(root, 'firestore.rules')), true);
  });
});
