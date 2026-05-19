import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('Eurovision-style header', () => {
  it('keeps app navigation while matching the Eurovision header pattern', () => {
    const header = readText('src/components/Header.astro');
    const script = readText('src/scripts/app-header.ts');

    assert.match(header, /site-header app-header/);
    assert.match(header, /class=\"header-inner\"/);
    assert.match(header, /class=\"site-brand\"/);
    assert.match(header, /site-brand__mark\">MD/);
    assert.match(header, /site-brand__text/);
    assert.match(header, /main-nav main-nav--desktop/);
    assert.match(header, /nav-dropdown/);
    assert.match(header, /locale-menu/);
    assert.match(header, /class=\"mobile-menu\" data-mobile-menu/);
    assert.match(header, /mobile-menu__panel/);
    assert.match(header, /mobile-menu__head/);
    assert.match(header, /mobile-menu__languages/);
    assert.match(header, /data-site-menu-toggle/);
    assert.match(header, /data-site-menu-panel/);
    assert.match(header, /aria-controls=\{panelId\}/);
    assert.match(header, /aria-expanded=\"false\"/);
    assert.match(header, /data-global-theme/);
    assert.match(header, /data-global-logout/);
    assert.match(header, /data-admin-link/);
    assert.match(header, /dashboardPath/);
    assert.match(header, /configurePath/);
    assert.match(header, /shoppingPath/);
    assert.match(header, /planningPath/);
    assert.match(header, /dishRecommenderPath/);
    assert.doesNotMatch(header, /site-header__bar/);
    assert.doesNotMatch(header, /site-header__toggle/);
    assert.doesNotMatch(header, /site-header__panel/);

    assert.match(script, /data-mobile-menu/);
    assert.match(script, /mobileMenu\.open/);
    assert.match(script, /data-site-menu-toggle/);
    assert.match(script, /data-site-menu-panel/);
    assert.match(script, /closest\('a'\)/);
    assert.match(script, /themeSelects/);
    assert.match(script, /logoutButtons/);
    assert.match(script, /adminLinks/);
  });
});
