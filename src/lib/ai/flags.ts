export type AiFeatureFlags = {
  aiEnabled: boolean;
  menuSuggestionsEnabled: boolean;
  remoteConfigEnabled: boolean;
};

const envFlags: AiFeatureFlags = {
  aiEnabled: import.meta.env.PUBLIC_AI_ENABLED === 'true',
  menuSuggestionsEnabled: import.meta.env.PUBLIC_AI_MENU_SUGGESTIONS_ENABLED === 'true',
  remoteConfigEnabled: import.meta.env.PUBLIC_AI_REMOTE_CONFIG_ENABLED === 'true',
};

const remoteFlagKeys: Record<keyof Omit<AiFeatureFlags, 'remoteConfigEnabled'>, string> = {
  aiEnabled: 'ai_enabled',
  menuSuggestionsEnabled: 'ai_menu_suggestions_enabled',
};

export function getAiFeatureFlags(remoteValues: Partial<Record<string, unknown>> = {}): AiFeatureFlags {
  return {
    remoteConfigEnabled: envFlags.remoteConfigEnabled,
    aiEnabled: readBoolean(remoteValues[remoteFlagKeys.aiEnabled], envFlags.aiEnabled),
    menuSuggestionsEnabled: readBoolean(
      remoteValues[remoteFlagKeys.menuSuggestionsEnabled],
      envFlags.menuSuggestionsEnabled
    ),
  };
}

export function isAiAvailable(flags: AiFeatureFlags = getAiFeatureFlags()) {
  return flags.aiEnabled;
}

export function isMenuSuggestionsAvailable(flags: AiFeatureFlags = getAiFeatureFlags()) {
  return flags.aiEnabled && flags.menuSuggestionsEnabled;
}

function readBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  return fallback;
}
