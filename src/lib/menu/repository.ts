import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { getWeekDays, getWeekTitle } from './dates';
import type { DailyMenu, MenuPatch, WeekMenu } from './types';

const collectionName = 'weeklyMenus';

function emptyDay(): DailyMenu {
  return { lunch: '', dinner: '', notes: '' };
}

function buildEmptyDays(weekStart: string) {
  return Object.fromEntries(getWeekDays(weekStart).map((day) => [day.key, emptyDay()]));
}

function createInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function mapWeekMenu(id: string, data: Record<string, any>): WeekMenu {
  return {
    id,
    title: data.title,
    ownerId: data.ownerId,
    members: data.members ?? [],
    inviteCode: data.inviteCode,
    weekStart: data.weekStart,
    days: data.days ?? {},
    updatedAt: data.updatedAt?.toDate?.(),
    updatedBy: data.updatedBy,
  };
}

export async function ensureUserProfile(db: Firestore, userId: string, displayName?: string | null) {
  await setDoc(
    doc(db, 'users', userId),
    {
      displayName: displayName ?? 'Invitado',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function createWeekMenu(db: Firestore, userId: string, weekStart: string) {
  const document = await addDoc(collection(db, collectionName), {
    title: getWeekTitle(weekStart),
    ownerId: userId,
    members: [userId],
    inviteCode: createInviteCode(),
    weekStart,
    days: buildEmptyDays(weekStart),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  return document.id;
}

export async function getLatestMenuForUser(db: Firestore, userId: string) {
  const menusQuery = query(
    collection(db, collectionName),
    where('members', 'array-contains', userId),
    orderBy('weekStart', 'desc'),
    limit(1)
  );
  const snapshot = await getDocs(menusQuery);

  return snapshot.docs[0]?.id;
}

export function watchUserMenus(db: Firestore, userId: string, callback: (menus: WeekMenu[]) => void) {
  const menusQuery = query(
    collection(db, collectionName),
    where('members', 'array-contains', userId),
    orderBy('weekStart', 'desc'),
    limit(12)
  );

  return onSnapshot(menusQuery, (snapshot) => {
    callback(snapshot.docs.map((item) => mapWeekMenu(item.id, item.data())));
  });
}

export function watchWeekMenu(db: Firestore, menuId: string, callback: (menu: WeekMenu | null) => void) {
  return onSnapshot(doc(db, collectionName, menuId), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    callback(mapWeekMenu(snapshot.id, snapshot.data()));
  });
}

export async function updateMenuPatch(db: Firestore, menuId: string, userId: string, patch: MenuPatch) {
  await updateDoc(doc(db, collectionName, menuId), {
    [`days.${patch.dayKey}.${patch.slot}`]: patch.value,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

export async function joinMenuByInviteCode(db: Firestore, userId: string, inviteCode: string) {
  const menusQuery = query(collection(db, collectionName), where('inviteCode', '==', inviteCode), limit(1));
  const snapshot = await getDocs(menusQuery);
  const menu = snapshot.docs[0];

  if (!menu) {
    throw new Error('invite-not-found');
  }

  const data = menu.data();
  const members = new Set<string>(data.members ?? []);
  members.add(userId);

  await updateDoc(doc(db, collectionName, menu.id), {
    members: [...members],
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  return menu.id;
}
