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

    assert.match(weeklyMenuRules, /allow read: if isMemberDocument\(\) \|\| isSharedGroupOwnerMenu\(\);/);
    assert.doesNotMatch(weeklyMenuRules, /allow read: if signedIn\(\);/);
  });

  it('restricts weekly menu updates to content edits or member joins', () => {
    const rules = readText('firestore.rules');
    const weeklyMenuRules = getRulesBlock(rules, 'weeklyMenus', 'menuId');

    assert.match(rules, /function changesOnlyFields\(fields\)/);
    assert.match(rules, /function updatesMenuContent\(\)/);
    assert.match(rules, /function joinsMenuDocument\(\)/);
    assert.match(rules, /function syncsSharedMenuMembership\(\)/);
    assert.match(rules, /changesOnlyFields\(\['days', 'updatedAt', 'updatedBy'\]\)/);
    assert.match(rules, /changesOnlyFields\(\['members', 'groupId', 'updatedAt', 'updatedBy'\]\)/);
    assert.match(rules, /changesOnlyFields\(\['members', 'updatedAt', 'updatedBy'\]\)/);
    assert.match(weeklyMenuRules, /allow update: if updatesMenuContent\(\) \|\| joinsMenuDocument\(\) \|\| syncsSharedMenuMembership\(\);/);
    assert.doesNotMatch(weeklyMenuRules, /allow update: if isMemberDocument\(\) \|\| joinsDocument\(\);/);
  });

  it('allows tupper reads for document members and real group members', () => {
    const rules = readText('firestore.rules');
    const tupperRules = getRulesBlock(rules, 'tuppers', 'tupperId');

    assert.match(rules, /function canAccessTupper\(data\)/);
    assert.match(rules, /function isValidTupperCreate\(data\)/);
    assert.match(tupperRules, /allow create: if isValidTupperCreate\(request\.resource\.data\);/);
    assert.match(tupperRules, /allow read: if canAccessTupper\(resource\.data\);/);
    assert.match(tupperRules, /allow update: if canAccessTupper\(resource\.data\) \|\| canAccessTupper\(request\.resource\.data\);/);
    assert.doesNotMatch(tupperRules, /allow read: if signedIn\(\);/);
  });

  it('restricts daily options to owners or real group members', () => {
    const rules = readText('firestore.rules');
    const optionRules = getRulesBlock(rules, 'dailyOptions', 'optionId');

    assert.match(rules, /function isDailyOptionScope\(data\)/);
    assert.match(rules, /function canAccessDailyOption\(data\)/);
    assert.match(optionRules, /allow read: if canAccessDailyOption\(resource\.data\);/);
    assert.match(optionRules, /allow create: if isDailyOptionScope\(request\.resource\.data\)/);
    assert.match(optionRules, /allow update: if canAccessDailyOption\(resource\.data\)/);
    assert.doesNotMatch(optionRules, /allow read: if signedIn\(\);/);
  });
});
