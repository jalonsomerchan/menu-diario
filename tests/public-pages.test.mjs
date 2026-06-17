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

describe('public pages smoke checks', () => {
  it('keeps the how it works page available in default and localized routes', () => {
    [
      'src/pages/como-funciona.astro',
      'src/pages/[locale]/como-funciona.astro',
      'src/components/PublicHowItWorksPage.astro',
      'src/i18n/translations/public/es.json',
      'src/i18n/translations/public/en.json',
    ].forEach((path) => {
      assert.equal(existsSync(join(root, path)), true, `${path} should exist`);
    });
  });

  it('loads public translations through the i18n namespace', () => {
    const ui = readText('src/i18n/ui.ts');
    assert.match(ui, /translations\/public\/es\.json/);
    assert.match(ui, /translations\/public\/en\.json/);
    assert.match(ui, /namespaceTranslations\('public'/);

    const es = readJson('src/i18n/translations/public/es.json');
    const en = readJson('src/i18n/translations/public/en.json');
    assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort());
    assert.equal(es['howItWorks.nav'], 'Cómo funciona');
    assert.equal(en['howItWorks.nav'], 'How it works');
  });

  it('links the how it works public page with base-safe helpers', () => {
    const footer = readText('src/components/Footer.astro');
    assert.match(footer, /getLocalizedPath\('\/como-funciona'/);
    assert.match(footer, /public\.howItWorks\.nav/);
  });

  it('keeps dynamic growth SEO routes available', () => {
    [
      'src/pages/[publicSeoSlug].astro',
      'src/pages/[locale]/[publicSeoSlug].astro',
      'src/data/public-seo-growth-pages.ts',
    ].forEach((path) => {
      assert.equal(existsSync(join(root, path)), true, `${path} should exist`);
    });

    const route = readText('src/pages/[publicSeoSlug].astro');
    const localizedRoute = readText('src/pages/[locale]/[publicSeoSlug].astro');
    const data = readText('src/data/public-seo-growth-pages.ts');

    assert.match(data, /lista-compra-semanal/);
    assert.match(data, /planificador-menu-ia/);
    assert.match(data, /organizar-tuppers-comidas/);
    assert.match(data, /batch-cooking-semanal/);
    assert.match(data, /app-menu-semanal-familiar/);
    assert.match(data, /menu-semanal-saludable/);
    assert.match(route, /publicSeoGrowthPageKeys/);
    assert.match(route, /getStaticPaths\(\)/);
    assert.match(localizedRoute, /Astro\.params\.locale/);
    assert.match(localizedRoute, /isLocale\(localeParam\)/);
  });
});
