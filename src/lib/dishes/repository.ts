import type { Dish, DishScope, DishSource } from '../menu/types';
import { getDishId, getDuplicateDish, isEditableDish, normalizeDishName, sortDishes } from './helpers.mjs';

type FirebaseServices = { db: any; firestoreModule: any };

const dishesCollection = 'dishes';
const globalScope: DishScope = 'global';
const groupScope: DishScope = 'group';
const userScope: DishScope = 'user';

function toDate(value: any): Date | undefined { return value?.toDate?.() ?? value; }
function toStringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }
function ownScope(groupId?: string): DishScope { return groupId ? groupScope : userScope; }
function ownOwnerId(userId: string, groupId?: string) { return groupId || userId; }

function normalizeScope(data: Record<string, any>): DishScope {
  if (data.scope === globalScope || data.isGlobal === true) return globalScope;
  if (data.scope === groupScope || data.groupId) return groupScope;
  return userScope;
}

function normalizeSource(data: Record<string, any>, scope: DishScope): DishSource {
  if (data.source) return data.source;
  if (scope === globalScope) return 'admin';
  if (scope === groupScope) return 'group';
  return 'legacy';
}

export function mapDish(id: string, data: Record<string, any>): Dish {
  const scope = normalizeScope(data);
  const isGlobal = scope === globalScope;
  return {
    id,
    name: data.name,
    normalizedName: data.normalizedName,
    scope,
    source: normalizeSource(data, scope),
    groupId: data.groupId,
    createdBy: data.createdBy,
    members: toStringArray(data.members).length ? toStringArray(data.members) : [data.createdBy].filter(Boolean),
    isGlobal,
    editable: data.editable ?? !isGlobal,
    timesUsed: data.timesUsed ?? 0,
    tags: toStringArray(data.tags),
    quickTags: toStringArray(data.quickTags),
    favorite: Boolean(data.favorite),
    blocked: Boolean(data.blocked),
    archived: Boolean(data.archived),
    archivedAt: toDate(data.archivedAt),
    duplicatedFrom: data.duplicatedFrom,
    createdAt: toDate(data.createdAt),
    lastUsedAt: toDate(data.lastUsedAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function ownQuery(services: FirebaseServices, userId: string, groupId?: string) {
  const { db, firestoreModule } = services;
  return groupId
    ? firestoreModule.query(firestoreModule.collection(db, dishesCollection), firestoreModule.where('scope', '==', groupScope), firestoreModule.where('groupId', '==', groupId), firestoreModule.limit(150))
    : firestoreModule.query(firestoreModule.collection(db, dishesCollection), firestoreModule.where('createdBy', '==', userId), firestoreModule.limit(150));
}

function ownDishRef(services: FirebaseServices, userId: string, normalizedName: string, groupId?: string) {
  const { db, firestoreModule } = services;
  return firestoreModule.doc(db, dishesCollection, getDishId(ownOwnerId(userId, groupId), normalizedName, ownScope(groupId)));
}

function ownDishPayload(
  services: FirebaseServices,
  input: {
    userId: string;
    groupId?: string;
    cleanName: string;
    normalizedName: string;
    source: DishSource;
    existing?: Record<string, any>;
    preserveSource?: boolean;
    timesUsed: number | any;
    lastUsedAt?: Date | any | null;
    favorite?: boolean;
    blocked?: boolean;
    archived?: boolean;
    archivedAt?: Date | any | null;
    tags?: string[];
    quickTags?: string[];
    duplicatedFrom?: string | null;
  }
) {
  const { firestoreModule } = services;
  const scope = ownScope(input.groupId);
  const existing = input.existing ?? {};

  return {
    name: input.cleanName,
    normalizedName: input.normalizedName,
    scope,
    groupId: input.groupId ?? null,
    source: input.preserveSource ? normalizeSource(existing, scope) : input.source,
    isGlobal: false,
    editable: true,
    createdBy: input.userId,
    members: toStringArray(existing.members).length ? toStringArray(existing.members) : [input.userId],
    timesUsed: input.timesUsed,
    favorite: input.favorite ?? Boolean(existing.favorite),
    blocked: input.blocked ?? Boolean(existing.blocked),
    archived: input.archived ?? false,
    archivedAt: input.archivedAt ?? null,
    tags: input.tags ?? toStringArray(existing.tags),
    quickTags: input.quickTags ?? toStringArray(existing.quickTags),
    duplicatedFrom: input.duplicatedFrom ?? existing.duplicatedFrom ?? null,
    createdAt: existing.createdAt ?? firestoreModule.serverTimestamp(),
    lastUsedAt: input.lastUsedAt ?? existing.lastUsedAt ?? null,
    updatedAt: firestoreModule.serverTimestamp(),
  };
}

function subscribeToDishQuery(services: FirebaseServices, query: any, onChange: (dishes: Dish[]) => void, onError: (error: Error) => void) {
  const { firestoreModule } = services;
  return firestoreModule.onSnapshot(query, (snapshot: any) => onChange(snapshot.docs.map((item: any) => mapDish(item.id, item.data()))), onError);
}

function mergeDishLists(lists: Dish[][], includeArchived: boolean) {
  const merged = new Map<string, Dish>();
  lists.flat().forEach((dish) => {
    if (!includeArchived && dish.archived) return;
    merged.set(dish.id, dish);
  });
  return sortDishes([...merged.values()], 'most-used') as Dish[];
}

async function getFirstDishByQuery(services: FirebaseServices, query: any, excludeId?: string) {
  const snapshot = await services.firestoreModule.getDocs(query);
  return snapshot.docs.map((item: any) => mapDish(item.id, item.data())).find((dish: Dish) => dish.id !== excludeId && !dish.archived);
}

async function findGlobalDuplicate(services: FirebaseServices, normalizedName: string, excludeId?: string) {
  const { db, firestoreModule } = services;
  return getFirstDishByQuery(
    services,
    firestoreModule.query(firestoreModule.collection(db, dishesCollection), firestoreModule.where('scope', '==', globalScope), firestoreModule.where('normalizedName', '==', normalizedName), firestoreModule.limit(1)),
    excludeId
  );
}

async function findOwnDuplicate(services: FirebaseServices, normalizedName: string, groupId?: string, userId?: string, excludeId?: string) {
  const { firestoreModule } = services;
  const filteredQuery = firestoreModule.query(ownQuery(services, userId ?? '', groupId), firestoreModule.where('normalizedName', '==', normalizedName), firestoreModule.limit(1));
  return getFirstDishByQuery(services, filteredQuery, excludeId);
}

async function findVisibleDuplicate(services: FirebaseServices, normalizedName: string, groupId?: string, userId?: string, excludeId?: string) {
  return (await findGlobalDuplicate(services, normalizedName, excludeId)) ?? findOwnDuplicate(services, normalizedName, groupId, userId, excludeId);
}

export function watchCatalogDishes(services: FirebaseServices, options: { userId: string; groupId?: string; includeArchived?: boolean }, callback: (dishes: Dish[]) => void, onError: (error: Error) => void) {
  const { db, firestoreModule } = services;
  const includeArchived = Boolean(options.includeArchived);
  const lists: Dish[][] = [[], []];
  const emit = () => callback(mergeDishLists(lists, includeArchived));
  const globalQuery = firestoreModule.query(firestoreModule.collection(db, dishesCollection), firestoreModule.where('scope', '==', globalScope), firestoreModule.limit(150));
  const ownScopedQuery = ownQuery(services, options.userId, options.groupId);
  const unsubGlobal = subscribeToDishQuery(services, globalQuery, (dishes) => { lists[0] = dishes; emit(); }, onError);
  const unsubOwn = subscribeToDishQuery(services, ownScopedQuery, (dishes) => { lists[1] = dishes; emit(); }, onError);
  return () => { unsubGlobal(); unsubOwn(); };
}

export function watchUserDishes(services: FirebaseServices, userId: string, callback: (dishes: Dish[]) => void, onError: (error: Error) => void, includeArchived = false, groupId?: string) {
  return watchCatalogDishes(services, { userId, groupId, includeArchived }, callback, onError);
}

export async function createManualDish(services: FirebaseServices, userId: string, name: string, groupId?: string) {
  const cleanName = name.trim().replace(/\s+/g, ' ');
  const normalizedName = normalizeDishName(cleanName);
  if (normalizedName.length < 2) throw new Error('dish-invalid-name');
  const { firestoreModule } = services;
  const dishRef = ownDishRef(services, userId, normalizedName, groupId);
  const snapshot = await firestoreModule.getDoc(dishRef);
  const duplicate = snapshot.exists() && !snapshot.data().archived ? mapDish(snapshot.id, snapshot.data()) : await findVisibleDuplicate(services, normalizedName, groupId, userId);
  if (duplicate && duplicate.id !== dishRef.id) throw new Error(duplicate.isGlobal ? 'dish-duplicate-global' : 'dish-duplicate');
  if (snapshot.exists() && !snapshot.data().archived) throw new Error('dish-duplicate');
  await firestoreModule.setDoc(
    dishRef,
    ownDishPayload(services, {
      userId,
      groupId,
      cleanName,
      normalizedName,
      source: 'manual',
      existing: snapshot.exists() ? snapshot.data() : undefined,
      timesUsed: snapshot.exists() ? snapshot.data().timesUsed ?? 0 : 0,
      archived: false,
      archivedAt: null,
    }),
    { merge: true }
  );
}

export async function recordMenuDishUsage(services: FirebaseServices, userId: string, name: string, groupId?: string) {
  const cleanName = name.trim().replace(/\s+/g, ' ');
  if (!cleanName) return;

  const { firestoreModule } = services;
  const normalizedName = normalizeDishName(cleanName);
  const dishRef = ownDishRef(services, userId, normalizedName, groupId);
  const snapshot = await firestoreModule.getDoc(dishRef);

  if (snapshot.exists()) {
    await firestoreModule.setDoc(
      dishRef,
      ownDishPayload(services, {
        userId,
        groupId,
        cleanName,
        normalizedName,
        source: 'menu',
        existing: snapshot.data(),
        preserveSource: true,
        timesUsed: firestoreModule.increment(1),
        lastUsedAt: firestoreModule.serverTimestamp(),
        archived: false,
        archivedAt: null,
      }),
      { merge: true }
    );
    return;
  }

  if (await findGlobalDuplicate(services, normalizedName)) return;

  await firestoreModule.setDoc(
    dishRef,
    ownDishPayload(services, {
      userId,
      groupId,
      cleanName,
      normalizedName,
      source: 'menu',
      timesUsed: 1,
      lastUsedAt: firestoreModule.serverTimestamp(),
      archived: false,
      archivedAt: null,
      tags: [],
      quickTags: [],
    }),
    { merge: true }
  );
}

export async function duplicateGlobalDish(services: FirebaseServices, userId: string, dish: Dish, groupId?: string) {
  if (!dish.isGlobal) throw new Error('dish-not-global');
  const ownDuplicate = await findOwnDuplicate(services, dish.normalizedName, groupId, userId, dish.id);
  if (ownDuplicate) throw new Error('dish-duplicate');
  const { firestoreModule } = services;
  await firestoreModule.setDoc(
    ownDishRef(services, userId, dish.normalizedName, groupId),
    ownDishPayload(services, {
      userId,
      groupId,
      cleanName: dish.name,
      normalizedName: dish.normalizedName,
      source: 'duplicated-global',
      timesUsed: 0,
      favorite: Boolean(dish.favorite),
      blocked: false,
      archived: false,
      archivedAt: null,
      tags: dish.tags ?? [],
      quickTags: dish.quickTags ?? [],
      duplicatedFrom: dish.id,
    }),
    { merge: true }
  );
}

export async function renameDish(services: FirebaseServices, userId: string, dish: Dish, nextName: string) {
  if (!isEditableDish(dish)) throw new Error('dish-not-editable');
  const cleanName = nextName.trim().replace(/\s+/g, ' ');
  const normalizedName = normalizeDishName(cleanName);
  if (normalizedName.length < 2) throw new Error('dish-invalid-name');
  const { db, firestoreModule } = services;
  const groupId = dish.groupId;
  if (normalizedName !== dish.normalizedName) {
    const duplicate = await findVisibleDuplicate(services, normalizedName, groupId, userId, dish.id);
    if (duplicate) throw new Error(duplicate.isGlobal ? 'dish-duplicate-global' : 'dish-duplicate');
    const nextRef = ownDishRef(services, userId, normalizedName, groupId);
    await firestoreModule.setDoc(
      nextRef,
      ownDishPayload(services, {
        userId,
        groupId,
        cleanName,
        normalizedName,
        source: dish.source ?? 'group',
        timesUsed: dish.timesUsed ?? 0,
        favorite: Boolean(dish.favorite),
        blocked: Boolean(dish.blocked),
        archived: false,
        archivedAt: null,
        tags: dish.tags ?? [],
        quickTags: dish.quickTags ?? [],
        duplicatedFrom: dish.duplicatedFrom ?? null,
        lastUsedAt: dish.lastUsedAt ?? null,
        existing: {
          members: dish.members,
          createdAt: dish.createdAt,
        },
      }),
      { merge: true }
    );
    await archiveDish(services, dish.id);
    return;
  }
  await firestoreModule.setDoc(firestoreModule.doc(db, dishesCollection, dish.id), { name: cleanName, normalizedName, updatedAt: firestoreModule.serverTimestamp() }, { merge: true });
}

export async function updateDishPreferences(services: FirebaseServices, dishId: string, preferences: { favorite?: boolean; blocked?: boolean; quickTags?: string[] }) {
  const { db, firestoreModule } = services;
  const dishRef = firestoreModule.doc(db, dishesCollection, dishId);
  const snapshot = await firestoreModule.getDoc(dishRef);
  if (!snapshot.exists() || !isEditableDish(mapDish(snapshot.id, snapshot.data()))) throw new Error('dish-not-editable');
  await firestoreModule.setDoc(dishRef, { ...preferences, updatedAt: firestoreModule.serverTimestamp() }, { merge: true });
}

export async function archiveDish(services: FirebaseServices, dishId: string) {
  const { db, firestoreModule } = services;
  const dishRef = firestoreModule.doc(db, dishesCollection, dishId);
  const snapshot = await firestoreModule.getDoc(dishRef);
  if (!snapshot.exists() || !isEditableDish(mapDish(snapshot.id, snapshot.data()))) throw new Error('dish-not-editable');
  await firestoreModule.setDoc(dishRef, { archived: true, archivedAt: firestoreModule.serverTimestamp(), updatedAt: firestoreModule.serverTimestamp() }, { merge: true });
}

export function findDuplicateDish(dishes: Dish[], name: string, excludeId?: string) {
  return getDuplicateDish(dishes, normalizeDishName(name), { excludeId });
}
