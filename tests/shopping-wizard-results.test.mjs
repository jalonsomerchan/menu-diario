import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('shopping wizard review flow', () => {
  it('keeps compact review action labels localized', () => {
    const source = readText('src/i18n/shopping-actions.ts');
    assert.match(source, /doNotBuy: 'No comprar'/);
    assert.match(source, /doNotBuy: 'Do not buy'/);
    assert.match(source, /Record<Locale, Record<string, string>>/);
  });

  it('starts AI shopping results at the first review item without repeated scrolling', () => {
    const source = readText('src/scripts/shopping-wizard.ts');
    assert.match(source, /function scrollResultsTop/);
    assert.match(source, /draft\?\.scrollTo\(\{ top: 0, left: 0, behavior: 'auto' \}\)/);
    assert.match(source, /scrollIntoView\(\{ behavior: 'auto', block: 'start' \}\)/);
    assert.match(source, /panels\[currentIndex\] === resultsPanel/);
    assert.match(source, /lastResultsScrollSignature/);
  });

  it('simplifies item review actions idempotently to buy or do not buy', () => {
    const script = readText('src/scripts/shopping-wizard.ts');
    const component = readText('src/components/ShoppingApp.astro');
    assert.match(script, /\[data-set-status="owned"\]:not\(\[data-review-hidden="true"\]\)/);
    assert.match(script, /button\.dataset\.reviewHidden = 'true'/);
    assert.match(script, /if \(button\.textContent !== doNotBuyLabel\)/);
    assert.match(script, /MutationObserver/);
    assert.match(component, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(component, /white-space: nowrap/);
  });
});
