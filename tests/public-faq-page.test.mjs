import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('public faq page', () => {
  it('adds localized FAQ routes with semantic content and footer links', () => {
    const defaultPage = readText('src/pages/faq.astro');
    const localizedPage = readText('src/pages/[locale]/faq.astro');
    const component = readText('src/components/FaqPage.astro');
    const footer = readText('src/components/Footer.astro');
    const copy = readText('src/i18n/public-pages.ts');

    assert.equal(existsSync(join(root, 'src/pages/faq.astro')), true);
    assert.equal(existsSync(join(root, 'src/pages/[locale]/faq.astro')), true);
    assert.match(defaultPage, /<BaseLayout/);
    assert.match(defaultPage, /description=\{tp\('faqDescription'\)\}/);
    assert.match(localizedPage, /getStaticPaths/);
    assert.match(localizedPage, /Astro\.params\.locale/);
    assert.match(localizedPage, /isLocale\(localeParam\)/);
    assert.doesNotMatch(component, /AuthGate/);
    assert.match(component, /<h1>\{tp\('faqTitle'\)\}<\/h1>/);
    assert.match(component, /getPublicFaqItems\(locale\)/);
    assert.match(component, /<section class="faq-page__item">/);
    assert.match(component, /aria-label=\{tp\('faqTitle'\)\}/);
    assert.match(component, /getLocalizedPath\('\/dashboard'/);
    assert.match(footer, /getLocalizedPath\('\/faq'/);
    assert.match(footer, /footerFaq/);
    assert.match(copy, /faqTitle/);
    assert.match(copy, /faqDescription/);
    assert.match(copy, /getPublicFaqItems/);
    assert.match(copy, /¿Qué es Menu Diario\?/);
    assert.match(copy, /What is Menu Diario\?/);
  });
});
