import type { TranslationKey } from '../../i18n/ui';
import { getAiErrorCode, type AiErrorCode } from './errors';

export const aiUiStates = [
  'idle',
  'loading',
  'disabled',
  'error',
  'quota-exhausted',
  'missing-config',
  'app-check-unavailable',
  'invalid-response',
] as const;

export type AiUiState = (typeof aiUiStates)[number];

const stateMessages: Record<Exclude<AiUiState, 'idle'>, TranslationKey> = {
  loading: 'ai.loading',
  disabled: 'ai.disabled',
  error: 'ai.error',
  'quota-exhausted': 'ai.quotaExhausted',
  'missing-config': 'ai.missingConfig',
  'app-check-unavailable': 'ai.appCheckUnavailable',
  'invalid-response': 'ai.invalidResponse',
};

const errorStateMap: Record<AiErrorCode, Exclude<AiUiState, 'idle' | 'loading'>> = {
  disabled: 'disabled',
  'missing-config': 'missing-config',
  'app-check-unavailable': 'app-check-unavailable',
  'quota-exhausted': 'quota-exhausted',
  timeout: 'error',
  'invalid-response': 'invalid-response',
  'network-error': 'error',
  'server-error': 'error',
  'auth-error': 'error',
  'request-failed': 'error',
};

export function getAiUiStateFromError(error: unknown): AiUiState {
  return errorStateMap[getAiErrorCode(error)];
}

export function getAiUiMessageKey(state: AiUiState): TranslationKey | undefined {
  if (state === 'idle') {
    return undefined;
  }

  return stateMessages[state];
}

export function getAiRetryLabelKey(): TranslationKey {
  return 'ai.retry';
}
