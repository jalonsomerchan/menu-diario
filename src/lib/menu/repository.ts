import { getWeekDays, getWeekTitle } from './dates';
import type { DailyMenu, FirebaseUser, MenuPatch, WeekMenu } from './types';

const collectionName = 'weeklyMenus';

type FirebaseServices = {
  db: any;
  firestoreModule: any;
};

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
  const document = await firestoreModule.addDoc(firestoreModule.collection(db, collectionName), {
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
    firestoreModule.collection(db, collectionName),
    firestoreModule.where('members', 'array-contains', userId),
    firestoreModule.orderBy('weekStart', 'desc'),
    firestoreModule.limit(1)
  );
  const snapshot = await firestoreModule.getDocs(menusQuery);

  return snapshot.docs[0]?.id;
}

export function watchUserMenus(
  services: FirebaseServices,
  userId: string,
  callback: (menus: WeekMenu[]) => void,
  onError: (error: Error) => void
) {
  const { db, firestoreModule } = services;
  const menusQuery = firestoreModule.query(
    firestoreModule.collection(db, collectionName),
    firestoreModule.where('members', 'array-contains', userId),
    firestoreModule.orderBy('weekStart', 'desc'),
    firestoreModule.limit(12)
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
    firestoreModule.doc(db, collectionName, menuId),
    (snapshot: any) => {
      callback(snapshot.exists() ? mapWeekMenu(snapshot.id, snapshot.data()) : null);
    },
    onError
  );
}

export async function updateMenuPatch(
  services: FirebaseServices,
  menuId: string,
  userId: string,
  patch: MenuPatch
) {
  const { db, firestoreModule } = services;
  await firestoreModule.updateDoc(firestoreModule.doc(db, collectionName, menuId), {
    [`days.${patch.dayKey}.${patch.slot}`]: patch.value,
    updatedAt: firestoreModule.serverTimestamp(),
    updatedBy: userId,
  });
}

export async function joinMenuByInviteCode(services: FirebaseServices, userId: string, inviteCode: string) {
  const { db, firestoreModule } = services;
  const menusQuery = firestoreModule.query(
    firestoreModule.collection(db, collectionName),
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

  await firestoreModule.updateDoc(firestoreModule.doc(db, collectionName, menu.id), {
    members: [...members],
    updatedAt: firestoreModule.serverTimestamp(),
    updatedBy: userId,
  });

  return menu.id;
}
