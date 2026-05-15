import { getWeekDays, getWeekTitle } from './dates';
import type { DailyMenu, Dish, FirebaseUser, MenuPatch, WeekMenu } from './types';

const menusCollection = 'weeklyMenus';
const dishesCollection = 'dishes';

type FirebaseServices = {
  db: any;
  firestoreModule: any;
};

function emptyDay(): DailyMenu {
  return {
    lunch: '',
    dinner: '',
    lunchItems: [],
    noLunch: false,
    noLunchReason: '',
    noLunchDescription: '',
    notes: '',
  };
}

function normalizeDay(data: Partial<DailyMenu> = {}): DailyMenu {
  const legacyLunchItems = data.lunch ? [data.lunch].filter(Boolean) : [];

  return {
    ...emptyDay(),
    ...data,
    lunchItems: Array.isArray(data.lunchItems) ? data.lunchItems : legacyLunchItems,
    noLunch: Boolean(data.noLunch),
    noLunchReason: data.noLunchReason ?? '',
    noLunchDescription: data.noLunchDescription ?? '',
    notes: data.notes ?? '',
  };
}

function buildEmptyDays(weekStart: string) {
  return Object.fromEntries(getWeekDays(weekStart).map((day) => [day.key, emptyDay()]));
}

function createInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function normalizeDishName(name: string) {
  return name.trim().toLocaleLowerCase('es-ES').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getDishId(userId: string, normalizedName: string) {
  return `${userId}_${encodeURIComponent(normalizedName).replaceAll('%', '_')}`.slice(0, 1400);
}

function mapWeekMenu(id: string, data: Record<string, any>): WeekMenu {
  const rawDays = data.days ?? {};

  return {
    id,
    title: data.title,
    ownerId: data.ownerId,
    members: data.members ?? [],
    inviteCode: data.inviteCode,
    weekStart: data.weekStart,
    days: Object.fromEntries(Object.entries(rawDays).map(([key, value]) => [key, normalizeDay(value as Partial<DailyMenu>)])),
    updatedAt: data.updatedAt?.toDate?.(),
    updatedBy: data.updatedBy,
  };
}

function mapDish(id: string, data: Record<string, any>): Dish {
  return {
    id,
    name: data.name,
    normalizedName: data.normalizedName,
    createdBy: data.createdBy,
    timesUsed: data.timesUsed ?? 0,
    lastUsedAt: data.lastUsedAt?.toDate?.(),
  };
}

export async function ensureUserProfile(services: FirebaseServices, user: FirebaseUser, guestLabel: string) {
  const { db, firestoreModule } = services;
  await firestoreModule.setDoc(
    firestoreModule.doc(db, 'users', user.uid),
    {
      displayName: user.displayName ?? guestLabel,
      updatedAt: firestoreModule.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function createWeekMenu(services: FirebaseServices, userId: string, weekStart: string, locale: string) {
  const { db, firestoreModule } = services;
  const document = await firestoreModule.addDoc(firestoreModule.collection(db, menusCollection), {
    title: getWeekTitle(weekStart, locale),
    ownerId: userId,
    members: [userId],
    inviteCode: createInviteCode(),
    weekStart,
    days: buildEmptyDays(weekStart),
    createdAt: firestoreModule.serverTimestamp(),
    updatedAt: firestoreModule.serverTimestamp(),
    updatedBy: userId,
  });

  return document.id;
}

export async function getLatestMenuForUser(services: FirebaseServices, userId: string) {
  const { db, firestoreModule } = services;
  const menusQuery = firestoreModule.query(
    firestoreModule.collection(db, menusCollection),
    firestoreModule.where('members', 'array-contains', userId),
    firestoreModule.orderBy('weekStart', 'desc'),
    firestoreModule.limit(1)
  );
  const snapshot = await firestoreModule.getDocs(menusQuery);

  return snapshot.docs[0]?.id;
}

export async function getOrCreateWeekMenu(services: FirebaseServices, userId: string, weekStart: string, locale: string) {
  const { db, firestoreModule } = services;
  const menusQuery = firestoreModule.query(
    firestoreModule.collection(db, menusCollection),
    firestoreModule.where('members', 'array-contains', userId),
    firestoreModule.where('weekStart', '==', weekStart),
    firestoreModule.limit(1)
  );
  const snapshot = await firestoreModule.getDocs(menusQuery);

  return snapshot.docs[0]?.id ?? createWeekMenu(services, userId, weekStart, locale);
}

export function watchUserMenus(
  services: FirebaseServices,
  userId: string,
  callback: (menus: WeekMenu[]) => void,
  onError: (error: Error) => void,
  maxResults = 12
) {
  const { db, firestoreModule } = services;
  const menusQuery = firestoreModule.query(
    firestoreModule.collection(db, menusCollection),
    firestoreModule.where('members', 'array-contains', userId),
    firestoreModule.orderBy('weekStart', 'desc'),
    firestoreModule.limit(maxResults)
  );

  return firestoreModule.onSnapshot(
    menusQuery,
    (snapshot: any) => callback(snapshot.docs.map((item: any) => mapWeekMenu(item.id, item.data()))),
    onError
  );
}

export function watchWeekMenu(
  services: FirebaseServices,
  menuId: string,
  callback: (menu: WeekMenu | null) => void,
  onError: (error: Error) => void
) {
  const { db, firestoreModule } = services;
  return firestoreModule.onSnapshot(
    firestoreModule.doc(db, menusCollection, menuId),
    (snapshot: any) => {
      callback(snapshot.exists() ? mapWeekMenu(snapshot.id, snapshot.data()) : null);
    },
    onError
  );
}

export function watchDishes(
  services: FirebaseServices,
  userId: string,
  callback: (dishes: Dish[]) => void,
  onError: (error: Error) => void
) {
  const { db, firestoreModule } = services;
  const dishesQuery = firestoreModule.query(
    firestoreModule.collection(db, dishesCollection),
    firestoreModule.where('createdBy', '==', userId),
    firestoreModule.limit(50)
  );

  return firestoreModule.onSnapshot(
    dishesQuery,
    (snapshot: any) => {
      const dishes = snapshot.docs
        .map((item: any) => mapDish(item.id, item.data()))
        .sort((a: Dish, b: Dish) => b.timesUsed - a.timesUsed || a.name.localeCompare(b.name));
      callback(dishes);
    },
    onError
  );
}

export async function upsertDish(services: FirebaseServices, userId: string, name: string) {
  const cleanName = name.trim();

  if (!cleanName) return;

  const { db, firestoreModule } = services;
  const normalizedName = normalizeDishName(cleanName);
  const dishRef = firestoreModule.doc(db, dishesCollection, getDishId(userId, normalizedName));
  const snapshot = await firestoreModule.getDoc(dishRef);

  if (snapshot.exists()) {
    await firestoreModule.updateDoc(dishRef, {
      timesUsed: firestoreModule.increment(1),
      lastUsedAt: firestoreModule.serverTimestamp(),
    });
    return;
  }

  await firestoreModule.setDoc(dishRef, {
    name: cleanName,
    normalizedName,
    createdBy: userId,
    members: [userId],
    timesUsed: 1,
    createdAt: firestoreModule.serverTimestamp(),
    lastUsedAt: firestoreModule.serverTimestamp(),
  });
}

export async function updateMenuPatch(
  services: FirebaseServices,
  menuId: string,
  userId: string,
  patch: MenuPatch
) {
  const { db, firestoreModule } = services;
  await firestoreModule.updateDoc(firestoreModule.doc(db, menusCollection, menuId), {
    [`days.${patch.dayKey}.${patch.slot}`]: patch.value,
    updatedAt: firestoreModule.serverTimestamp(),
    updatedBy: userId,
  });

  if (patch.slot === 'lunchItems' && Array.isArray(patch.value)) {
    await Promise.all(patch.value.map((item) => upsertDish(services, userId, item)));
  }
}

export async function joinMenuByInviteCode(services: FirebaseServices, userId: string, inviteCode: string) {
  const { db, firestoreModule } = services;
  const menusQuery = firestoreModule.query(
    firestoreModule.collection(db, menusCollection),
    firestoreModule.where('inviteCode', '==', inviteCode),
    firestoreModule.limit(1)
  );
  const snapshot = await firestoreModule.getDocs(menusQuery);
  const menu = snapshot.docs[0];

  if (!menu) {
    throw new Error('invite-not-found');
  }

  const data = menu.data();
  const members = new Set<string>(data.members ?? []);
  members.add(userId);

  await firestoreModule.updateDoc(firestoreModule.doc(db, menusCollection, menu.id), {
    members: [...members],
    updatedAt: firestoreModule.serverTimestamp(),
    updatedBy: userId,
  });

  return menu.id;
}
