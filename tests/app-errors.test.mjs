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

  it('exposes one small shared formatter module for UI scripts', () => {
    const index = readText('src/lib/errors/index.ts');
    const source = readText('src/lib/errors/format-app-error.ts');

    assert.match(index, /formatAppError/);
    assert.match(index, /getAppErrorKey/);
    assert.match(source, /export function formatAppError/);
    assert.match(source, /labels\[key\]/);
    assert.match(source, /labels\['errors\.generic'\]/);
  });
});
