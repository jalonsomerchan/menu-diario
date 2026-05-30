import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { watchUserDishes } from '../lib/dishes/repository';
import { normalizeDishName } from '../lib/dishes/helpers.mjs';
import { formatAppError } from '../lib/errors';
import { getUpcomingDates, getWeekStartForDate, getWeekStartsForDates, toIsoDate } from '../lib/menu/dates';
import { createDayEditModalController } from '../lib/menu/day-edit-modal';
import { renderDaySummaryCard } from '../lib/menu/day-summary-card';
import { serializeDay } from '../lib/menu/day-state';
import { renderPlateRow } from '../lib/menu/day-editor';
import { normalizeDay } from '../lib/menu/normalizers';
import { attachDishSuggestions } from '../lib/menu/dish-suggestions';
import { getDayCardMealLabel, getDayCardMealSummary, getDayCardParticipantSummary, prepareDayCardMeals, renderDayCardMealsHtml } from '../lib/menu/day-card-data';
import { getMenuParticipants } from '../lib/menu/participants';
import {
  clearMenuDay,
  ensureUserProfile,
  getOrCreateWeekMenus,
  updateMenuDay,
  watchGroup,
  watchUserProfile,
  watchWeekMenusByIds,
} from '../lib/menu/repository';
import type { DailyMenu, Dish, FirebaseUser, MealSlot, MenuGroup, MenuParticipant, UserProfile, WeekMenu } from '../lib/menu/types';
import { notifyMenuChanged, requestChangeNotifications } from '../lib/notifications/browser';
import { getNetworkStatus, watchNetworkStatus } from '../lib/pwa/network-status';
import { readLastOfflineMenuCache, saveOfflineMenuCache } from '../lib/pwa/offline-cache';
import { shouldBlockOfflineWrites } from '../lib/pwa/offline-sync';
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
  const todaySummary = root.querySelector<HTMLElement>('[data-today-summary]');
  const todayNotes = root.querySelector<HTMLElement>('[data-today-notes]');
  const nextDays = root.querySelector<HTMLElement>('[data-next-days]');
  const offlineBanner = root.querySelector<HTMLElement>('[data-offline-banner]');
  const offlineMessage = root.querySelector<HTMLElement>('[data-offline-message]');
  const expiryBanner = root.querySelector<HTMLElement>('[data-expiry-banner]');

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentGroup: MenuGroup | null = null;
  let currentMenu: WeekMenu | null = null;
  let currentMenus: WeekMenu[] = [];
  let currentMenuIdsByWeekStart: Record<string, string> = {};
  let dishes: Dish[] = [];
  let tuppers: TupperItem[] = [];
  let unsubscribeMenu: (() => void) | undefined;
  let unsubscribeDishes: (() => void) | undefined;
  let unsubscribeProfile: (() => void) | undefined;
  let unsubscribeGroup: (() => void) | undefined;
  let unsubscribeTuppers: (() => void) | undefined;
  let firstMenuLoad = true;
  let isOnline = getNetworkStatus() === 'online';
  let isReadOnlyOffline = !isOnline;
  const saveFeedback = createSaveFeedback(status, {
    pending: labels.savePending,
    saving: labels.saveSaving,
    saved: labels.saveSaved,
  });

  attachDishSuggestions(root, () => dishes);

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

  function formatDate(isoDate: string) {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(`${isoDate}T00:00:00`));
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
    const notesHtml = renderDayNotesHtml(day);
    const participantHtml = renderParticipantSummary(day, firstMeal);

    todaySummary.innerHTML = items.map((item) => `<li>${escapeHtml(item)} ${participantHtml}</li>`).join('');
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
    return renderDayCardMealsHtml(prepareDayCardMeals(labels, day, getEnabledMeals(), getParticipants()));
  }

  function renderNextSeven(menu: WeekMenu) {
    if (!nextDays) return;

    const disabledAttr = isReadOnlyOffline ? 'disabled aria-disabled="true"' : '';
    const mealSummary = getEnabledMeals().map(mealLabel).join(' · ');
    nextDays.innerHTML = getNextSevenDates()
      .map((isoDate) => {
        const day = normalizeDay(menu.days[isoDate]);

        return renderDaySummaryCard({
          isoDate,
          dayNumber: getDayNumber(isoDate),
          weekday: formatWeekday(isoDate),
          dateLabel: `${formatDate(isoDate)} · ${mealSummary}`,
          actionLabel: labels.editDay,
          actionAttr: 'data-quick-edit',
          actionStateAttr: disabledAttr,
          deleteActionLabel: labels.deleteMenu,
          deleteActionAttr: 'data-quick-clear',
          deleteActionStateAttr: disabledAttr,
          moreActionsLabel: labels.moreActions,
          summariesHtml: renderDashboardDayMeals(day),
          notesHtml: renderDayNotesHtml(day),
          className: 'dashboard-day-card',
        });
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
    addOptimisticDishesFromDay(nextDay);
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
            if (currentMenu) renderDashboard(currentMenu);
          },
          (error) => showStatus(formatError(error), true),
          false,
          profile.groupId
        );
        unsubscribeGroup?.();
        currentGroup = null;
        if (profile.groupId) {
          unsubscribeGroup = watchGroup(
            services,
            profile.groupId,
            (group) => {
              currentGroup = group;
              if (currentMenu) renderDashboard(currentMenu);
            },
            (error) => showStatus(formatError(error), true)
          );
        }
        if (currentMenu) {
          renderDashboard(currentMenu);
          cacheCurrentMenu(currentMenu);
        }

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
        cacheCurrentMenu(mergedMenu);
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
    getEnabledMeals,
    getParticipants,
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

          if (target.dataset.quickClear) {
            if (shouldBlockOfflineWrites(isOnline) || !currentUser) {
              showStatus(labels.offlineReadOnly, true);
              return;
            }

            const menuId = getMenuIdForDay(target.dataset.quickClear);
            if (!menuId) return;
            const services = await getFirebaseServices();
            await clearMenuDay(services, menuId, currentUser.uid, target.dataset.quickClear);
          }
        });

        root.querySelector('[data-today-edit]')?.addEventListener('click', () => {
          openQuickEdit(toIsoDate(new Date()));
        });

        services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
          currentUser = user;
          unsubscribeMenu?.();
          unsubscribeDishes?.();
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
