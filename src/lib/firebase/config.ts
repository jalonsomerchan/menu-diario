export type FirebasePublicConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

export type FirebaseAppCheckConfig = {
  enabled: boolean;
  provider: 'recaptcha-enterprise';
  siteKey: string;
  debugToken?: string;
  autoRefresh: boolean;
  requiredForAi: boolean;
};

const firebaseConfig: FirebasePublicConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID ?? '',
  measurementId: import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
};

const appCheckConfig: FirebaseAppCheckConfig = {
  enabled: import.meta.env.PUBLIC_FIREBASE_APPCHECK_ENABLED === 'true',
  provider: 'recaptcha-enterprise',
  siteKey: import.meta.env.PUBLIC_FIREBASE_APPCHECK_SITE_KEY ?? '',
  debugToken: import.meta.env.PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN || undefined,
  autoRefresh: import.meta.env.PUBLIC_FIREBASE_APPCHECK_AUTO_REFRESH !== 'false',
  requiredForAi: import.meta.env.PUBLIC_FIREBASE_APPCHECK_REQUIRED_FOR_AI === 'true',
};

export function getFirebaseConfig() {
  return firebaseConfig;
}

export function getFirebaseAppCheckConfig() {
  return appCheckConfig;
}

export function hasFirebaseConfig() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
}

export function hasFirebaseAppCheckConfig() {
  return Boolean(appCheckConfig.enabled && appCheckConfig.siteKey);
}

export function isFirebaseAppCheckRequiredForAi() {
  return appCheckConfig.requiredForAi;
}
