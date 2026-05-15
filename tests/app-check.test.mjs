import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('Firebase App Check configuration', () => {
  it('keeps App Check env variables documented without real tokens', () => {
    const envExample = readText('.env.example');

    [
      'PUBLIC_FIREBASE_APPCHECK_ENABLED=false',
      'PUBLIC_FIREBASE_APPCHECK_SITE_KEY=',
      'PUBLIC_FIREBASE_APPCHECK_AUTO_REFRESH=true',
      'PUBLIC_FIREBASE_APPCHECK_REQUIRED_FOR_AI=false',
      'PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN=',
    ].forEach((line) => assert.match(envExample, new RegExp(line)));

    assert.doesNotMatch(envExample, /PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN=\S+/);
  });

  it('initializes App Check before Firebase services are exposed', () => {
    const firebaseClient = readText('src/lib/firebase/client.ts');
    const appCheck = readText('src/lib/firebase/app-check.ts');

    assert.match(firebaseClient, /initializeFirebaseAppCheck/);
    assert.match(firebaseClient, /await initializeFirebaseAppCheck\(app\)/);
    assert.match(appCheck, /firebase-app-check\.js/);
    assert.match(appCheck, /ReCaptchaEnterpriseProvider/);
    assert.match(appCheck, /isTokenAutoRefreshEnabled/);
  });

  it('protects AI calls and exposes translated App Check errors', () => {
    const aiClient = readText('src/lib/ai/client.ts');
    const aiErrors = readText('src/lib/ai/errors.ts');
    const aiUiState = readText('src/lib/ai/ui-state.ts');
    const es = readText('src/i18n/translations/es.json');
    const en = readText('src/i18n/translations/en.json');

    assert.match(aiClient, /assertFirebaseAppCheckReadyForAi/);
    assert.match(aiClient, /app-check-unavailable/);
    assert.match(aiErrors, /app-check-unavailable/);
    assert.match(aiUiState, /ai\.appCheckUnavailable/);
    assert.match(es, /ai\.appCheckUnavailable/);
    assert.match(en, /ai\.appCheckUnavailable/);
  });

  it('keeps App Check documentation available', () => {
    const firebaseDocs = readText('docs/firebase.md');
    const appCheckDocs = readText('docs/app-check.md');
    const readme = readText('README.md');

    assert.equal(existsSync(join(root, 'docs/app-check.md')), true);
    assert.match(firebaseDocs, /App Check/);
    assert.match(appCheckDocs, /PUBLIC_FIREBASE_APPCHECK_REQUIRED_FOR_AI/);
    assert.match(appCheckDocs, /Activación gradual/);
    assert.match(appCheckDocs, /Firebase AI Logic/);
    assert.match(readme, /PUBLIC_FIREBASE_APPCHECK_ENABLED/);
  });
});
