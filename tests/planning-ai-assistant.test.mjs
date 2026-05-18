import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assignPlanningRecommendations,
  buildPlanningAssistantPrompt,
  getPlanningCatalogDishes,
} from '../src/lib/ai/planning-assistant.ts';

const catalog = [
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
];

describe('planning AI assistant', () => {
  it('does not expose reusable catalog dishes in new-dishes mode', () => {
    const prompt = buildPlanningAssistantPrompt({
      locale: 'es-ES',
      mode: 'new',
      recommendationCount: 3,
      pendingMeals: [{ dayKey: '2026-05-20', meal: 'lunch' }],
      days: {},
      dishes: catalog,
      mealLabels: {
        breakfast: 'Desayuno',
        lunch: 'Comida',
        dinner: 'Cena',
      },
    });

    assert.deepEqual(getPlanningCatalogDishes(catalog, 'new'), []);
    assert.match(prompt, /Saved dishes available to reuse when allowed:\n\n- none/);
    assert.match(prompt, /you must not reuse or rename any saved dish/i);
    assert.match(prompt, /Known dish names already in the catalog/);
    assert.match(prompt, /Lentejas/);
    assert.match(prompt, /Crema de calabaza/);
  });

  it('keeps only genuinely new dishes in new-dishes mode assignments', () => {
    const assigned = assignPlanningRecommendations({
      mode: 'new',
      pendingMeals: [{ dayKey: '2026-05-20', meal: 'lunch' }],
      dishes: catalog,
      recommendationCount: 3,
      response: {
        recommendations: [
          {
            dayKey: '2026-05-20',
            meal: 'lunch',
            dishes: [
              { name: 'Lentejas', isNew: true },
              { name: 'Bowl templado de garbanzos con tahini', isNew: true },
              { name: 'Crema de calabaza', isNew: false },
            ],
            reason: 'Alternativa variada para diario.',
          },
        ],
      },
    });

    assert.deepEqual(assigned, [
      {
        dayKey: '2026-05-20',
        meal: 'lunch',
        dishes: [
          {
            name: 'Bowl templado de garbanzos con tahini',
            isNew: true,
            scope: 'new',
            isGlobal: false,
          },
        ],
        reason: 'Alternativa variada para diario.',
      },
    ]);
  });

  it('requires a genuinely new dish in mixed-mode assignments', () => {
    const assigned = assignPlanningRecommendations({
      mode: 'mix',
      pendingMeals: [{ dayKey: '2026-05-20', meal: 'lunch' }],
      dishes: catalog,
      recommendationCount: 3,
      response: {
        recommendations: [
          {
            dayKey: '2026-05-20',
            meal: 'lunch',
            dishes: [
              { name: 'Lentejas', isNew: false },
              { name: 'Crema de calabaza', isNew: false },
              { name: 'Lentejas', isNew: true },
            ],
            reason: 'Mezcla de ideas.',
          },
        ],
      },
    });

    assert.deepEqual(assigned, []);
  });

  it('keeps a balanced mixed-mode assignment when it includes a real new dish', () => {
    const assigned = assignPlanningRecommendations({
      mode: 'mix',
      pendingMeals: [{ dayKey: '2026-05-20', meal: 'lunch' }],
      dishes: catalog,
      recommendationCount: 3,
      response: {
        recommendations: [
          {
            dayKey: '2026-05-20',
            meal: 'lunch',
            dishes: [
              { name: 'Lentejas', isNew: false },
              { name: 'Crema de calabaza', isNew: false },
              { name: 'Salteado de quinoa con verduras y yogur', isNew: true },
            ],
            reason: 'Mezcla de ideas.',
          },
        ],
      },
    });

    assert.deepEqual(assigned, [
      {
        dayKey: '2026-05-20',
        meal: 'lunch',
        dishes: [
          {
            name: 'Salteado de quinoa con verduras y yogur',
            isNew: true,
            scope: 'new',
            isGlobal: false,
          },
          {
            name: 'Lentejas',
            isNew: false,
            scope: 'group',
            isGlobal: false,
          },
          {
            name: 'Crema de calabaza',
            isNew: false,
            scope: 'global',
            isGlobal: true,
          },
        ],
        reason: 'Mezcla de ideas.',
      },
    ]);
  });
});
