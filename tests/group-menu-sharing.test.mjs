import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('group menu sharing smoke checks', () => {
  it('resolves shared menus from the group owner context and preserves group metadata', () => {
    const repository = readText('src/lib/menu/repository.ts');
    const types = readText('src/lib/menu/types.ts');

    assert.match(types, /groupId\?: string;/);
    assert.match(repository, /type MenuAccessContext =/);
    assert.match(repository, /async function getMenuAccessContext/);
    assert.match(repository, /where\(access\.groupId \? 'ownerId' : 'members'/);
    assert.match(repository, /groupId: menuAccess\.groupId \?\? null/);
    assert.match(repository, /syncSharedMenuMembership/);
    assert.match(repository, /syncSharedMenusForAccess/);
  });

  it('allows shared-group reads and controlled metadata syncs in firestore rules', () => {
    const rules = readText('firestore.rules');

    assert.match(rules, /function isSharedGroupOwnerMenu\(\)/);
    assert.match(rules, /allow read: if isMemberDocument\(\) \|\| isSharedGroupOwnerMenu\(\);/);
    assert.match(rules, /allow create: if createsOwnMenu\(\) \|\| createsSharedGroupMenu\(\);/);
    assert.match(rules, /syncsSharedMenuMembership/);
  });
});
