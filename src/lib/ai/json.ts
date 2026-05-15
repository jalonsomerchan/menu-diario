import { AiClientError } from './errors';

export type JsonValidator<T> = (value: unknown) => value is T;

export function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(stripJsonFence(text));
  } catch (cause) {
    throw new AiClientError('invalid-response', 'AI response is not valid JSON.', { cause });
  }
}

export function parseValidatedJson<T>(text: string, validator: JsonValidator<T>): T {
  const value = parseJsonObject(text);

  if (!validator(value)) {
    throw new AiClientError('invalid-response', 'AI response does not match the expected shape.');
  }

  return value;
}

export function buildJsonPrompt(parts: string[]) {
  return parts.filter(Boolean).join('\n\n');
}

function stripJsonFence(text: string) {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return match?.[1]?.trim() ?? trimmed;
}
