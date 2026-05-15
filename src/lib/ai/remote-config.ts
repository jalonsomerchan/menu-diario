import { getFirebaseApp } from '../firebase/client';
import { getAiFeatureFlags, type AiFeatureFlags } from './flags';

type RemoteConfigModule = {
  getRemoteConfig: (app: unknown) => unknown;
  fetchAndActivate: (remoteConfig: unknown) => Promise<boolean>;
  getBoolean: (remoteConfig: unknown, key: string) => boolean;
};

const firebaseVersion = '12.6.0';
const remoteFlagKeys = ['ai_enabled', 'ai_menu_suggestions_enabled'] as const;
let remoteConfigModulePromise: Promise<RemoteConfigModule> | undefined;

async function importRemoteConfigModule() {
  remoteConfigModulePromise ??= import(
    /* @vite-ignore */ `https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-remote-config.js`
  ) as Promise<RemoteConfigModule>;

  return remoteConfigModulePromise;
}

export async function getAiFeatureFlagsFromRemoteConfig(): Promise<AiFeatureFlags> {
  const baseFlags = getAiFeatureFlags();

  if (!baseFlags.remoteConfigEnabled) {
    return baseFlags;
  }

  try {
    const app = await getFirebaseApp();
    const remoteConfigModule = await importRemoteConfigModule();
    const remoteConfig = remoteConfigModule.getRemoteConfig(app);
    await remoteConfigModule.fetchAndActivate(remoteConfig);

    return getAiFeatureFlags(
      Object.fromEntries(remoteFlagKeys.map((key) => [key, remoteConfigModule.getBoolean(remoteConfig, key)]))
    );
  } catch (error) {
    console.warn('[ai]', 'remote-config', { code: 'request-failed' });
    return baseFlags;
  }
}
