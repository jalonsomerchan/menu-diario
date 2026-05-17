import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { watchUserDishes } from '../lib/dishes/repository';
import { getUpcomingDates, getWeekStartForDate, getWeekStartsForDates, toIsoDate } from '../lib/menu/dates';
import { createDayEditModalController } from '../lib/menu/day-edit-modal';
import { serializeDay } from '../lib/menu/day-state';
import { renderPlateRow } from '../lib/menu/day-editor';
import { normalizeDay } from '../lib/menu/normalizers';
import { attachDishSuggestions } from '../lib/menu/dish-suggestions';
import {
  clearMenuDay,
  ensureUserProfile,
  getOrCreateWeekMenus,
  updateMenuDay,
  watchUserProfile,
  watchWeekMenusByIds,
} from '../lib/menu/repository';
import type { DailyMenu, Dish, FirebaseUser, MealEntry, MealSlot, UserProfile, WeekMenu } from '../lib/menu/types';
import { notifyMenuChanged, requestChangeNotifications } from '../lib/notifications/browser';
import { getNetworkStatus, watchNetworkStatus } from '../lib/pwa/network-status';
import { readLastOfflineMenuCache, saveOfflineMenuCache } from '../lib/pwa/offline-cache';
import { shouldBlockOfflineWrites } from '../lib/pwa/offline-sync';
import { createSaveFeedback } from '../lib/ui/save-feedback';

const root = document.querySelector<HTMLElement>('[data-dashboard-app]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const status = root.querySelector<HTMLElement>('[data-status]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const content = root.querySelector<HTMLElement>('[data-content]');
  const userLabel = root.querySelector<HTMLElement>('[data-user-label]');
  const todaySummary = root.querySelector<HTMLElement>('[data-today-summary]');
  const nextDays = root.querySelector<HTMLElement>('[data-next-days]');
  const offlineBanner = root.querySelector<HTMLElement>('[data-offline-banner]');
  const offlineMessage = root.querySelector<HTMLElement>('[data-offline-message]');

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentMenu: WeekMenu | null = null;
  let currentMenus: WeekMenu[] = [];
  let currentMenuIdsByWeekStart: Record<string, string> = {};
  let dishes: Dish[] = [];
  let unsubscribeMenu: (() => void) | undefined;
  let unsubscribeDishes: (() => void) | undefined;
  let unsubscribeProfile: (() => void) | undefined;
  let firstMenuLoad = true;
  let isOnline = getNetworkStatus() === 'online';
  let isReadOnlyOffline = !isOnline;
  const saveFeedback = createSaveFeedback(status, {
    pending: labels.savePending,
    saving: labels.saveSaving,
    saved: labels.saveSaved,
  });

  attachDishSuggestions(root, () => dishes);

  function escapeHtml(value = '') {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function showStatus(message: string, isError = false) {
    if (isError) {
      saveFeedback.error(message);
      return;
    }
    saveFeedback.info(message);
  }

  function formatError(error: unknown) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      return labels.permissionsError;
    }
    return error instanceof Error ? error.message : String(error);
  }

  function updateOfflineState(message = labels.offlineReadOnly) {
    isReadOnlyOffline = !isOnline;
    if (!offlineBanner) return;

    offlineBanner.hidden = isOnline;
    if (offlineMessage) offlineMessage.textContent = message;
  }

  function getEnabledMeals(): MealSlot[] {
    return currentProfile?.enabledMeals?.length ? currentProfile.enabledMeals : ['lunch'];
  }

  function mealLabel(meal: MealSlot) {
    return labels[meal] ?? meal;
  }

  function reasonLabel(reason: string) {
    if (reason === 'away') return labels.reasonAway;
    if (reason === 'eating-out') return labels.reasonEatingOut;
    if (reason === 'not-hungry') return labels.reasonNotHungry;
    if (reason === 'other') return labels.reasonOther;
    return '';
  }

  function renderMealSummary(meal: MealEntry) {
    if (meal.skipped) {
      const reason = reasonLabel(meal.reason);
      return reason ? `${labels.skipSummary}: ${reason}` : labels.skipSummary;
    }

    return meal.items.length ? meal.items.join(', ') : labels.todayEmpty;
  }

  function renderDaySummary(day: DailyMenu, meal: MealSlot) {
    if (day.skipped) {
      const reason = reasonLabel(day.reason ?? '');
      return reason ? `${labels.skipSummary}: ${reason}` : labels.skipSummary;
    }

    return renderMealSummary(day.meals[meal]);
  }

  function getNextSevenDates() {
    return getUpcomingDates(new Date(), 1, 7);
  }

  function getRelevantWeekStarts() {
    return getWeekStartsForDates([toIsoDate(new Date()), ...getNextSevenDates()]);
  }

  function getMenuIdForDay(dayKey: string) {
    return currentMenuIdsByWeekStart[getWeekStartForDate(dayKey)] ?? '';
  }

  function getMenuForDay(dayKey: string) {
    const weekStart = getWeekStartForDate(dayKey);
    return currentMenus.find((menu) => menu.weekStart === weekStart) ?? null;
  }

  function buildDisplayMenu(menus: WeekMenu[]) {
    const today = toIsoDate(new Date());
    const days = Object.fromEntries(
      [today, ...getNextSevenDates()].map((dayKey) => [dayKey, normalizeDay(getMenuForDay(dayKey)?.days?.[dayKey])])
    );
    const todayWeekStart = getWeekStartForDate(today);
    const primaryMenu = menus.find((menu) => menu.weekStart === todayWeekStart);

    return {
      id: primaryMenu?.id ?? '',
      title: primaryMenu?.title ?? '',
      ownerId: primaryMenu?.ownerId ?? currentUser?.uid ?? '',
      members: primaryMenu?.members ?? (currentUser ? [currentUser.uid] : []),
      inviteCode: primaryMenu?.inviteCode ?? '',
      weekStart: todayWeekStart,
      days,
      updatedAt: primaryMenu?.updatedAt,
      updatedBy: primaryMenu?.updatedBy,
    } satisfies WeekMenu;
  }

  function formatWeekday(isoDate: string) {
    return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(`${isoDate}T00:00:00`));
  }

  function getDayNumber(isoDate: string) {
    return new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(new Date(`${isoDate}T00:00:00`));
  }

  function applyTheme(theme: UserProfile['theme']) {
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.dataset.theme = theme;
    }
  }

  function setVisible(isReady: boolean) {
    if (loading) loading.hidden = isReady;
    if (content) content.hidden = !isReady;
  }

  function renderToday(menu: WeekMenu) {
    if (!todaySummary) return;

    const day = normalizeDay(menu.days[toIsoDate(new Date())]);
    const firstMeal = getEnabledMeals()[0] ?? 'lunch';
    const meal = day.meals[firstMeal];
    const items = day.skipped || meal.skipped || meal.items.length === 0 ? [renderDaySummary(day, firstMeal)] : meal.items;

    todaySummary.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  }

  function renderNextSeven(menu: WeekMenu) {
    if (!nextDays) return;

    const disabledAttr = isReadOnlyOffline ? 'disabled aria-disabled="true"' : '';
    nextDays.innerHTML = getNextSevenDates()
      .map((isoDate) => {
        const day = normalizeDay(menu.days[isoDate]);
        const summaries = getEnabledMeals()
          .map(
            (meal) => `
              <div class="day-meal-row">
                <span>${escapeHtml(mealLabel(meal))}:</span>
                <strong>${escapeHtml(renderDaySummary(day, meal))}</strong>
              </div>
            `
          )
          .join('');

        return `
          <article class="next-day-card next-day-card--mockup" data-day="${isoDate}">
            <div class="next-day-card__number">${escapeHtml(getDayNumber(isoDate))}</div>
            <div class="next-day-card__body">
              <header class="dashboard-day-card__header">
                <div class="dashboard-day-card__title">
                  <h3>${escapeHtml(formatWeekday(isoDate))}</h3>
                  <p>${escapeHtml(new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(`${isoDate}T00:00:00`)))}</p>
                </div>
                <details class="day-actions">
                  <summary aria-label="${escapeHtml(labels.moreActions)}">⋯</summary>
                  <div>
                    <button type="button" data-quick-edit="${isoDate}" ${disabledAttr}>${escapeHtml(labels.editDay)}</button>
                    <button type="button" data-clear-day="${isoDate}" ${disabledAttr}>${escapeHtml(labels.deleteDay)}</button>
                  </div>
                </details>
              </header>
              <div class="dashboard-day-card__meals">${summaries}</div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function openQuickEdit(dayKey: string) {
    if (isReadOnlyOffline) {
      showStatus(labels.offlineReadOnly, true);
      return;
    }
    dayEditModal.open(dayKey);
  }

  function syncRenderedDayStates(container: ParentNode, dates: string[]) {
    dates.forEach((dayKey) => {
      const card = container.querySelector<HTMLElement>(`[data-day="${dayKey}"]`);
      if (!card) return;
      card.dataset.dayState = serializeDay(currentMenu?.days[dayKey] ?? normalizeDay(undefined));
    });
  }

  function updateLocalDay(dayKey: string, nextDay: DailyMenu) {
    currentMenu = currentMenu
      ? {
          ...currentMenu,
          days: {
            ...currentMenu.days,
            [dayKey]: nextDay,
          },
        }
      : currentMenu;

    currentMenus = currentMenus.map((menu) =>
      menu.weekStart === getWeekStartForDate(dayKey)
        ? {
            ...menu,
            days: {
              ...menu.days,
              [dayKey]: nextDay,
            },
          }
        : menu
    );
  }

  async function saveDay(dayKey: string, nextDay: DailyMenu, card?: HTMLElement) {
    if (shouldBlockOfflineWrites(isOnline)) {
      throw new Error(labels.offlineReadOnly);
    }

    if (!currentUser) return;
    const menuId = getMenuIdForDay(dayKey);
    if (!menuId) return;
    const nextState = serializeDay(nextDay);
    const savedState = serializeDay(currentMenu?.days[dayKey] ?? normalizeDay(undefined));
    if (savedState === nextState) {
      saveFeedback.saved();
      return;
    }

    saveFeedback.saving();
    const services = await getFirebaseServices();
    const changed = await updateMenuDay(services, menuId, currentUser.uid, dayKey, nextDay, currentProfile?.groupId);
    card?.setAttribute('data-day-state', nextState);
    updateLocalDay(dayKey, nextDay);
    saveFeedback.saved(changed ? labels.saveSaved : labels.saveSaved);
  }

  function cacheCurrentMenu(menu = currentMenu) {
    const todayMenuId = getMenuIdForDay(toIsoDate(new Date()));
    if (!menu || !currentUser || !todayMenuId) return;

    saveOfflineMenuCache({
      userId: currentUser.uid,
      menuId: todayMenuId,
      menu,
      profile: {
        displayName: currentProfile?.displayName || currentUser.displayName || currentUser.email || labels.guestSession,
        enabledMeals: getEnabledMeals(),
        theme: currentProfile?.theme ?? 'system',
      },
    });
  }

  function renderOfflineCache() {
    const cached = readLastOfflineMenuCache();
    if (!cached) {
      setVisible(false);
      showStatus(labels.offlineNoCache, true);
      updateOfflineState(labels.offlineNoCache);
      return;
    }

    currentUser = { uid: cached.userId, displayName: cached.profile.displayName };
    currentMenuIdsByWeekStart = { [getWeekStartForDate(cached.menu.weekStart)]: cached.menuId };
    currentMenus = [cached.menu];
    currentProfile = {
      id: cached.userId,
      displayName: cached.profile.displayName,
      email: '',
      enabledMeals: cached.profile.enabledMeals,
      theme: cached.profile.theme,
    };
    if (userLabel) userLabel.textContent = `${labels.hello} ${cached.profile.displayName}`;
    applyTheme(cached.profile.theme);
    renderDashboard(cached.menu);
    updateOfflineState(`${labels.offlineCached} ${new Date(cached.savedAt).toLocaleString(locale)}. ${labels.offlineReadOnly}`);
  }

  function addPlate(card: HTMLElement, meal: MealSlot) {
    if (isReadOnlyOffline) {
      showStatus(labels.offlineReadOnly, true);
      return;
    }

    const list = card.querySelector<HTMLElement>(`[data-plate-list="${meal}"]`);
    if (!list) return;

    list.insertAdjacentHTML('beforeend', renderPlateRow(labels, meal, '', list.children.length, dishes));
    list.querySelector<HTMLInputElement>('.plate-row:last-child input')?.focus();
  }

  function renderDashboard(menu: WeekMenu) {
    currentMenu = menu;
    setVisible(true);
    renderToday(menu);
    renderNextSeven(menu);
    syncRenderedDayStates(nextDays ?? root, getNextSevenDates());
  }

  const dayEditModal = createDayEditModalController({
    root,
    labels,
    getDay: (dayKey) => normalizeDay(currentMenu?.days[dayKey]),
    getDishes: () => dishes,
    getEnabledMeals,
    getSavedDayState: (dayKey) => serializeDay(currentMenu?.days[dayKey] ?? normalizeDay(undefined)),
    getDayNumber,
    getWeekday: formatWeekday,
    canWrite: () => !shouldBlockOfflineWrites(isOnline),
    getWriteErrorMessage: () => labels.offlineReadOnly,
    onSaveDay: (dayKey, nextDay, card) => saveDay(dayKey, nextDay, card),
    onClearDay: async (dayKey) => {
      if (shouldBlockOfflineWrites(isOnline) || !currentUser) {
        showStatus(labels.offlineReadOnly, true);
        return false;
      }

      const menuId = getMenuIdForDay(dayKey);
      if (!menuId) return false;
      const services = await getFirebaseServices();
      await clearMenuDay(services, menuId, currentUser.uid, dayKey);
      return true;
    },
  });

  watchNetworkStatus((networkStatus) => {
    const wasOffline = !isOnline;
    isOnline = networkStatus === 'online';
    updateOfflineState();

    if (!isOnline && !currentMenu) {
      renderOfflineCache();
    }

    if (isOnline && wasOffline) {
      showStatus(labels.backOnline);
      if (currentMenu) renderDashboard(currentMenu);
    }
  });

  if (!hasFirebaseConfig()) {
    setVisible(false);
    showStatus(labels.configMissing, true);
  } else if (!isOnline) {
    renderOfflineCache();
  } else {
    getFirebaseServices()
      .then((services) => {
        root.querySelector('[data-notifications]')?.addEventListener('click', async () => {
          const permission = await requestChangeNotifications();
          showStatus(permission === 'granted' ? labels.notificationsEnabled : labels.notificationsDenied, permission !== 'granted');
        });

        nextDays?.addEventListener('click', async (event) => {
          const target = event.target;
          if (!(target instanceof HTMLButtonElement)) return;

          if (target.dataset.quickEdit) {
            openQuickEdit(target.dataset.quickEdit);
            return;
          }

          if (target.dataset.clearDay && currentUser) {
            if (shouldBlockOfflineWrites(isOnline)) {
              showStatus(labels.offlineReadOnly, true);
              return;
            }
            const menuId = getMenuIdForDay(target.dataset.clearDay);
            if (!menuId) return;
            await clearMenuDay(services, menuId, currentUser.uid, target.dataset.clearDay);
          }
        });

        services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
          currentUser = user;
          unsubscribeMenu?.();
          unsubscribeDishes?.();
          unsubscribeProfile?.();

          if (!user) {
            window.location.assign(labels.homePath || '/');
            return;
          }

          if (userLabel) userLabel.textContent = `${labels.hello} ${user.displayName || user.email || labels.guestSession}`;

          await ensureUserProfile(services, user, labels.guestSession);
          currentMenuIdsByWeekStart = await getOrCreateWeekMenus(services, user.uid, getRelevantWeekStarts(), locale);
          currentMenus = [];
          firstMenuLoad = true;

          unsubscribeProfile = watchUserProfile(
            services,
            user,
            labels.guestSession,
            (profile) => {
              currentProfile = profile;
              applyTheme(profile.theme);
              unsubscribeDishes?.();
              unsubscribeDishes = watchUserDishes(
                services,
                user.uid,
                (nextDishes) => {
                  dishes = nextDishes;
                  if (currentMenu) renderDashboard(currentMenu);
                },
                (error) => showStatus(formatError(error), true),
                false,
                profile.groupId
              );
              if (currentMenu) {
                renderDashboard(currentMenu);
                cacheCurrentMenu(currentMenu);
              }
            },
            (error) => showStatus(formatError(error), true)
          );

          unsubscribeMenu = watchWeekMenusByIds(
            services,
            Object.values(currentMenuIdsByWeekStart),
            (menus) => {
              currentMenus = menus;
              const mergedMenu = buildDisplayMenu(menus);
              const changedByOtherUser = !firstMenuLoad && menus.some((menu) => menu.updatedBy && menu.updatedBy !== currentUser?.uid);
              renderDashboard(mergedMenu);
              cacheCurrentMenu(mergedMenu);
              if (changedByOtherUser) notifyMenuChanged(labels.updated, labels.updatedBody);
              firstMenuLoad = menus.length < Object.keys(currentMenuIdsByWeekStart).length;
            },
            (error) => showStatus(formatError(error), true)
          );
        });
      })
      .catch((error: Error) => {
        if (!isOnline) {
          renderOfflineCache();
          return;
        }
        showStatus(formatError(error), true);
      });
  }
}
