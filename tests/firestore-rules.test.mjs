import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('Firestore rules smoke checks', () => {
  it('restricts tupper reads to document members', () => {
    const rules = readText('firestore.rules');
    const tupperRulesMatch = rules.match(/match \/tuppers\/\{tupperId\} \{(?<body>[\s\S]*?)\n    \}/);

    assert.ok(tupperRulesMatch?.groups?.body, 'tupper rules block should exist');
    assert.match(tupperRulesMatch.groups.body, /allow read: if isMemberDocument\(\);/);
    assert.doesNotMatch(tupperRulesMatch.groups.body, /allow read: if signedIn\(\);/);
  });
});
