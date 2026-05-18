export type DishRecommendationMeal = 'breakfast' | 'lunch' | 'dinner';
export type DishRecommendationDifficulty = 'easy' | 'medium' | 'advanced';
export type DishRecommendationTime = 'short' | 'enough' | 'long' | 'previous-day';
export type DishRecommendationIngredientMode = 'have' | 'shopping';

export type DishRecommenderPromptInput = {
  locale: string;
  meal: DishRecommendationMeal;
  people: number;
  difficulty: DishRecommendationDifficulty;
  time: DishRecommendationTime;
  ingredientMode: DishRecommendationIngredientMode;
  ingredients: string;
  intolerances: string;
  preferences: string[];
  extraPreferences: string;
  recentMeals?: string[];
};

export type DishRecommendation = {
  title: string;
  description: string;
};

export type DishRecommendationResponse = {
  dishes: DishRecommendation[];
};

const maxTextLength = 700;
const maxDishes = 12;
const maxRecentMeals = 28;

export function buildDishRecommenderPrompt(input: DishRecommenderPromptInput) {
  const preferenceText = input.preferences.length ? input.preferences.join(', ') : 'none';
  const recentMeals = describeRecentMeals(input.recentMeals);
  const ingredientsRule =
    input.ingredientMode === 'shopping'
      ? 'The user will shop, so you may use any normal supermarket ingredient.'
      : 'Prioritize the listed ingredients and assume only basic pantry items are available in addition.';

  return [
    `Locale: ${input.locale}.`,
    'Task: recommend everyday home dishes for a menu planning app.',
    `Return ${maxDishes} dish ideas when possible, with a short title and one-sentence description.`,
    'Use practical, realistic dishes. Do not include full recipes, long steps, calories or invented health claims.',
    'Assume basic pantry items are available: salt, oil, water, common spices, flour/sugar only when normal for the dish, and standard utensils.',
    'Respect intolerances and restrictions as hard constraints.',
    recentMeals
      ? 'Use the recent meals as avoidance context: do not recommend the same dish, very similar dishes, or the same main protein/style repeatedly unless the user preference makes it unavoidable.'
      : 'No recent meal history was provided.',
    ingredientsRule,
    `Meal: ${input.meal}.`,
    `People: ${Math.max(1, Math.min(20, Math.round(input.people || 1)))}.`,
    `Difficulty: ${input.difficulty}.`,
    `Available time: ${input.time}.`,
    `Ingredients: ${trimText(input.ingredients) || 'not specified'}.`,
    `Intolerances: ${trimText(input.intolerances) || 'none'}.`,
    `Preferences: ${preferenceText}.`,
    `Extra preferences: ${trimText(input.extraPreferences) || 'none'}.`,
    'Recently eaten meals to avoid repeating or closely imitating:',
    recentMeals || '- none',
    'Return JSON only with shape {"dishes":[{"title":"Dish title","description":"One short sentence"}]}.',
  ].join('\n\n');
}

export function isDishRecommendationResponse(value: unknown): value is DishRecommendationResponse {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { dishes?: unknown }).dishes)) return false;

  return (value as { dishes: unknown[] }).dishes.every((dish) => {
    if (!dish || typeof dish !== 'object') return false;
    const candidate = dish as Partial<DishRecommendation>;
    return typeof candidate.title === 'string' && candidate.title.trim().length >= 2 && typeof candidate.description === 'string';
  });
}

export function normalizeDishRecommendations(response: DishRecommendationResponse) {
  const seen = new Set<string>();
  return response.dishes.flatMap((dish) => {
    const title = dish.title.trim().replace(/\s+/g, ' ');
    const description = dish.description.trim().replace(/\s+/g, ' ');
    const key = title.toLocaleLowerCase();
    if (title.length < 2 || seen.has(key)) return [];
    seen.add(key);
    return [{ title, description }];
  }).slice(0, maxDishes);
}

function describeRecentMeals(recentMeals: string[] = []) {
  return recentMeals
    .map((meal) => trimText(meal))
    .filter(Boolean)
    .slice(0, maxRecentMeals)
    .map((meal) => `- ${meal}`)
    .join('\n');
}

function trimText(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, maxTextLength);
}
