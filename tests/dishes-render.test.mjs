import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompactDishRow, renderDishEditorBody } from '../src/lib/dishes/render.mjs';

const labels = {
  markFavorite: 'Mark favorite',
  unmarkFavorite: 'Unmark favorite',
  favoriteBadge: 'Favorite',
  notFavoriteBadge: 'Not favorite',
  editCompact: 'Edit',
  editDishAria: 'Edit {dish}',
  addName: 'Dish name',
  removeTag: 'Remove tag',
  noQuickTags: 'No quick tags',
  quickTagsLabel: 'Quick tags',
  quickTagsList: ['healthy', 'cheap'],
  tagLabels: { healthy: 'Healthy', cheap: 'Cheap' },
  globalReadOnlyModal: 'Read only global dish',
  editableHint: 'Advanced changes are saved in this dialog.',
  notEditable: 'Not editable',
  statusSection: 'Status',
  favoriteField: 'Favorite',
  blockedField: 'Blocked',
  archivedField: 'Archived',
  activeState: 'No',
  archivedState: 'Yes',
  statistics: 'Statistics',
  timesUsed: 'Times used',
  lastUsed: 'Last eaten',
  createdAt: 'Created',
  neverUsed: 'Not eaten yet',
  noCreatedAt: 'No saved date',
  origin: 'Origin',
  originGlobal: 'Shared catalogue',
  originGroup: 'Group-owned dish',
  originUser: 'Personal dish',
  source: 'Created from',
  sourceLabels: {
    admin: 'Administration',
    group: 'Group',
    legacy: 'Legacy',
    'duplicated-global': 'Duplicated from shared catalogue',
    manual: 'Manual entry',
    menu: 'Saved from a menu',
  },
};

describe('dishes render helpers', () => {
  it('keeps the compact row focused on quick actions only', () => {
    const html = renderCompactDishRow(
      { id: 'dish-1', name: 'Lentejas', favorite: true, editable: true, isGlobal: false, scope: 'group' },
      labels
    );

    assert.match(html, /Lentejas/);
    assert.match(html, /data-toggle-favorite/);
    assert.match(html, /data-edit-dish/);
    assert.doesNotMatch(html, /Times used/);
    assert.doesNotMatch(html, /Last eaten/);
    assert.doesNotMatch(html, /Created/);
    assert.doesNotMatch(html, /Quick tags/);
  });

  it('keeps advanced editing and statistics inside the dialog body', () => {
    const html = renderDishEditorBody(
      {
        id: 'dish-1',
        name: 'Lentejas',
        favorite: true,
        blocked: false,
        editable: true,
        isGlobal: false,
        scope: 'group',
        source: 'manual',
        timesUsed: 4,
        quickTags: ['healthy'],
        createdAt: new Date('2026-01-05'),
        lastUsedAt: new Date('2026-05-01'),
      },
      labels,
      (value) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(value)
    );

    assert.match(html, /Times used/);
    assert.match(html, /Last eaten/);
    assert.match(html, /Created/);
    assert.match(html, /Quick tags/);
    assert.match(html, /Healthy/);
    assert.match(html, /Origin/);
    assert.match(html, /Created from/);
  });
});
