import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('public footer', () => {
  it('shows only public pages in the footer', () => {
    const footer = readText('src/components/Footer.astro');

    assert.match(footer, /site-footer__brand/);
    assert.match(footer, /site-footer__public-pages/);
    assert.match(footer, /getPublicSeoPages/);
    assert.match(footer, /getLocalizedPath\('\/'/);
    assert.match(footer, /getLocalizedPath\('\/como-funciona'/);
    assert.match(footer, /getLocalizedPath\('\/acerca-de'/);
    assert.match(footer, /getLocalizedPath\('\/faq'/);
    assert.match(footer, /page\.navLabel/);

    assert.doesNotMatch(footer, /getLocalizedPath\('\/dashboard'/);
    assert.doesNotMatch(footer, /getLocalizedPath\('\/planificador'/);
    assert.doesNotMatch(footer, /siteConfig\.repositoryUrl/);
    assert.doesNotMatch(footer, /footerTools/);
    assert.doesNotMatch(footer, /footerGames/);
    assert.doesNotMatch(footer, /target=\"_blank\"/);
    assert.doesNotMatch(footer, /new URL\(project\.href\)/);
  });
});
