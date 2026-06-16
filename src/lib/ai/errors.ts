export const aiErrorCodes = [
  'disabled',
  'missing-config',
  'app-check-unavailable',
  'quota-exhausted',
  'timeout',
  'invalid-response',
  'request-failed',
] as const;

export type AiErrorCode = (typeof aiErrorCodes)[number];

type AiErrorDebugCause = {
  status?: number;
  error?: string;
  detalles?: string;
  message?: string;
  body?: string;
};

export class AiClientError extends Error {
  readonly code: AiErrorCode;
  readonly retryable: boolean;

  constructor(code: AiErrorCode, message: string, options: { retryable?: boolean; cause?: unknown } = {}) {
    super(message);
    this.name = 'AiClientError';
    this.code = code;
    this.retryable = options.retryable ?? false;

    if (options.cause) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function getAiErrorCode(error: unknown): AiErrorCode {
  if (error instanceof AiClientError) {
    return error.code;
  }

  return 'request-failed';
}

export function getAiErrorDetail(error: unknown) {
  const cause = error instanceof AiClientError ? (error as Error & { cause?: unknown }).cause : undefined;
  const value = readReadableCause(cause) || (error instanceof Error ? error.message : String(error));
  const normalized = value.replace(/\s+/g, ' ').trim();

  return normalized.length > 240 ? `${normalized.slice(0, 239)}…` : normalized;
}

export function logAiError(error: unknown, context: string) {
  const code = getAiErrorCode(error);
  console.warn('[ai]', context, getAiErrorDebugContext(error, code));
}

function getAiErrorDebugContext(error: unknown, code: AiErrorCode) {
  if (error instanceof AiClientError) {
    const cause = (error as Error & { cause?: unknown }).cause;
    return {
      code,
      message: error.message,
      retryable: error.retryable,
      ...readDebugCause(cause),
    };
  }

  if (error instanceof Error) {
    return { code, message: error.message };
  }

  return { code, message: String(error) };
}

function readReadableCause(cause: unknown) {
  if (!cause) return '';
  if (cause instanceof Error) return cause.message;
  if (typeof cause !== 'object') return String(cause);

  const candidate = cause as Partial<AiErrorDebugCause>;
  return [candidate.detalles, candidate.error, candidate.message, candidate.body].find(
    (value) => typeof value === 'string' && value.trim().length > 0
  ) ?? '';
}

function readDebugCause(cause: unknown): AiErrorDebugCause {
  if (!cause) return {};

  if (cause instanceof Error) {
    return { message: cause.message };
  }

  if (typeof cause === 'object') {
    const candidate = cause as Partial<AiErrorDebugCause>;
    return {
      status: typeof candidate.status === 'number' ? candidate.status : undefined,
      error: typeof candidate.error === 'string' ? candidate.error : undefined,
      detalles: typeof candidate.detalles === 'string' ? candidate.detalles : undefined,
      message: typeof candidate.message === 'string' ? candidate.message : undefined,
      body: typeof candidate.body === 'string' ? candidate.body : undefined,
    };
  }

  return { message: String(cause) };
}
