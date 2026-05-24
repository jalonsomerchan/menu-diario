import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getUserGroupId, leaveGroupMembership } from '../src/lib/menu/group-membership.ts';

function createFirestoreHarness(initialStore = {}) {
  const store = new Map(
    Object.entries(initialStore).map(([collection, docs]) => [collection, new Map(Object.entries(docs))])
  );
  const now = new Date('2026-05-24T10:00:00.000Z');

  function collectionMap(name) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name);
  }

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function applyValue(previous, next) {
    if (next?.__op === 'serverTimestamp') return new Date(now);
    return clone(next);
  }

  function mergeDoc(previous = {}, patch = {}) {
    const merged = { ...previous };
    for (const [key, value] of Object.entries(patch)) {
      merged[key] = applyValue(previous[key], value);
    }
    return merged;
  }

  const firestoreModule = {
    doc(_db, collection, id) {
      return { kind: 'doc', collection, id };
    },
    serverTimestamp() {
      return { __op: 'serverTimestamp' };
    },
    async getDoc(ref) {
      const data = collectionMap(ref.collection).get(ref.id);
      return {
        id: ref.id,
        exists: () => data !== undefined,
        data: () => clone(data),
      };
    },
    async updateDoc(ref, data) {
      const docs = collectionMap(ref.collection);
      const previous = docs.get(ref.id);
      docs.set(ref.id, mergeDoc(previous, data));
    },
    async deleteDoc(ref) {
      collectionMap(ref.collection).delete(ref.id);
    },
  };

  return {
    services: { db: {}, firestoreModule },
    read(collection, id) {
      return clone(collectionMap(collection).get(id));
    },
  };
}

describe('group membership helpers', () => {
  it('reads the current group id safely from user profile data', () => {
    assert.equal(getUserGroupId({ groupId: 'group-1' }), 'group-1');
    assert.equal(getUserGroupId({ groupId: '  ' }), null);
    assert.equal(getUserGroupId({}), null);
  });

  it('deletes the previous personal group when its only member switches away', async () => {
    const { services, read } = createFirestoreHarness({
      groups: {
        'group-old': {
          ownerId: 'user-1',
          members: ['user-1'],
          memberEmails: ['jorge@example.com'],
        },
      },
    });

    await leaveGroupMembership(services, {
      groupId: 'group-old',
      nextGroupId: 'group-new',
      userId: 'user-1',
      email: 'jorge@example.com',
    });

    assert.equal(read('groups', 'group-old'), undefined);
  });

  it('transfers ownership and removes the old member email when others remain', async () => {
    const { services, read } = createFirestoreHarness({
      groups: {
        'group-old': {
          ownerId: 'user-1',
          members: ['user-1', 'user-2'],
          memberEmails: ['jorge@example.com', 'ana@example.com'],
          pendingEmails: [],
        },
      },
    });

    await leaveGroupMembership(services, {
      groupId: 'group-old',
      userId: 'user-1',
      email: 'JORGE@example.com',
    });

    assert.deepEqual(read('groups', 'group-old'), {
      ownerId: 'user-2',
      members: ['user-2'],
      memberEmails: ['ana@example.com'],
      pendingEmails: [],
      updatedAt: new Date('2026-05-24T10:00:00.000Z'),
    });
  });
});
