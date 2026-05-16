import type { TupperExpiryState, TupperItem } from './types';

export const defaultExpiryWarningDays = 2;

export function getDaysUntilExpiry(expiresAt: string, today = new Date()) {
  const expiry = parseIsoDate(expiresAt);
  const base = startOfDay(today);

  return Math.ceil((expiry.getTime() - base.getTime()) / 86_400_000);
}

export function getTupperExpiryState(
  tupper: Pick<TupperItem, 'expiresAt' | 'status'>,
  today = new Date(),
  warningDays = defaultExpiryWarningDays
): TupperExpiryState {
  if (tupper.status === 'consumed' || tupper.status === 'discarded' || tupper.status === 'archived') {
    return 'done';
  }

  const days = getDaysUntilExpiry(tupper.expiresAt, today);
  if (days < 0) return 'expired';
  if (days <= warningDays) return 'expiring';

  return 'fresh';
}

export function isTupperActive(tupper: Pick<TupperItem, 'status'>) {
  return tupper.status === 'active' || tupper.status === 'assigned';
}

export function sortTuppersByPriority(a: TupperItem, b: TupperItem, today = new Date()) {
  const statusOrder: Record<TupperExpiryState, number> = { expired: 0, expiring: 1, fresh: 2, done: 3 };
  const stateDiff = statusOrder[getTupperExpiryState(a, today)] - statusOrder[getTupperExpiryState(b, today)];
  if (stateDiff !== 0) return stateDiff;

  return getDaysUntilExpiry(a.expiresAt, today) - getDaysUntilExpiry(b.expiresAt, today) || a.name.localeCompare(b.name);
}

function parseIsoDate(value: string) {
  return startOfDay(new Date(`${value}T00:00:00`));
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
