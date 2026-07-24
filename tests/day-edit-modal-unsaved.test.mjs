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
    const component = readText('src/components/DayEditModal.astro');

    assert.match(source, /let allowNextClose = false/);
    assert.match(source, /import \{ createConfirmDialog \} from '\.\.\/ui\/confirm-dialog'/);
    assert.match(source, /const discardConfirmation = confirmDialog \? createConfirmDialog\(confirmDialog\) : null/);
    assert.match(source, /function hasUnsavedChanges\(\)/);
    assert.match(source, /readDayDraft\(card, options\.getEnabledMeals\(\), draftDay(?:, getParticipants\(\))?\)/);
    assert.match(source, /serializeDay\(currentDraft\) !== options\.getSavedDayState\(activeDayKey\)/);
    assert.match(source, /async function requestCloseWithConfirmation\(returnFocusTo\?: HTMLElement \| null\)/);
    assert.match(source, /await discardConfirmation\?\.open\(\{/);
    assert.match(source, /title: options\.labels\.discardChangesTitle/);
    assert.match(source, /confirmVariant: 'danger'/);
    assert.match(source, /await requestCloseWithConfirmation\(cancelButton\)/);
    assert.match(source, /modal\.addEventListener\('cancel'/);
    assert.match(source, /event\.preventDefault\(\)/);
    assert.match(source, /void requestCloseWithConfirmation\(\s*document\.activeElement instanceof HTMLElement/);
    assert.doesNotMatch(source, /window\.confirm/);
    assert.match(component, /<ConfirmDialog/);
    assert.match(component, /dialogId="day-edit-discard-confirm"/);
  });

  it('resets a previous confirmation before reopening so Escape remains a cancellation', () => {
    const source = readText('src/lib/ui/confirm-dialog.ts');

    assert.match(source, /const handleCancel = \(\) => \{\n\s+dialog\.returnValue = 'cancel';\n\s+};/);
    assert.match(source, /dialog\.addEventListener\('cancel', handleCancel\)/);
    assert.match(source, /dialog\.returnValue = 'cancel';\n\s+dialog\.showModal\(\)/);
    assert.match(source, /dialog\.removeEventListener\('cancel', handleCancel\)/);
  });

  it('locks body scrolling while the day edit modal is open and releases it on close', () => {
    const source = readText('src/lib/menu/day-edit-modal.ts');

    assert.match(source, /import \{ lockBodyScroll \} from '\.\.\/ui\/body-scroll-lock'/);
    assert.match(source, /let releaseBodyScroll: \(\(\) => void\) \| null = null/);
    assert.match(source, /modal\.showModal\(\);\n\s+releaseBodyScroll = lockBodyScroll\(\)/);
    assert.match(source, /modal\.addEventListener\('close', \(\) => \{\n\s+allowNextClose = false;\n\s+releaseBodyScroll\?\.\(\);\n\s+releaseBodyScroll = null;/);
  });

  it('keeps the mobile modal body scrollable and footer actions readable in one row', () => {
    const styles = readText('src/styles/modals.css');

    assert.match(styles, /\.day-edit-modal \{\n\s+height: calc\(100vh - 0\.75rem\) !important;\n\s+max-height: calc\(100vh - 0\.75rem\) !important;\n\s+height: calc\(100svh - 0\.75rem\) !important;\n\s+max-height: calc\(100svh - 0\.75rem\) !important;\n\s+height: calc\(100dvh - 0\.75rem\) !important;/);
    assert.match(styles, /\.day-edit-modal__box \{\n\s+height: min\(calc\(100vh - 0\.75rem\), 46rem\) !important;\n\s+max-height: min\(calc\(100vh - 0\.75rem\), 46rem\) !important;\n\s+height: min\(calc\(100svh - 0\.75rem\), 46rem\) !important;/);
    assert.match(styles, /\.day-edit-modal__body \{\n\s+flex: 1 1 0 !important;\n\s+height: 0 !important;\n\s+min-height: 0 !important;/);
    assert.match(styles, /overflow-y: scroll !important;/);
    assert.match(styles, /touch-action: pan-y !important;/);
    assert.match(styles, /@supports \(-webkit-touch-callout: none\)/);
    assert.match(styles, /\.day-edit-modal__box \{\n\s+height: 100% !important;\n\s+max-height: 100% !important;\n\s+overflow-x: hidden !important;\n\s+overflow-y: auto !important;/);
    assert.match(styles, /\.day-edit-modal__body \{\n\s+flex: 0 0 auto !important;\n\s+height: auto !important;\n\s+min-height: auto !important;\n\s+overflow: visible !important;/);
    assert.match(styles, /\.day-edit-modal__actions \{\n\s+display: grid !important;\n\s+grid-template-columns: repeat\(3, minmax\(0, 1fr\)\) !important;/);
    assert.match(styles, /\.day-edit-modal__action-label \{\n\s+display: inline !important;\n\s+min-width: 0 !important;\n\s+overflow: hidden !important;\n\s+text-overflow: ellipsis !important;\n\s+white-space: nowrap !important;/);
  });
});
