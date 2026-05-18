import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createManualDish,
  mapDish,
  recordMenuDishUsage,
  watchUserDishes,
} from '../src/lib/dishes/repository.ts';
import { createGlobalDishId } from '../src/lib/dishes/helpers.mjs';

function createFirestoreHarness(initialStore = {}) {
  const store = new Map(
    Object.entries(initialStore).map(([collection, docs]) => [collection, new Map(Object.entries(docs))])
  );
  const writes = [];
  const now = new Date('2026-05-16T08:00:00.000Z');

  function collectionMap(name) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name);
  }

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function normalizeQueryParts(parts) {
    if (parts[0]?.kind === 'query') {
      const [base, ...rest] = parts;
      return {
        kind: 'query',
        collection: base.collection,
        filters: [...base.filters, ...rest.filter((part) => part.kind === 'where')],
        limitValue: rest.find((part) => part.kind === 'limit')?.value ?? base.limitValue,
      };
    }

    return {
      kind: 'query',
      collection: parts[0].name,
      filters: parts.slice(1).filter((part) => part.kind === 'where'),
      limitValue: parts.find((part) => part.kind === 'limit')?.value,
    };
  }

  function applyValue(previous, next) {
    if (next?.__op === 'serverTimestamp') return new Date(now);
    if (next?.__op === 'increment') return (typeof previous === 'number' ? previous : 0) + next.by;
    return clone(next);
  }

  function mergeDoc(previous = {}, patch = {}) {
    const merged = { ...previous };
    for (const [key, value] of Object.entries(patch)) {
      merged[key] = applyValue(previous[key], value);
    }
    return merged;
  }

  function queryDocs(queryRef) {
    let docs = [...collectionMap(queryRef.collection).entries()].map(([id, data]) => ({ id, data: clone(data) }));
    for (const filter of queryRef.filters) {
      docs = docs.filter((doc) => doc.data?.[filter.field] === filter.value);
    }
    if (queryRef.limitValue) docs = docs.slice(0, queryRef.limitValue);
    return docs;
  }

  const firestoreModule = {
    collection(_db, name) {
      return { kind: 'collection', name };
    },
    doc(_db, collection, id) {
      return { kind: 'doc', collection, id };
    },
    where(field, op, value) {
      return { kind: 'where', field, op, value };
    },
    limit(value) {
      return { kind: 'limit', value };
    },
    query(...parts) {
      return normalizeQueryParts(parts);
    },
    serverTimestamp() {
      return { __op: 'serverTimestamp' };
    },
    increment(by) {
      return { __op: 'increment', by };
    },
    async getDoc(ref) {
      const data = collectionMap(ref.collection).get(ref.id);
      return {
        id: ref.id,
        exists: () => data !== undefined,
        data: () => clone(data),
      };
    },
    async setDoc(ref, data, options = {}) {
      const docs = collectionMap(ref.collection);
      const previous = docs.get(ref.id);
      const next = options.merge ? mergeDoc(previous, data) : mergeDoc({}, data);
      docs.set(ref.id, next);
      writes.push({ type: 'setDoc', ref, data: clone(next), merge: Boolean(options.merge) });
    },
    async getDocs(queryRef) {
      const docs = queryDocs(queryRef);
      return {
        empty: docs.length === 0,
        docs: docs.map((doc) => ({ id: doc.id, data: () => clone(doc.data) })),
      };
    },
    onSnapshot(queryRef, callback) {
      const docs = queryDocs(queryRef);
      callback({ docs: docs.map((doc) => ({ id: doc.id, data: () => clone(doc.data) })) });
      return () => {};
    },
  };

  return {
    services: { db: {}, firestoreModule },
    writes,
    read(collection, id) {
      return clone(collectionMap(collection).get(id));
    },
  };
}

describe('dishes repository', () => {
  it('maps dish records with normalized scope, source and member defaults', () => {
    assert.deepEqual(
      mapDish('dish-1', {
        name: 'Arroz',
        normalizedName: 'arroz',
        groupId: 'group-1',
        createdBy: 'user-1',
        tags: ['rice', 9],
        quickTags: ['cheap', false],
      }),
      {
        id: 'dish-1',
        name: 'Arroz',
        normalizedName: 'arroz',
        scope: 'group',
        source: 'group',
        groupId: 'group-1',
        createdBy: 'user-1',
        members: ['user-1'],
        isGlobal: false,
        editable: true,
        timesUsed: 0,
        tags: ['rice'],
        quickTags: ['cheap'],
        favorite: false,
        blocked: false,
        archived: false,
        archivedAt: undefined,
        duplicatedFrom: undefined,
        createdAt: undefined,
        lastUsedAt: undefined,
        updatedAt: undefined,
      }
    );
  });

  it('blocks manual creation when a global duplicate already exists', async () => {
    const { services, writes } = createFirestoreHarness({
      dishes: {
        global_sopa: {
          name: 'Sopa',
          normalizedName: 'sopa',
          scope: 'global',
          isGlobal: true,
          editable: false,
          createdBy: 'admin',
        },
      },
    });

    await assert.rejects(() => createManualDish(services, 'user-1', 'Sopa'), /dish-duplicate-global/);
    assert.equal(writes.length, 0);
  });

  it('registers menu dish usage by creating a local dish when no duplicate exists', async () => {
    const { services, read } = createFirestoreHarness();

    await recordMenuDishUsage(services, 'user-1', '  Lentejas   con verduras  ', 'group-1');

    assert.deepEqual(read('dishes', 'group_group-1_lentejas_20con_20verduras'), {
      name: 'Lentejas con verduras',
      normalizedName: 'lentejas con verduras',
      scope: 'group',
      groupId: 'group-1',
      source: 'menu',
      isGlobal: false,
      editable: true,
      createdBy: 'user-1',
      members: ['user-1'],
      timesUsed: 1,
      favorite: false,
      blocked: false,
      archived: false,
      archivedAt: null,
      tags: [],
      quickTags: [],
      duplicatedFrom: null,
      createdAt: new Date('2026-05-16T08:00:00.000Z'),
      lastUsedAt: new Date('2026-05-16T08:00:00.000Z'),
      updatedAt: new Date('2026-05-16T08:00:00.000Z'),
    });
  });

  it('registers global dish menu usage in an own document without mutating the global catalog', async () => {
    const globalDishId = createGlobalDishId('lasana');
    const { services, read } = createFirestoreHarness({
      dishes: {
        [globalDishId]: {
          name: 'Lasaña',
          normalizedName: 'lasana',
          scope: 'global',
          source: 'admin',
          isGlobal: true,
          editable: false,
          createdBy: 'admin-1',
          timesUsed: 7,
          archived: false,
          tags: ['pasta'],
          quickTags: ['kids'],
          createdAt: new Date('2026-05-01T08:00:00.000Z'),
        },
      },
    });

    await recordMenuDishUsage(services, 'user-1', 'Lasaña', 'group-1');

    assert.deepEqual(read('dishes', globalDishId), {
      name: 'Lasaña',
      normalizedName: 'lasana',
      scope: 'global',
      source: 'admin',
      isGlobal: true,
      editable: false,
      createdBy: 'admin-1',
      timesUsed: 7,
      archived: false,
      tags: ['pasta'],
      quickTags: ['kids'],
      createdAt: new Date('2026-05-01T08:00:00.000Z'),
    });
    assert.deepEqual(read('dishes', 'group_group-1_lasana'), {
      name: 'Lasaña',
      normalizedName: 'lasana',
      scope: 'group',
      groupId: 'group-1',
      source: 'duplicated-global',
      isGlobal: false,
      editable: true,
      createdBy: 'user-1',
      members: ['user-1'],
      timesUsed: 1,
      favorite: false,
      blocked: false,
      archived: false,
      archivedAt: null,
      tags: ['pasta'],
      quickTags: ['kids'],
      duplicatedFrom: globalDishId,
      createdAt: new Date('2026-05-16T08:00:00.000Z'),
      lastUsedAt: new Date('2026-05-16T08:00:00.000Z'),
      updatedAt: new Date('2026-05-16T08:00:00.000Z'),
    });
  });

  it('restores archived own dishes and preserves their custom metadata on menu usage', async () => {
    const { services, read } = createFirestoreHarness({
      dishes: {
        'user_user-1_pasta': {
          name: 'Pasta',
          normalizedName: 'pasta',
          scope: 'user',
          source: 'manual',
          createdBy: 'user-1',
          members: ['user-1'],
          timesUsed: 3,
          favorite: true,
          blocked: true,
          archived: true,
          archivedAt: new Date('2026-05-10T08:00:00.000Z'),
          quickTags: ['kids'],
          tags: ['italian'],
          createdAt: new Date('2026-05-01T08:00:00.000Z'),
        },
      },
    });

    await recordMenuDishUsage(services, 'user-1', 'Pasta');

    assert.deepEqual(read('dishes', 'user_user-1_pasta'), {
      name: 'Pasta',
      normalizedName: 'pasta',
      scope: 'user',
      groupId: null,
      source: 'manual',
      isGlobal: false,
      editable: true,
      createdBy: 'user-1',
      members: ['user-1'],
      timesUsed: 4,
      favorite: true,
      blocked: true,
      archived: false,
      archivedAt: null,
      tags: ['italian'],
      quickTags: ['kids'],
      duplicatedFrom: null,
      createdAt: new Date('2026-05-01T08:00:00.000Z'),
      lastUsedAt: new Date('2026-05-16T08:00:00.000Z'),
      updatedAt: new Date('2026-05-16T08:00:00.000Z'),
    });
  });

  it('reuses the centralized watch logic for global and own dishes', async () => {
    const { services } = createFirestoreHarness({
      dishes: {
        global_arroz: {
          name: 'Arroz',
          normalizedName: 'arroz',
          scope: 'global',
          isGlobal: true,
          editable: false,
          createdBy: 'admin',
          timesUsed: 1,
        },
        'user_user-1_lentejas': {
          name: 'Lentejas',
          normalizedName: 'lentejas',
          scope: 'user',
          createdBy: 'user-1',
          source: 'manual',
          editable: true,
          timesUsed: 4,
          favorite: true,
        },
        'user_user-1_archivada': {
          name: 'Archivada',
          normalizedName: 'archivada',
          scope: 'user',
          createdBy: 'user-1',
          archived: true,
        },
      },
    });

    let captured = [];
    watchUserDishes(services, 'user-1', (dishes) => {
      captured = dishes;
    }, () => {});

    assert.deepEqual(captured.map((dish) => dish.name), ['Lentejas', 'Arroz']);
  });
});
