import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { watchUserDishes } from '../lib/dishes/repository';
import { createDayEditModalController } from '../lib/menu/day-edit-modal';
import { serializeDay } from '../lib/menu/day-state';
import { getDatesInRange, getMonday, getWeekStartForDate, normalizeDateRange, toIsoDate } from '../lib/menu/dates';
import { getHistoryDayStatus, matchesHistoryFilters, type HistoryStatusFilter } from '../lib/menu/history';
import { normalizeDay } from '../lib/menu/normalizers';
import { attachDishSuggestions } from '../lib/menu/dish-suggestions';
import {
  clearMenuDay,
  ensureUserProfile,
  getOrCreateWeekMenu,
  updateMenuDay,
  watchUserMenusByWeekRange,
  watchUserProfile,
} from '../lib/menu/repository';
import type { Dish, FirebaseUser, MealEntry, MealSlot, UserProfile, WeekMenu } from '../lib/menu/types';
import { getNetworkStatus } from '../lib/pwa/network-status';
import { createSaveFeedback } from '../lib/ui/save-feedback';

const root = document.querySelector<HTMLElement>('[data-history-app]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const status = root.querySelector<HTMLElement>('[data-status]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const content = root.querySelector<HTMLElement>('[data-content]');
  const list = root.querySelector<HTMLElement>('[data-history-days]');
  const fromInput = root.querySelector<HTMLInputElement>('[data-date-from]');
  const toInput = root.querySelector<HTMLInputElement>('[data-date-to]');
  const queryInput = root.querySelector<HTMLInputElement>('[data-history-query]');
  const statusInput = root.querySelector<HTMLSelectElement>('[data-history-status]');
  const weekdayInput = root.querySelector<HTMLSelectElement>('[data-history-weekday]');

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let menus: WeekMenu[] = [];
  let dishes: Dish[] = [];
  let editMenuId = '';
  let unsubscribeMenus: (() => void) | undefined;
  let unsubscribeDishes: (() => void) | undefined;
  let unsubscribeProfile: (() => void) | undefined;
  let activeRange = { start: '', end: '' };
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

  function getEnabledMeals(): MealSlot[] {
    return currentProfile?.enabledMeals?.length ? currentProfile.enabledMeals : ['lunch'];
  }

  function mealLabel(meal: MealSlot) {
    return labels[meal] ?? meal;
  }

  function getDateOffset(daysFromToday: number) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + daysFromToday);
    return toIsoDate(date);
  }

  function getCurrentWeekStart() {
    return toIsoDate(getMonday(new Date()));
  }

  function getDefaultRange() {
    return normalizeDateRange(getDateOffset(-30), getDateOffset(-1));
  }

  function getSelectedRange() {
    const fallback = getDefaultRange();
    return normalizeDateRange(fromInput?.value || fallback.start, toInput?.value || fallback.end);
  }

  function getSelectedFilters() {
    return {
      query: queryInput?.value.trim() ?? '',
      status: (statusInput?.value as HistoryStatusFilter | '') || 'all',
      weekday: weekdayInput?.value || 'all',
    };
  }

  function formatWeekday(isoDate: string) {
    return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(`${isoDate}T00:00:00`));
  }

  function formatDate(isoDate: string) {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(`${isoDate}T00:00:00`));
  }

  function getDayNumber(isoDate: string) {
    return new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(new Date(`${isoDate}T00:00:00`));
  }

  function renderMealSummary(meal: MealEntry) {
    if (meal.skipped) return labels.skipSummary;
    return meal.items.length ? meal.items.join(', ') : labels.todayEmpty;
  }

  function findDay(isoDate: string) {
    for (const menu of menus) {
      if (menu.days[isoDate]) return { menu, day: normalizeDay(menu.days[isoDate]) };
    }
    return null;
  }

  function getEditingMenu() {
    return menus.find((item) => item.id === editMenuId) ?? null;
  }

  function ensureLocalMenu(menuId: string, dayKey: string) {
    const weekStart = getWeekStartForDate(dayKey);
    const existing = menus.find((menu) => menu.id === menuId);
    if (existing) return existing;

    const nextMenu: WeekMenu = {
      id: menuId,
      title: '',
      ownerId: currentUser?.uid ?? '',
      members: currentUser ? [currentUser.uid] : [],
      inviteCode: '',
      weekStart,
      days: {},
    };

    menus = [...menus, nextMenu].sort((first, second) => first.weekStart.localeCompare(second.weekStart));
    return nextMenu;
  }

  async function resolveMenuIdForDay(dayKey: string, menuId = '') {
    if (menuId) {
      ensureLocalMenu(menuId, dayKey);
      return menuId;
    }

    if (!currentUser) return '';

    const weekStart = getWeekStartForDate(dayKey);
    const existingMenu = menus.find((menu) => menu.weekStart === weekStart);
    if (existingMenu) {
      return existingMenu.id;
    }

    const services = await getFirebaseServices();
    const nextMenuId = await getOrCreateWeekMenu(services, currentUser.uid, weekStart, locale);
    ensureLocalMenu(nextMenuId, dayKey);
    return nextMenuId;
  }

  function renderHistory() {
    if (!list) return;
    const filters = getSelectedFilters();
    const rows: string[] = [];
    const enabledMeals = getEnabledMeals();

    getDatesInRange(activeRange.start, activeRange.end).forEach((isoDate) => {
      const found = findDay(isoDate);
      const day = found?.day;

      if (!matchesHistoryFilters(isoDate, day, enabledMeals, filters)) {
        return;
      }

      const dayStatus = getHistoryDayStatus(day, enabledMeals);
      const normalizedDay = normalizeDay(day);
      const summaries = enabledMeals
        .map((meal) => {
          const summary = dayStatus === 'skipped' ? labels.skipSummary : renderMealSummary(normalizedDay.meals[meal]);
          return `<div class="day-meal-row"><span>${escapeHtml(mealLabel(meal))}:</span><strong>${escapeHtml(summary)}</strong></div>`;
        })
        .join('');

      rows.unshift(`
        <article class="next-day-card next-day-card--mockup" data-day="${isoDate}" data-menu="${escapeHtml(found?.menu.id ?? '')}" data-day-status="${escapeHtml(dayStatus)}">
          <div class="next-day-card__number">${escapeHtml(getDayNumber(isoDate))}</div>
          <div class="next-day-card__body">
            <header>
              <div class="next-day-card__title">
                <h3>${escapeHtml(formatWeekday(isoDate))}</h3>
                <p>${escapeHtml(formatDate(isoDate))}</p>
              </div>
              <details class="day-actions">
                <summary aria-label="${escapeHtml(labels.moreActions)}">⋯</summary>
                <div>
                  <button type="button" data-history-edit="${isoDate}" data-menu="${escapeHtml(found?.menu.id ?? '')}">${escapeHtml(labels.editDay)}</button>
                  ${found?.menu.id ? `<button type="button" data-clear-day="${isoDate}" data-menu="${escapeHtml(found.menu.id)}">${escapeHtml(labels.deleteDay)}</button>` : ''}
                </div>
              </details>
            </header>
            ${summaries}
          </div>
        </article>
      `);
    });

    list.innerHTML = rows.length ? rows.join('') : `<p class="menu-list__empty">${escapeHtml(labels.empty)}</p>`;
  }

  function openEdit(menuId: string, dayKey: string) {
    editMenuId = menuId;
    dayEditModal.open(dayKey);
  }

  function updateLocalDay(dayKey: string, nextDay: WeekMenu['days'][string]) {
    if (!editMenuId) return;

    if (!menus.some((menu) => menu.id === editMenuId)) {
      ensureLocalMenu(editMenuId, dayKey);
    }

    menus = menus.map((menu) =>
      menu.id === editMenuId
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

  async function saveDay(dayKey: string, nextDay: WeekMenu['days'][string], card?: HTMLElement) {
    if (getNetworkStatus() !== 'online') {
      throw new Error(labels.offlineReadOnly);
    }
    if (!currentUser || !editMenuId) return;
    const nextState = serializeDay(nextDay);
    const savedState = serializeDay(getEditingMenu()?.days[dayKey] ?? normalizeDay(undefined));
    if (savedState === nextState) {
      saveFeedback.saved();
      return;
    }

    saveFeedback.saving();
    const services = await getFirebaseServices();
    const changed = await updateMenuDay(services, editMenuId, currentUser.uid, dayKey, nextDay, currentProfile?.groupId);
    card?.setAttribute('data-day-state', nextState);
    updateLocalDay(dayKey, nextDay);
    saveFeedback.saved(changed ? labels.saveSaved : labels.saveSaved);
  }

  function subscribeRange() {
    if (!currentUser) return;
    const nextRange = getSelectedRange();
    activeRange = nextRange;
    unsubscribeMenus?.();
    unsubscribeMenus = undefined;
    menus = [];
    renderHistory();

    const startWeek = getWeekStartForDate(nextRange.start);
    const endWeek = getWeekStartForDate(nextRange.end);

    getFirebaseServices()
      .then((services) => {
        unsubscribeMenus = watchUserMenusByWeekRange(
          services,
          currentUser.uid,
          startWeek,
          endWeek,
          (nextMenus) => {
            menus = nextMenus;
            if (loading) loading.hidden = true;
            if (content) content.hidden = false;
            renderHistory();
          },
          (error) => showStatus(formatError(error), true)
        );
      })
      .catch((error: Error) => showStatus(formatError(error), true));
  }

  const dayEditModal = createDayEditModalController({
    root,
    labels,
    getDay: (dayKey) => normalizeDay(getEditingMenu()?.days[dayKey]),
    getDishes: () => dishes,
    getEnabledMeals,
    getSavedDayState: (dayKey) => serializeDay(getEditingMenu()?.days[dayKey] ?? normalizeDay(undefined)),
    getDayNumber,
    getWeekday: formatWeekday,
    getDateLabel: formatDate,
    canWrite: () => getNetworkStatus() === 'online',
    getWriteErrorMessage: () => labels.offlineReadOnly,
    onSaveDay: (dayKey, nextDay, card) => saveDay(dayKey, nextDay, card),
    onClearDay: async (dayKey) => {
      if (getNetworkStatus() !== 'online' || !currentUser || !editMenuId) {
        saveFeedback.error(labels.offlineReadOnly);
        return false;
      }

      const services = await getFirebaseServices();
      await clearMenuDay(services, editMenuId, currentUser.uid, dayKey);
      return true;
    },
  });

  if (!hasFirebaseConfig()) {
    if (loading) loading.hidden = true;
    showStatus(labels.configMissing, true);
  } else {
    getFirebaseServices()
      .then((services) => {
        const defaultRange = getDefaultRange();
        activeRange = defaultRange;
        if (toInput) toInput.value = defaultRange.end;
        if (fromInput) fromInput.value = defaultRange.start;

        root.querySelector('[data-history-form]')?.addEventListener('submit', (event) => {
          event.preventDefault();
          subscribeRange();
        });

        queryInput?.addEventListener('input', () => renderHistory());
        statusInput?.addEventListener('change', () => renderHistory());
        weekdayInput?.addEventListener('change', () => renderHistory());

        list?.addEventListener('click', async (event) => {
          const target = event.target;
          if (!(target instanceof HTMLButtonElement) || !currentUser) return;

          if (target.dataset.historyEdit) {
            const menuId = await resolveMenuIdForDay(target.dataset.historyEdit, target.dataset.menu);
            if (!menuId) return;
            openEdit(menuId, target.dataset.historyEdit);
            return;
          }

          if (target.dataset.clearDay && target.dataset.menu) {
            await clearMenuDay(services, target.dataset.menu, currentUser.uid, target.dataset.clearDay);
          }
        });

        services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
          currentUser = user;
          unsubscribeMenus?.();
          unsubscribeDishes?.();
          unsubscribeProfile?.();

          if (!user) {
            window.location.assign(labels.homePath || '/');
            return;
          }

          await ensureUserProfile(services, user, labels.guestSession);
          await getOrCreateWeekMenu(services, user.uid, getCurrentWeekStart(), locale);
          unsubscribeProfile = watchUserProfile(
            services,
            user,
            labels.guestSession,
            (profile) => {
              currentProfile = profile;
              unsubscribeDishes?.();
              unsubscribeDishes = watchUserDishes(services, user.uid, (nextDishes) => {
                dishes = nextDishes;
              }, (error) => showStatus(formatError(error), true), false, profile.groupId);
              renderHistory();
            },
            (error) => showStatus(formatError(error), true)
          );
          subscribeRange();
        });
      })
      .catch((error: Error) => showStatus(formatError(error), true));
  }
}
