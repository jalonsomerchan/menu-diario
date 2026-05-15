export type NetworkStatus = 'online' | 'offline';

export function getNetworkStatus(): NetworkStatus {
  if (typeof navigator === 'undefined') {
    return 'online';
  }

  return navigator.onLine ? 'online' : 'offline';
}

export function isOffline() {
  return getNetworkStatus() === 'offline';
}

export function watchNetworkStatus(callback: (status: NetworkStatus) => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const notify = () => callback(getNetworkStatus());
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  notify();

  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
}
