import { assertFirebaseAppCheckReadyForAi } from '../firebase/app-check';
import { getFirebaseServices, hasFirebaseConfig } from '../firebase/client';
import { aiApiConfig, aiGenerationConfig, aiPromptConfig } from './config';
import { AiClientError, logAiError } from './errors';
import { getAiFeatureFlags, isAiAvailable } from './flags';
import { parseValidatedJson, type JsonValidator } from './json';
import { assertAiClientLimit, registerAiClientUse } from './limits';

type GenerateJsonOptions<T> = {
  prompt: string;
  validator: JsonValidator<T>;
  userId?: string;
  timeoutMs?: number;
};

export async function generateGeminiJson<T>({ prompt, validator, userId, timeoutMs }: GenerateJsonOptions<T>) {
  return generateAuthenticatedAiJson({ prompt, validator, userId, timeoutMs });
}

export async function generateAuthenticatedAiJson<T>({ prompt, validator, userId, timeoutMs }: GenerateJsonOptions<T>) {
  if (!isAiAvailable(getAiFeatureFlags())) {
    throw new AiClientError('disabled', 'AI features are disabled.');
  }

  if (!hasFirebaseConfig()) {
    throw new AiClientError('missing-config', 'Firebase public config is missing.');
  }

  assertAiClientLimit(userId);

  try {
    await ensureAppCheckForAi();
    const result = await withTimeout(requestAuthenticatedAiText(prompt), timeoutMs ?? aiGenerationConfig.timeoutMs);
    const json = parseValidatedJson(result, validator);
    registerAiClientUse(userId);

    return json;
  } catch (error) {
    logAiError(error, 'generateAuthenticatedAiJson');
    throw normalizeAiError(error);
  }
}

async function ensureAppCheckForAi() {
  try {
    await assertFirebaseAppCheckReadyForAi();
  } catch (error) {
    throw new AiClientError('app-check-unavailable', 'Firebase App Check is not ready for AI requests.', {
      cause: error,
      retryable: true,
    });
  }
}

async function requestAuthenticatedAiText(prompt: string) {
  const token = await getCurrentUserIdToken();
  const response = await fetch(aiApiConfig.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      system_prompt: getSystemPrompt(),
      user_prompt: prompt,
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    throw createHttpError(response.status, text);
  }

  if (!text.trim()) {
    throw new AiClientError('invalid-response', 'AI response is empty.');
  }

  return text;
}

async function getCurrentUserIdToken() {
  const { auth } = await getFirebaseServices();
  const user = auth.currentUser as { getIdToken?: (forceRefresh?: boolean) => Promise<string> } | null;

  if (!user?.getIdToken) {
    throw new AiClientError('missing-config', 'A signed-in Firebase user is required for AI requests.');
  }

  return user.getIdToken();
}

function getSystemPrompt() {
  return [aiPromptConfig.baseSafety, aiPromptConfig.localeInstruction, aiPromptConfig.jsonOnly].join('\n\n');
}

function createHttpError(status: number, body: string) {
  if (status === 401 || status === 403) {
    return new AiClientError('request-failed', 'Authenticated AI API rejected the Firebase token.', {
      retryable: false,
      cause: readErrorBody(body),
    });
  }

  if (status === 429) {
    return new AiClientError('quota-exhausted', 'Authenticated AI API quota was exhausted.', {
      retryable: true,
      cause: readErrorBody(body),
    });
  }

  if (status >= 500) {
    return new AiClientError('request-failed', 'Authenticated AI API failed.', {
      retryable: true,
      cause: readErrorBody(body),
    });
  }

  return new AiClientError('request-failed', 'Authenticated AI API request failed.', {
    cause: readErrorBody(body),
  });
}

function readErrorBody(body: string) {
  try {
    const parsed = JSON.parse(body) as { error?: unknown; detalles?: unknown };
    return {
      error: typeof parsed.error === 'string' ? parsed.error : undefined,
      detalles: typeof parsed.detalles === 'string' ? parsed.detalles : undefined,
    };
  } catch {
    return undefined;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new AiClientError('timeout', 'AI request timed out.', { retryable: true }));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId));
  });
}

function normalizeAiError(error: unknown) {
  if (error instanceof AiClientError) {
    return error;
  }

  return new AiClientError('request-failed', 'AI request failed.', { cause: error, retryable: true });
}
