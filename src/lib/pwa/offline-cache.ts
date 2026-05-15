import type { UserProfile, WeekMenu } from '../menu/types';

const cacheVersion = 1;
const storagePrefix = 'menu-diario:offline-menu';
const lastCacheKey = `${storagePrefix}:last:v${cacheVersion}`;

export type OfflineMenuCache = {
  version: number;
  savedAt: string;
  userId: string;
  menuId: string;
  menu: WeekMenu;
  profile: Pick<UserProfile, 'displayName' | 'enabledMeals' | 'theme'>;
};

export function saveOfflineMenuCache(entry: Omit<OfflineMenuCache, 'version' | 'savedAt'>) {
  const storage = getStorage();
  if (!storage) return;

  const payload: OfflineMenuCache = {
    ...entry,
    version: cacheVersion,
    savedAt: new Date().toISOString(),
  };
  const key = getStorageKey(entry.userId);

  storage.setItem(key, JSON.stringify(payload));
  storage.setItem(lastCacheKey, key);
}

export function readOfflineMenuCache(userId: string): OfflineMenuCache | undefined {
  return readCacheByKey(getStorageKey(userId));
}

export function readLastOfflineMenuCache(): OfflineMenuCache | undefined {
  const storage = getStorage();
  if (!storage) return undefined;

  const key = storage.getItem(lastCacheKey);
  return key ? readCacheByKey(key) : undefined;
}

export function clearOfflineMenuCache(userId: string) {
  const storage = getStorage();
  if (!storage) return;

  const key = getStorageKey(userId);
  storage.removeItem(key);
  if (storage.getItem(lastCacheKey) === key) {
    storage.removeItem(lastCacheKey);
  }
}

function readCacheByKey(key: string): OfflineMenuCache | undefined {
  const storage = getStorage();
  if (!storage) return undefined;

  try {
    const parsed = JSON.parse(storage.getItem(key) || 'null') as Partial<OfflineMenuCache> | null;
    if (!isOfflineMenuCache(parsed)) return undefined;

    return parsed;
  } catch {
    return undefined;
  }
}

function isOfflineMenuCache(value: Partial<OfflineMenuCache> | null): value is OfflineMenuCache {
  return Boolean(
    value &&
      value.version === cacheVersion &&
      typeof value.userId === 'string' &&
      typeof value.menuId === 'string' &&
      typeof value.savedAt === 'string' &&
      value.menu &&
      typeof value.menu === 'object' &&
      value.profile &&
      typeof value.profile === 'object'
  );
}

function getStorageKey(userId: string) {
  return `${storagePrefix}:v${cacheVersion}:${userId}`;
}

function getStorage() {
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}
