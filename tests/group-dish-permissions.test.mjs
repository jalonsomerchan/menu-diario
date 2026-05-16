import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('group dish permissions smoke checks', () => {
  it('uses group membership as the source of truth for group dish permissions', () => {
    const rules = readText('firestore.rules');
    const docs = readText('docs/firebase.md');
    const groupDishData = rules.match(/function isGroupDishData\(data\) \{([\s\S]*?)\n    \}/)?.[1] ?? '';

    assert.match(groupDishData, /data\.scope == 'group'/);
    assert.match(groupDishData, /data\.groupId is string/);
    assert.match(groupDishData, /isGroupMember\(data\.groupId\)/);
    assert.doesNotMatch(groupDishData, /request\.auth\.uid in data\.members/);
    assert.match(rules, /function keepsGroupDishScope\(\)/);
    assert.match(rules, /request\.resource\.data\.groupId == resource\.data\.groupId/);
    assert.match(docs, /no se exige que su UID esté duplicado en `dishes\.members`/);
    assert.match(docs, /`members`: metadato legacy en platos/);
  });
});
