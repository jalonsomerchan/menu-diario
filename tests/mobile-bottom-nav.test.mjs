import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('mobile bottom navigation', () => {
  it('renders from the base layout with localized routes and safe-area styles', () => {
    const layout = readText('src/layouts/BaseLayout.astro');
    const component = readText('src/components/MobileBottomNav.astro');
    const styles = readText('src/styles/mobile-bottom-nav.css');

    assert.match(layout, /MobileBottomNav/);
    assert.match(layout, /mobile-bottom-nav\.css/);
    assert.match(component, /getLocalizedPath\('\/dashboard'/);
    assert.match(component, /getLocalizedPath\('\/planificacion'/);
    assert.match(component, /getLocalizedPath\('\/compra'/);
    assert.match(component, /getLocalizedPath\('\/tuppers'/);
    assert.match(component, /appNav\.planning/);
    assert.match(component, /aria-current/);
    assert.match(styles, /repeat\(4, minmax\(0, 1fr\)\)/);
    assert.match(styles, /env\(safe-area-inset-bottom\)/);
    assert.match(styles, /@media \(min-width: 768px\)/);
  });
});
