import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('shopping Alexa shortcut smoke checks', () => {
  it('wires the Alexa shortcut script into the shopping page', () => {
    assert.equal(existsSync(join(root, 'src/scripts/shopping-alexa-integration.ts')), true);

    const wizardScript = readText('src/scripts/shopping-wizard.ts');
    const alexaScript = readText('src/scripts/shopping-alexa-integration.ts');

    assert.match(wizardScript, /shopping-alexa-integration/);
    assert.match(alexaScript, /data-shopping-app/);
    assert.match(alexaScript, /dataset\.alexa/);
    assert.match(alexaScript, /Añadir a Alexa/);
    assert.match(alexaScript, /Add to Alexa/);
    assert.match(alexaScript, /navigator\.clipboard\.writeText\(command\)/);
    assert.match(alexaScript, /window\.location\.href = ALEXA_SHOPPING_LIST_URL/);
    assert.match(alexaScript, /String\.fromCharCode\(97, 108, 101, 120, 97\)/);
    assert.match(alexaScript, /index\.html#lists\/shopping/);
    assert.match(alexaScript, /Añade a la lista de la compra/);
    assert.match(alexaScript, /data-item-id\]\[data-status="to-buy"\]/);
  });
});
