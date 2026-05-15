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
      'src/pages/[locale]/index.astro',
      'src/pages/[locale]/dashboard.astro',
      'src/pages/[locale]/configurar.astro',
      'src/pages/[locale]/ajustes.astro',
      'src/pages/[locale]/historico.astro',
      'src/pages/404.astro',
      'src/pages/manifest.webmanifest.ts',
      'src/pages/robots.txt.ts',
      'src/layouts/BaseLayout.astro',
      'src/config/site.ts',
      'src/i18n/ui.ts',
      'src/i18n/translations',
      'src/utils/paths.ts',
      'src/styles/global.css',
    ].forEach((path) => {
      assert.equal(existsSync(join(root, path)), true, `${path} should exist`);
    });
  });

  it('keeps shared and app components available', () => {
    ['Button', 'Container', 'Footer', 'Header', 'AppHeader', 'AuthGate', 'DashboardApp', 'ConfiguratorApp', 'SettingsApp', 'HistoryApp', 'MenuApp'].forEach(
      (component) => {
        assert.equal(
          existsSync(join(root, `src/components/${component}.astro`)),
          true,
          `${component}.astro should exist`
        );
      }
    );
  });

  it('keeps project metadata and expected npm scripts available', () => {
    ['.nvmrc', '.env.example', '.gitignore', '.prettierrc', '.prettierignore', 'README.md'].forEach(
      (path) => assert.equal(existsSync(join(root, path)), true, `${path} should exist`)
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
      ['home.title', 'nav.main', 'dashboard.title', 'dashboard.moreActions', 'history.title', 'group.title', 'appNav.settings', 'menu.signInGoogle'].forEach((key) => {
        assert.ok(translations[key], `${locale}.json should include ${key}`);
      });
    });
  });

  it('keeps routing and assets compatible with root and subpath deployments', () => {
    const layout = readText('src/layouts/BaseLayout.astro');
    const manifest = readText('src/pages/manifest.webmanifest.ts');
    const robots = readText('src/pages/robots.txt.ts');
    const i18nHelper = readText('src/i18n/ui.ts');
    const pathHelpers = readText('src/utils/paths.ts');

    [layout, manifest, robots, i18nHelper].forEach((source) => {
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

  it('keeps app navigation and feature wiring available', () => {
    const home = readText('src/pages/index.astro');
    const dashboard = readText('src/pages/dashboard.astro');
    const configure = readText('src/pages/configurar.astro');
    const settings = readText('src/pages/ajustes.astro');
    const history = readText('src/pages/historico.astro');
    const appHeader = readText('src/components/AppHeader.astro');
    const authGate = readText('src/components/AuthGate.astro');
    const dashboardApp = readText('src/components/DashboardApp.astro');
    const configuratorApp = readText('src/components/ConfiguratorApp.astro');
    const settingsApp = readText('src/components/SettingsApp.astro');
    const historyApp = readText('src/components/HistoryApp.astro');

    assert.match(home, /<AuthGate/);
    assert.match(dashboard, /<AppHeader/);
    assert.match(dashboard, /<DashboardApp/);
    assert.match(configure, /<AppHeader/);
    assert.match(configure, /<ConfiguratorApp/);
    assert.match(settings, /<SettingsApp/);
    assert.match(history, /<HistoryApp/);
    assert.match(appHeader, /data-global-theme/);
    assert.match(appHeader, /appNav\.history/);
    assert.match(authGate, /data-auth-gate/);
    assert.match(dashboardApp, /data-quick-modal/);
    assert.match(dashboardApp, /data-notifications/);
    assert.match(configuratorApp, /data-configurator-app/);
    assert.match(settingsApp, /data-settings-app/);
    assert.match(historyApp, /data-history-app/);
  });

  it('keeps data layer helpers and UI styles wired', () => {
    const repository = readText('src/lib/menu/repository.ts');
    const types = readText('src/lib/menu/types.ts');
    const dashboardScript = readText('src/scripts/dashboard-app.ts');
    const configuratorScript = readText('src/scripts/configurator-app.ts');
    const settingsScript = readText('src/scripts/settings-app.ts');
    const historyScript = readText('src/scripts/history-app.ts');
    const headerScript = readText('src/scripts/app-header.ts');
    const styles = readText('src/styles/global.css');
    const rules = readText('firestore.rules');

    assert.match(repository, /ensureDefaultGroup/);
    assert.match(repository, /joinGroupByInviteCode/);
    assert.match(repository, /clearMenuDay/);
    assert.match(types, /type MenuGroup/);
    assert.match(types, /MealSlot = 'breakfast' \| 'lunch' \| 'dinner'/);
    assert.match(dashboardScript, /data-quick-edit/);
    assert.match(dashboardScript, /data-clear-day/);
    assert.match(configuratorScript, /day-card__date-number/);
    assert.match(settingsScript, /addPendingGroupEmail/);
    assert.match(settingsScript, /leaveGroup/);
    assert.match(historyScript, /watchUserMenus/);
    assert.match(headerScript, /data-global-theme/);
    assert.match(styles, /app-header/);
    assert.match(styles, /day-actions/);
    assert.match(styles, /quick-edit-modal/);
    assert.match(styles, /next-day-card__number/);
    assert.match(rules, /match \/groups/);
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

    assert.match(readme, /Menu Diario/);
    assert.match(firebaseDocs, /enabledMeals/);
    assert.match(firebaseDocs, /theme/);
    assert.equal(existsSync(join(root, 'agents.md')), true);
    assert.equal(existsSync(join(root, 'docs/design-system.md')), true);
    assert.equal(existsSync(join(root, 'docs/firebase.md')), true);
    assert.equal(existsSync(join(root, 'firestore.rules')), true);
  });
});
