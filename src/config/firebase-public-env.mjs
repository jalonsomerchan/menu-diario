export const requiredFirebasePublicEnvKeys = [
  'PUBLIC_FIREBASE_API_KEY',
  'PUBLIC_FIREBASE_AUTH_DOMAIN',
  'PUBLIC_FIREBASE_PROJECT_ID',
  'PUBLIC_FIREBASE_APP_ID',
];

export function getMissingFirebasePublicEnv(env = process.env) {
  return requiredFirebasePublicEnvKeys.filter((key) => !String(env[key] ?? '').trim());
}

export function assertRequiredFirebasePublicEnv(env = process.env) {
  const missing = getMissingFirebasePublicEnv(env);
  if (missing.length === 0) return;

  throw new Error(
    `Missing required Firebase public env vars for build: ${missing.join(', ')}. ` +
      'Set them in .env for local builds or in GitHub Actions variables/secrets for deployments.'
  );
}
