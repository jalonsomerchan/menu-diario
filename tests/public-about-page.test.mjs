import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('public about page', () => {
  it('adds accessible localized public routes without auth gate', () => {
    const defaultPage = readText('src/pages/acerca-de.astro');
    const localizedPage = readText('src/pages/[locale]/acerca-de.astro');
    const component = readText('src/components/AboutPage.astro');
    const footer = readText('src/components/Footer.astro');
    const copy = readText('src/i18n/public-pages.ts');

    assert.equal(existsSync(join(root, 'src/pages/acerca-de.astro')), true);
    assert.equal(existsSync(join(root, 'src/pages/[locale]/acerca-de.astro')), true);
    assert.match(defaultPage, /<BaseLayout/);
    assert.match(defaultPage, /description=\{tp\('aboutDescription'\)\}/);
    assert.match(localizedPage, /getStaticPaths/);
    assert.match(localizedPage, /Astro\.params\.locale/);
    assert.match(localizedPage, /isLocale\(localeParam\)/);
    assert.doesNotMatch(component, /AuthGate/);
    assert.match(component, /<h1>\{tp\('aboutTitle'\)\}<\/h1>/);
    assert.match(component, /aria-labelledby/);
    assert.match(component, /getLocalizedPath\('\/dashboard'/);
    assert.match(component, /siteConfig\.repositoryUrl/);
    assert.match(component, /<style>/);
    assert.match(footer, /getLocalizedPath\('\/acerca-de'/);
    assert.match(footer, /footerAbout/);
    assert.match(copy, /aboutTitle/);
    assert.match(copy, /aboutDescription/);
    assert.match(copy, /footerAbout/);
    assert.match(copy, /es:/);
    assert.match(copy, /en:/);
  });
});
