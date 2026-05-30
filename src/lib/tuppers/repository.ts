import { recordMenuDishUsage } from '../dishes/repository';
import { getMonday, toIsoDate } from '../menu/dates';
import { getOrCreateWeekMenu, updateMenuPatch } from '../menu/repository';
import type { Dish, FirebaseUser, UserProfile, WeekMenu } from '../menu/types';
import { getMealForAssignment, planTupperAssignment, removeTupperFromMealItems } from './assignment';
import { sortTuppersByPriority } from './expiry';
import type { TupperAssignment, TupperFormData, TupperItem, TupperLocation, TupperStatus } from './types';

const tuppersCollection = 'tuppers';

type FirebaseServices = {
  db: any;
  firestoreModule: any;
};

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase('es-ES').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function mapTupper(id: string, data: Record<string, any>): TupperItem {
  return {
    id,
    name: data.name ?? '',
    normalizedName: data.normalizedName ?? normalizeName(data.name ?? ''),
    dishId: data.dishId,
    createdBy: data.createdBy,
    groupId: data.groupId,
    members: stringArray(data.members),
    preparedAt: data.preparedAt,
    expiresAt: data.expiresAt,
    portions: typeof data.portions === 'number' ? data.portions : undefined,
    location: normalizeLocation(data.location),
    notes: data.notes ?? '',
    status: normalizeStatus(data.status),
    assignedMenuId: data.assignedMenuId,
    assignedDay: data.assignedDay,
    assignedMeal: data.assignedMeal,
    createdAt: data.createdAt?.toDate?.(),
    updatedAt: data.updatedAt?.toDate?.(),
  };
}

function normalizeLocation(value: unknown): TupperLocation {
  return value === 'fridge' || value === 'freezer' || value === 'other' ? value : '';
}

function normalizeStatus(value: unknown): TupperStatus {
  return value === 'assigned' || value === 'consumed' || value === 'discarded' || value === 'archived' ? value : 'active';
}

function subscribeToTupperQuery(
  services: FirebaseServices,
  query: any,
  onChange: (tuppers: TupperItem[]) => void,
  onError: (error: Error) => void
) {
  return services.firestoreModule.onSnapshot(
    query,
    (snapshot: any) => {
      onChange(snapshot.docs.map((item: any) => mapTupper(item.id, item.data())).sort(sortTuppersByPriority));
    },
    onError
  );
}

export function watchTuppers(
  services: FirebaseServices,
  userId: string,
  groupId: string | undefined,
  callback: (tuppers: TupperItem[]) => void,
  onError: (error: Error) => void
) {
  const { db, firestoreModule } = services;
  if (!groupId) {
    const ownQuery = firestoreModule.query(
      firestoreModule.collection(db, tuppersCollection),
      firestoreModule.where('members', 'array-contains', userId),
      firestoreModule.limit(80)
    );

    return subscribeToTupperQuery(services, ownQuery, callback, onError);
  }

  const tuppersBySource = new Map<'group' | 'legacy', TupperItem[]>([
    ['group', []],
    ['legacy', []],
  ]);
  const emit = () => {
    const merged = new Map<string, TupperItem>();
    tuppersBySource.forEach((items) => {
      items.forEach((tupper) => merged.set(tupper.id, tupper));
    });
    callback([...merged.values()].sort(sortTuppersByPriority));
  };

  const groupQuery = firestoreModule.query(
    firestoreModule.collection(db, tuppersCollection),
    firestoreModule.where('groupId', '==', groupId),
    firestoreModule.limit(120)
  );
  const legacyOwnQuery = firestoreModule.query(
    firestoreModule.collection(db, tuppersCollection),
    firestoreModule.where('members', 'array-contains', userId),
    firestoreModule.limit(80)
  );

  const unsubscribeGroup = subscribeToTupperQuery(
    services,
    groupQuery,
    (tuppers) => {
      tuppersBySource.set('group', tuppers);
      emit();
    },
    onError
  );
  const unsubscribeLegacy = subscribeToTupperQuery(
    services,
    legacyOwnQuery,
    (tuppers) => {
      tuppersBySource.set(
        'legacy',
        tuppers.filter((tupper) => !tupper.groupId)
      );
      emit();
    },
    onError
  );

  return () => {
    unsubscribeGroup();
    unsubscribeLegacy();
  };
}

export async function createTupper(
  services: FirebaseServices,
  user: FirebaseUser,
  profile: UserProfile | null,
  data: TupperFormData
) {
  const cleanName = data.name.trim();
  if (!cleanName || !data.preparedAt || !data.expiresAt) {
    throw new Error('invalid-tupper');
  }

  const { db, firestoreModule } = services;
  const normalizedName = normalizeName(cleanName);
  await recordMenuDishUsage(services, user.uid, cleanName);

  await firestoreModule.addDoc(firestoreModule.collection(db, tuppersCollection), {
    name: cleanName,
    normalizedName,
    dishId: data.dishId || '',
    createdBy: user.uid,
    groupId: profile?.groupId ?? null,
    members: [user.uid],
    preparedAt: data.preparedAt,
    expiresAt: data.expiresAt,
    portions: data.portions ?? null,
    location: data.location,
    notes: data.notes.trim(),
    status: 'active',
    createdAt: firestoreModule.serverTimestamp(),
    updatedAt: firestoreModule.serverTimestamp(),
  });
}

export async function updateTupper(
  services: FirebaseServices,
  user: FirebaseUser,
  tupper: TupperItem,
  data: TupperFormData
) {
  const cleanName = data.name.trim();
  if (!cleanName || !data.preparedAt || !data.expiresAt) {
    throw new Error('invalid-tupper');
  }

  const { db, firestoreModule } = services;
  const normalizedName = normalizeName(cleanName);

  await firestoreModule.updateDoc(firestoreModule.doc(db, tuppersCollection, tupper.id), {
    name: cleanName,
    normalizedName,
    dishId: data.dishId || '',
    preparedAt: data.preparedAt,
    expiresAt: data.expiresAt,
    portions: data.portions ?? null,
    location: data.location,
    notes: data.notes.trim(),
    updatedAt: firestoreModule.serverTimestamp(),
  });

  if (cleanName !== tupper.name) {
    await syncAssignedTupperName(services, tupper, cleanName, user.uid);
    await recordMenuDishUsage(services, user.uid, cleanName);
  }
}

export async function updateTupperState(
  services: FirebaseServices,
  tupper: TupperItem,
  patch: Partial<Pick<TupperItem, 'status' | 'location'>>
) {
  const { db, firestoreModule } = services;
  await firestoreModule.updateDoc(firestoreModule.doc(db, tuppersCollection, tupper.id), {
    ...patch,
    ...(patch.status && patch.status !== 'assigned'
      ? {
          assignedMenuId: firestoreModule.deleteField(),
          assignedDay: firestoreModule.deleteField(),
          assignedMeal: firestoreModule.deleteField(),
        }
      : {}),
    updatedAt: firestoreModule.serverTimestamp(),
  });
}

export async function assignTupperToMeal(
  services: FirebaseServices,
  user: FirebaseUser,
  tupper: TupperItem,
  assignment: Omit<TupperAssignment, 'menuId'> & { locale: string; allowAppend?: boolean; forceMove?: boolean }
) {
  const isAssigned = Boolean(tupper.assignedMenuId && tupper.assignedDay && tupper.assignedMeal);
  const isSameTarget =
    isAssigned &&
    tupper.assignedDay === assignment.dayKey &&
    tupper.assignedMeal === assignment.meal;

  if (isSameTarget) {
    throw new Error('assignment-already-same');
  }

  if (isAssigned && !assignment.forceMove) {
    throw new Error('assignment-move-required');
  }

  const menuId = await getOrCreateWeekMenu(services, user.uid, getWeekStart(assignment.dayKey), assignment.locale);
  const menu = await readWeekMenu(services, menuId);
  const result = planTupperAssignment(menu, assignment.dayKey, assignment.meal, tupper, {
    allowAppend: assignment.allowAppend,
  });

  if (!result.canAssign) {
    throw new Error(result.reason ?? 'assignment-blocked');
  }

  if (isAssigned) {
    await removeTupperAssignmentFromMenu(services, tupper, user.uid);
  }

  await updateMenuPatch(services, menuId, user.uid, {
    dayKey: assignment.dayKey,
    path: `meals.${assignment.meal}.items`,
    value: result.nextItems,
  });

  const { db, firestoreModule } = services;
  await firestoreModule.updateDoc(firestoreModule.doc(db, tuppersCollection, tupper.id), {
    status: 'assigned',
    assignedMenuId: menuId,
    assignedDay: assignment.dayKey,
    assignedMeal: assignment.meal,
    updatedAt: firestoreModule.serverTimestamp(),
  });
}

export async function removeTupperFromMeal(
  services: FirebaseServices,
  userId: string,
  tupper: TupperItem
) {
  const hadAssignment = await removeTupperAssignmentFromMenu(services, tupper, userId);
  const { db, firestoreModule } = services;

  await firestoreModule.updateDoc(firestoreModule.doc(db, tuppersCollection, tupper.id), {
    status: 'active',
    assignedMenuId: firestoreModule.deleteField(),
    assignedDay: firestoreModule.deleteField(),
    assignedMeal: firestoreModule.deleteField(),
    updatedAt: firestoreModule.serverTimestamp(),
  });

  return hadAssignment;
}

async function readWeekMenu(services: FirebaseServices, menuId: string): Promise<WeekMenu> {
  const { db, firestoreModule } = services;
  const snapshot = await firestoreModule.getDoc(firestoreModule.doc(db, 'weeklyMenus', menuId));

  if (!snapshot.exists()) {
    throw new Error('menu-not-found');
  }

  return { id: menuId, ...snapshot.data() } as WeekMenu;
}

function getWeekStart(dayKey: string) {
  return toIsoDate(getMonday(new Date(`${dayKey}T00:00:00`)));
}

async function removeTupperAssignmentFromMenu(
  services: FirebaseServices,
  tupper: TupperItem,
  userId = tupper.createdBy
) {
  if (!tupper.assignedMenuId || !tupper.assignedDay || !tupper.assignedMeal) {
    return false;
  }

  try {
    const menu = await readWeekMenu(services, tupper.assignedMenuId);
    const meal = getMealForAssignment(menu, tupper.assignedDay, tupper.assignedMeal);
    const nextItems = removeTupperFromMealItems(meal.items, tupper);

    if (nextItems.length === meal.items.length) {
      return false;
    }

    await updateMenuPatch(services, tupper.assignedMenuId, userId, {
      dayKey: tupper.assignedDay,
      path: `meals.${tupper.assignedMeal}.items`,
      value: nextItems,
    });

    return true;
  } catch {
    return false;
  }
}

async function syncAssignedTupperName(
  services: FirebaseServices,
  tupper: TupperItem,
  nextName: string,
  userId = tupper.createdBy
) {
  if (!tupper.assignedMenuId || !tupper.assignedDay || !tupper.assignedMeal) {
    return false;
  }

  try {
    const menu = await readWeekMenu(services, tupper.assignedMenuId);
    const meal = getMealForAssignment(menu, tupper.assignedDay, tupper.assignedMeal);
    const previousLabel = `Tupper: ${tupper.name}`;
    const nextLabel = `Tupper: ${nextName}`;
    const nextItems = meal.items.map((item) => (item === previousLabel ? nextLabel : item));

    if (nextItems.every((item, index) => item === meal.items[index])) {
      return false;
    }

    await updateMenuPatch(services, tupper.assignedMenuId, userId, {
      dayKey: tupper.assignedDay,
      path: `meals.${tupper.assignedMeal}.items`,
      value: nextItems,
    });

    return true;
  } catch {
    return false;
  }
}

export function getDishOptions(dishes: Dish[]) {
  return dishes.map((dish) => ({ id: dish.id, name: dish.name, normalizedName: dish.normalizedName }));
}
