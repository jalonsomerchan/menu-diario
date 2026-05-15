type FirebaseUser = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
};

type DailyMenu = {
  lunch: string;
  dinner: string;
  notes: string;
};

type WeekMenu = {
  id: string;
  title: string;
  ownerId: string;
  members: string[];
  inviteCode: string;
  weekStart: string;
  days: Record<string, DailyMenu>;
  updatedAt?: Date;
  updatedBy?: string;
};

const firebaseVersion = '12.6.0';
const collectionName = 'weeklyMenus';
const dayLabels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const root = document.querySelector<HTMLElement>('[data-menu-app]');

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getMonday(input = new Date()) {
  const date = new Date(input);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function shiftWeek(weekStart: string, amount: number) {
  const date = new Date(`${weekStart}T00:00:00`);
  date.setDate(date.getDate() + amount * 7);
  return toIsoDate(date);
}

function getWeekDays(weekStart: string) {
  const start = new Date(`${weekStart}T00:00:00`);
  return dayLabels.map((label, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { key: toIsoDate(date), label, isoDate: toIsoDate(date) };
  });
}

function formatShortDate(isoDate: string) {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(
    new Date(`${isoDate}T00:00:00`)
  );
}

function getWeekTitle(weekStart: string) {
  const days = getWeekDays(weekStart);
  return `${formatShortDate(days[0].isoDate)} - ${formatShortDate(days[6].isoDate)}`;
}

function emptyDay(): DailyMenu {
  return { lunch: '', dinner: '', notes: '' };
}

function buildEmptyDays(weekStart: string) {
  return Object.fromEntries(getWeekDays(weekStart).map((day) => [day.key, emptyDay()]));
}

function createInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getFirebaseConfig() {
  return {
    apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: import.meta.env.PUBLIC_FIREBASE_APP_ID ?? '',
    measurementId: import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
  };
}

function hasFirebaseConfig() {
  const config = getFirebaseConfig();
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

function canUseNotifications() {
  return 'Notification' in window;
}

async function requestChangeNotifications() {
  if (!canUseNotifications()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

function notifyMenuChanged(title: string, body: string) {
  if (!canUseNotifications() || Notification.permission !== 'granted') return;
  new Notification(title, { body, tag: 'menu-diario-change' });
}

async function importFirebaseModule(path: 'app' | 'auth' | 'firestore') {
  return import(/* @vite-ignore */ `https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-${path}.js`);
}

async function createFirebaseServices() {
  const [appModule, authModule, firestoreModule] = await Promise.all([
    importFirebaseModule('app'),
    importFirebaseModule('auth'),
    importFirebaseModule('firestore'),
  ]);
  const app = appModule.initializeApp(getFirebaseConfig());
  const auth = authModule.getAuth(app);
  const db = firestoreModule.getFirestore(app);
  return { auth, db, authModule, firestoreModule };
}

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const status = root.querySelector<HTMLElement>('[data-status]');
  const authPanel = root.querySelector<HTMLElement>('[data-auth-panel]');
  const workspace = root.querySelector<HTMLElement>('[data-workspace]');
  const daysContainer = root.querySelector<HTMLElement>('[data-days]');
  const weekTitle = root.querySelector<HTMLElement>('[data-week-title]');
  const userLabel = root.querySelector<HTMLElement>('[data-user-label]');
  const inviteInput = root.querySelector<HTMLInputElement>('#invite-code');

  let currentUser: FirebaseUser | null = null;
  let currentMenuId = '';
  let currentWeekStart = toIsoDate(getMonday());
  let currentMenu: WeekMenu | null = null;
  let unsubscribeMenu: (() => void) | undefined;
  let firstMenuLoad = true;

  function escapeHtml(value = '') {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function showStatus(message: string, isError = false) {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.dataset.variant = isError ? 'error' : 'info';
  }

  function clearStatus() {
    if (!status) return;
    status.hidden = true;
    status.textContent = '';
  }

  function setAuthenticated(isAuthenticated: boolean) {
    if (authPanel) authPanel.hidden = isAuthenticated;
    if (workspace) workspace.hidden = !isAuthenticated;
  }

  function getMenuIdFromUrl() {
    return new URLSearchParams(window.location.search).get('menu') ?? '';
  }

  function setMenuIdInUrl(menuId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('menu', menuId);
    window.history.replaceState({}, '', url);
  }

  function normalizeMenu(snapshot: any): WeekMenu | null {
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    return {
      id: snapshot.id,
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

  async function ensureUserProfile(services: any, user: FirebaseUser) {
    const { db, firestoreModule } = services;
    await firestoreModule.setDoc(
      firestoreModule.doc(db, 'users', user.uid),
      {
        displayName: user.displayName ?? labels.guestSession,
        updatedAt: firestoreModule.serverTimestamp(),
      },
      { merge: true }
    );
  }

  async function createWeekMenu(services: any, userId: string, weekStart: string) {
    const { db, firestoreModule } = services;
    const document = await firestoreModule.addDoc(firestoreModule.collection(db, collectionName), {
      title: getWeekTitle(weekStart),
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

  async function getLatestMenuForUser(services: any, userId: string) {
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

  function watchWeekMenu(services: any, menuId: string, callback: (menu: WeekMenu | null) => void) {
    const { db, firestoreModule } = services;
    return firestoreModule.onSnapshot(
      firestoreModule.doc(db, collectionName, menuId),
      (snapshot: any) => callback(normalizeMenu(snapshot)),
      (error: Error) => showStatus(error.message, true)
    );
  }

  async function updateMenuField(services: any, dayKey: string, slot: string, value: string) {
    if (!currentUser || !currentMenuId) return;
    const { db, firestoreModule } = services;
    await firestoreModule.updateDoc(firestoreModule.doc(db, collectionName, currentMenuId), {
      [`days.${dayKey}.${slot}`]: value,
      updatedAt: firestoreModule.serverTimestamp(),
      updatedBy: currentUser.uid,
    });
  }

  async function joinMenuByInviteCode(services: any, userId: string, inviteCode: string) {
    const { db, firestoreModule } = services;
    const menusQuery = firestoreModule.query(
      firestoreModule.collection(db, collectionName),
      firestoreModule.where('inviteCode', '==', inviteCode),
      firestoreModule.limit(1)
    );
    const snapshot = await firestoreModule.getDocs(menusQuery);
    const menu = snapshot.docs[0];
    if (!menu) throw new Error(labels.joinError);

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

  function renderMenu(menu: WeekMenu) {
    if (!daysContainer || !weekTitle) return;
    weekTitle.textContent = menu.title || getWeekTitle(menu.weekStart);
    if (inviteInput) inviteInput.value = '';

    const today = toIsoDate(new Date());
    daysContainer.innerHTML = getWeekDays(menu.weekStart)
      .map((day) => {
        const data = menu.days[day.key] ?? emptyDay();
        const badge = day.isoDate === today ? `<span class="day-card__today">${labels.today}</span>` : '';
        return `
          <article class="day-card" data-day="${day.key}">
            <header class="day-card__header">
              <div><h3>${escapeHtml(day.label)}</h3><p>${formatShortDate(day.isoDate)}</p></div>${badge}
            </header>
            <label>${labels.lunch}<textarea data-field="lunch" rows="2" placeholder="${labels.empty}">${escapeHtml(data.lunch)}</textarea></label>
            <label>${labels.dinner}<textarea data-field="dinner" rows="2" placeholder="${labels.empty}">${escapeHtml(data.dinner)}</textarea></label>
            <label>${labels.notes}<textarea data-field="notes" rows="2" placeholder="${labels.notes}">${escapeHtml(data.notes)}</textarea></label>
          </article>
        `;
      })
      .join('');
  }

  if (!hasFirebaseConfig()) {
    setAuthenticated(false);
    showStatus(labels.configMissing, true);
  } else {
    createFirebaseServices()
      .then((services) => {
        async function selectMenu(menuId: string) {
          if (!currentUser) return;
          unsubscribeMenu?.();
          currentMenuId = menuId;
          firstMenuLoad = true;
          setMenuIdInUrl(menuId);
          unsubscribeMenu = watchWeekMenu(services, menuId, (menu) => {
            if (!menu) {
              showStatus(labels.notFoundMenu, true);
              return;
            }
            const changedByOtherUser = !firstMenuLoad && menu.updatedBy && menu.updatedBy !== currentUser?.uid;
            currentMenu = menu;
            currentWeekStart = menu.weekStart;
            renderMenu(menu);
            if (changedByOtherUser) notifyMenuChanged(labels.updated, labels.updatedBody);
            firstMenuLoad = false;
          });
        }

        async function ensureActiveMenu(user: FirebaseUser) {
          await ensureUserProfile(services, user);
          const urlMenuId = getMenuIdFromUrl();
          const menuId =
            urlMenuId ||
            (await getLatestMenuForUser(services, user.uid)) ||
            (await createWeekMenu(services, user.uid, currentWeekStart));
          await selectMenu(menuId);
        }

        async function saveField(target: HTMLTextAreaElement) {
          const card = target.closest<HTMLElement>('[data-day]');
          const slot = target.dataset.field;
          if (!card || !slot) return;
          await updateMenuField(services, card.dataset.day ?? '', slot, target.value.trim());
        }

        root.querySelector('[data-google-login]')?.addEventListener('click', async () => {
          const provider = new services.authModule.GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          await services.authModule.signInWithPopup(services.auth, provider).catch((error: Error) => showStatus(error.message, true));
        });
        root.querySelector('[data-guest-login]')?.addEventListener('click', () =>
          services.authModule.signInAnonymously(services.auth).catch((error: Error) => showStatus(error.message, true))
        );
        root.querySelector('[data-logout]')?.addEventListener('click', () => services.authModule.signOut(services.auth));
        root.querySelector('[data-notifications]')?.addEventListener('click', async () => {
          const permission = await requestChangeNotifications();
          showStatus(permission === 'granted' ? labels.notificationsEnabled : labels.notificationsDenied, permission !== 'granted');
        });
        root.querySelector('[data-new-week]')?.addEventListener('click', async () => {
          if (!currentUser) return;
          const menuId = await createWeekMenu(services, currentUser.uid, currentWeekStart);
          await selectMenu(menuId);
        });
        root.querySelector('[data-prev-week]')?.addEventListener('click', () => {
          currentWeekStart = shiftWeek(currentWeekStart, -1);
          if (currentMenu) renderMenu({ ...currentMenu, weekStart: currentWeekStart, title: getWeekTitle(currentWeekStart), days: {} });
        });
        root.querySelector('[data-next-week]')?.addEventListener('click', () => {
          currentWeekStart = shiftWeek(currentWeekStart, 1);
          if (currentMenu) renderMenu({ ...currentMenu, weekStart: currentWeekStart, title: getWeekTitle(currentWeekStart), days: {} });
        });
        root.querySelector('[data-share-code]')?.addEventListener('click', async () => {
          if (!currentMenu?.inviteCode) return;
          await navigator.clipboard?.writeText(currentMenu.inviteCode);
          showStatus(`${labels.codeCopied}: ${currentMenu.inviteCode}`);
        });
        root.querySelector('[data-join-form]')?.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (!currentUser || !inviteInput?.value.trim()) return;
          const menuId = await joinMenuByInviteCode(services, currentUser.uid, inviteInput.value.trim().toUpperCase()).catch((error: Error) => {
            showStatus(error.message, true);
            return '';
          });
          if (menuId) {
            await selectMenu(menuId);
            clearStatus();
          }
        });
        daysContainer?.addEventListener('change', (event) => {
          const target = event.target;
          if (target instanceof HTMLTextAreaElement) saveField(target).catch((error) => showStatus(error.message, true));
        });
        services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
          currentUser = user;
          setAuthenticated(Boolean(user));
          unsubscribeMenu?.();
          if (!user) return;
          if (userLabel) userLabel.textContent = user.displayName || user.email || labels.guestSession;
          await ensureActiveMenu(user).catch((error: Error) => showStatus(error.message, true));
        });
      })
      .catch((error: Error) => showStatus(error.message, true));
  }
}
