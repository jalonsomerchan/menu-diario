import { getMonday, toIsoDate } from '../menu/dates';
import { getOrCreateWeekMenu, updateMenuPatch, upsertDish } from '../menu/repository';
import type { Dish, FirebaseUser, UserProfile, WeekMenu } from '../menu/types';
import { planTupperAssignment } from './assignment';
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

export function watchTuppers(
  services: FirebaseServices,
  userId: string,
  callback: (tuppers: TupperItem[]) => void,
  onError: (error: Error) => void
) {
  const { db, firestoreModule } = services;
  const query = firestoreModule.query(
    firestoreModule.collection(db, tuppersCollection),
    firestoreModule.where('members', 'array-contains', userId),
    firestoreModule.limit(80)
  );

  return firestoreModule.onSnapshot(
    query,
    (snapshot: any) => {
      callback(snapshot.docs.map((item: any) => mapTupper(item.id, item.data())).sort(sortTuppersByPriority));
    },
    onError
  );
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
  await upsertDish(services, user.uid, cleanName);

  await firestoreModule.addDoc(firestoreModule.collection(db, tuppersCollection), {
    name: cleanName,
    normalizedName,
    dishId: data.dishId || '',
    createdBy: user.uid,
    groupId: profile?.groupId ?? '',
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

export async function updateTupperState(
  services: FirebaseServices,
  tupper: TupperItem,
  patch: Partial<Pick<TupperItem, 'status' | 'location'>>
) {
  const { db, firestoreModule } = services;
  await firestoreModule.updateDoc(firestoreModule.doc(db, tuppersCollection, tupper.id), {
    ...patch,
    updatedAt: firestoreModule.serverTimestamp(),
  });
}

export async function assignTupperToMeal(
  services: FirebaseServices,
  user: FirebaseUser,
  tupper: TupperItem,
  assignment: Omit<TupperAssignment, 'menuId'> & { locale: string; allowAppend?: boolean }
) {
  const menuId = await getOrCreateWeekMenu(services, user.uid, getWeekStart(assignment.dayKey), assignment.locale);
  const menu = await readWeekMenu(services, menuId);
  const result = planTupperAssignment(menu, assignment.dayKey, assignment.meal, tupper, {
    allowAppend: assignment.allowAppend,
  });

  if (!result.canAssign) {
    throw new Error(result.reason ?? 'assignment-blocked');
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

export function getDishOptions(dishes: Dish[]) {
  return dishes.map((dish) => ({ id: dish.id, name: dish.name, normalizedName: dish.normalizedName }));
}
