import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('localized route switcher', () => {
  it('keeps the current route when building alternate locale links', () => {
    const header = readText('src/components/Header.astro');
    const i18n = readText('src/i18n/ui.ts');

    assert.match(i18n, /export function getUnlocalizedPath/);
    assert.match(i18n, /export function getLocalizedEquivalentPath/);
    assert.match(i18n, /stripBasePath\(pathname\)/);
    assert.match(i18n, /isLocale\(segments\[0\]\)/);
    assert.match(i18n, /getLocalizedPath\(getUnlocalizedPath\(pathname\), locale\)/);

    assert.match(header, /getLocalizedEquivalentPath/);
    assert.match(header, /Astro\.url\.pathname/);
    assert.match(header, /hreflang=\{alternateLocale\}/);
    assert.doesNotMatch(header, /href=\{getLocalizedPath\('\/', alternateLocale\)\}/);
  });
});
