import { getWeekDays, getWeekTitle } from './dates';
import { getAddedDishNames, isSameDayMenu } from './day-state';
import { getAddedDishNamesFromItems } from './dish-usage.mjs';
import { emptyDay, normalizeDay } from './normalizers';
import { recordMenuDishUsage } from '../dishes/repository';
import type {
  DailyMenu,
  FirebaseUser,
  MealSlot,
  MenuGroup,
  MenuPatch,
  ThemePreference,
  UserProfile,
  WeekMenu,
} from './types';

const menusCollection = 'weeklyMenus';
const groupsCollection = 'groups';
const defaultEnabledMeals: MealSlot[] = ['lunch'];
const mealSlots: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

type FirebaseServices = {
  db: any;
  firestoreModule: any;
};

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

function mapUserProfile(id: string, data: Record<string, any>, fallbackName: string, fallbackEmail = ''): UserProfile {
  return { id, displayName: data.displayName ?? fallbackName, email: data.email ?? fallbackEmail, enabledMeals: normalizeEnabledMeals(data.enabledMeals), theme: normalizeTheme(data.theme), groupId: data.groupId, updatedAt: data.updatedAt?.toDate?.() };
}

function mapGroup(id: string, data: Record<string, any>): MenuGroup {
  return { id, name: data.name ?? 'Menu Diario', ownerId: data.ownerId, members: data.members ?? [], memberEmails: data.memberEmails ?? [], pendingEmails: data.pendingEmails ?? [], inviteCode: data.inviteCode, enabledMeals: normalizeEnabledMeals(data.enabledMeals), updatedAt: data.updatedAt?.toDate?.() };
}

function getPatchMealItems(previousDay: DailyMenu, path: string) {
  const match = path.match(/^meals\.(breakfast|lunch|dinner)\.items$/);
  if (match) return previousDay.meals[match[1] as MealSlot].items;
  if (path === 'lunchItems') return previousDay.meals.lunch.items;
  return [];
}

export async function ensureUserProfile(services: FirebaseServices, user: FirebaseUser, guestLabel: string) {
  const { db, firestoreModule } = services;
  const userRef = firestoreModule.doc(db, 'users', user.uid);
  const snapshot = await firestoreModule.getDoc(userRef);
  const email = normalizeEmail(user.email ?? '');
  if (snapshot.exists()) {
    await firestoreModule.setDoc(userRef, { displayName: user.displayName ?? snapshot.data().displayName ?? guestLabel, email: email || snapshot.data().email || '', updatedAt: firestoreModule.serverTimestamp() }, { merge: true });
    return;
  }
  await firestoreModule.setDoc(userRef, { displayName: user.displayName ?? guestLabel, email, enabledMeals: defaultEnabledMeals, theme: 'system', createdAt: firestoreModule.serverTimestamp(), updatedAt: firestoreModule.serverTimestamp() });
}

export function watchUserProfile(services: FirebaseServices, user: FirebaseUser, guestLabel: string, callback: (profile: UserProfile) => void, onError: (error: Error) => void) {
  const { db, firestoreModule } = services;
  return firestoreModule.onSnapshot(
    firestoreModule.doc(db, 'users', user.uid),
    (snapshot: any) => callback(mapUserProfile(user.uid, snapshot.exists() ? snapshot.data() : {}, user.displayName ?? user.email ?? guestLabel, normalizeEmail(user.email ?? ''))),
    onError
  );
}

export async function updateUserPreferences(services: FirebaseServices, userId: string, preferences: { enabledMeals?: MealSlot[]; theme?: ThemePreference; groupId?: string | null }) {
  const { db, firestoreModule } = services;
  await firestoreModule.setDoc(firestoreModule.doc(db, 'users', userId), { ...preferences, updatedAt: firestoreModule.serverTimestamp() }, { merge: true });
}

export async function ensureDefaultGroup(services: FirebaseServices, user: FirebaseUser, profile: UserProfile) {
  if (profile.groupId) return profile.groupId;
  const { db, firestoreModule } = services;
  const email = normalizeEmail(user.email ?? profile.email);
  const groupRef = await firestoreModule.addDoc(firestoreModule.collection(db, groupsCollection), { name: 'Menu Diario', ownerId: user.uid, members: [user.uid], memberEmails: email ? [email] : [], pendingEmails: [], inviteCode: createInviteCode(), enabledMeals: profile.enabledMeals, createdAt: firestoreModule.serverTimestamp(), updatedAt: firestoreModule.serverTimestamp() });
  await updateUserPreferences(services, user.uid, { groupId: groupRef.id });
  return groupRef.id;
}

export function watchGroup(services: FirebaseServices, groupId: string, callback: (group: MenuGroup | null) => void, onError: (error: Error) => void) {
  const { db, firestoreModule } = services;
  return firestoreModule.onSnapshot(firestoreModule.doc(db, groupsCollection, groupId), (snapshot: any) => callback(snapshot.exists() ? mapGroup(snapshot.id, snapshot.data()) : null), onError);
}

export async function updateGroupOptions(services: FirebaseServices, groupId: string, enabledMeals: MealSlot[]) {
  const { db, firestoreModule } = services;
  await firestoreModule.setDoc(firestoreModule.doc(db, groupsCollection, groupId), { enabledMeals: enabledMeals.length ? enabledMeals : defaultEnabledMeals, updatedAt: firestoreModule.serverTimestamp() }, { merge: true });
}

export async function addPendingGroupEmail(services: FirebaseServices, groupId: string, email: string) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return;
  const { db, firestoreModule } = services;
  const groupRef = firestoreModule.doc(db, groupsCollection, groupId);
  const snapshot = await firestoreModule.getDoc(groupRef);
  const data = snapshot.exists() ? snapshot.data() : {};
  await firestoreModule.updateDoc(groupRef, { pendingEmails: uniqueValues([...(data.pendingEmails ?? []), cleanEmail]), updatedAt: firestoreModule.serverTimestamp() });
}

export async function joinGroupByInviteCode(services: FirebaseServices, user: FirebaseUser, inviteCode: string) {
  const { db, firestoreModule } = services;
  const cleanCode = inviteCode.trim().toUpperCase();
  const groupsQuery = firestoreModule.query(firestoreModule.collection(db, groupsCollection), firestoreModule.where('inviteCode', '==', cleanCode), firestoreModule.limit(1));
  const snapshot = await firestoreModule.getDocs(groupsQuery);
  const group = snapshot.docs[0];
  if (!group) throw new Error('group-not-found');
  const data = group.data();
  const email = normalizeEmail(user.email ?? '');
  const members = uniqueValues([...(data.members ?? []), user.uid]);
  const memberEmails = email ? uniqueValues([...(data.memberEmails ?? []), email]) : data.memberEmails ?? [];
  const pendingEmails = email ? (data.pendingEmails ?? []).filter((item: string) => item !== email) : data.pendingEmails ?? [];
  await firestoreModule.updateDoc(firestoreModule.doc(db, groupsCollection, group.id), { members, memberEmails, pendingEmails, updatedAt: firestoreModule.serverTimestamp() });
  await updateUserPreferences(services, user.uid, { groupId: group.id, enabledMeals: normalizeEnabledMeals(data.enabledMeals) });
  return group.id;
}

export async function leaveGroup(services: FirebaseServices, user: FirebaseUser, group: MenuGroup) {
  const { db, firestoreModule } = services;
  const email = normalizeEmail(user.email ?? '');
  await firestoreModule.updateDoc(firestoreModule.doc(db, groupsCollection, group.id), { members: group.members.filter((member) => member !== user.uid), memberEmails: email ? group.memberEmails.filter((item) => item !== email) : group.memberEmails, updatedAt: firestoreModule.serverTimestamp() });
  await updateUserPreferences(services, user.uid, { groupId: null });
}

export async function createWeekMenu(services: FirebaseServices, userId: string, weekStart: string, locale: string) {
  const { db, firestoreModule } = services;
  const document = await firestoreModule.addDoc(firestoreModule.collection(db, menusCollection), { title: getWeekTitle(weekStart, locale), ownerId: userId, members: [userId], inviteCode: createInviteCode(), weekStart, days: buildEmptyDays(weekStart), createdAt: firestoreModule.serverTimestamp(), updatedAt: firestoreModule.serverTimestamp(), updatedBy: userId });
  return document.id;
}

export async function getLatestMenuForUser(services: FirebaseServices, userId: string) {
  const { db, firestoreModule } = services;
  const menusQuery = firestoreModule.query(firestoreModule.collection(db, menusCollection), firestoreModule.where('members', 'array-contains', userId), firestoreModule.orderBy('weekStart', 'desc'), firestoreModule.limit(1));
  const snapshot = await firestoreModule.getDocs(menusQuery);
  return snapshot.docs[0]?.id;
}

export async function getOrCreateWeekMenu(services: FirebaseServices, userId: string, weekStart: string, locale: string) {
  const { db, firestoreModule } = services;
  const menusQuery = firestoreModule.query(firestoreModule.collection(db, menusCollection), firestoreModule.where('members', 'array-contains', userId), firestoreModule.where('weekStart', '==', weekStart), firestoreModule.limit(1));
  const snapshot = await firestoreModule.getDocs(menusQuery);
  return snapshot.docs[0]?.id ?? createWeekMenu(services, userId, weekStart, locale);
}

export async function getOrCreateWeekMenus(services: FirebaseServices, userId: string, weekStarts: string[], locale: string) {
  const uniqueWeekStarts = [...new Set(weekStarts)];
  const entries = await Promise.all(
    uniqueWeekStarts.map(async (weekStart) => [weekStart, await getOrCreateWeekMenu(services, userId, weekStart, locale)] as const)
  );
  return Object.fromEntries(entries);
}

export function watchUserMenus(services: FirebaseServices, userId: string, callback: (menus: WeekMenu[]) => void, onError: (error: Error) => void, maxResults = 30) {
  const { db, firestoreModule } = services;
  const menusQuery = firestoreModule.query(firestoreModule.collection(db, menusCollection), firestoreModule.where('members', 'array-contains', userId), firestoreModule.orderBy('weekStart', 'desc'), firestoreModule.limit(maxResults));
  return firestoreModule.onSnapshot(menusQuery, (snapshot: any) => callback(snapshot.docs.map((item: any) => mapWeekMenu(item.id, item.data()))), onError);
}

export function watchUserMenusByWeekRange(
  services: FirebaseServices,
  userId: string,
  startWeek: string,
  endWeek: string,
  callback: (menus: WeekMenu[]) => void,
  onError: (error: Error) => void
) {
  const { db, firestoreModule } = services;
  const menusQuery = firestoreModule.query(
    firestoreModule.collection(db, menusCollection),
    firestoreModule.where('members', 'array-contains', userId),
    firestoreModule.where('weekStart', '>=', startWeek),
    firestoreModule.where('weekStart', '<=', endWeek),
    firestoreModule.orderBy('weekStart', 'asc')
  );

  return firestoreModule.onSnapshot(
    menusQuery,
    (snapshot: any) => callback(snapshot.docs.map((item: any) => mapWeekMenu(item.id, item.data()))),
    onError
  );
}

export function watchWeekMenu(services: FirebaseServices, menuId: string, callback: (menu: WeekMenu | null) => void, onError: (error: Error) => void) {
  const { db, firestoreModule } = services;
  return firestoreModule.onSnapshot(firestoreModule.doc(db, menusCollection, menuId), (snapshot: any) => { callback(snapshot.exists() ? mapWeekMenu(snapshot.id, snapshot.data()) : null); }, onError);
}

export function watchWeekMenusByIds(services: FirebaseServices, menuIds: string[], callback: (menus: WeekMenu[]) => void, onError: (error: Error) => void) {
  if (menuIds.length === 0) {
    callback([]);
    return () => {};
  }

  const menus = new Map<string, WeekMenu>();
  const emit = () => callback([...menus.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)));
  const unsubscribes = menuIds.map((menuId) =>
    watchWeekMenu(
      services,
      menuId,
      (menu) => {
        if (menu) {
          menus.set(menuId, menu);
        } else {
          menus.delete(menuId);
        }
        emit();
      },
      onError
    )
  );

  return () => {
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  };
}

export async function updateMenuPatch(services: FirebaseServices, menuId: string, userId: string, patch: MenuPatch, groupId?: string) {
  const path = patch.path ?? patch.slot;
  if (!path) return;
  const { db, firestoreModule } = services;
  const menuRef = firestoreModule.doc(db, menusCollection, menuId);
  const shouldRecordItems = (path.endsWith('.items') || path === 'lunchItems') && Array.isArray(patch.value);
  const snapshot = shouldRecordItems ? await firestoreModule.getDoc(menuRef) : null;
  const previousDay = normalizeDay(snapshot?.exists?.() ? snapshot.data()?.days?.[patch.dayKey] : undefined);
  const addedItems = shouldRecordItems ? getAddedDishNamesFromItems(getPatchMealItems(previousDay, path), patch.value) : [];
  await firestoreModule.updateDoc(menuRef, { [`days.${patch.dayKey}.${path}`]: patch.value, updatedAt: firestoreModule.serverTimestamp(), updatedBy: userId });
  if (addedItems.length) {
    await Promise.all(addedItems.map((item) => recordMenuDishUsage(services, userId, item, groupId)));
  }
}

export async function updateMenuDay(
  services: FirebaseServices,
  menuId: string,
  userId: string,
  dayKey: string,
  nextDay: Partial<DailyMenu>,
  groupId?: string
) {
  const { db, firestoreModule } = services;
  const menuRef = firestoreModule.doc(db, menusCollection, menuId);
  const snapshot = await firestoreModule.getDoc(menuRef);
  const previousDay = normalizeDay(snapshot.exists() ? snapshot.data()?.days?.[dayKey] : undefined);
  const normalizedNextDay = normalizeDay(nextDay);

  if (isSameDayMenu(previousDay, normalizedNextDay)) {
    return false;
  }

  await firestoreModule.updateDoc(menuRef, {
    [`days.${dayKey}`]: normalizedNextDay,
    updatedAt: firestoreModule.serverTimestamp(),
    updatedBy: userId,
  });

  const additions = getAddedDishNames(previousDay, normalizedNextDay);
  if (additions.length) {
    await Promise.all(additions.map((item) => recordMenuDishUsage(services, userId, item, groupId)));
  }

  return true;
}

export async function clearMenuDay(services: FirebaseServices, menuId: string, userId: string, dayKey: string) {
  const { db, firestoreModule } = services;
  await firestoreModule.updateDoc(firestoreModule.doc(db, menusCollection, menuId), { [`days.${dayKey}`]: emptyDay(), updatedAt: firestoreModule.serverTimestamp(), updatedBy: userId });
}

export async function joinMenuByInviteCode(services: FirebaseServices, userId: string, inviteCode: string) {
  const { db, firestoreModule } = services;
  const menusQuery = firestoreModule.query(firestoreModule.collection(db, menusCollection), firestoreModule.where('inviteCode', '==', inviteCode), firestoreModule.limit(1));
  const snapshot = await firestoreModule.getDocs(menusQuery);
  const menu = snapshot.docs[0];
  if (!menu) throw new Error('invite-not-found');
  const data = menu.data();
  const members = new Set<string>(data.members ?? []);
  members.add(userId);
  await firestoreModule.updateDoc(firestoreModule.doc(db, menusCollection, menu.id), { members: [...members], updatedAt: firestoreModule.serverTimestamp(), updatedBy: userId });
  return menu.id;
}
