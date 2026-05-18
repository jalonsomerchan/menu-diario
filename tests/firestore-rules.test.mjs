import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

function getRulesBlock(rules, collection, idName) {
  const match = rules.match(new RegExp(`match \\/${collection}\\/\\{${idName}\\} \\{(?<body>[\\s\\S]*?)\\n    \\}`));
  assert.ok(match?.groups?.body, `${collection} rules block should exist`);
  return match.groups.body;
}

describe('Firestore rules smoke checks', () => {
  it('restricts weekly menu reads to document members', () => {
    const rules = readText('firestore.rules');
    const weeklyMenuRules = getRulesBlock(rules, 'weeklyMenus', 'menuId');

    assert.match(weeklyMenuRules, /allow read: if isMemberDocument\(\);/);
    assert.doesNotMatch(weeklyMenuRules, /allow read: if signedIn\(\);/);
  });

  it('restricts weekly menu updates to content edits or member joins', () => {
    const rules = readText('firestore.rules');
    const weeklyMenuRules = getRulesBlock(rules, 'weeklyMenus', 'menuId');

    assert.match(rules, /function changesOnlyFields\(fields\)/);
    assert.match(rules, /function updatesMenuContent\(\)/);
    assert.match(rules, /function joinsMenuDocument\(\)/);
    assert.match(rules, /changesOnlyFields\(\['days', 'updatedAt', 'updatedBy'\]\)/);
    assert.match(rules, /changesOnlyFields\(\['members', 'updatedAt', 'updatedBy'\]\)/);
    assert.match(weeklyMenuRules, /allow update: if updatesMenuContent\(\) \|\| joinsMenuDocument\(\);/);
    assert.doesNotMatch(weeklyMenuRules, /allow update: if isMemberDocument\(\) \|\| joinsDocument\(\);/);
  });

  it('restricts tupper reads to document members', () => {
    const rules = readText('firestore.rules');
    const tupperRules = getRulesBlock(rules, 'tuppers', 'tupperId');

    assert.match(tupperRules, /allow read: if isMemberDocument\(\);/);
    assert.doesNotMatch(tupperRules, /allow read: if signedIn\(\);/);
  });
});
