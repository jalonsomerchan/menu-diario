import type { Dish, DishScope, DishSource } from '../menu/types';
import { getDishId, getDuplicateDish, isEditableDish, normalizeDishName, sortDishes } from './helpers.mjs';

type FirebaseServices = {
  db: any;
  firestoreModule: any;
};

const dishesCollection = 'dishes';
const globalScope: DishScope = 'global';
const groupScope: DishScope = 'group';

function toDate(value: any): Date | undefined {
  return value?.toDate?.() ?? value;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeScope(data: Record<string, any>): DishScope {
  if (data.scope === globalScope || data.isGlobal === true) return globalScope;
  if (data.scope === groupScope || data.groupId) return groupScope;
  return 'user';
}

function normalizeSource(data: Record<string, any>, scope: DishScope): DishSource {
  if (data.source) return data.source;
  if (scope === globalScope) return 'admin';
  if (scope === groupScope) return 'group';
  return 'legacy';
}

function mapDish(id: string, data: Record<string, any>): Dish {
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

function subscribeToDishQuery(
  services: FirebaseServices,
  query: any,
  onChange: (dishes: Dish[]) => void,
  onError: (error: Error) => void
) {
  const { firestoreModule } = services;
  return firestoreModule.onSnapshot(
    query,
    (snapshot: any) => onChange(snapshot.docs.map((item: any) => mapDish(item.id, item.data()))),
    onError
  );
}

function mergeDishLists(lists: Dish[][], includeArchived: boolean) {
  const merged = new Map<string, Dish>();
  lists.flat().forEach((dish) => {
    if (!includeArchived && dish.archived) return;
    merged.set(dish.id, dish);
  });
  return sortDishes([...merged.values()], 'most-used') as Dish[];
}

async function findVisibleDuplicate(
  services: FirebaseServices,
  normalizedName: string,
  groupId?: string,
  excludeId?: string
) {
  const { db, firestoreModule } = services;
  const globalSnapshot = await firestoreModule.getDocs(
    firestoreModule.query(
      firestoreModule.collection(db, dishesCollection),
      firestoreModule.where('scope', '==', globalScope),
      firestoreModule.where('normalizedName', '==', normalizedName),
      firestoreModule.limit(1)
    )
  );
  const globalDish = globalSnapshot.docs.map((item: any) => mapDish(item.id, item.data())).find((dish: Dish) => dish.id !== excludeId && !dish.archived);

  if (globalDish) return globalDish;
  if (!groupId) return undefined;

  const groupSnapshot = await firestoreModule.getDocs(
    firestoreModule.query(
      firestoreModule.collection(db, dishesCollection),
      firestoreModule.where('scope', '==', groupScope),
      firestoreModule.where('groupId', '==', groupId),
      firestoreModule.where('normalizedName', '==', normalizedName),
      firestoreModule.limit(1)
    )
  );

  return groupSnapshot.docs.map((item: any) => mapDish(item.id, item.data())).find((dish: Dish) => dish.id !== excludeId && !dish.archived);
}

export function watchCatalogDishes(
  services: FirebaseServices,
  options: { userId: string; groupId?: string; includeArchived?: boolean },
  callback: (dishes: Dish[]) => void,
  onError: (error: Error) => void
) {
  const { db, firestoreModule } = services;
  const includeArchived = Boolean(options.includeArchived);
  const lists: Dish[][] = [[], []];
  const emit = () => callback(mergeDishLists(lists, includeArchived));

  const globalQuery = firestoreModule.query(
    firestoreModule.collection(db, dishesCollection),
    firestoreModule.where('scope', '==', globalScope),
    firestoreModule.limit(150)
  );

  const groupQuery = options.groupId
    ? firestoreModule.query(
        firestoreModule.collection(db, dishesCollection),
        firestoreModule.where('scope', '==', groupScope),
        firestoreModule.where('groupId', '==', options.groupId),
        firestoreModule.limit(150)
      )
    : firestoreModule.query(
        firestoreModule.collection(db, dishesCollection),
        firestoreModule.where('createdBy', '==', options.userId),
        firestoreModule.limit(150)
      );

  const unsubGlobal = subscribeToDishQuery(
    services,
    globalQuery,
    (dishes) => {
      lists[0] = dishes;
      emit();
    },
    onError
  );
  const unsubGroup = subscribeToDishQuery(
    services,
    groupQuery,
    (dishes) => {
      lists[1] = dishes;
      emit();
    },
    onError
  );

  return () => {
    unsubGlobal();
    unsubGroup();
  };
}

export function watchUserDishes(
  services: FirebaseServices,
  userId: string,
  callback: (dishes: Dish[]) => void,
  onError: (error: Error) => void,
  includeArchived = false,
  groupId?: string
) {
  return watchCatalogDishes(services, { userId, groupId, includeArchived }, callback, onError);
}

export async function createManualDish(services: FirebaseServices, userId: string, name: string, groupId?: string) {
  const cleanName = name.trim().replace(/\s+/g, ' ');
  const normalizedName = normalizeDishName(cleanName);

  if (normalizedName.length < 2) throw new Error('dish-invalid-name');

  const { db, firestoreModule } = services;
  const ownerId = groupId || userId;
  const dishRef = firestoreModule.doc(db, dishesCollection, getDishId(ownerId, normalizedName, groupScope));
  const snapshot = await firestoreModule.getDoc(dishRef);
  const duplicate = snapshot.exists() && !snapshot.data().archived ? mapDish(snapshot.id, snapshot.data()) : await findVisibleDuplicate(services, normalizedName, groupId);

  if (duplicate && duplicate.id !== dishRef.id) throw new Error(duplicate.isGlobal ? 'dish-duplicate-global' : 'dish-duplicate');
  if (snapshot.exists() && !snapshot.data().archived) throw new Error('dish-duplicate');

  await firestoreModule.setDoc(
    dishRef,
    {
      name: cleanName,
      normalizedName,
      scope: groupScope,
      groupId: groupId ?? null,
      source: 'manual',
      isGlobal: false,
      editable: true,
      createdBy: userId,
      members: [userId],
      timesUsed: snapshot.exists() ? snapshot.data().timesUsed ?? 0 : 0,
      favorite: snapshot.exists() ? Boolean(snapshot.data().favorite) : false,
      blocked: snapshot.exists() ? Boolean(snapshot.data().blocked) : false,
      archived: false,
      archivedAt: null,
      tags: snapshot.exists() ? toStringArray(snapshot.data().tags) : [],
      quickTags: snapshot.exists() ? toStringArray(snapshot.data().quickTags) : [],
      createdAt: snapshot.exists() ? snapshot.data().createdAt : firestoreModule.serverTimestamp(),
      updatedAt: firestoreModule.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function duplicateGlobalDish(services: FirebaseServices, userId: string, dish: Dish, groupId?: string) {
  if (!dish.isGlobal) throw new Error('dish-not-global');

  const duplicate = await findVisibleDuplicate(services, dish.normalizedName, groupId, dish.id);
  if (duplicate && !duplicate.isGlobal) throw new Error('dish-duplicate');

  const { db, firestoreModule } = services;
  const ownerId = groupId || userId;
  await firestoreModule.setDoc(
    firestoreModule.doc(db, dishesCollection, getDishId(ownerId, dish.normalizedName, groupScope)),
    {
      name: dish.name,
      normalizedName: dish.normalizedName,
      scope: groupScope,
      groupId: groupId ?? null,
      source: 'duplicated-global',
      isGlobal: false,
      editable: true,
      createdBy: userId,
      members: [userId],
      timesUsed: 0,
      favorite: Boolean(dish.favorite),
      blocked: false,
      archived: false,
      archivedAt: null,
      tags: dish.tags ?? [],
      quickTags: dish.quickTags ?? [],
      duplicatedFrom: dish.id,
      createdAt: firestoreModule.serverTimestamp(),
      updatedAt: firestoreModule.serverTimestamp(),
    },
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
    const duplicate = await findVisibleDuplicate(services, normalizedName, groupId, dish.id);
    if (duplicate) throw new Error(duplicate.isGlobal ? 'dish-duplicate-global' : 'dish-duplicate');

    const ownerId = groupId || userId;
    const nextRef = firestoreModule.doc(db, dishesCollection, getDishId(ownerId, normalizedName, groupScope));

    await firestoreModule.setDoc(
      nextRef,
      {
        name: cleanName,
        normalizedName,
        scope: groupScope,
        groupId: groupId ?? null,
        source: dish.source ?? 'group',
        isGlobal: false,
        editable: true,
        createdBy: userId,
        members: dish.members?.length ? dish.members : [userId],
        timesUsed: dish.timesUsed ?? 0,
        tags: dish.tags ?? [],
        quickTags: dish.quickTags ?? [],
        favorite: Boolean(dish.favorite),
        blocked: Boolean(dish.blocked),
        archived: false,
        archivedAt: null,
        createdAt: dish.createdAt ?? firestoreModule.serverTimestamp(),
        lastUsedAt: dish.lastUsedAt ?? null,
        duplicatedFrom: dish.duplicatedFrom ?? null,
        updatedAt: firestoreModule.serverTimestamp(),
      },
      { merge: true }
    );
    await archiveDish(services, dish.id);
    return;
  }

  await firestoreModule.setDoc(
    firestoreModule.doc(db, dishesCollection, dish.id),
    {
      name: cleanName,
      normalizedName,
      updatedAt: firestoreModule.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function updateDishPreferences(
  services: FirebaseServices,
  dishId: string,
  preferences: { favorite?: boolean; blocked?: boolean; quickTags?: string[] }
) {
  const { db, firestoreModule } = services;
  const dishRef = firestoreModule.doc(db, dishesCollection, dishId);
  const snapshot = await firestoreModule.getDoc(dishRef);
  if (!snapshot.exists() || !isEditableDish(mapDish(snapshot.id, snapshot.data()))) throw new Error('dish-not-editable');

  await firestoreModule.setDoc(
    dishRef,
    {
      ...preferences,
      updatedAt: firestoreModule.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function archiveDish(services: FirebaseServices, dishId: string) {
  const { db, firestoreModule } = services;
  const dishRef = firestoreModule.doc(db, dishesCollection, dishId);
  const snapshot = await firestoreModule.getDoc(dishRef);
  if (!snapshot.exists() || !isEditableDish(mapDish(snapshot.id, snapshot.data()))) throw new Error('dish-not-editable');

  await firestoreModule.setDoc(
    dishRef,
    {
      archived: true,
      archivedAt: firestoreModule.serverTimestamp(),
      updatedAt: firestoreModule.serverTimestamp(),
    },
    { merge: true }
  );
}

export function findDuplicateDish(dishes: Dish[], name: string, excludeId?: string) {
  return getDuplicateDish(dishes, normalizeDishName(name), { excludeId });
}
