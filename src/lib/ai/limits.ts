import { aiClientLimits } from './config';
import { AiClientError } from './errors';

const storagePrefix = 'menu-diario:ai-limits';

type LimitSnapshot = {
  sessionCount: number;
  userDayCount: number;
  dayKey: string;
};

export function assertAiClientLimit(userId = 'guest', storage: Storage | undefined = getStorage()) {
  const snapshot = readLimitSnapshot(userId, storage);

  if (aiClientLimits.perSession > 0 && snapshot.sessionCount >= aiClientLimits.perSession) {
    throw new AiClientError('quota-exhausted', 'AI session quota exhausted.');
  }

  if (aiClientLimits.perUserPerDay > 0 && snapshot.userDayCount >= aiClientLimits.perUserPerDay) {
    throw new AiClientError('quota-exhausted', 'AI daily quota exhausted.');
  }
}

export function registerAiClientUse(userId = 'guest', storage: Storage | undefined = getStorage()) {
  const snapshot = readLimitSnapshot(userId, storage);
  writeLimitSnapshot(
    userId,
    {
      ...snapshot,
      sessionCount: snapshot.sessionCount + 1,
      userDayCount: snapshot.userDayCount + 1,
    },
    storage
  );
}

export function readLimitSnapshot(userId = 'guest', storage: Storage | undefined = getStorage()): LimitSnapshot {
  const dayKey = new Date().toISOString().slice(0, 10);
  const fallback = { sessionCount: 0, userDayCount: 0, dayKey };

  if (!storage) {
    return fallback;
  }

  try {
    const saved = JSON.parse(storage.getItem(getStorageKey(userId)) || 'null') as Partial<LimitSnapshot> | null;

    if (!saved || saved.dayKey !== dayKey) {
      return fallback;
    }

    return {
      dayKey,
      sessionCount: Number(saved.sessionCount) || 0,
      userDayCount: Number(saved.userDayCount) || 0,
    };
  } catch {
    return fallback;
  }
}

function writeLimitSnapshot(userId: string, snapshot: LimitSnapshot, storage: Storage | undefined) {
  if (!storage) {
    return;
  }

  storage.setItem(getStorageKey(userId), JSON.stringify(snapshot));
}

function getStorageKey(userId: string) {
  return `${storagePrefix}:${userId}`;
}

function getStorage() {
  return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
}
