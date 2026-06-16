import { getWeekDays } from './dates';
import { emptyDay, normalizeDay } from './normalizers';
import { getOrCreateWeekMenu } from './repository';
import type { DailyMenu, WeekMenu } from './types';

type FirebaseServices = {
  db: any;
  firestoreModule: any;
};

const menusCollection = 'weeklyMenus';

function mapWeekMenu(id: string, data: Record<string, any>): WeekMenu {
  const rawDays = data.days ?? {};

  return {
    id,
    title: data.title ?? '',
    ownerId: data.ownerId ?? '',
    members: Array.isArray(data.members) ? data.members : [],
    groupId: data.groupId ?? undefined,
    inviteCode: data.inviteCode ?? '',
    weekStart: data.weekStart ?? '',
    days: Object.fromEntries(Object.entries(rawDays).map(([key, value]) => [key, normalizeDay(value as Partial<DailyMenu>)])),
    updatedAt: data.updatedAt?.toDate?.(),
    updatedBy: data.updatedBy,
  };
}

export async function readWeekMenuByStart(services: FirebaseServices, userId: string, weekStart: string) {
  const { db, firestoreModule } = services;
  const query = firestoreModule.query(
    firestoreModule.collection(db, menusCollection),
    firestoreModule.where('members', 'array-contains', userId),
    firestoreModule.where('weekStart', '==', weekStart),
    firestoreModule.limit(1)
  );
  const snapshot = await firestoreModule.getDocs(query);
  const document = snapshot.docs[0];

  return document ? mapWeekMenu(document.id, document.data()) : null;
}

export async function readWeekMenusByStarts(services: FirebaseServices, userId: string, weekStarts: string[]) {
  const menus = await Promise.all([...new Set(weekStarts)].map((weekStart) => readWeekMenuByStart(services, userId, weekStart)));
  return menus.filter((menu): menu is WeekMenu => Boolean(menu));
}

export function remapWeekDays(sourceMenu: WeekMenu, targetWeekStart: string) {
  const sourceDays = getWeekDays(sourceMenu.weekStart);
  const targetDays = getWeekDays(targetWeekStart);

  return Object.fromEntries(
    targetDays.map((targetDay, index) => {
      const sourceDayKey = sourceDays[index]?.key;
      return [targetDay.key, sourceDayKey ? normalizeDay(sourceMenu.days[sourceDayKey]) : emptyDay()];
    })
  );
}

export async function copyWeekMenuDays(
  services: FirebaseServices,
  input: { userId: string; sourceWeekStart: string; targetWeekStart: string; locale: string }
) {
  const sourceMenu = await readWeekMenuByStart(services, input.userId, input.sourceWeekStart);
  if (!sourceMenu) {
    throw new Error('source-week-empty');
  }

  const targetMenuId = await getOrCreateWeekMenu(services, input.userId, input.targetWeekStart, input.locale);
  const { db, firestoreModule } = services;

  await firestoreModule.updateDoc(firestoreModule.doc(db, menusCollection, targetMenuId), {
    days: remapWeekDays(sourceMenu, input.targetWeekStart),
    updatedAt: firestoreModule.serverTimestamp(),
    updatedBy: input.userId,
  });

  return targetMenuId;
}

export function getMergedDaysForKeys(menus: WeekMenu[], dayKeys: string[]) {
  return Object.fromEntries(
    dayKeys.map((dayKey) => {
      const menu = menus.find((entry) => entry.days[dayKey]);
      return [dayKey, menu?.days[dayKey]];
    })
  );
}
