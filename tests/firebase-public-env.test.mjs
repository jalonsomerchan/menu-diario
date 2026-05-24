import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  assertRequiredFirebasePublicEnv,
  getMissingFirebasePublicEnv,
  requiredFirebasePublicEnvKeys,
} from '../src/config/firebase-public-env.mjs';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('firebase public env validation', () => {
  it('defines the required public Firebase keys used by the client app', () => {
    assert.deepEqual(requiredFirebasePublicEnvKeys, [
      'PUBLIC_FIREBASE_API_KEY',
      'PUBLIC_FIREBASE_AUTH_DOMAIN',
      'PUBLIC_FIREBASE_PROJECT_ID',
      'PUBLIC_FIREBASE_APP_ID',
    ]);
  });

  it('reports and blocks builds when required public Firebase vars are missing', () => {
    assert.deepEqual(getMissingFirebasePublicEnv({}), requiredFirebasePublicEnvKeys);
    assert.throws(
      () => assertRequiredFirebasePublicEnv({ PUBLIC_FIREBASE_API_KEY: 'set' }),
      /PUBLIC_FIREBASE_AUTH_DOMAIN, PUBLIC_FIREBASE_PROJECT_ID, PUBLIC_FIREBASE_APP_ID/
    );
  });

  it('wires the validation into Astro builds', () => {
    const astroConfig = readText('astro.config.mjs');

    assert.match(astroConfig, /assertRequiredFirebasePublicEnv/);
    assert.match(astroConfig, /loadEnv/);
    assert.match(astroConfig, /const isBuildCommand = process\.argv\.some/);
    assert.match(astroConfig, /if \(isBuildCommand\) \{\s+assertRequiredFirebasePublicEnv\(env\);/);
  });
});
