import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('public SEO pages', () => {
  it('keeps public SEO routes and reusable data available', () => {
    [
      'src/data/public-seo-pages.ts',
      'src/components/PublicSeoPage.astro',
      'src/pages/manual.astro',
      'src/pages/politica-privacidad.astro',
      'src/pages/organizar-menu-semanal.astro',
      'src/pages/planificador-comidas.astro',
      'src/pages/[locale]/manual.astro',
      'src/pages/[locale]/politica-privacidad.astro',
      'src/pages/[locale]/organizar-menu-semanal.astro',
      'src/pages/[locale]/planificador-comidas.astro',
    ].forEach((path) => {
      assert.equal(existsSync(join(root, path)), true, `${path} should exist`);
    });
  });

  it('keeps public SEO content centralized and localized', () => {
    const data = readText('src/data/public-seo-pages.ts');
    ['manual', 'privacy', 'weeklyMenu', 'mealPlanner'].forEach((key) => assert.match(data, new RegExp(key)));
    ['manual', 'politica-privacidad', 'organizar-menu-semanal', 'planificador-comidas'].forEach((slug) =>
      assert.match(data, new RegExp(slug))
    );
    assert.match(data, /Record<Locale, Record<PublicSeoPageKey, PublicSeoPage>>/);
    assert.match(data, /getPublicSeoPages/);
    assert.match(data, /getPublicSeoRelatedPages/);
  });

  it('keeps public SEO pages compatible with i18n and subpath deployments', () => {
    const component = readText('src/components/PublicSeoPage.astro');
    const footer = readText('src/components/Footer.astro');
    assert.match(component, /getLocalizedPath/);
    assert.match(component, /<Breadcrumb/);
    assert.match(component, /<Button/);
    assert.doesNotMatch(component, /href=\"\//);
    assert.doesNotMatch(component, /src=\"\//);
    assert.match(footer, /getPublicSeoPages/);
    assert.match(footer, /getLocalizedPath/);
    assert.doesNotMatch(footer, /href=\"\//);
  });

  it('keeps localized public routes generated from configured locales', () => {
    [
      'src/pages/[locale]/manual.astro',
      'src/pages/[locale]/politica-privacidad.astro',
      'src/pages/[locale]/organizar-menu-semanal.astro',
      'src/pages/[locale]/planificador-comidas.astro',
    ].forEach((path) => {
      const source = readText(path);
      assert.match(source, /getStaticPaths/);
      assert.match(source, /locales/);
      assert.match(source, /defaultLocale/);
      assert.match(source, /isLocale/);
      assert.match(source, /<BaseLayout/);
      assert.match(source, /<PublicSeoPage/);
    });
  });
});
