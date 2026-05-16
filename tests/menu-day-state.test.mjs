import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getAddedDishNames, isSameDayMenu, serializeDay } from '../src/lib/menu/day-state.ts';

describe('menu day state helpers', () => {
  it('treats equivalent normalized days as the same state', () => {
    assert.equal(
      isSameDayMenu(
        {
          notes: '',
          meals: {
            lunch: { items: ['Lentejas'] },
          },
        },
        {
          notes: '',
          meals: {
            breakfast: { items: [] },
            lunch: { items: ['Lentejas'] },
            dinner: { items: [] },
          },
          skipped: false,
        }
      ),
      true
    );
  });

  it('serializes day state consistently for repeated comparisons', () => {
    const state = serializeDay({
      skipped: true,
      reason: 'away',
      skipNote: 'Viaje',
    });

    assert.equal(
      state,
      serializeDay({
        skipped: true,
        reason: 'away',
        skipNote: 'Viaje',
      })
    );
  });

  it('returns only the newly added dish names when a day changes', () => {
    assert.deepEqual(
      getAddedDishNames(
        {
          meals: {
            lunch: { items: ['Pasta', 'Ensalada'] },
            dinner: { items: ['Sopa'] },
          },
        },
        {
          meals: {
            lunch: { items: ['Pasta', 'Curry'] },
            dinner: { items: ['Sopa', 'Yogur'] },
          },
        }
      ),
      ['Curry', 'Yogur']
    );
  });
});
