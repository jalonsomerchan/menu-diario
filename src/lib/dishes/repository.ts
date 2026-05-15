import type { Dish } from '../menu/types';
import { getDishId, normalizeDishName, sortDishes } from './helpers.mjs';

type FirebaseServices = {
  db: any;
  firestoreModule: any;
};

const dishesCollection = 'dishes';

function toDate(value: any): Date | undefined {
  return value?.toDate?.() ?? value;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function mapDish(id: string, data: Record<string, any>): Dish {
  return {
    id,
    name: data.name,
    normalizedName: data.normalizedName,
    createdBy: data.createdBy,
    members: data.members ?? [data.createdBy].filter(Boolean),
    timesUsed: data.timesUsed ?? 0,
    tags: toStringArray(data.tags),
    quickTags: toStringArray(data.quickTags),
    favorite: Boolean(data.favorite),
    blocked: Boolean(data.blocked),
    archived: Boolean(data.archived),
    createdAt: toDate(data.createdAt),
    lastUsedAt: toDate(data.lastUsedAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function watchUserDishes(
  services: FirebaseServices,
  userId: string,
  callback: (dishes: Dish[]) => void,
  onError: (error: Error) => void,
  includeArchived = false
) {
  const { db, firestoreModule } = services;
  const dishesQuery = firestoreModule.query(
    firestoreModule.collection(db, dishesCollection),
    firestoreModule.where('createdBy', '==', userId),
    firestoreModule.limit(150)
  );

  return firestoreModule.onSnapshot(
    dishesQuery,
    (snapshot: any) => {
      const dishes = snapshot.docs
        .map((item: any) => mapDish(item.id, item.data()))
        .filter((dish: Dish) => includeArchived || !dish.archived);
      callback(sortDishes(dishes, 'most-used') as Dish[]);
    },
    onError
  );
}

export async function createManualDish(services: FirebaseServices, userId: string, name: string) {
  const cleanName = name.trim().replace(/\s+/g, ' ');
  const normalizedName = normalizeDishName(cleanName);

  if (normalizedName.length < 2) throw new Error('dish-invalid-name');

  const { db, firestoreModule } = services;
  const dishRef = firestoreModule.doc(db, dishesCollection, getDishId(userId, normalizedName));
  const snapshot = await firestoreModule.getDoc(dishRef);

  if (snapshot.exists() && !snapshot.data().archived) throw new Error('dish-duplicate');

  await firestoreModule.setDoc(
    dishRef,
    {
      name: cleanName,
      normalizedName,
      createdBy: userId,
      members: [userId],
      timesUsed: snapshot.exists() ? snapshot.data().timesUsed ?? 0 : 0,
      favorite: snapshot.exists() ? Boolean(snapshot.data().favorite) : false,
      blocked: snapshot.exists() ? Boolean(snapshot.data().blocked) : false,
      archived: false,
      tags: snapshot.exists() ? toStringArray(snapshot.data().tags) : [],
      quickTags: snapshot.exists() ? toStringArray(snapshot.data().quickTags) : [],
      createdAt: snapshot.exists() ? snapshot.data().createdAt : firestoreModule.serverTimestamp(),
      updatedAt: firestoreModule.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function renameDish(services: FirebaseServices, userId: string, dish: Dish, nextName: string) {
  const cleanName = nextName.trim().replace(/\s+/g, ' ');
  const normalizedName = normalizeDishName(cleanName);

  if (normalizedName.length < 2) throw new Error('dish-invalid-name');

  const { db, firestoreModule } = services;

  if (normalizedName !== dish.normalizedName) {
    const nextRef = firestoreModule.doc(db, dishesCollection, getDishId(userId, normalizedName));
    const duplicate = await firestoreModule.getDoc(nextRef);

    if (duplicate.exists() && !duplicate.data().archived) throw new Error('dish-duplicate');

    await firestoreModule.setDoc(
      nextRef,
      {
        name: cleanName,
        normalizedName,
        createdBy: userId,
        members: dish.members?.length ? dish.members : [userId],
        timesUsed: dish.timesUsed ?? 0,
        tags: dish.tags ?? [],
        quickTags: dish.quickTags ?? [],
        favorite: Boolean(dish.favorite),
        blocked: Boolean(dish.blocked),
        archived: false,
        createdAt: dish.createdAt ?? firestoreModule.serverTimestamp(),
        lastUsedAt: dish.lastUsedAt ?? null,
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
  await firestoreModule.setDoc(
    firestoreModule.doc(db, dishesCollection, dishId),
    {
      ...preferences,
      updatedAt: firestoreModule.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function archiveDish(services: FirebaseServices, dishId: string) {
  const { db, firestoreModule } = services;
  await firestoreModule.setDoc(
    firestoreModule.doc(db, dishesCollection, dishId),
    {
      archived: true,
      updatedAt: firestoreModule.serverTimestamp(),
    },
    { merge: true }
  );
}
