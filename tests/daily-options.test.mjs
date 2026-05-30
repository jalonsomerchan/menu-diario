import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  getActiveDailyOptions,
  getDailyOptionPromptHints,
  getSelectedDailyOptions,
  normalizeDailyOptionColor,
  normalizeDailyOptionIcon,
  normalizeDailyOptionName,
} from '../src/lib/menu/daily-options.ts';
import { normalizeDay } from '../src/lib/menu/normalizers.ts';
import { serializeDay } from '../src/lib/menu/day-state.ts';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

const options = [
  { id: 'late', name: 'Llego tarde', description: 'Priorizar rápido', active: true, color: 'orange', icon: 'clock', order: 2 },
  { id: 'kids', name: 'Día de niños', description: '', active: true, color: 'green', icon: 'kids', order: 1 },
  { id: 'old', name: 'Antigua', description: '', active: false, color: 'blue', icon: 'note', order: 0 },
].map((option) => ({
  ...option,
  scope: 'group',
  ownerId: 'group-1',
  groupId: 'group-1',
  createdBy: 'user-1',
  members: ['user-1'],
}));

describe('daily planning options', () => {
  it('normalizes option fields and selected day ids', () => {
    assert.equal(normalizeDailyOptionName('  Llego   tarde  '), 'Llego tarde');
    assert.equal(normalizeDailyOptionColor('bad'), 'blue');
    assert.equal(normalizeDailyOptionIcon('bad'), 'note');

    const day = normalizeDay({ optionIds: ['late', 'late', '', 'kids'] });
    assert.deepEqual(day.optionIds, ['late', 'kids']);
    assert.match(serializeDay(day), /"optionIds":\["kids","late"\]/);
  });

  it('returns active selected options in configured order for badges and AI hints', () => {
    const day = normalizeDay({ optionIds: ['late', 'old', 'kids'] });

    assert.deepEqual(getActiveDailyOptions(options).map((option) => option.id), ['kids', 'late']);
    assert.deepEqual(getSelectedDailyOptions(day, options).map((option) => option.id), ['old', 'kids', 'late']);
    assert.deepEqual(getDailyOptionPromptHints(day, options), ['Antigua', 'Día de niños', 'Llego tarde: Priorizar rápido']);
  });

  it('keeps UI, repository, rules and translations wired', () => {
    const dayEditor = readText('src/lib/menu/day-editor.ts');
    const settings = readText('src/components/SettingsApp.astro');
    const settingsScript = readText('src/scripts/settings-app.ts');
    const repository = readText('src/lib/menu/daily-options-repository.ts');
    const rules = readText('firestore.rules');
    const es = readText('src/i18n/translations/es.json');
    const en = readText('src/i18n/translations/en.json');

    assert.match(dayEditor, /data-day-option-input/);
    assert.match(settings, /data-daily-option-form/);
    assert.match(settingsScript, /watchDailyOptions/);
    assert.match(repository, /dailyOptions/);
    assert.match(rules, /match \/dailyOptions\/\{optionId\}/);
    assert.match(es, /dailyOptions\.dayTitle/);
    assert.match(en, /dailyOptions\.dayTitle/);
  });
});
