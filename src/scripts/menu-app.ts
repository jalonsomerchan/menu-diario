import { onAuthStateChanged, type User } from 'firebase/auth';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { closeSession, getFirebaseServices, signInAsGuest, signInWithGoogle } from '../lib/firebase/client';
import { formatShortDate, getMonday, getWeekDays, getWeekTitle, shiftWeek, toIsoDate } from '../lib/menu/dates';
import {
  createWeekMenu,
  ensureUserProfile,
  getLatestMenuForUser,
  joinMenuByInviteCode,
  updateMenuPatch,
  watchWeekMenu,
} from '../lib/menu/repository';
import type { WeekMenu } from '../lib/menu/types';
import { notifyMenuChanged, requestChangeNotifications } from '../lib/notifications/browser';

const root = document.querySelector<HTMLElement>('[data-menu-app]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const status = root.querySelector<HTMLElement>('[data-status]');
  const authPanel = root.querySelector<HTMLElement>('[data-auth-panel]');
  const workspace = root.querySelector<HTMLElement>('[data-workspace]');
  const daysContainer = root.querySelector<HTMLElement>('[data-days]');
  const weekTitle = root.querySelector<HTMLElement>('[data-week-title]');
  const userLabel = root.querySelector<HTMLElement>('[data-user-label]');
  const inviteInput = root.querySelector<HTMLInputElement>('#invite-code');

  let currentUser: User | null = null;
  let currentMenuId = '';
  let currentWeekStart = toIsoDate(getMonday());
  let currentMenu: WeekMenu | null = null;
  let unsubscribeMenu: (() => void) | undefined;
  let firstMenuLoad = true;

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

  async function selectMenu(menuId: string) {
    if (!currentUser) return;
    const { db } = getFirebaseServices();

    unsubscribeMenu?.();
    currentMenuId = menuId;
    firstMenuLoad = true;
    setMenuIdInUrl(menuId);

    unsubscribeMenu = watchWeekMenu(db, menuId, (menu) => {
      if (!menu) {
        showStatus('No se ha encontrado este menú.', true);
        return;
      }

      const changedByOtherUser = !firstMenuLoad && menu.updatedBy && menu.updatedBy !== currentUser?.uid;
      currentMenu = menu;
      currentWeekStart = menu.weekStart;
      renderMenu(menu);

      if (changedByOtherUser) {
        notifyMenuChanged(labels.updated, labels.updatedBody);
      }

      firstMenuLoad = false;
    });
  }

  async function ensureActiveMenu(user: User) {
    const { db } = getFirebaseServices();
    await ensureUserProfile(db, user.uid, user.displayName);

    const urlMenuId = getMenuIdFromUrl();
    const menuId = urlMenuId || (await getLatestMenuForUser(db, user.uid)) || (await createWeekMenu(db, user.uid, currentWeekStart));
    await selectMenu(menuId);
  }

  function renderMenu(menu: WeekMenu) {
    if (!daysContainer || !weekTitle) return;

    weekTitle.textContent = menu.title || getWeekTitle(menu.weekStart);
    if (inviteInput) inviteInput.value = '';

    const today = toIsoDate(new Date());
    const days = getWeekDays(menu.weekStart);

    daysContainer.innerHTML = days
      .map((day) => {
        const data = menu.days[day.key] ?? { lunch: '', dinner: '', notes: '' };
        const badge = day.isoDate === today ? `<span class="day-card__today">${labels.today}</span>` : '';

        return `
          <article class="day-card" data-day="${day.key}">
            <header class="day-card__header">
              <div>
                <h3>${day.label}</h3>
                <p>${formatShortDate(day.isoDate)}</p>
              </div>
              ${badge}
            </header>
            <label>${labels.lunch}<textarea data-field="lunch" rows="2" placeholder="${labels.empty}">${data.lunch}</textarea></label>
            <label>${labels.dinner}<textarea data-field="dinner" rows="2" placeholder="${labels.empty}">${data.dinner}</textarea></label>
            <label>${labels.notes}<textarea data-field="notes" rows="2" placeholder="${labels.notes}">${data.notes}</textarea></label>
          </article>
        `;
      })
      .join('');
  }

  async function saveField(target: HTMLTextAreaElement) {
    if (!currentUser || !currentMenuId) return;
    const card = target.closest<HTMLElement>('[data-day]');
    const slot = target.dataset.field;

    if (!card || !slot) return;

    const { db } = getFirebaseServices();
    await updateMenuPatch(db, currentMenuId, currentUser.uid, {
      dayKey: card.dataset.day ?? '',
      slot: slot as 'lunch' | 'dinner' | 'notes',
      value: target.value.trim(),
    });
  }

  if (!hasFirebaseConfig()) {
    setAuthenticated(false);
    showStatus(labels.configMissing, true);
  } else {
    const { auth, db } = getFirebaseServices();

    root.querySelector('[data-google-login]')?.addEventListener('click', () => signInWithGoogle().catch((error) => showStatus(error.message, true)));
    root.querySelector('[data-guest-login]')?.addEventListener('click', () => signInAsGuest().catch((error) => showStatus(error.message, true)));
    root.querySelector('[data-logout]')?.addEventListener('click', () => closeSession());
    root.querySelector('[data-notifications]')?.addEventListener('click', async () => {
      const permission = await requestChangeNotifications();
      showStatus(permission === 'granted' ? 'Avisos activados.' : 'No se han podido activar los avisos.', permission !== 'granted');
    });

    root.querySelector('[data-new-week]')?.addEventListener('click', async () => {
      if (!currentUser) return;
      const menuId = await createWeekMenu(db, currentUser.uid, currentWeekStart);
      await selectMenu(menuId);
    });

    root.querySelector('[data-prev-week]')?.addEventListener('click', () => {
      currentWeekStart = shiftWeek(currentWeekStart, -1);
      if (currentMenu) renderMenu({ ...currentMenu, weekStart: currentWeekStart, title: getWeekTitle(currentWeekStart) });
    });

    root.querySelector('[data-next-week]')?.addEventListener('click', () => {
      currentWeekStart = shiftWeek(currentWeekStart, 1);
      if (currentMenu) renderMenu({ ...currentMenu, weekStart: currentWeekStart, title: getWeekTitle(currentWeekStart) });
    });

    root.querySelector('[data-share-code]')?.addEventListener('click', async () => {
      if (!currentMenu?.inviteCode) return;
      await navigator.clipboard?.writeText(currentMenu.inviteCode);
      showStatus(`Código copiado: ${currentMenu.inviteCode}`);
    });

    root.querySelector('[data-join-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!currentUser || !inviteInput?.value.trim()) return;

      try {
        const menuId = await joinMenuByInviteCode(db, currentUser.uid, inviteInput.value.trim().toUpperCase());
        await selectMenu(menuId);
        clearStatus();
      } catch (error) {
        showStatus(error instanceof Error ? error.message : 'No se pudo unir al menú.', true);
      }
    });

    daysContainer?.addEventListener('change', (event) => {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement) {
        saveField(target).catch((error) => showStatus(error.message, true));
      }
    });

    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      setAuthenticated(Boolean(user));
      unsubscribeMenu?.();

      if (!user) return;

      userLabel && (userLabel.textContent = user.displayName || user.email || 'Sesión invitada');
      await ensureActiveMenu(user).catch((error) => showStatus(error.message, true));
    });
  }
}
