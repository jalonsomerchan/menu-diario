import { getWeekDays, getWeekTitle } from './dates';
import type {
  DailyMenu,
  Dish,
  FirebaseUser,
  MealEntry,
  MealSlot,
  MenuGroup,
  MenuPatch,
  ThemePreference,
  UserProfile,
  WeekMenu,
} from './types';

const menusCollection = 'weeklyMenus';
const dishesCollection = 'dishes';
const groupsCollection = 'groups';
const defaultEnabledMeals: MealSlot[] = ['lunch'];
const mealSlots: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

type FirebaseServices = {
  db: any;
  firestoreModule: any;
};

function emptyMeal(): MealEntry {
  return { items: [], skipped: false, reason: '', note: '' };
}

function emptyDay(): DailyMenu {
  return {
    meals: {
      breakfast: emptyMeal(),
      lunch: emptyMeal(),
      dinner: emptyMeal(),
    },
    notes: '',
  };
}

function normalizeMeal(data?: Partial<MealEntry>): MealEntry {
  return {
    ...emptyMeal(),
    ...data,
    items: Array.isArray(data?.items) ? data.items : [],
    skipped: Boolean(data?.skipped),
    reason: data?.reason ?? '',
    note: data?.note ?? '',
  };
}

function normalizeDay(data: Partial<DailyMenu> = {}): DailyMenu {
  const legacyLunchItems = data.lunchItems ?? (data.lunch ? [data.lunch].filter(Boolean) : []);
  const meals = data.meals ?? {};

  return {
    ...emptyDay(),
    ...data,
    meals: {
      breakfast: normalizeMeal(meals.breakfast),
      lunch: normalizeMeal({
        ...(meals.lunch ?? {}),
        items: meals.lunch?.items ?? legacyLunchItems,
        skipped: meals.lunch?.skipped ?? Boolean(data.noLunch),
        reason: meals.lunch?.reason ?? data.noLunchReason ?? '',
        note: meals.lunch?.note ?? data.noLunchDescription ?? '',
      }),
      dinner: normalizeMeal({
        ...(meals.dinner ?? {}),
        items: meals.dinner?.items ?? (data.dinner ? [data.dinner].filter(Boolean) : []),
      }),
    },
    notes: data.notes ?? '',
  };
}

function buildEmptyDays(weekStart: string) {
  return Object.fromEntries(getWeekDays(weekStart).map((day) => [day.key, emptyDay()]));
}

function createInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function normalizeEmail(email = '') {
  return email.trim().toLocaleLowerCase('es-ES');
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeDishName(name: string) {
  return name.trim().toLocaleLowerCase('es-ES').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getDishId(userId: string, normalizedName: string) {
  return `${userId}_${encodeURIComponent(normalizedName).replaceAll('%', '_')}`.slice(0, 1400);
}

function normalizeEnabledMeals(value: unknown): MealSlot[] {
  if (!Array.isArray(value)) return defaultEnabledMeals;
  const enabled = value.filter((meal): meal is MealSlot => mealSlots.includes(meal));
  return enabled.length > 0 ? enabled : defaultEnabledMeals;
}

function normalizeTheme(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
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

function mapUserProfile(id: string, data: Record<string, any>, fallbackName: string, fallbackEmail = ''): UserProfile {
  return {
    id,
    displayName: data.displayName ?? fallbackName,
    email: data.email ?? fallbackEmail,
    enabledMeals: normalizeEnabledMeals(data.enabledMeals),
    theme: normalizeTheme(data.theme),
    groupId: data.groupId,
    updatedAt: data.updatedAt?.toDate?.(),
  };
}

function mapGroup(id: string, data: Record<string, any>): MenuGroup {
  return {
    id,
    name: data.name ?? 'Menu Diario',
    ownerId: data.ownerId,
    members: data.members ?? [],
    memberEmails: data.memberEmails ?? [],
    pendingEmails: data.pendingEmails ?? [],
    inviteCode: data.inviteCode,
    enabledMeals: normalizeEnabledMeals(data.enabledMeals),
    updatedAt: data.updatedAt?.toDate?.(),
  };
}

export async function ensureUserProfile(services: FirebaseServices, user: FirebaseUser, guestLabel: string) {
  const { db, firestoreModule } = services;
  const userRef = firestoreModule.doc(db, 'users', user.uid);
  const snapshot = await firestoreModule.getDoc(userRef);
  const email = normalizeEmail(user.email ?? '');

  if (snapshot.exists()) {
    await firestoreModule.setDoc(
      userRef,
      {
        displayName: user.displayName ?? snapshot.data().displayName ?? guestLabel,
        email: email || snapshot.data().email || '',
        updatedAt: firestoreModule.serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  await firestoreModule.setDoc(userRef, {
    displayName: user.displayName ?? guestLabel,
    email,
    enabledMeals: defaultEnabledMeals,
    theme: 'system',
    createdAt: firestoreModule.serverTimestamp(),
    updatedAt: firestoreModule.serverTimestamp(),
  });
}

export function watchUserProfile(
  services: FirebaseServices,
  user: FirebaseUser,
  guestLabel: string,
  callback: (profile: UserProfile) => void,
  onError: (error: Error) => void
) {
  const { db, firestoreModule } = services;
  return firestoreModule.onSnapshot(
    firestoreModule.doc(db, 'users', user.uid),
    (snapshot: any) => {
      callback(
        mapUserProfile(
          user.uid,
          snapshot.exists() ? snapshot.data() : {},
          user.displayName ?? user.email ?? guestLabel,
          normalizeEmail(user.email ?? '')
        )
      );
    },
    onError
  );
}

export async function updateUserPreferences(
  services: FirebaseServices,
  userId: string,
  preferences: { enabledMeals?: MealSlot[]; theme?: ThemePreference; groupId?: string | null }
) {
  const { db, firestoreModule } = services;
  await firestoreModule.setDoc(
    firestoreModule.doc(db, 'users', userId),
    {
      ...preferences,
      updatedAt: firestoreModule.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function ensureDefaultGroup(services: FirebaseServices, user: FirebaseUser, profile: UserProfile) {
  if (profile.groupId) return profile.groupId;

  const { db, firestoreModule } = services;
  const email = normalizeEmail(user.email ?? profile.email);
  const groupRef = await firestoreModule.addDoc(firestoreModule.collection(db, groupsCollection), {
    name: 'Menu Diario',
    ownerId: user.uid,
    members: [user.uid],
    memberEmails: email ? [email] : [],
    pendingEmails: [],
    inviteCode: createInviteCode(),
    enabledMeals: profile.enabledMeals,
    createdAt: firestoreModule.serverTimestamp(),
    updatedAt: firestoreModule.serverTimestamp(),
  });

  await updateUserPreferences(services, user.uid, { groupId: groupRef.id });
  return groupRef.id;
}

export function watchGroup(
  services: FirebaseServices,
  groupId: string,
  callback: (group: MenuGroup | null) => void,
  onError: (error: Error) => void
) {
  const { db, firestoreModule } = services;
  return firestoreModule.onSnapshot(
    firestoreModule.doc(db, groupsCollection, groupId),
    (snapshot: any) => callback(snapshot.exists() ? mapGroup(snapshot.id, snapshot.data()) : null),
    onError
  );
}

export async function updateGroupOptions(services: FirebaseServices, groupId: string, enabledMeals: MealSlot[]) {
  const { db, firestoreModule } = services;
  await firestoreModule.setDoc(
    firestoreModule.doc(db, groupsCollection, groupId),
    {
      enabledMeals: enabledMeals.length ? enabledMeals : defaultEnabledMeals,
      updatedAt: firestoreModule.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function addPendingGroupEmail(services: FirebaseServices, groupId: string, email: string) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return;

  const { db, firestoreModule } = services;
  const groupRef = firestoreModule.doc(db, groupsCollection, groupId);
  const snapshot = await firestoreModule.getDoc(groupRef);
  const data = snapshot.exists() ? snapshot.data() : {};

  await firestoreModule.updateDoc(groupRef, {
    pendingEmails: uniqueValues([...(data.pendingEmails ?? []), cleanEmail]),
    updatedAt: firestoreModule.serverTimestamp(),
  });
}

export async function joinGroupByInviteCode(services: FirebaseServices, user: FirebaseUser, inviteCode: string) {
  const { db, firestoreModule } = services;
  const cleanCode = inviteCode.trim().toUpperCase();
  const groupsQuery = firestoreModule.query(
    firestoreModule.collection(db, groupsCollection),
    firestoreModule.where('inviteCode', '==', cleanCode),
    firestoreModule.limit(1)
  );
  const snapshot = await firestoreModule.getDocs(groupsQuery);
  const group = snapshot.docs[0];

  if (!group) throw new Error('group-not-found');

  const data = group.data();
  const email = normalizeEmail(user.email ?? '');
  const members = uniqueValues([...(data.members ?? []), user.uid]);
  const memberEmails = email ? uniqueValues([...(data.memberEmails ?? []), email]) : data.memberEmails ?? [];
  const pendingEmails = email ? (data.pendingEmails ?? []).filter((item: string) => item !== email) : data.pendingEmails ?? [];

  await firestoreModule.updateDoc(firestoreModule.doc(db, groupsCollection, group.id), {
    members,
    memberEmails,
    pendingEmails,
    updatedAt: firestoreModule.serverTimestamp(),
  });
  await updateUserPreferences(services, user.uid, {
    groupId: group.id,
    enabledMeals: normalizeEnabledMeals(data.enabledMeals),
  });
  return group.id;
}

export async function leaveGroup(services: FirebaseServices, user: FirebaseUser, group: MenuGroup) {
  const { db, firestoreModule } = services;
  const email = normalizeEmail(user.email ?? '');
  await firestoreModule.updateDoc(firestoreModule.doc(db, groupsCollection, group.id), {
    members: group.members.filter((member) => member !== user.uid),
    memberEmails: email ? group.memberEmails.filter((item) => item !== email) : group.memberEmails,
    updatedAt: firestoreModule.serverTimestamp(),
  });
  await updateUserPreferences(services, user.uid, { groupId: null });
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
  maxResults = 30
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
  const path = patch.path ?? patch.slot;

  if (!path) return;

  const { db, firestoreModule } = services;
  await firestoreModule.updateDoc(firestoreModule.doc(db, menusCollection, menuId), {
    [`days.${patch.dayKey}.${path}`]: patch.value,
    updatedAt: firestoreModule.serverTimestamp(),
    updatedBy: userId,
  });

  if ((path.endsWith('.items') || path === 'lunchItems') && Array.isArray(patch.value)) {
    await Promise.all(patch.value.map((item) => upsertDish(services, userId, item)));
  }
}

export async function clearMenuDay(services: FirebaseServices, menuId: string, userId: string, dayKey: string) {
  const { db, firestoreModule } = services;
  await firestoreModule.updateDoc(firestoreModule.doc(db, menusCollection, menuId), {
    [`days.${dayKey}`]: emptyDay(),
    updatedAt: firestoreModule.serverTimestamp(),
    updatedBy: userId,
  });
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
