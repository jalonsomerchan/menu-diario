import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildHistoryRows,
  countActiveHistoryFilters,
  filterAndSortHistoryRows,
  getHistoryDayStatus,
  getHistoryWeekdayValue,
  matchesHistoryFilters,
  normalizeHistoryText,
  sortHistoryRows,
} from '../src/lib/menu/history.ts';

describe('menu history helpers', () => {
  const enabledMeals = ['breakfast', 'lunch', 'dinner'];
  const menus = [
    {
      id: 'week-1',
      weekStart: '2026-05-04',
      days: {
        '2026-05-04': {
          skipped: false,
          reason: '',
          notes: '',
          meals: {
            breakfast: { items: ['Café'], skipped: false, reason: '', note: '' },
            lunch: { items: ['Lentejas'], skipped: false, reason: '', note: '' },
            dinner: { items: ['Pasta'], skipped: false, reason: '', note: 'sobras para mañana' },
          },
        },
        '2026-05-05': {
          skipped: false,
          reason: '',
          notes: 'opción rápida',
          meals: {
            lunch: { items: ['Pasta'], skipped: false, reason: '', note: '' },
            dinner: { items: [], skipped: true, reason: 'eating-out', note: 'Restaurante' },
          },
        },
      },
    },
  ];
  const dishes = [
    { name: 'Lentejas', normalizedName: 'lentejas', favorite: true, tags: ['legumbre'], quickTags: ['healthy'] },
    { name: 'Pasta', normalizedName: 'pasta', favorite: false, tags: ['tupper'], quickTags: [] },
    { name: 'Café', normalizedName: 'cafe', favorite: false, tags: ['desayuno'], quickTags: [] },
  ];

  it('classifies empty, planned and skipped days correctly', () => {
    assert.equal(getHistoryDayStatus(undefined, enabledMeals), 'empty');
    assert.equal(
      getHistoryDayStatus(
        {
          meals: {
            breakfast: { items: [], skipped: false, reason: '', note: '' },
            lunch: { items: ['Paella'], skipped: false, reason: '', note: '' },
            dinner: { items: [], skipped: false, reason: '', note: '' },
          },
        },
        enabledMeals
      ),
      'planned'
    );
    assert.equal(
      getHistoryDayStatus(
        {
          skipped: true,
          meals: {
            breakfast: { items: [], skipped: false, reason: '', note: '' },
            lunch: { items: [], skipped: false, reason: '', note: '' },
            dinner: { items: [], skipped: false, reason: '', note: '' },
          },
        },
        enabledMeals
      ),
      'skipped'
    );
  });

  it('filters by weekday, status and query without hiding missing days', () => {
    assert.equal(getHistoryWeekdayValue('2026-05-18'), '1');
    assert.equal(
      matchesHistoryFilters('2026-05-18', undefined, enabledMeals, {
        query: '',
        status: 'empty',
        weekday: '1',
      }),
      true
    );
    assert.equal(
      matchesHistoryFilters(
        '2026-05-18',
        {
          notes: 'Cena especial',
          meals: {
            breakfast: { items: [], skipped: false, reason: '', note: '' },
            lunch: { items: ['Paella'], skipped: false, reason: '', note: '' },
            dinner: { items: [], skipped: false, reason: '', note: '' },
          },
        },
        enabledMeals,
        {
          query: 'paella',
          status: 'planned',
          weekday: 'all',
        }
      ),
      true
    );
    assert.equal(
      matchesHistoryFilters('2026-05-18', undefined, enabledMeals, {
        query: 'paella',
        status: 'all',
        weekday: 'all',
      }),
      false
    );
  });

  it('normalizes text and filters rows by meal, dish and tag metadata', () => {
    assert.equal(normalizeHistoryText('  CAFÉ   con Leche  '), 'cafe con leche');
    const rows = buildHistoryRows(menus, dishes, enabledMeals, {
      query: '',
      status: 'all',
      weekday: 'all',
      meal: 'lunch',
      dish: 'lente',
      tag: 'legumbre',
      special: 'all',
      sort: 'date-desc',
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].meal, 'lunch');
    assert.equal(rows[0].isFavorite, true);
  });

  it('supports favorite, leftovers, meals out and unplanned filters', () => {
    assert.equal(filterAndSortHistoryRows(menus, dishes, enabledMeals, { query: '', status: 'all', weekday: 'all', special: 'favorite' }).length, 1);
    assert.equal(filterAndSortHistoryRows(menus, dishes, enabledMeals, { query: '', status: 'all', weekday: 'all', special: 'leftovers' }).length, 2);
    assert.equal(filterAndSortHistoryRows(menus, dishes, enabledMeals, { query: '', status: 'all', weekday: 'all', special: 'eating-out' }).length, 1);
    assert.equal(filterAndSortHistoryRows(menus, dishes, ['breakfast'], { query: '', status: 'all', weekday: 'all', special: 'unplanned' }).length, 1);
  });

  it('sorts by date, dish and repeated dish frequency', () => {
    const rows = buildHistoryRows(menus, dishes, enabledMeals, { query: '', status: 'all', weekday: 'all', special: 'all' });
    assert.equal(sortHistoryRows(rows, 'date-asc')[0].isoDate, '2026-05-04');
    assert.equal(sortHistoryRows(rows, 'dish')[0].items[0], 'Café');
    assert.equal(sortHistoryRows(rows, 'frequency')[0].items[0], 'Pasta');
  });

  it('counts active filters without counting default values', () => {
    assert.equal(countActiveHistoryFilters({ query: '', status: 'all', weekday: 'all', meal: 'all', special: 'all', sort: 'date-desc' }), 0);
    assert.equal(countActiveHistoryFilters({ query: 'pasta', status: 'planned', weekday: '2', meal: 'dinner', special: 'leftovers', sort: 'dish' }), 6);
  });
});
