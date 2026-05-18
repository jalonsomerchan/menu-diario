import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('day edit modal unsaved changes protection', () => {
  it('confirms before closing dirty day edits from cancel actions and Escape', () => {
    const source = readText('src/lib/menu/day-edit-modal.ts');

    assert.match(source, /let allowNextClose = false/);
    assert.match(source, /const discardChangesMessage = options\.labels\.discardChangesConfirm \?\? options\.labels\.savePending/);
    assert.match(source, /function hasUnsavedChanges\(\)/);
    assert.match(source, /readDayDraft\(card, options\.getEnabledMeals\(\), draftDay(?:, getParticipants\(\))?\)/);
    assert.match(source, /serializeDay\(currentDraft\) !== options\.getSavedDayState\(activeDayKey\)/);
    assert.match(source, /function requestCloseWithConfirmation\(\)/);
    assert.match(source, /window\.confirm\(discardChangesMessage\)/);
    assert.match(source, /requestCloseWithConfirmation\(\);\n\s+return;\n\s+}\n\n\s+const clearAction/);
    assert.match(source, /modal\.addEventListener\('cancel'/);
    assert.match(source, /event\.preventDefault\(\)/);
    assert.match(source, /allowNextClose = true;\n\s+modal\.close\(\)/);
  });
});
