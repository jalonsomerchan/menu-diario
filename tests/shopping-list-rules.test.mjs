import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('shopping list Firestore rules', () => {
  it('allows scoped list reads while keeping writes restricted', () => {
    const rules = readText('firestore.rules');
    const shoppingRules = rules.match(/match \/shoppingLists\/\{listId\} \{([\s\S]*?)\n    \}/)?.[1] ?? '';

    assert.match(shoppingRules, /allow get, list: if canAccessShoppingList\(resource\.data\)/);
    assert.match(shoppingRules, /allow create: if signedIn\(\)/);
    assert.match(shoppingRules, /request\.resource\.data\.ownerId == request\.auth\.uid/);
    assert.match(shoppingRules, /isShoppingListScope\(request\.resource\.data\)/);
    assert.match(shoppingRules, /allow update: if canAccessShoppingList\(resource\.data\)/);
    assert.match(shoppingRules, /request\.resource\.data\.groupId == resource\.data\.groupId/);
    assert.match(shoppingRules, /allow delete: if canAccessShoppingList\(resource\.data\)/);
  });
});
