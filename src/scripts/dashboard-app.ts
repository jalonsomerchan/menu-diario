import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { watchUserDishes } from '../lib/dishes/repository';
import { normalizeDishName } from '../lib/dishes/helpers.mjs';
import { formatAppError } from '../lib/errors';
import { watchDailyOptions } from '../lib/menu/daily-options-repository';
import { getUpcomingDates, getWeekStartForDate, getWeekStartsForDates, toIsoDate } from '../lib/menu/dates';
import { createDayEditModalController } from '../lib/menu/day-edit-modal';
import { renderDaySummaryCard } from '../lib/menu/day-summary-card';
import { serializeDay } from '../lib/menu/day-state';
import { renderPlateRow } from '../lib/menu/day-editor';
import { normalizeDay } from '../lib/menu/normalizers';
import { attachDishSuggestions } from '../lib/menu/dish-suggestions';
import { getDayCardMealLabel, getDayCardMealSummary, getDayCardParticipantSummary, prepareDayCardMeals, renderDayCardMealsHtml, renderDayOptionBadgesHtml } from '../lib/menu/day-card-data';
import { getMenuParticipants, getSelectedParticipantIds } from '../lib/menu/participants';
import {
  clearMenuDay,
  ensureUserProfile,
  getOrCreateWeekMenus,
  updateMenuDay,
  watchGroup,
  watchUserProfile,
  watchWeekMenusByIds,
} from '../lib/menu/repository';
import type { DailyMenu, DailyOption, Dish, FirebaseUser, MealSlot, MenuGroup, MenuParticipant, UserProfile, WeekMenu } from '../lib/menu/types';
import { notifyMenuChanged, requestChangeNotifications } from '../lib/notifications/browser';
import { escapeHtml } from '../lib/ui/html';
import { createSaveFeedback } from '../lib/ui/save-feedback';
import { watchTuppers } from '../lib/tuppers/repository';
import type { TupperItem } from '../lib/tuppers/types';
import { shouldShowExpiryWarning } from '../lib/tuppers/state';

const root = document.querySelector<HTMLElement>('[data-dashboard-app]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const status = root.querySelector<HTMLElement>('[data-status]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const content = root.querySelector<HTMLElement>('[data-content]');
  const userLabel = root.querySelector<HTMLElement>('[data-user-label]');
  const weekPlanned = root.querySelector<HTMLElement>('[data-week-planned]');
  const weekEmpty = root.querySelector<HTMLElement>('[data-week-empty]');
  const weekPeople = root.querySelector<HTMLElement>('[data-week-people]');
  const weekNextDish = root.querySelector<HTMLElement>('[data-week-next-dish]');
  const weekNextMeta = root.querySelector<HTMLElement>('[data-week-next-meta]');
  const weekNextPeople = root.querySelector<HTMLElement>('[data-week-next-people]');
  const weekRange = root.querySelector<HTMLElement>('[data-week-range]');
  const weekOverview = root.querySelector<HTMLElement>('[data-week-overview]');
  const weekOverviewBody = root.querySelector<HTMLElement>('[data-overview-body]');
  const weekOverviewToggle = root.querySelector<HTMLButtonElement>('[data-overview-toggle]');
  const todayNotes = root.querySelector<HTMLElement>('[data-today-notes]');
  const nextDays = root.querySelector<HTMLElement>('[data-next-days]');
  const expiryBanner = root.querySelector<HTMLElement>('[data-expiry-banner]');
  const weekOverviewStorageKey = 'menu-diario-dashboard-week-overview-collapsed';
  const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'long' });
  const dayMonthFormatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  const dayNumberFormatter = new Intl.DateTimeFormat(locale, { day: 'numeric' });

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentGroup: MenuGroup | null = null;
  let currentMenu: WeekMenu | null = null;
  let currentMenus: WeekMenu[] = [];
  let currentMenuIdsByWeekStart: Record<string, string> = {};
  let dishes: Dish[] = [];
  let dailyOptions: DailyOption[] = [];
  let tuppers: TupperItem[] = [];
  let unsubscribeMenu: (() => void) | undefined;
  let unsubscribeDishes: (() => void) | undefined;
  let unsubscribeDailyOptions: (() => void) | undefined;
  let unsubscribeProfile: (() => void) | undefined;
  let unsubscribeGroup: (() => void) | undefined;
  let unsubscribeTuppers: (() => void) | undefined;
  let firstMenuLoad = true;
  let renderQueued = false;
  const saveFeedback = createSaveFeedback(status, {
    pending: labels.savePending,
    saving: labels.saveSaving,
    saved: labels.saveSaved,
  });

  attachDishSuggestions(root, () => dishes);

  function setWeekOverviewCollapsed(collapsed: boolean) {
    if (weekOverview) {
      weekOverview.dataset.collapsed = collapsed ? 'true' : 'false';
    }

    if (weekOverviewBody) {
      weekOverviewBody.hidden = collapsed;
    }

    if (weekOverviewToggle) {
      weekOverviewToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      weekOverviewToggle.setAttribute('aria-label', collapsed ? labels.expandSummary : labels.collapseSummary);
    }

    try {
      window.localStorage.setItem(weekOverviewStorageKey, collapsed ? 'true' : 'false');
    } catch {
      // Ignore storage failures so the dashboard keeps working in restricted browsers.
    }
  }

  function getStoredWeekOverviewCollapsed() {
    try {
      return window.localStorage.getItem(weekOverviewStorageKey) === 'true';
    } catch {
      return false;
    }
  }

  weekOverviewToggle?.addEventListener('click', () => {
    const isCollapsed = weekOverview?.dataset.collapsed === 'true';
    setWeekOverviewCollapsed(!isCollapsed);
  });

  setWeekOverviewCollapsed(getStoredWeekOverviewCollapsed());

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

  function getParticipants(): MenuParticipant[] {
    return getMenuParticipants(currentGroup, currentUser, currentProfile, labels.guestSession);
  }


  function getEnabledMeals(): MealSlot[] {
    return currentProfile?.enabledMeals?.length ? currentProfile.enabledMeals : ['lunch'];
  }

  function mealLabel(meal: MealSlot) {
    return getDayCardMealLabel(labels, meal);
  }

  function renderDaySummary(day: DailyMenu, meal: MealSlot) {
    return getDayCardMealSummary(labels, day, meal);
  }

  function renderParticipantSummary(day: DailyMenu, meal: MealSlot) {
    const summary = getDayCardParticipantSummary(labels, day, meal, getParticipants());
    return summary ? `<span class="meal-participants-summary">${escapeHtml(summary)}</span>` : '';
  }

  function collectDayNotes(day: DailyMenu) {
    const dayNotes = [day.notes, day.skipped ? day.skipNote : '']
      .map((note) => note?.trim())
      .filter((note): note is string => Boolean(note));
    const mealNotes = getEnabledMeals()
      .map((meal) => {
        const note = day.meals[meal]?.note?.trim();
        return note ? `${mealLabel(meal)}: ${note}` : '';
      })
      .filter(Boolean);

    return [...dayNotes, ...mealNotes];
  }

  function renderDayNotesHtml(day: DailyMenu) {
    const notes = collectDayNotes(day);
    if (!notes.length) return '';

    return `
      <section class="planner-day-card__notes" aria-label="${escapeHtml(labels.notes)}">
        <span class="planner-day-card__notes-label">${escapeHtml(labels.notes)}</span>
        <ul>
          ${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}
        </ul>
      </section>
    `;
  }

  function getNextSevenDates() {
    return getUpcomingDates(new Date(), 0, 7);
  }

  function getOverviewDates() {
    return getUpcomingDates(new Date(), 0, 7);
  }

  function getRelevantWeekStarts() {
    return getWeekStartsForDates(getNextSevenDates());
  }

  function getMenuIdForDay(dayKey: string) {
    return currentMenuIdsByWeekStart[getWeekStartForDate(dayKey)] ?? '';
  }

  function getMenuForDay(dayKey: string) {
    const weekStart = getWeekStartForDate(dayKey);
    return currentMenus.find((menu) => menu.weekStart === weekStart) ?? null;
  }

  function scheduleDashboardRender() {
    if (!currentMenu || renderQueued) return;

    renderQueued = true;
    window.requestAnimationFrame(() => {
      renderQueued = false;
      if (!currentMenu) return;
      renderDashboard(currentMenu);
    });
  }

  function buildDisplayMenu(menus: WeekMenu[]) {
    const today = toIsoDate(new Date());
    const days = Object.fromEntries(
      getNextSevenDates().map((dayKey) => [dayKey, normalizeDay(getMenuForDay(dayKey)?.days?.[dayKey])])
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
    return weekdayFormatter.format(new Date(`${isoDate}T00:00:00`));
  }

  function capitalizeLabel(value: string) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  }

  function formatDate(isoDate: string) {
    return dayMonthFormatter.format(new Date(`${isoDate}T00:00:00`));
  }

  function formatShortDayMonth(isoDate: string) {
    return dayMonthFormatter.format(new Date(`${isoDate}T00:00:00`)).replace('.', '');
  }

  function getDayNumber(isoDate: string) {
    return dayNumberFormatter.format(new Date(`${isoDate}T00:00:00`));
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

  function getSelectedCount(day: DailyMenu, meal: MealSlot) {
    const participants = getParticipants();
    if (!participants.length || day.skipped) return 0;
    return getSelectedParticipantIds(day.meals[meal], participants).length;
  }

  function renderWeekOverview(menu: WeekMenu) {
    const primaryMeal = getEnabledMeals()[0] ?? 'lunch';
    const dates = getOverviewDates();
    const days = dates.map((date) => ({ date, day: normalizeDay(menu.days[date]) }));
    const plannedDays = days.filter(({ day }) => !day.skipped && !day.meals[primaryMeal].skipped && day.meals[primaryMeal].items.some(Boolean));
    const emptyDays = days.length - plannedDays.length;
    const averagePeople = plannedDays.length
      ? Math.round(plannedDays.reduce((total, { day }) => total + getSelectedCount(day, primaryMeal), 0) / plannedDays.length)
      : 0;
    const nextPlanned = plannedDays[0];
    const today = toIsoDate(new Date());
    const todayDay = normalizeDay(menu.days[today]);
    const notesHtml = renderDayNotesHtml(todayDay);
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];

    if (weekPlanned) weekPlanned.textContent = String(plannedDays.length);
    if (weekEmpty) weekEmpty.textContent = String(emptyDays);
    if (weekPeople) weekPeople.textContent = String(averagePeople || getParticipants().length || 0);
    if (weekNextDish) weekNextDish.textContent = nextPlanned ? renderDaySummary(nextPlanned.day, primaryMeal) : labels.todayEmpty;
    if (weekRange && firstDate && lastDate) weekRange.textContent = `${formatShortDayMonth(firstDate)} - ${formatShortDayMonth(lastDate)}`;
    if (weekNextMeta) {
      const participantSummary = nextPlanned ? getDayCardParticipantSummary(labels, nextPlanned.day, primaryMeal, getParticipants()) : '';
      const metaDate = nextPlanned
        ? nextPlanned.date === today
          ? [labels.todayForLunch.replace(':', ''), participantSummary].filter(Boolean).join(' · ')
          : [capitalizeLabel(formatWeekday(nextPlanned.date)), participantSummary].filter(Boolean).join(' · ')
        : '';
      weekNextMeta.textContent = metaDate;
    }
    if (weekNextPeople) {
      weekNextPeople.textContent = '';
    }
    if (todayNotes) {
      todayNotes.innerHTML = notesHtml;
      todayNotes.hidden = !notesHtml;
    }
  }

  function renderExpiryBanner() {
    if (!expiryBanner) return;
    expiryBanner.hidden = !shouldShowExpiryWarning(tuppers);
  }

  function renderDashboardDayMeals(day: DailyMenu) {
    return [
      renderDayOptionBadgesHtml(day, dailyOptions, labels.dailyOptionsSummary),
      renderDayCardMealsHtml(prepareDayCardMeals(labels, day, getEnabledMeals(), getParticipants())),
    ].join('');
  }

  function renderNextSeven(menu: WeekMenu) {
    if (!nextDays) return;

    const disabledAttr = '';
    const mealSummary = getEnabledMeals().map(mealLabel).join(' · ');
    const primaryMeal = getEnabledMeals()[0] ?? 'lunch';
    const today = toIsoDate(new Date());
    nextDays.innerHTML = getNextSevenDates()
      .map((isoDate) => {
        const day = normalizeDay(menu.days[isoDate]);
        const hasPrimaryMeal = !day.skipped && !day.meals[primaryMeal].skipped && day.meals[primaryMeal].items.some(Boolean);

        return renderDaySummaryCard({
          isoDate,
          isToday: isoDate === today,
          todayLabel: labels.todayShort,
          dayNumber: getDayNumber(isoDate),
          weekday: formatWeekday(isoDate),
          dateLabel: `${formatDate(isoDate)} · ${mealSummary}`,
          actionLabel: labels.editDay,
          actionAttr: 'data-quick-edit',
          actionStateAttr: disabledAttr,
          summariesHtml: renderDashboardDayMeals(day),
          notesHtml: renderDayNotesHtml(day),
          statusLabel: '',
          actionKind: hasPrimaryMeal ? 'edit' : 'add',
          className: `dashboard-day-card${isoDate === today ? ' dashboard-day-card--today' : ''}`,
        });
      })
      .join('');
  }

  function openQuickEdit(dayKey: string) {
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

  function addOptimisticDishesFromDay(day: DailyMenu) {
    const knownNames = new Set(dishes.map((dish) => dish.normalizedName).filter(Boolean));
    const additions = getEnabledMeals()
      .flatMap((meal) => day.meals[meal]?.items ?? [])
      .map((name) => name.trim().replace(/\s+/g, ' '))
      .filter(Boolean)
      .filter((name) => {
        const normalizedName = normalizeDishName(name);
        if (!normalizedName || knownNames.has(normalizedName)) return false;
        knownNames.add(normalizedName);
        return true;
      });

    if (!additions.length) return;

    const createdAt = new Date();
    dishes = [
      ...additions.map((name) => ({
        id: `optimistic-${normalizeDishName(name)}`,
        name,
        normalizedName: normalizeDishName(name),
        scope: currentProfile?.groupId ? 'group' : 'user',
        source: 'menu',
        groupId: currentProfile?.groupId,
        createdBy: currentUser?.uid,
        members: currentUser ? [currentUser.uid] : [],
        isGlobal: false,
        editable: true,
        timesUsed: 1,
        tags: [],
        quickTags: [],
        favorite: false,
        blocked: false,
        archived: false,
        createdAt,
        lastUsedAt: createdAt,
        updatedAt: createdAt,
      }) satisfies Dish),
      ...dishes,
    ];
  }

  async function saveDay(dayKey: string, nextDay: DailyMenu, card?: HTMLElement) {
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
    addOptimisticDishesFromDay(nextDay);
    saveFeedback.saved(changed ? labels.saveSaved : labels.saveSaved);
  }


  function addPlate(card: HTMLElement, meal: MealSlot) {
    const list = card.querySelector<HTMLElement>(`[data-plate-list="${meal}"]`);
    if (!list) return;

    list.insertAdjacentHTML('beforeend', renderPlateRow(labels, meal, '', list.children.length, dishes));
    list.querySelector<HTMLInputElement>('.plate-row:last-child input')?.focus();
  }

  function renderDashboard(menu: WeekMenu) {
    currentMenu = menu;
    setVisible(true);
    renderWeekOverview(menu);
    renderExpiryBanner();
    renderNextSeven(menu);
    syncRenderedDayStates(nextDays ?? root, getNextSevenDates());
  }

  async function initializeAuthenticatedDashboard(services: Awaited<ReturnType<typeof getFirebaseServices>>, user: FirebaseUser) {
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
          },
          (error) => showStatus(formatError(error), true),
          false,
          profile.groupId
        );
        unsubscribeDailyOptions?.();
        unsubscribeDailyOptions = watchDailyOptions(
          services,
          { userId: user.uid, groupId: profile.groupId },
          (nextOptions) => {
            dailyOptions = nextOptions;
            scheduleDashboardRender();
          },
          (error) => showStatus(formatError(error), true)
        );
        unsubscribeGroup?.();
        currentGroup = null;
        if (profile.groupId) {
          unsubscribeGroup = watchGroup(
            services,
            profile.groupId,
            (group) => {
              currentGroup = group;
              scheduleDashboardRender();
            },
            (error) => showStatus(formatError(error), true)
          );
        }
        scheduleDashboardRender();

        unsubscribeTuppers?.();
        unsubscribeTuppers = watchTuppers(
          services,
          user.uid,
          profile.groupId,
          (nextTuppers) => {
            tuppers = nextTuppers;
            renderExpiryBanner();
          },
          (error) => showStatus(formatError(error), true)
        );
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
        if (changedByOtherUser) notifyMenuChanged(labels.updated, labels.updatedBody);
        firstMenuLoad = menus.length < Object.keys(currentMenuIdsByWeekStart).length;
      },
      (error) => showStatus(formatError(error), true)
    );
  }

  const dayEditModal = createDayEditModalController({
    root,
    labels,
    getDay: (dayKey) => normalizeDay(currentMenu?.days[dayKey]),
    getDishes: () => dishes,
    getDailyOptions: () => dailyOptions,
    getEnabledMeals,
    getParticipants,
    getSavedDayState: (dayKey) => serializeDay(currentMenu?.days[dayKey] ?? normalizeDay(undefined)),
    getDayNumber,
    getWeekday: formatWeekday,
    canWrite: () => true,
    getWriteErrorMessage: () => labels.saveHint,
    onSaveDay: (dayKey, nextDay, card) => saveDay(dayKey, nextDay, card),
    onClearDay: async (dayKey) => {
      if (!currentUser) return false;

      const menuId = getMenuIdForDay(dayKey);
      if (!menuId) return false;
      const services = await getFirebaseServices();
      await clearMenuDay(services, menuId, currentUser.uid, dayKey);
      return true;
    },
  });


  if (!hasFirebaseConfig()) {
    setVisible(false);
    showStatus(labels.configMissing, true);
  } else {
    getFirebaseServices()
      .then((services) => {
        root.querySelector('[data-notifications]')?.addEventListener('click', async () => {
          const permission = await requestChangeNotifications();
          showStatus(permission === 'granted' ? labels.notificationsEnabled : labels.notificationsDenied, permission !== 'granted');
        });

        nextDays?.addEventListener('click', async (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          const button = target.closest<HTMLButtonElement>('button');
          if (!button) return;

          if (button.dataset.quickEdit) {
            openQuickEdit(button.dataset.quickEdit);
            return;
          }

          if (button.dataset.quickClear) {
            if (!currentUser) return;

            const menuId = getMenuIdForDay(button.dataset.quickClear);
            if (!menuId) return;
            const services = await getFirebaseServices();
            await clearMenuDay(services, menuId, currentUser.uid, button.dataset.quickClear);
          }
        });

        root.querySelector('[data-today-edit]')?.addEventListener('click', () => {
          openQuickEdit(toIsoDate(new Date()));
        });

        services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
          currentUser = user;
          unsubscribeMenu?.();
          unsubscribeDishes?.();
          unsubscribeDailyOptions?.();
          unsubscribeProfile?.();
          unsubscribeGroup?.();
          unsubscribeTuppers?.();

          if (!user) {
            window.location.assign(labels.homePath || '/');
            return;
          }

          try {
            await initializeAuthenticatedDashboard(services, user);
          } catch (error) {
            setVisible(false);
            showStatus(formatError(error), true);
          }
        });
      })
      .catch((error: Error) => showStatus(formatError(error), true));
  }
}
