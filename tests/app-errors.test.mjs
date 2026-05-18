import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('app error formatter', () => {
  it('maps technical error codes to safe translated label keys', () => {
    const source = readText('src/lib/errors/format-app-error.ts');

    [
      'Firebase public config is missing. Check .env.example.',
      'Firebase App Check is required for AI requests but is not ready.',
      'group-not-found',
      'invite-not-found',
      'dish-invalid-name',
      'dish-duplicate',
      'dish-duplicate-global',
      'dish-not-editable',
      'permission-denied',
      'unavailable',
      'errors.generic',
    ].forEach((snippet) => assert.match(source, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
  });

  it('uses the shared formatter in the dishes app instead of exposing raw errors', () => {
    const component = readText('src/components/DishesApp.astro');
    const script = readText('src/scripts/dishes-app.ts');

    assert.match(component, /errors\.dishInvalidName/);
    assert.match(component, /errors\.dishDuplicate/);
    assert.match(component, /errors\.dishDuplicateGlobal/);
    assert.match(component, /errors\.dishNotEditable/);
    assert.match(script, /formatAppError/);
    assert.match(script, /function errorMessage\(error: unknown\)/);
    assert.doesNotMatch(script, /return error\.message;/);
  });
});
