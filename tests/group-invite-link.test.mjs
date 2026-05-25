import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('group invite link helpers', () => {
  it('keeps invite-link parsing and persistence centralized for auth and settings flows', () => {
    const helper = readText('src/lib/menu/group-invite-link.ts');
    const settingsScript = readText('src/scripts/settings-app.ts');
    const authGateScript = readText('src/scripts/auth-gate.ts');

    assert.match(helper, /export const groupInviteQueryParam = 'groupInvite'/);
    assert.match(helper, /export const groupInviteStorageKey = 'menu-diario-group-invite'/);
    assert.match(helper, /export function readGroupInviteCode/);
    assert.match(helper, /export function buildGroupInviteUrl/);
    assert.match(settingsScript, /groupInviteStorageKey/);
    assert.match(settingsScript, /buildGroupInviteUrl/);
    assert.match(settingsScript, /joinLinkAction/);
    assert.match(authGateScript, /groupInviteStorageKey/);
    assert.match(authGateScript, /labels\.settingsPath/);
  });
});
