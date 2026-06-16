import { groupShoppingItems, normalizeShoppingItem } from './normalize.ts';
import type { ShoppingAiRequestContext, ShoppingItem } from './types.ts';

export function buildMenuShoppingItems(
  context: ShoppingAiRequestContext,
  options: { fallbackNote?: string } = {}
): ShoppingItem[] {
  const items: ShoppingItem[] = [];

  context.meals.forEach((meal) => {
    const mealRef = `${meal.dayKey} ${meal.meal}`;

    if (meal.recipeIngredients.length > 0) {
      meal.recipeIngredients.forEach((ingredient) => {
        items.push(
          normalizeShoppingItem(
            {
              name: ingredient.name,
              category: ingredient.category || ingredient.name,
              quantity: ingredient.quantity || '',
              forMeals: [mealRef],
              source: 'manual',
              confidence: 'high',
              status: 'to-buy',
              checked: false,
              order: items.length,
            },
            items.length
          )
        );
      });
      return;
    }

    meal.dishes.forEach((dish) => {
      items.push(
        normalizeShoppingItem(
          {
            name: dish,
            category: 'other',
            quantity: '',
            note: options.fallbackNote ?? '',
            forMeals: [mealRef],
            source: 'manual',
            confidence: 'low',
            status: 'to-buy',
            checked: false,
            order: items.length,
          },
          items.length
        )
      );
    });
  });

  return groupShoppingItems(items);
}
