import { normalizeDishName } from '../dishes/helpers.mjs';
import { buildJsonPrompt } from './json.ts';
import { normalizeDay } from '../menu/normalizers.ts';
import type { Dish, MealSlot } from '../menu/types.ts';
import type { TupperItem } from '../tuppers/types.ts';
import type {
  ShoppingAiRequestContext,
  ShoppingAiResponse,
  ShoppingInventoryHint,
  ShoppingMealContext,
  ShoppingRecipeIngredient,
} from '../shopping/types.ts';

const maxMeals = 21;
const maxInventoryHints = 12;
const maxItems = 80;

export function buildShoppingListContext(input: {
  locale: string;
  days: Record<string, unknown>;
  dayKeys: string[];
  enabledMeals: MealSlot[];
  dishes: Dish[];
  tuppers?: TupperItem[];
}) {
  const dishMap = new Map(input.dishes.map((dish) => [normalizeDishName(dish.name), dish] as const));
  const meals = input.dayKeys
    .flatMap((dayKey) => {
      const day = normalizeDay(input.days[dayKey]);
      if (day.skipped) {
        return [];
      }

      return input.enabledMeals.flatMap((meal) => {
        const mealState = day.meals[meal];
        const dishes = mealState.items.map((item) => item.trim()).filter(Boolean);
        if (mealState.skipped || dishes.length === 0) {
          return [];
        }

        const recipeIngredients = dishes.flatMap((dishName) =>
          readDishIngredients(dishMap.get(normalizeDishName(stripTupperPrefix(dishName))))
        );

        return [
          {
            dayKey,
            meal,
            dishes,
            note: pickSafeNote(mealState.note || day.notes || ''),
            recipeIngredients,
          } satisfies ShoppingMealContext,
        ];
      });
    })
    .slice(0, maxMeals);

  const inventoryHints = (input.tuppers ?? [])
    .filter((item) => item.status === 'active' || item.status === 'assigned')
    .slice(0, maxInventoryHints)
    .map(
      (item) =>
        ({
          name: item.name,
          portions: item.portions,
          expiresAt: item.expiresAt,
          location: item.location || undefined,
        }) satisfies ShoppingInventoryHint
    );

  return {
    locale: input.locale,
    meals,
    inventoryHints,
  } satisfies ShoppingAiRequestContext;
}

export function buildShoppingListPrompt(context: ShoppingAiRequestContext) {
  const meals = context.meals
    .map((meal) =>
      [
        `- ${meal.dayKey} ${meal.meal}`,
        `  dishes: ${meal.dishes.join(', ')}`,
        meal.recipeIngredients.length
          ? `  recipeIngredients: ${meal.recipeIngredients
              .map((ingredient) =>
                [ingredient.name, ingredient.quantity ? `(${ingredient.quantity})` : '', ingredient.category ? `[${ingredient.category}]` : '']
                  .filter(Boolean)
                  .join(' ')
              )
              .join('; ')}`
          : '  recipeIngredients: none',
        meal.note ? `  note: ${meal.note}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n');
  const inventory = context.inventoryHints.length
    ? context.inventoryHints
        .map((item) =>
          `- ${item.name}${item.portions ? ` | portions:${item.portions}` : ''}${item.expiresAt ? ` | expires:${item.expiresAt}` : ''}${item.location ? ` | location:${item.location}` : ''}`
        )
        .join('\n')
    : '- none';

  return buildJsonPrompt([
    `Locale: ${context.locale}.`,
    'Task: generate a shopping list proposal for upcoming meals in a weekly menu app.',
    'Prioritize explicit recipeIngredients when they are available. Only infer ingredients or products when a dish has no recipeIngredients.',
    'Use inventoryHints only as weak context for things that may already be available. Never treat inventoryHints as certainty.',
    'Ignore private data. Never include emails, user ids, member names, invite codes or sensitive notes.',
    'Return only ingredients or products to review before shopping, not finished dishes.',
    'Prefer merging repeated ingredients across meals and keep quantities concise and practical.',
    'Return strict JSON with shape {"items":[{"name":"string","category":"string","quantity":"string","forMeals":["YYYY-MM-DD meal"],"confidence":"low|medium|high"}]}.',
    `Return at most ${maxItems} items.`,
    'Upcoming meals:',
    meals || '- none',
    'Optional inventory hints:',
    inventory,
  ]);
}

export function isShoppingListAiResponse(value: unknown): value is ShoppingAiResponse {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { items?: unknown }).items)) {
    return false;
  }

  return (value as { items: unknown[] }).items.every((entry) => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const candidate = entry as Partial<ShoppingAiResponse['items'][number]>;
    return (
      typeof candidate.name === 'string' &&
      candidate.name.trim().length > 0 &&
      typeof candidate.category === 'string' &&
      typeof candidate.quantity === 'string' &&
      Array.isArray(candidate.forMeals) &&
      candidate.forMeals.every((meal) => typeof meal === 'string') &&
      (candidate.confidence === 'low' || candidate.confidence === 'medium' || candidate.confidence === 'high')
    );
  });
}

function pickSafeNote(value: string) {
  const note = value.trim();
  if (!note || note.length > 120) {
    return '';
  }

  if (/@|https?:\/\/|uid|invite|codigo|code/i.test(note)) {
    return '';
  }

  return note;
}

function readDishIngredients(dish: Dish | undefined): ShoppingRecipeIngredient[] {
  if (!dish?.ingredients?.length) {
    return [];
  }

  return dish.ingredients
    .map((ingredient) => {
      if (typeof ingredient === 'string') {
        return { name: ingredient.trim() };
      }

      if (!ingredient || typeof ingredient !== 'object' || typeof ingredient.name !== 'string') {
        return null;
      }

      return {
        name: ingredient.name.trim(),
        quantity: typeof ingredient.quantity === 'string' ? ingredient.quantity.trim() : '',
        category: typeof ingredient.category === 'string' ? ingredient.category.trim() : '',
      } satisfies ShoppingRecipeIngredient;
    })
    .filter((ingredient): ingredient is ShoppingRecipeIngredient => Boolean(ingredient?.name));
}

function stripTupperPrefix(value: string) {
  return value.replace(/^tupper:\s*/i, '').trim();
}
