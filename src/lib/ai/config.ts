const defaultModel = 'gemini-2.5-flash-lite';

function readNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export const aiModels = {
  menuAssistant: import.meta.env.PUBLIC_FIREBASE_AI_MODEL || defaultModel,
} as const;

export const aiGenerationConfig = {
  model: aiModels.menuAssistant,
  temperature: clamp(readNumber(import.meta.env.PUBLIC_FIREBASE_AI_TEMPERATURE, 0.35), 0, 2),
  topP: clamp(readNumber(import.meta.env.PUBLIC_FIREBASE_AI_TOP_P, 0.9), 0, 1),
  maxOutputTokens: clamp(
    readNumber(import.meta.env.PUBLIC_FIREBASE_AI_MAX_OUTPUT_TOKENS, 768),
    64,
    4096
  ),
  timeoutMs: clamp(readNumber(import.meta.env.PUBLIC_FIREBASE_AI_TIMEOUT_MS, 15000), 1000, 60000),
} as const;

export const aiClientLimits = {
  perSession: clamp(readNumber(import.meta.env.PUBLIC_AI_MAX_SESSION_REQUESTS, 8), 0, 100),
  perUserPerDay: clamp(readNumber(import.meta.env.PUBLIC_AI_MAX_USER_DAILY_REQUESTS, 20), 0, 500),
} as const;

export const aiPromptConfig = {
  localeInstruction:
    'Respond in the user locale. Keep content concise, practical and safe for a daily menu app.',
  jsonOnly:
    'Return only valid JSON. Do not wrap it in Markdown, comments, explanations or code fences.',
  baseSafety:
    'Do not include private data, credentials, medical advice or unsafe food handling instructions.',
} as const;

export type AiModelKey = keyof typeof aiModels;
export type AiGenerationConfig = typeof aiGenerationConfig;
