import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assignPendingMealRecommendations,
  getPendingMealSlots,
  isPendingMealRecommendationResponse,
} from '../src/lib/ai/pending-meal-recommendations.ts';

describe('pending meal AI recommendations', () => {
  it('detects only pending non-skipped meals in enabled slots', () => {
    const slots = getPendingMealSlots(
      {
        '2026-05-17': {
          meals: {
            breakfast: { items: ['Cafe'], skipped: false, reason: '', note: '' },
            lunch: { items: [], skipped: false, reason: '', note: '' },
            dinner: { items: [], skipped: true, reason: '', note: '' },
          },
        },
        '2026-05-18': {
          skipped: true,
          meals: {
            breakfast: { items: [], skipped: false, reason: '', note: '' },
            lunch: { items: [], skipped: false, reason: '', note: '' },
            dinner: { items: [], skipped: false, reason: '', note: '' },
          },
        },
      },
      ['2026-05-17', '2026-05-18'],
      ['breakfast', 'lunch', 'dinner']
    );

    assert.deepEqual(slots, [{ dayKey: '2026-05-17', meal: 'lunch' }]);
  });

  it('validates the expected AI response shape', () => {
    assert.equal(
      isPendingMealRecommendationResponse({
        recommendations: [
          {
            dayKey: '2026-05-17',
            meal: 'lunch',
            dishes: ['Lentejas'],
            reason: 'Ya está en el catálogo y encaja con una comida sencilla.',
          },
        ],
      }),
      true
    );

    assert.equal(
      isPendingMealRecommendationResponse({
        recommendations: [{ dayKey: '2026-05-17', meal: 'snack', dishes: ['Lentejas'], reason: 'Nope' }],
      }),
      false
    );
  });

  it('assigns recommendations only to pending slots and visible catalog dishes', () => {
    const assigned = assignPendingMealRecommendations({
      pendingMeals: [
        { dayKey: '2026-05-17', meal: 'lunch' },
        { dayKey: '2026-05-18', meal: 'dinner' },
      ],
      dishes: [
        {
          id: 'dish-1',
          name: 'Lentejas',
          normalizedName: 'lentejas',
          scope: 'group',
          source: 'manual',
          createdBy: 'user-1',
          isGlobal: false,
          editable: true,
          timesUsed: 3,
        },
        {
          id: 'dish-2',
          name: 'Pasta al horno',
          normalizedName: 'pasta al horno',
          scope: 'group',
          source: 'manual',
          createdBy: 'user-1',
          isGlobal: false,
          editable: true,
          timesUsed: 2,
          blocked: true,
        },
      ],
      response: {
        recommendations: [
          {
            dayKey: '2026-05-17',
            meal: 'lunch',
            dishes: ['Lentejas', 'Plato inventado', 'lentejas'],
            reason: 'Favorito y fácil de repetir.',
          },
          {
            dayKey: '2026-05-18',
            meal: 'dinner',
            dishes: ['Pasta al horno'],
            reason: 'Bloqueado, no debería pasar.',
          },
          {
            dayKey: '2026-05-19',
            meal: 'lunch',
            dishes: ['Lentejas'],
            reason: 'No es un hueco pendiente.',
          },
        ],
      },
    });

    assert.deepEqual(assigned, [
      {
        dayKey: '2026-05-17',
        meal: 'lunch',
        dishes: ['Lentejas'],
        reason: 'Favorito y fácil de repetir.',
      },
    ]);
  });
});
