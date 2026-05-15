export function canUseNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestChangeNotifications() {
  if (!canUseNotifications()) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  return Notification.requestPermission();
}

export function notifyMenuChanged(title: string, body: string) {
  if (!canUseNotifications() || Notification.permission !== 'granted') {
    return;
  }

  new Notification(title, {
    body,
    tag: 'menu-diario-change',
  });
}
