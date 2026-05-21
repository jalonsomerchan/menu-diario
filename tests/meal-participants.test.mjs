import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('meal participants wiring', () => {
  it('keeps the participant helper and styles available', () => {
    const helper = readText('src/lib/menu/participants.ts');
    const styles = readText('src/styles/meal-participants.css');
    const modal = readText('src/components/DayEditModal.astro');

    assert.match(helper, /export function getMenuParticipants/);
    assert.match(helper, /export function getSelectedParticipantIds/);
    assert.match(helper, /export function getStoredParticipantIds/);
    assert.match(helper, /export function formatParticipantSummary/);
    assert.match(styles, /\.meal-participants/);
    assert.match(styles, /\.meal-participants-summary/);
    assert.match(modal, /meal-participants\.css/);
  });

  it('stores participants as an optional MealEntry field and normalizes legacy meals as everyone', () => {
    const types = readText('src/lib/menu/types.ts');
    const normalizers = readText('src/lib/menu/normalizers.ts');

    assert.match(types, /participantIds\?: string\[\]/);
    assert.match(normalizers, /normalizeParticipantIds/);
    assert.match(normalizers, /Array\.isArray\(value\)/);
    assert.match(normalizers, /delete meal\.participantIds/);
    assert.match(normalizers, /return \{ \.\.\.meal, participantIds \}/);
  });

  it('renders accessible mobile-friendly participant controls in the day editor', () => {
    const controller = readText('src/lib/menu/day-edit-modal.ts');
    const editor = readText('src/lib/menu/day-editor.ts');
    const styles = readText('src/styles/meal-participants.css');

    assert.match(controller, /getParticipants/);
    assert.match(controller, /readDayDraft\(card, options\.getEnabledMeals\(\), draftDay, getParticipants\(\)\)/);
    assert.match(controller, /participants: getParticipants\(\)/);
    assert.match(editor, /renderParticipantSelector/);
    assert.match(editor, /data-participant-list/);
    assert.match(editor, /data-participant-input/);
    assert.match(editor, /type="checkbox"/);
    assert.match(editor, /\.meal-participant-chip/);
    assert.match(styles, /:focus-within/);
    assert.match(styles, /:has\(input:checked\)::after/);
    assert.match(styles, /@media \(max-width: 520px\)/);
  });

  it('wires participant summaries and group membership in dashboard and configurator', () => {
    const dashboard = readText('src/scripts/dashboard-app.ts');
    const configurator = readText('src/scripts/configurator-app.ts');
    const sharedCardData = readText('src/lib/menu/day-card-data.ts');
    const dashboardComponent = readText('src/components/DashboardApp.astro');
    const configuratorComponent = readText('src/components/ConfiguratorApp.astro');

    [dashboard, configurator].forEach((source) => {
      assert.match(source, /watchGroup/);
      assert.match(source, /getMenuParticipants/);
      assert.match(source, /prepareDayCardMeals/);
      assert.match(source, /meal-participants-summary/);
      assert.match(source, /getParticipants/);
    });

    assert.match(sharedCardData, /formatParticipantSummary/);
    assert.match(sharedCardData, /getDayCardParticipantSummary/);

    [dashboardComponent, configuratorComponent].forEach((source) => {
      assert.match(source, /participants: t\('group\.members'\)/);
      assert.match(source, /participantsAll: t\('history\.statusAll'\)/);
    });
  });
});
