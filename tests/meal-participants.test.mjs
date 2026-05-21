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
  it('keeps the participant helper, styles and documentation available', () => {
    const helper = readText('src/lib/menu/participants.ts');
    const styles = readText('src/styles/modals.css');
    const docs = readText('docs/data-model.md');

    assert.match(helper, /export function getMenuParticipants/);
    assert.match(helper, /export function normalizeParticipantIds/);
    assert.match(helper, /export function formatParticipantSummary/);
    assert.match(styles, /\.meal-participants/);
    assert.match(styles, /\.meal-participants-summary/);
    assert.match(docs, /participantIds/);
  });

  it('stores participants as an optional MealEntry field and normalizes legacy meals as everyone', () => {
    const types = readText('src/lib/menu/types.ts');
    const normalizers = readText('src/lib/menu/normalizers.ts');

    assert.match(types, /participantIds\?: string\[\]/);
    assert.match(normalizers, /participantIds:/);
    assert.match(normalizers, /Array\.isArray\(raw\.participantIds\)/);
  });

  it('renders accessible mobile-friendly participant controls in the day editor', () => {
    const modal = readText('src/components/DayEditModal.astro');
    const controller = readText('src/lib/menu/day-edit-modal.ts');
    const editor = readText('src/lib/menu/day-editor.ts');
    const styles = readText('src/styles/modals.css');

    assert.match(modal, /data-participants-section/);
    assert.match(modal, /data-participants-list/);
    assert.match(controller, /getParticipants/);
    assert.match(controller, /participantIds/);
    assert.match(editor, /renderParticipantControls/);
    assert.match(editor, /type="checkbox"/);
    assert.match(editor, /\.meal-participant-option/);
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
