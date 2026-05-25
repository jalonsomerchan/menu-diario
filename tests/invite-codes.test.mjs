import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('invite code helpers', () => {
  it('centralizes invite code generation and only checks Firestore collisions where rules allow it', () => {
    const helper = readText('src/lib/menu/invite-codes.ts');
    const repository = readText('src/lib/menu/repository.ts');

    assert.match(helper, /export function createInviteCode/);
    assert.match(helper, /export async function createUniqueInviteCode/);
    assert.match(helper, /crypto\.getRandomValues/);
    assert.match(helper, /where\('inviteCode', '==', inviteCode\)/);
    assert.match(helper, /throw new Error\('invite-code-collision'\)/);

    assert.match(repository, /import \{ createInviteCode, createUniqueInviteCode \} from '\.\/invite-codes'/);
    assert.match(repository, /createUniqueInviteCode\(services, groupsCollection\)/);
    assert.match(repository, /const inviteCode = createInviteCode\(\);/);
    assert.doesNotMatch(repository, /Math\.random/);
  });
});
