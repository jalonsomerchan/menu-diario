import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  createPublicShareMetadata,
  getPublicShareRobots,
  isPublicShareIdSafe,
} from '../src/lib/public-sharing/metadata.mjs';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('public sharing policy', () => {
  it('defaults personal shared content to noindex', () => {
    assert.equal(getPublicShareRobots(), 'noindex,nofollow');
    assert.equal(getPublicShareRobots(false), 'noindex,nofollow');
    assert.equal(getPublicShareRobots(true), 'index,follow');
  });

  it('creates base-safe metadata without exposing private ids', () => {
    const metadata = createPublicShareMetadata({
      title: 'Menú semanal',
      description: 'Menú compartido',
      routePath: '/menu/public-share-id',
      type: 'menu',
    });

    assert.equal(metadata.robots, 'noindex,nofollow');
    assert.equal(metadata.ogType, 'website');
    assert.match(metadata.canonicalUrl, /\/menu\/public-share-id$/);
    assert.doesNotMatch(metadata.canonicalUrl, /uid|ownerId|groupId|inviteCode/i);
  });

  it('requires non-trivial share ids', () => {
    assert.equal(isPublicShareIdSafe('abc'), false);
    assert.equal(isPublicShareIdSafe('abc def ghi jkl'), false);
    assert.equal(isPublicShareIdSafe('share_1234567890-abcd'), true);
  });

  it('documents forbidden public data and noindex defaults', () => {
    const docs = readText('docs/public-sharing.md');

    ['uid', 'ownerId', 'emails', 'miembros', 'códigos de invitación', 'despensa privada', 'tuppers privados'].forEach((term) => {
      assert.match(docs, new RegExp(term, 'i'));
    });
    assert.match(docs, /noindex,nofollow/);
    assert.match(docs, /src\/lib\/public-sharing\/metadata\.mjs/);
  });
});
