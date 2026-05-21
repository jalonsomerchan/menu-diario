import { watchUserDishes } from '../lib/dishes/repository';
import { formatAppError } from '../lib/errors';
import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { createDayEditModalController } from '../lib/menu/day-edit-modal';
import { renderDaySummaryCard } from '../lib/menu/day-summary-card';
import { serializeDay } from '../lib/menu/day-state';
import { getMonday, getWeekStartForDate, normalizeDateRange, toIsoDate } from '../lib/menu/dates';
import {
  countActiveHistoryFilters,
  filterAndSortHistoryRows,
  type HistoryFilters,
  type HistoryRow,
  type HistorySortMode,
  type HistorySpecialFilter,
  type HistoryStatusFilter,
} from '../lib/menu/history';
import { attachDishSuggestions } from '../lib/menu/dish-suggestions';
import { normalizeDay } from '../lib/menu/normalizers';
import {
  clearMenuDay,
  ensureUserProfile,
  getOrCreateWeekMenu,
  updateMenuDay,
  watchUserMenusByWeekRange,
  watchUserProfile,
} from '../lib/menu/repository';
import type { Dish, FirebaseUser, MealSlot, UserProfile, WeekMenu } from '../lib/menu/types';
import { getNetworkStatus } from '../lib/pwa/network-status';
import { createSaveFeedback } from '../lib/ui/save-feedback';

const root = document.querySelector<HTMLElement>('[data-history-app]');
const pageSize = 20;

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const status = root.querySelector<HTMLElement>('[data-status]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const content = root.querySelector<HTMLElement>('[data-content]');
  const list = root.querySelector<HTMLElement>('[data-history-days]');
  const summary = root.querySelector<HTMLElement>('[data-history-summary]');
  const chips = root.querySelector<HTMLElement>('[data-history-chips]');
  const fromInput = root.querySelector<HTMLInputElement>('[data-date-from]');
  const toInput = root.querySelector<HTMLInputElement>('[data-date-to]');
  const queryInput = root.querySelector<HTMLInputElement>('[data-history-query]');
  const statusInput = root.querySelector<HTMLSelectElement>('[data-history-status]');
  const weekdayInput = root.querySelector<HTMLSelectElement>('[data-history-weekday]');
  const mealInput = root.querySelector<HTMLSelectElement>('[data-history-meal]');
  const dishInput = root.querySelector<HTMLInputElement>('[data-history-dish]');
  const tagInput = root.querySelector<HTMLInputElement>('[data-history-tag]');
  const specialInput = root.querySelector<HTMLSelectElement>('[data-history-special]');
  const sortInput = root.querySelector<HTMLSelectElement>('[data-history-sort]');
  const clearButton = root.querySelector<HTMLButtonElement>('[data-clear-filters]');
  const loadMoreButton = root.querySelector<HTMLButtonElement>('[data-history-load-more]');
  const filterCount = root.querySelector<HTMLElement>('[data-filter-count]');

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let menus: WeekMenu[] = [];
  let dishes: Dish[] = [];
  let editMenuId = '';
  let unsubscribeMenus: (() => void) | undefined;
  let unsubscribeDishes: (() => void) | undefined;
  let unsubscribeProfile: (() => void) | undefined;
  let activeRange = { start: '', end: '' };
  let visibleCount = pageSize;
  const saveFeedback = createSaveFeedback(status, {
    pending: labels.savePending,
    saving: labels.saveSaving,
    saved: labels.saveSaved,
  });

  attachDishSuggestions(root, () => dishes);

  function escapeHtml(value = '') {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function showStatus(message: string, isError = false) {
    if (isError) {
      saveFeedback.error(message);
      return;
    }
    saveFeedback.info(message);
  }

  function formatError(error: unknown) {
    return formatAppError(error, labels);
  }

  function getEnabledMeals(): MealSlot[] {
    return currentProfile?.enabledMeals?.length ? currentProfile.enabledMeals : ['lunch'];
  }

  function mealLabel(meal: string) {
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

  function getSelectedFilters(): HistoryFilters {
    return {
      query: queryInput?.value.trim() ?? '',
      status: (statusInput?.value as HistoryStatusFilter | '') || 'all',
      weekday: weekdayInput?.value || 'all',
      meal: (mealInput?.value as HistoryFilters['meal'] | '') || 'all',
      dish: dishInput?.value.trim() ?? '',
      tag: tagInput?.value.trim() ?? '',
      special: (specialInput?.value as HistorySpecialFilter | '') || 'all',
      sort: (sortInput?.value as HistorySortMode | '') || 'date-desc',
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
    if (existingMenu) return existingMenu.id;

    const services = await getFirebaseServices();
    const nextMenuId = await getOrCreateWeekMenu(services, currentUser.uid, weekStart, locale);
    ensureLocalMenu(nextMenuId, dayKey);
    return nextMenuId;
  }

  function stateLabel(row: HistoryRow) {
    if (row.state === 'eating-out') return labels.specialEatingOut;
    if (row.state === 'unplanned') return labels.specialUnplanned;
    if (row.state === 'custom') return labels.specialCustom;
    if (row.state === 'skipped') return labels.statusSkipped;
    return '';
  }

  function specialLabel(value: string) {
    if (value === 'favorite') return labels.specialFavorite;
    if (value === 'leftovers') return labels.specialLeftovers;
    if (value === 'eating-out') return labels.specialEatingOut;
    if (value === 'unplanned') return labels.specialUnplanned;
    if (value === 'custom') return labels.specialCustom;
    return labels.specialAll;
  }

  function sortLabel(value: string) {
    if (value === 'date-asc') return labels.sortOldest;
    if (value === 'dish') return labels.sortDish;
    if (value === 'frequency') return labels.sortFrequency;
    return labels.sortRecent;
  }

  function statusLabel(value: string) {
    if (value === 'planned') return labels.statusPlanned;
    if (value === 'skipped') return labels.statusSkipped;
    if (value === 'empty') return labels.statusEmpty;
    return labels.statusAll;
  }

  function weekdayLabel(value: string) {
    const labelsByWeekday: Record<string, string> = {
      '1': labels.weekdayMonday,
      '2': labels.weekdayTuesday,
      '3': labels.weekdayWednesday,
      '4': labels.weekdayThursday,
      '5': labels.weekdayFriday,
      '6': labels.weekdaySaturday,
      '7': labels.weekdaySunday,
    };
    return labelsByWeekday[value] ?? labels.weekdayAll;
  }

  function renderChips(filters: HistoryFilters) {
    if (!chips) return;
    const active = [
      filters.query && `${labels.query}: ${filters.query}`,
      filters.status !== 'all' && `${labels.status}: ${statusLabel(filters.status)}`,
      filters.weekday !== 'all' && `${labels.weekday}: ${weekdayLabel(filters.weekday)}`,
      filters.meal && filters.meal !== 'all' && `${labels.meal}: ${mealLabel(filters.meal)}`,
      filters.dish && `${labels.dish}: ${filters.dish}`,
      filters.tag && `${labels.tag}: ${filters.tag}`,
      filters.special && filters.special !== 'all' && `${labels.special}: ${specialLabel(filters.special)}`,
      filters.sort && filters.sort !== 'date-desc' && `${labels.sort}: ${sortLabel(filters.sort)}`,
    ].filter(Boolean) as string[];
    chips.innerHTML = active.map((item) => `<span class="history-chip">${escapeHtml(item)}</span>`).join('');
  }

  function renderBadges(row: HistoryRow) {
    const badges = [
      row.isFavorite && labels.favoriteBadge,
      row.hasLeftovers && labels.leftoversBadge,
      stateLabel(row),
      ...row.tags.slice(0, 3),
    ].filter(Boolean) as string[];
    return badges.length ? `<div class="history-card__badges">${badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join('')}</div>` : '';
  }

  function renderRowActions(row: HistoryRow) {
    return `
      <details class="day-actions">
        <summary aria-label="${escapeHtml(labels.moreActions)}">•••</summary>
        <div>
          <button type="button" data-history-edit="${escapeHtml(row.isoDate)}" data-menu="${escapeHtml(row.menuId)}">${escapeHtml(labels.editDay)}</button>
          ${row.menuId ? `<button type="button" data-clear-day="${escapeHtml(row.isoDate)}" data-menu="${escapeHtml(row.menuId)}">${escapeHtml(labels.deleteDay)}</button>` : ''}
        </div>
      </details>
    `;
  }

  function renderRow(row: HistoryRow) {
    const items = row.daySkipped || row.mealSkipped ? labels.skipSummary : row.items.length ? row.items.join(', ') : labels.todayEmpty;

    return renderDaySummaryCard({
      isoDate: row.isoDate,
      dayNumber: getDayNumber(row.isoDate),
      weekday: formatWeekday(row.isoDate),
      dateLabel: `${formatDate(row.isoDate)} · ${mealLabel(row.meal)}`,
      menuId: row.menuId,
      dayStatus: row.dayStatus,
      actionHtml: renderRowActions(row),
      summariesHtml: `<p class="history-card__items">${escapeHtml(items)}</p>`,
      badgesHtml: renderBadges(row),
    });
  }

  function updateResultSummary(shown: number, total: number) {
    if (!summary) return;
    summary.textContent = labels.showingResults.replace('{shown}', String(shown)).replace('{total}', String(total));
  }

  function renderHistory() {
    if (!list) return;
    const filters = getSelectedFilters();
    const rows = filterAndSortHistoryRows(menus, dishes, getEnabledMeals(), filters);
    const visibleRows = rows.slice(0, visibleCount);
    const activeCount = countActiveHistoryFilters(filters);
    const emptyLabel = activeCount > 0 ? labels.emptySearch : labels.empty;

    list.innerHTML = visibleRows.length ? visibleRows.map(renderRow).join('') : `<p class="history-empty">${escapeHtml(emptyLabel)}</p>`;
    updateResultSummary(visibleRows.length, rows.length);
    renderChips(filters);

    if (filterCount) {
      filterCount.hidden = activeCount === 0;
      filterCount.textContent = String(activeCount);
    }
    if (loadMoreButton) loadMoreButton.hidden = visibleRows.length >= rows.length;
  }

  function resetFilters() {
    const defaultRange = getDefaultRange();
    activeRange = defaultRange;
    if (toInput) toInput.value = defaultRange.end;
    if (fromInput) fromInput.value = defaultRange.start;
    if (queryInput) queryInput.value = '';
    if (statusInput) statusInput.value = 'all';
    if (weekdayInput) weekdayInput.value = 'all';
    if (mealInput) mealInput.value = 'all';
    if (dishInput) dishInput.value = '';
    if (tagInput) tagInput.value = '';
    if (specialInput) specialInput.value = 'all';
    if (sortInput) sortInput.value = 'date-desc';
    visibleCount = pageSize;
    subscribeRange();
  }

  function openEdit(menuId: string, dayKey: string) {
    editMenuId = menuId;
    dayEditModal.open(dayKey);
  }

  function updateLocalDay(dayKey: string, nextDay: WeekMenu['days'][string]) {
    if (!editMenuId) return;

    if (!menus.some((menu) => menu.id === editMenuId)) ensureLocalMenu(editMenuId, dayKey);

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
    renderHistory();
    saveFeedback.saved(changed ? labels.saveSaved : labels.saveSaved);
  }

  function subscribeRange() {
    if (!currentUser) return;
    const nextRange = getSelectedRange();
    activeRange = nextRange;
    visibleCount = pageSize;
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

        [queryInput, statusInput, weekdayInput, mealInput, dishInput, tagInput, specialInput, sortInput].forEach((field) => {
          field?.addEventListener('input', () => {
            visibleCount = pageSize;
            renderHistory();
          });
          field?.addEventListener('change', () => {
            visibleCount = pageSize;
            renderHistory();
          });
        });
        [fromInput, toInput].forEach((field) => field?.addEventListener('change', () => subscribeRange()));
        clearButton?.addEventListener('click', resetFilters);
        loadMoreButton?.addEventListener('click', () => {
          visibleCount += pageSize;
          renderHistory();
        });
        window.addEventListener('offline', () => showStatus(labels.errorOffline, true));

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
                renderHistory();
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