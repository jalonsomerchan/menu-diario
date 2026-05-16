import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getHistoryDayStatus,
  getHistoryWeekdayValue,
  matchesHistoryFilters,
} from '../src/lib/menu/history.ts';

describe('menu history helpers', () => {
  const enabledMeals = ['breakfast', 'lunch', 'dinner'];

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
});
