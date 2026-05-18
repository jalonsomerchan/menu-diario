export { aiClientLimits, aiGenerationConfig, aiModels, aiPromptConfig } from './config';
export { generateGeminiJson } from './client';
export { AiClientError, getAiErrorCode, logAiError } from './errors';
export { getAiFeatureFlags, isAiAvailable, isMenuSuggestionsAvailable, isShoppingListAiAvailable } from './flags';
export { buildJsonPrompt, parseJsonObject, parseValidatedJson } from './json';
export {
  assignPendingMealRecommendations,
  buildPendingMealPrompt,
  getPendingMealSlots,
  isPendingMealRecommendationResponse,
} from './pending-meal-recommendations';
export {
  buildDishRecommenderPrompt,
  isDishRecommendationResponse,
  normalizeDishRecommendations,
} from './dish-recommender';
export {
  assignPlanningRecommendations,
  buildPlanningAssistantPrompt,
  getPlanningCatalogDishes,
  hasPlanningCatalogForMode,
  isPlanningRecommendationResponse,
} from './planning-assistant';
export { buildShoppingListContext, buildShoppingListPrompt, isShoppingListAiResponse } from './shopping-list';
export { assertAiClientLimit, readLimitSnapshot, registerAiClientUse } from './limits';
export { getAiFeatureFlagsFromRemoteConfig } from './remote-config';
export { getAiRetryLabelKey, getAiUiMessageKey, getAiUiStateFromError } from './ui-state';
export {
  assertFirebaseAppCheckReadyForAi,
  getFirebaseAppCheckState,
  isFirebaseAppCheckReady,
  shouldRequireFirebaseAppCheckForAi,
} from '../firebase/app-check';
export type { AiGenerationConfig } from './config';
export type { AiErrorCode } from './errors';
export type { AiFeatureFlags } from './flags';
export type { JsonValidator } from './json';
export type {
  DishRecommendation,
  DishRecommendationResponse,
  DishRecommenderPromptInput,
} from './dish-recommender';
export type {
  PendingMealRecommendation,
  PendingMealRecommendedDish,
  PendingMealRecommendationResponse,
  PendingMealSlot,
} from './pending-meal-recommendations';
export type {
  PlanningRecommendation,
  PlanningRecommendationDish,
  PlanningRecommendationInput,
  PlanningRecommendationMode,
  PlanningRecommendationResponse,
} from './planning-assistant';
export type { ShoppingAiResponse } from '../shopping/types';
export type { AiUiState } from './ui-state';
