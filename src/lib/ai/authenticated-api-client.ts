import { AiClientError } from './errors';
import { parseValidatedJson, type JsonValidator } from './json';

export const authenticatedAiApiEndpoint = 'https://alon.one/api-ia/auth.php';

export type AuthenticatedAiApiOptions = {
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  responseFormat?: { type: 'json_object' };
  responseMimeType?: 'application/json' | string;
};

export type AuthenticatedAiApiJsonOptions<T> = {
  token: string;
  projectId: string;
  systemPrompt: string;
  userPrompt: string;
  validator: JsonValidator<T>;
  timeoutMs: number;
  options?: AuthenticatedAiApiOptions;
  fetcher?: typeof fetch;
};

const defaultJsonOptions: AuthenticatedAiApiOptions = {
  responseFormat: { type: 'json_object' },
  responseMimeType: 'application/json',
};

export async function generateAuthenticatedAiApiJson<T>({
  token,
  projectId,
  systemPrompt,
  userPrompt,
  validator,
  timeoutMs,
  options,
  fetcher = globalThis.fetch.bind(globalThis),
}: AuthenticatedAiApiJsonOptions<T>) {
  const text = await withTimeout(
    requestAuthenticatedAiApiText({ token, projectId, systemPrompt, userPrompt, options, fetcher }),
    timeoutMs
  );

  return parseValidatedJson(text, validator);
}

async function requestAuthenticatedAiApiText(input: {
  token: string;
  projectId: string;
  systemPrompt: string;
  userPrompt: string;
  options?: AuthenticatedAiApiOptions;
  fetcher: typeof fetch;
}) {
  let response: Response;

  try {
    response = await input.fetcher(authenticatedAiApiEndpoint, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + input.token,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Accept: 'application/json',
      },
      body: buildAuthenticatedAiApiBody(input),
    });
  } catch (error) {
    throw new AiClientError('network-error', 'Authenticated AI API network request failed.', {
      retryable: true,
      cause: error,
    });
  }

  const text = await response.text();

  if (!response.ok) {
    throw createHttpError(response.status, text);
  }

  if (!text.trim()) {
    throw new AiClientError('invalid-response', 'AI response is empty.');
  }

  return text;
}

function buildAuthenticatedAiApiBody(input: {
  projectId: string;
  systemPrompt: string;
  userPrompt: string;
  options?: AuthenticatedAiApiOptions;
}) {
  const body = new URLSearchParams({
    project_id: input.projectId,
    system_prompt: input.systemPrompt,
    user_prompt: input.userPrompt,
  });
  const options = { ...defaultJsonOptions, ...input.options };

  appendOption(body, 'temperature', options.temperature);
  appendOption(body, 'topP', options.topP);
  appendOption(body, 'maxOutputTokens', options.maxOutputTokens);
  appendOption(body, 'response_mime_type', options.responseMimeType);

  if (options.responseFormat?.type) {
    body.set('options[response_format][type]', options.responseFormat.type);
  }

  return body;
}

function appendOption(body: URLSearchParams, name: string, value: string | number | undefined) {
  if (value === undefined || value === '') return;
  body.set(`options[${name}]`, String(value));
}

function createHttpError(status: number, body: string) {
  if (status === 401 || status === 403) {
    return new AiClientError('auth-error', 'Authenticated AI API rejected the Firebase token.', {
      retryable: false,
      cause: readErrorBody(status, body),
    });
  }

  if (status === 429) {
    return new AiClientError('quota-exhausted', 'Authenticated AI API quota was exhausted.', {
      retryable: true,
      cause: readErrorBody(status, body),
    });
  }

  if (status >= 500) {
    return new AiClientError('server-error', 'Authenticated AI API failed.', {
      retryable: true,
      cause: readErrorBody(status, body),
    });
  }

  return new AiClientError('request-failed', 'Authenticated AI API request failed.', {
    cause: readErrorBody(status, body),
  });
}

function readErrorBody(status: number, body: string) {
  try {
    const parsed = JSON.parse(body) as { error?: unknown; detalles?: unknown };
    return {
      status,
      error: typeof parsed.error === 'string' ? parsed.error : undefined,
      detalles: typeof parsed.detalles === 'string' ? parsed.detalles : undefined,
      body: typeof parsed.error === 'string' || typeof parsed.detalles === 'string' ? undefined : body.slice(0, 300),
    };
  } catch {
    return { status, body: body.slice(0, 300) };
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
