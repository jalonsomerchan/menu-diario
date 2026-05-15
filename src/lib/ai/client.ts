import { assertFirebaseAppCheckReadyForAi } from '../firebase/app-check';
import { getFirebaseApp, hasFirebaseConfig } from '../firebase/client';
import { aiGenerationConfig, aiPromptConfig } from './config';
import { AiClientError, logAiError } from './errors';
import { getAiFeatureFlags, isAiAvailable } from './flags';
import { parseValidatedJson, type JsonValidator } from './json';
import { assertAiClientLimit, registerAiClientUse } from './limits';

type FirebaseAiModule = {
  GoogleAIBackend: new () => unknown;
  getAI: (app: unknown, options: { backend: unknown }) => unknown;
  getGenerativeModel: (ai: unknown, options: Record<string, unknown>) => GenerativeModel;
};

type GenerativeModel = {
  generateContent: (prompt: string) => Promise<unknown>;
};

type GenerateJsonOptions<T> = {
  prompt: string;
  validator: JsonValidator<T>;
  userId?: string;
  timeoutMs?: number;
};

const firebaseVersion = '12.6.0';
let aiModulePromise: Promise<FirebaseAiModule> | undefined;

async function importFirebaseAiModule() {
  aiModulePromise ??= import(
    /* @vite-ignore */ `https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-ai.js`
  ) as Promise<FirebaseAiModule>;

  return aiModulePromise;
}

export async function generateGeminiJson<T>({ prompt, validator, userId, timeoutMs }: GenerateJsonOptions<T>) {
  if (!isAiAvailable(getAiFeatureFlags())) {
    throw new AiClientError('disabled', 'AI features are disabled.');
  }

  if (!hasFirebaseConfig()) {
    throw new AiClientError('missing-config', 'Firebase AI public config is missing.');
  }

  assertAiClientLimit(userId);

  try {
    await ensureAppCheckForAi();
    const result = await withTimeout(generateText(prompt), timeoutMs ?? aiGenerationConfig.timeoutMs);
    const json = parseValidatedJson(result, validator);
    registerAiClientUse(userId);

    return json;
  } catch (error) {
    logAiError(error, 'generateGeminiJson');
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

async function generateText(prompt: string) {
  const app = await getFirebaseApp();
  const aiModule = await importFirebaseAiModule();
  const ai = aiModule.getAI(app, { backend: new aiModule.GoogleAIBackend() });
  const model = aiModule.getGenerativeModel(ai, {
    model: aiGenerationConfig.model,
    generationConfig: {
      temperature: aiGenerationConfig.temperature,
      topP: aiGenerationConfig.topP,
      maxOutputTokens: aiGenerationConfig.maxOutputTokens,
      responseMimeType: 'application/json',
    },
  });

  const response = await model.generateContent(
    [aiPromptConfig.baseSafety, aiPromptConfig.localeInstruction, aiPromptConfig.jsonOnly, prompt].join('\n\n')
  );

  return readGeneratedText(response);
}

function readGeneratedText(response: unknown) {
  const candidate = response as { response?: { text?: () => string } };
  const text = candidate.response?.text?.();

  if (!text) {
    throw new AiClientError('invalid-response', 'AI response is empty.');
  }

  return text;
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
