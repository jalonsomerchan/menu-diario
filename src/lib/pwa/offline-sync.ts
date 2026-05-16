export type OfflineSyncState = 'read-only' | 'pending-sync' | 'synced' | 'conflict-risk';

export function getOfflineSyncState(isOnline: boolean, hasCachedMenu: boolean): OfflineSyncState {
  if (!isOnline && hasCachedMenu) {
    return 'read-only';
  }

  if (!isOnline) {
    return 'conflict-risk';
  }

  return 'synced';
}

export function shouldBlockOfflineWrites(isOnline: boolean) {
  return !isOnline;
}
