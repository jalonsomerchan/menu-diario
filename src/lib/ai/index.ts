export { aiClientLimits, aiGenerationConfig, aiModels, aiPromptConfig } from './config';
export { generateGeminiJson } from './client';
export { AiClientError, getAiErrorCode, logAiError } from './errors';
export { getAiFeatureFlags, isAiAvailable, isMenuSuggestionsAvailable } from './flags';
export { buildJsonPrompt, parseJsonObject, parseValidatedJson } from './json';
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
export type { AiUiState } from './ui-state';
