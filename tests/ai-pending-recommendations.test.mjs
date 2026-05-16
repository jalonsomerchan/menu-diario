import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assignPendingMealRecommendations,
  buildPendingMealPrompt,
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

  it('assigns recommendations only to pending slots and visible catalog dishes from a mixed catalog', () => {
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
          id: 'dish-0',
          name: 'Crema de calabaza',
          normalizedName: 'crema de calabaza',
          scope: 'global',
          source: 'admin',
          createdBy: 'admin-1',
          isGlobal: true,
          editable: false,
          favorite: true,
          timesUsed: 5,
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
            dishes: ['Crema de calabaza', 'Plato inventado', 'Lentejas', 'Lentejas'],
            reason: 'Mezcla una opción general conocida con un plato propio frecuente.',
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
        dishes: [
          {
            id: 'dish-0',
            name: 'Crema de calabaza',
            scope: 'global',
            isGlobal: true,
          },
          {
            id: 'dish-1',
            name: 'Lentejas',
            scope: 'group',
            isGlobal: false,
          },
        ],
        reason: 'Mezcla una opción general conocida con un plato propio frecuente.',
      },
    ]);
  });

  it('keeps blocked and archived dishes out of the prompt catalog', () => {
    const prompt = buildPendingMealPrompt({
      locale: 'es-ES',
      pendingMeals: [{ dayKey: '2026-05-17', meal: 'lunch' }],
      mealLabels: {
        breakfast: 'Desayuno',
        lunch: 'Comida',
        dinner: 'Cena',
      },
      dishes: [
        {
          id: 'dish-1',
          name: 'General visible',
          normalizedName: 'general visible',
          scope: 'global',
          source: 'admin',
          createdBy: 'admin-1',
          isGlobal: true,
          editable: false,
          favorite: true,
          timesUsed: 4,
        },
        {
          id: 'dish-2',
          name: 'Bloqueado',
          normalizedName: 'bloqueado',
          scope: 'group',
          source: 'group',
          createdBy: 'user-1',
          isGlobal: false,
          editable: true,
          blocked: true,
          timesUsed: 2,
        },
        {
          id: 'dish-3',
          name: 'Archivado',
          normalizedName: 'archivado',
          scope: 'user',
          source: 'legacy',
          createdBy: 'user-1',
          isGlobal: false,
          editable: true,
          archived: true,
          timesUsed: 1,
        },
      ],
    });

    assert.match(prompt, /General visible \| scope:global \| favorite \| timesUsed:4/);
    assert.match(prompt, /Every suggested dish must match a catalog item exactly/);
    assert.match(prompt, /healthy, balanced, varied, not too difficult to prepare/);
    assert.match(prompt, /Return up to 5 dishes per slot/);
    assert.doesNotMatch(prompt, /Bloqueado/);
    assert.doesNotMatch(prompt, /Archivado/);
  });
});
