import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildShoppingListContext, isShoppingListAiResponse } from '../src/lib/ai/shopping-list.ts';
import { buildShoppingListText } from '../src/lib/shopping/export.ts';
import { fromAiResponseItems, normalizeShoppingCategory } from '../src/lib/shopping/normalize.ts';

describe('AI shopping list helpers', () => {
  it('builds meal context from upcoming planned meals and keeps only safe notes', () => {
    const context = buildShoppingListContext({
      locale: 'es-ES',
      dayKeys: ['2026-05-18', '2026-05-19'],
      enabledMeals: ['lunch', 'dinner'],
      dishes: [
        {
          id: 'dish-1',
          name: 'Lentejas con verduras',
          normalizedName: 'lentejas con verduras',
          scope: 'global',
          source: 'admin',
          createdBy: 'admin',
          isGlobal: true,
          editable: false,
          timesUsed: 1,
          ingredients: [
            { name: 'Lentejas', quantity: '500 g', category: 'despensa' },
            { name: 'Zanahoria', quantity: '2', category: 'verdura' },
          ],
        },
      ],
      tuppers: [
        {
          id: 't1',
          name: 'Lentejas hechas',
          normalizedName: 'lentejas hechas',
          createdBy: 'u1',
          members: ['u1'],
          preparedAt: '2026-05-16',
          expiresAt: '2026-05-19',
          location: 'fridge',
          notes: '',
          status: 'active',
          portions: 2,
        },
      ],
      days: {
        '2026-05-18': {
          skipped: false,
          notes: 'usar lo que quede',
          meals: {
            breakfast: { items: [], skipped: false, reason: '', note: '' },
            lunch: { items: ['Lentejas con verduras'], skipped: false, reason: '', note: '' },
            dinner: { items: [], skipped: true, reason: 'away', note: '' },
          },
        },
        '2026-05-19': {
          skipped: true,
          notes: 'uid-123@example.com',
          meals: {
            breakfast: { items: [], skipped: false, reason: '', note: '' },
            lunch: { items: ['Pasta'], skipped: false, reason: '', note: '' },
            dinner: { items: ['Tortilla'], skipped: false, reason: '', note: '' },
          },
        },
      },
    });

    assert.equal(context.meals.length, 1);
    assert.equal(context.meals[0].dayKey, '2026-05-18');
    assert.equal(context.meals[0].note, 'usar lo que quede');
    assert.equal(context.meals[0].recipeIngredients.length, 2);
    assert.equal(context.inventoryHints.length, 1);
  });

  it('validates strict AI JSON and normalizes duplicate ingredients', () => {
    const response = {
      items: [
        { name: 'Tomate', category: 'verdura', quantity: '2', forMeals: ['2026-05-18 lunch'], confidence: 'medium' },
        { name: 'tomate', category: 'vegetables', quantity: '2', forMeals: ['2026-05-19 dinner'], confidence: 'high' },
      ],
    };

    assert.equal(isShoppingListAiResponse(response), true);

    const normalized = fromAiResponseItems(response.items);
    assert.equal(normalized.length, 1);
    assert.equal(normalized[0].category, 'vegetables');
    assert.equal(normalized[0].forMeals.length, 2);
    assert.equal(normalized[0].confidence, 'high');
    assert.equal(normalizeShoppingCategory('despensa'), 'pantry');
  });

  it('exports only items still marked to buy', () => {
    const text = buildShoppingListText(
      [
        {
          id: 'vegetables:tomate',
          name: 'Tomate',
          normalizedName: 'tomate',
          category: 'vegetables',
          quantity: '4',
          status: 'to-buy',
          forMeals: ['2026-05-18 lunch'],
          source: 'ai',
          confidence: 'medium',
        },
        {
          id: 'pantry:arroz',
          name: 'Arroz',
          normalizedName: 'arroz',
          category: 'pantry',
          quantity: '1 kg',
          status: 'owned',
          forMeals: ['2026-05-19 lunch'],
          source: 'manual',
          confidence: 'medium',
        },
      ],
      {
        title: 'Lista de la compra',
        emptyLabel: 'Vacía',
        categoryLabel: (category) => ({ vegetables: 'Verduras', pantry: 'Despensa' }[category] ?? category),
      }
    );

    assert.match(text, /Lista de la compra/);
    assert.match(text, /Tomate \(4\)/);
    assert.doesNotMatch(text, /Arroz/);
    assert.doesNotMatch(text, /Verduras/);
  });
});
