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

  it('keeps the mobile modal body scrollable and footer actions readable in one row', () => {
    const styles = readText('src/styles/modals.css');

    assert.match(styles, /\.day-edit-modal__box \{\n\s+height: min\(calc\(100dvh - 0\.75rem\), 46rem\) !important;/);
    assert.match(styles, /\.day-edit-modal__body \{\n\s+flex: 1 1 auto !important;\n\s+min-height: 0 !important;/);
    assert.match(styles, /overflow-y: auto !important;/);
    assert.match(styles, /\.day-edit-modal__actions \{\n\s+display: grid !important;\n\s+grid-template-columns: repeat\(3, minmax\(0, 1fr\)\) !important;/);
    assert.match(styles, /\.day-edit-modal__action-label \{\n\s+display: inline !important;\n\s+min-width: 0 !important;\n\s+overflow: hidden !important;\n\s+text-overflow: ellipsis !important;\n\s+white-space: nowrap !important;/);
  });
});
