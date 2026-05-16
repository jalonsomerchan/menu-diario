import { getTupperExpiryState } from './expiry';
import type { TupperFilter, TupperItem, TupperStatus } from './types';

const doneStatuses: TupperStatus[] = ['assigned', 'consumed', 'discarded', 'archived'];

export function filterTuppers(tuppers: TupperItem[], filter: TupperFilter, today = new Date()) {
  return tuppers.filter((tupper) => {
    if (filter === 'all') return tupper.status === 'active' || tupper.status === 'assigned';
    if (filter === 'expiring') return getTupperExpiryState(tupper, today) === 'expiring';
    if (filter === 'expired') return getTupperExpiryState(tupper, today) === 'expired';
    if (filter === 'freezer') return tupper.location === 'freezer';
    if (filter === 'fridge') return tupper.location === 'fridge';
    if (filter === 'done') return doneStatuses.includes(tupper.status);

    return true;
  });
}

export function nextTupperStatus(current: TupperStatus, action: 'consume' | 'discard' | 'archive' | 'freeze' | 'defrost') {
  if (action === 'consume') return 'consumed';
  if (action === 'discard') return 'discarded';
  if (action === 'archive') return 'archived';

  return current;
}

export function nextTupperLocation(current: TupperItem['location'], action: 'freeze' | 'defrost') {
  if (action === 'freeze') return 'freezer';
  if (action === 'defrost') return current === 'freezer' ? 'fridge' : current;

  return current;
}

export function shouldShowExpiryWarning(tuppers: TupperItem[], today = new Date()) {
  return tuppers.some((tupper) => ['expired', 'expiring'].includes(getTupperExpiryState(tupper, today)));
}
