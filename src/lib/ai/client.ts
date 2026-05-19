import { assertFirebaseAppCheckReadyForAi } from '../firebase/app-check';
import { getFirebaseServices, hasFirebaseConfig } from '../firebase/client';
import { getFirebaseConfig } from '../firebase/config';
import { generateAuthenticatedAiApiJson } from './authenticated-api-client';
import { aiGenerationConfig, aiPromptConfig } from './config';
import { AiClientError, logAiError } from './errors';
import { getAiFeatureFlags, isAiAvailable } from './flags';
import { type JsonValidator } from './json';
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
    const json = await generateAuthenticatedAiApiJson({
      token: await getCurrentUserIdToken(),
      projectId: getFirebaseConfig().projectId,
      systemPrompt: getSystemPrompt(),
      userPrompt: prompt,
      validator,
      timeoutMs: timeoutMs ?? aiGenerationConfig.timeoutMs,
    });
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

function normalizeAiError(error: unknown) {
  if (error instanceof AiClientError) {
    return error;
  }

  return new AiClientError('request-failed', 'AI request failed.', { cause: error, retryable: true });
}
