import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('meal participants wiring', () => {
  it('keeps the participant helper, styles and documentation available', () => {
    assert.equal(existsSync(join(root, 'src/lib/menu/participants.ts')), true);
    assert.equal(existsSync(join(root, 'src/styles/meal-participants.css')), true);
    assert.equal(existsSync(join(root, 'docs/meal-participants.md')), true);

    const helper = readText('src/lib/menu/participants.ts');
    const docs = readText('docs/meal-participants.md');

    assert.match(helper, /getStoredParticipantIds/);
    assert.match(helper, /formatParticipantSummary/);
    assert.match(helper, /getMenuParticipants/);
    assert.match(docs, /participantIds/);
    assert.match(docs, /opcional/);
    assert.match(docs, /todos los miembros activos/);
    assert.match(docs, /No hace falta migración obligatoria/);
  });

  it('stores participants as an optional MealEntry field and normalizes legacy meals as everyone', () => {
    const types = readText('src/lib/menu/types.ts');
    const normalizers = readText('src/lib/menu/normalizers.ts');
    const dayState = readText('src/lib/menu/day-state.ts');

    assert.match(types, /participantIds\?: string\[\]/);
    assert.match(types, /type MenuParticipant/);
    assert.match(normalizers, /normalizeParticipantIds/);
    assert.match(normalizers, /delete meal\.participantIds/);
    assert.match(dayState, /participantIds/);
  });

  it('renders accessible mobile-friendly participant controls in the day editor', () => {
    const editor = readText('src/lib/menu/day-editor.ts');
    const form = readText('src/lib/menu/day-form.ts');
    const modal = readText('src/lib/menu/day-edit-modal.ts');
    const styles = readText('src/styles/meal-participants.css');

    assert.match(editor, /fieldset class="meal-participants"/);
    assert.match(editor, /legend/);
    assert.match(editor, /data-participant-input/);
    assert.match(editor, /getParticipantInitials/);
    assert.match(form, /getStoredParticipantIds/);
    assert.match(modal, /getParticipants/);
    assert.match(styles, /:focus-within/);
    assert.match(styles, /@media \(max-width: 520px\)/);
  });

  it('wires participant summaries and group membership in dashboard and configurator', () => {
    const dashboard = readText('src/scripts/dashboard-app.ts');
    const configurator = readText('src/scripts/configurator-app.ts');
    const dashboardComponent = readText('src/components/DashboardApp.astro');
    const configuratorComponent = readText('src/components/ConfiguratorApp.astro');

    [dashboard, configurator].forEach((source) => {
      assert.match(source, /watchGroup/);
      assert.match(source, /getMenuParticipants/);
      assert.match(source, /formatParticipantSummary/);
      assert.match(source, /meal-participants-summary/);
      assert.match(source, /getParticipants/);
    });

    [dashboardComponent, configuratorComponent].forEach((source) => {
      assert.match(source, /participants: t\('group\.members'\)/);
      assert.match(source, /participantsAll: t\('history\.statusAll'\)/);
    });
  });
});
