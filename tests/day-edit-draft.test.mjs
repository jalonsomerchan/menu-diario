import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { appendRecommendedMealDraft, applyRecommendedMealDraft, setDaySkippedDraft } from '../src/lib/menu/day-edit-draft.mjs';

describe('day edit draft helpers', () => {
  it('preserves meals and notes when toggling full-day skipped on and off', () => {
    const baseDay = {
      skipped: false,
      reason: '',
      skipNote: '',
      notes: 'Comprar pan',
      meals: {
        breakfast: { items: [], skipped: false, reason: '', note: '' },
        lunch: { items: ['Lentejas'], skipped: false, reason: '', note: '' },
        dinner: { items: ['Tortilla'], skipped: false, reason: '', note: '' },
      },
    };

    const skippedDay = setDaySkippedDraft(baseDay, true);
    const restoredDay = setDaySkippedDraft(skippedDay, false);

    assert.equal(skippedDay.skipped, true);
    assert.deepEqual(skippedDay.meals.lunch.items, ['Lentejas']);
    assert.equal(skippedDay.notes, 'Comprar pan');
    assert.equal(restoredDay.skipped, false);
    assert.deepEqual(restoredDay.meals.dinner.items, ['Tortilla']);
    assert.equal(restoredDay.notes, 'Comprar pan');
  });

  it('forces the recommended meal flow back into editable meal mode', () => {
    const nextDay = applyRecommendedMealDraft(
      {
        skipped: true,
        reason: 'away',
        skipNote: 'Viaje',
        meals: {
          breakfast: { items: [], skipped: false, reason: '', note: '' },
          lunch: { items: [], skipped: false, reason: '', note: '' },
          dinner: { items: ['Sopa'], skipped: false, reason: '', note: '' },
        },
      },
      'lunch',
      ['Arroz al horno']
    );

    assert.equal(nextDay.skipped, false);
    assert.deepEqual(nextDay.meals.lunch.items, ['Arroz al horno']);
    assert.deepEqual(nextDay.meals.dinner.items, ['Sopa']);
  });

  it('appends one recommended dish without duplicating the same dish', () => {
    const nextDay = appendRecommendedMealDraft(
      {
        skipped: false,
        reason: '',
        skipNote: '',
        meals: {
          breakfast: { items: [], skipped: false, reason: '', note: '' },
          lunch: { items: ['Arroz al horno'], skipped: false, reason: '', note: '' },
          dinner: { items: ['Sopa'], skipped: false, reason: '', note: '' },
        },
      },
      'lunch',
      'Lentejas'
    );

    const dedupedDay = appendRecommendedMealDraft(nextDay, 'lunch', 'Lentejas');

    assert.deepEqual(nextDay.meals.lunch.items, ['Arroz al horno', 'Lentejas']);
    assert.deepEqual(dedupedDay.meals.lunch.items, ['Arroz al horno', 'Lentejas']);
    assert.deepEqual(dedupedDay.meals.dinner.items, ['Sopa']);
  });
});
