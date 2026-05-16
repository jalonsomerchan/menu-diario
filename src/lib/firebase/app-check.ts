import {
  getFirebaseAppCheckConfig,
  hasFirebaseAppCheckConfig,
  isFirebaseAppCheckRequiredForAi,
} from './config';

type FirebaseAppCheckModule = {
  ReCaptchaEnterpriseProvider: new (siteKey: string) => unknown;
  getToken: (appCheck: unknown, forceRefresh?: boolean) => Promise<unknown>;
  initializeAppCheck: (
    app: unknown,
    options: { provider: unknown; isTokenAutoRefreshEnabled: boolean }
  ) => unknown;
};

type AppCheckStatus = 'disabled' | 'ready' | 'missing-config' | 'failed';

type AppCheckState = {
  status: AppCheckStatus;
  error?: unknown;
};

const firebaseVersion = '12.6.0';
let appCheckModulePromise: Promise<FirebaseAppCheckModule> | undefined;
let appCheckInstance: unknown;
let appCheckState: AppCheckState = { status: 'disabled' };

async function importAppCheckModule() {
  appCheckModulePromise ??= import(
    /* @vite-ignore */ `https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-app-check.js`
  ) as Promise<FirebaseAppCheckModule>;

  return appCheckModulePromise;
}

export async function initializeFirebaseAppCheck(app: unknown) {
  const config = getFirebaseAppCheckConfig();

  if (!config.enabled) {
    appCheckState = { status: 'disabled' };
    return appCheckState;
  }

  if (!hasFirebaseAppCheckConfig()) {
    appCheckState = { status: 'missing-config' };
    return appCheckState;
  }

  if (appCheckInstance) {
    return appCheckState;
  }

  try {
    if (config.debugToken && typeof self !== 'undefined') {
      (self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
        config.debugToken;
    }

    const appCheckModule = await importAppCheckModule();
    appCheckInstance = appCheckModule.initializeAppCheck(app, {
      provider: new appCheckModule.ReCaptchaEnterpriseProvider(config.siteKey),
      isTokenAutoRefreshEnabled: config.autoRefresh,
    });
    appCheckState = { status: 'ready' };
  } catch (error) {
    appCheckState = { status: 'failed', error };
    console.warn('[firebase]', 'app-check', { code: 'request-failed' });
  }

  return appCheckState;
}

export function getFirebaseAppCheckState() {
  return appCheckState;
}

export function isFirebaseAppCheckReady() {
  return appCheckState.status === 'ready';
}

export function shouldRequireFirebaseAppCheckForAi() {
  return isFirebaseAppCheckRequiredForAi();
}

export async function assertFirebaseAppCheckReadyForAi() {
  if (!shouldRequireFirebaseAppCheckForAi()) {
    return;
  }

  if (!isFirebaseAppCheckReady()) {
    throw new Error('Firebase App Check is required for AI requests but is not ready.');
  }

  if (appCheckInstance) {
    const appCheckModule = await importAppCheckModule();
    await appCheckModule.getToken(appCheckInstance, false);
  }
}
