import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

function readJson(path) {
  return JSON.parse(readText(path));
}

describe('settings UI smoke checks', () => {
  it('keeps settings sections translated in every configured locale', () => {
    const es = readJson('src/i18n/translations/settings/es.json');
    const en = readJson('src/i18n/translations/settings/en.json');
    const expectedKeys = Object.keys(es).sort();

    assert.deepEqual(Object.keys(en).sort(), expectedKeys);
    [
      'personalTitle',
      'groupTitle',
      'groupOptionsTitle',
      'inviteTitle',
      'joinTitle',
      'membersTitle',
      'dangerTitle',
      'ownerOnly',
      'leaveConfirmTitle',
      'leaveConfirmConfirm',
    ].forEach((key) => {
      assert.ok(es[key], `Spanish settings translations should include ${key}`);
      assert.ok(en[key], `English settings translations should include ${key}`);
    });
  });

  it('separates personal and group settings with permission and confirmation hooks', () => {
    const component = readText('src/components/SettingsApp.astro');
    const script = readText('src/scripts/settings-app.ts');

    assert.match(component, /settings-personal-title/);
    assert.match(component, /settings-group-title/);
    assert.match(component, /data-group-admin-section/);
    assert.match(component, /data-group-admin-control/);
    assert.match(component, /data-group-permission-note/);
    assert.match(component, /<ConfirmDialog/);
    assert.match(component, /settings-leave-group-dialog/);
    assert.match(script, /createConfirmDialog/);
    assert.match(script, /currentGroup\.ownerId !== currentUser\.uid/);
    assert.match(script, /setGroupAdminState/);
    assert.match(script, /labels\.leaveConfirmTitle/);
    assert.match(script, /membersEmpty/);
    assert.match(script, /pendingEmpty/);
  });
});
