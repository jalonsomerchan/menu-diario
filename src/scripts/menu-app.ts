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
  watchUserMenus,
  watchWeekMenu,
} from '../lib/menu/repository';
import type { WeekMenu } from '../lib/menu/types';
import { notifyMenuChanged, requestChangeNotifications } from '../lib/notifications/browser';

const root = document.querySelector<HTMLElement>('[data-menu-app]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const dayLabels = (labels.days ?? '').split('|').filter(Boolean);
  const status = root.querySelector<HTMLElement>('[data-status]');
  const authPanel = root.querySelector<HTMLElement>('[data-auth-panel]');
  const workspace = root.querySelector<HTMLElement>('[data-workspace]');
  const daysContainer = root.querySelector<HTMLElement>('[data-days]');
  const menuLists = root.querySelector<HTMLElement>('[data-menu-lists]');
  const weekTitle = root.querySelector<HTMLElement>('[data-week-title]');
  const userLabel = root.querySelector<HTMLElement>('[data-user-label]');
  const inviteInput = root.querySelector<HTMLInputElement>('#invite-code');

  let currentUser: User | null = null;
  let currentMenuId = '';
  let currentWeekStart = toIsoDate(getMonday());
  let currentMenu: WeekMenu | null = null;
  let unsubscribeMenu: (() => void) | undefined;
  let unsubscribeMenus: (() => void) | undefined;
  let firstMenuLoad = true;

  function escapeHtml(value = '') {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
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

  async function selectMenu(menuId: string) {
    if (!currentUser) return;
    const { db } = getFirebaseServices();

    unsubscribeMenu?.();
    currentMenuId = menuId;
    firstMenuLoad = true;
    setMenuIdInUrl(menuId);

    unsubscribeMenu = watchWeekMenu(db, menuId, (menu) => {
      if (!menu) {
        showStatus(labels.notFoundMenu, true);
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

    const menuId =
      getMenuIdFromUrl() ||
      (await getLatestMenuForUser(db, user.uid)) ||
      (await createWeekMenu(db, user.uid, currentWeekStart));
    await selectMenu(menuId);
  }

  function renderMenuButtons(menus: WeekMenu[]) {
    if (menus.length === 0) {
      return `<p class="menu-list__empty">${escapeHtml(labels.emptyList)}</p>`;
    }

    return menus
      .map((menu) => {
        const title = escapeHtml(menu.title || getWeekTitle(menu.weekStart, locale));
        return `<button class="menu-list__button" type="button" data-menu-select="${menu.id}">${title}</button>`;
      })
      .join('');
  }

  function renderMenuList(menus: WeekMenu[]) {
    if (!menuLists) return;

    const today = toIsoDate(new Date());
    const history = menus.filter((menu) => menu.weekStart < today);
    const upcoming = menus.filter((menu) => menu.weekStart >= today);

    menuLists.innerHTML = `
      <section class="menu-list" aria-labelledby="upcoming-menus">
        <h3 id="upcoming-menus">${escapeHtml(labels.upcoming)}</h3>
        <div>${renderMenuButtons(upcoming)}</div>
      </section>
      <section class="menu-list" aria-labelledby="historic-menus">
        <h3 id="historic-menus">${escapeHtml(labels.history)}</h3>
        <div>${renderMenuButtons(history)}</div>
      </section>
    `;
  }

  function renderMenu(menu: WeekMenu) {
    if (!daysContainer || !weekTitle) return;

    weekTitle.textContent = menu.title || getWeekTitle(menu.weekStart, locale);
    if (inviteInput) inviteInput.value = '';

    const today = toIsoDate(new Date());
    const days = getWeekDays(menu.weekStart, dayLabels);

    daysContainer.innerHTML = days
      .map((day) => {
        const data = menu.days[day.key] ?? { lunch: '', dinner: '', notes: '' };
        const badge = day.isoDate === today ? `<span class="day-card__today">${escapeHtml(labels.today)}</span>` : '';

        return `
          <article class="day-card" data-day="${day.key}">
            <header class="day-card__header">
              <div><h3>${escapeHtml(day.label)}</h3><p>${formatShortDate(day.isoDate, locale)}</p></div>${badge}
            </header>
            <label>${escapeHtml(labels.lunch)}<textarea data-field="lunch" rows="2" placeholder="${escapeHtml(labels.empty)}">${escapeHtml(data.lunch)}</textarea></label>
            <label>${escapeHtml(labels.dinner)}<textarea data-field="dinner" rows="2" placeholder="${escapeHtml(labels.empty)}">${escapeHtml(data.dinner)}</textarea></label>
            <label>${escapeHtml(labels.notes)}<textarea data-field="notes" rows="2" placeholder="${escapeHtml(labels.notes)}">${escapeHtml(data.notes)}</textarea></label>
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

    root.querySelector('[data-google-login]')?.addEventListener('click', () =>
      signInWithGoogle().catch((error) => showStatus(error.message, true))
    );
    root.querySelector('[data-guest-login]')?.addEventListener('click', () =>
      signInAsGuest().catch((error) => showStatus(error.message, true))
    );
    root.querySelector('[data-logout]')?.addEventListener('click', () => closeSession());
    root.querySelector('[data-notifications]')?.addEventListener('click', async () => {
      const permission = await requestChangeNotifications();
      showStatus(
        permission === 'granted' ? labels.notificationsEnabled : labels.notificationsDenied,
        permission !== 'granted'
      );
    });

    root.querySelector('[data-new-week]')?.addEventListener('click', async () => {
      if (!currentUser) return;
      const menuId = await createWeekMenu(db, currentUser.uid, currentWeekStart);
      await selectMenu(menuId);
    });

    root.querySelector('[data-prev-week]')?.addEventListener('click', () => {
      currentWeekStart = shiftWeek(currentWeekStart, -1);
      if (currentMenu) {
        renderMenu({ ...currentMenu, weekStart: currentWeekStart, title: getWeekTitle(currentWeekStart, locale), days: {} });
      }
    });

    root.querySelector('[data-next-week]')?.addEventListener('click', () => {
      currentWeekStart = shiftWeek(currentWeekStart, 1);
      if (currentMenu) {
        renderMenu({ ...currentMenu, weekStart: currentWeekStart, title: getWeekTitle(currentWeekStart, locale), days: {} });
      }
    });

    root.querySelector('[data-share-code]')?.addEventListener('click', async () => {
      if (!currentMenu?.inviteCode) return;
      await navigator.clipboard?.writeText(currentMenu.inviteCode);
      showStatus(`${labels.codeCopied}: ${currentMenu.inviteCode}`);
    });

    root.querySelector('[data-join-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!currentUser || !inviteInput?.value.trim()) return;

      try {
        const menuId = await joinMenuByInviteCode(db, currentUser.uid, inviteInput.value.trim().toUpperCase());
        await selectMenu(menuId);
        clearStatus();
      } catch {
        showStatus(labels.joinError, true);
      }
    });

    menuLists?.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof HTMLButtonElement && target.dataset.menuSelect) {
        selectMenu(target.dataset.menuSelect).catch((error) => showStatus(error.message, true));
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
      unsubscribeMenus?.();

      if (!user) return;

      if (userLabel) userLabel.textContent = user.displayName || user.email || labels.guestSession;
      unsubscribeMenus = watchUserMenus(db, user.uid, renderMenuList);
      await ensureActiveMenu(user).catch((error) => showStatus(error.message, true));
    });
  }
}
