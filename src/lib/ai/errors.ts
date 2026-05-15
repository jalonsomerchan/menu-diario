export const aiErrorCodes = [
  'disabled',
  'missing-config',
  'quota-exhausted',
  'timeout',
  'invalid-response',
  'request-failed',
] as const;

export type AiErrorCode = (typeof aiErrorCodes)[number];

export class AiClientError extends Error {
  readonly code: AiErrorCode;
  readonly retryable: boolean;

  constructor(code: AiErrorCode, message: string, options: { retryable?: boolean; cause?: unknown } = {}) {
    super(message);
    this.name = 'AiClientError';
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
  }
}

export function getAiErrorCode(error: unknown): AiErrorCode {
  if (error instanceof AiClientError) {
    return error.code;
  }

  return 'request-failed';
}

export function logAiError(error: unknown, context: string) {
  const code = getAiErrorCode(error);
  console.warn('[ai]', context, { code });
}
