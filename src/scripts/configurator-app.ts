import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { watchUserDishes } from '../lib/dishes/repository';
import { formatAppError } from '../lib/errors';
import { watchDailyOptions } from '../lib/menu/daily-options-repository';
import { createDayEditModalController } from '../lib/menu/day-edit-modal';
import { renderDaySummaryCard } from '../lib/menu/day-summary-card';
import { serializeDay } from '../lib/menu/day-state';
import { getUpcomingDates, getWeekStartForDate, getWeekStartsForDates } from '../lib/menu/dates';
import { normalizeDay } from '../lib/menu/normalizers';
import { attachDishSuggestions } from '../lib/menu/dish-suggestions';
import { prepareDayCardMeals, renderDayCardMealsHtml, renderDayOptionBadgesHtml } from '../lib/menu/day-card-data';
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
import type { DailyMenu, DailyOption, Dish, FirebaseUser, MealSlot, MenuGroup, MenuParticipant, UserProfile, WeekMenu } from '../lib/menu/types';
import { createSaveFeedback } from '../lib/ui/save-feedback';

const root = document.querySelector<HTMLElement>('[data-configurator-app]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const status = root.querySelector<HTMLElement>('[data-status]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const content = root.querySelector<HTMLElement>('[data-content]');
  const configDays = root.querySelector<HTMLElement>('[data-config-days]');
  const loadMoreButton = root.querySelector<HTMLButtonElement>('[data-config-load-more]');

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentGroup: MenuGroup | null = null;
  let currentMenu: WeekMenu | null = null;
  let currentMenus: WeekMenu[] = [];
  let currentMenuIdsByWeekStart: Record<string, string> = {};
  let visibleDayCount = 7;
  let dishes: Dish[] = [];
  let dailyOptions: DailyOption[] = [];
  let unsubscribeMenu: (() => void) | undefined;
  let unsubscribeDishes: (() => void) | undefined;
  let unsubscribeDailyOptions: (() => void) | undefined;
  let unsubscribeProfile: (() => void) | undefined;
  let unsubscribeGroup: (() => void) | undefined;
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

  function getEnabledMeals(): MealSlot[] {
    return currentProfile?.enabledMeals?.length ? currentProfile.enabledMeals : ['lunch'];
  }

  function getConfigDates() {
    return getUpcomingDates(new Date(), 0, visibleDayCount);
  }

  function getRelevantWeekStarts() {
    return getWeekStartsForDates(getConfigDates());
  }

  function getMenuIdForDay(dayKey: string) {
    return currentMenuIdsByWeekStart[getWeekStartForDate(dayKey)] ?? '';
  }

  function getMenuForDay(dayKey: string) {
    const weekStart = getWeekStartForDate(dayKey);
    return currentMenus.find((menu) => menu.weekStart === weekStart) ?? null;
  }

  function buildDisplayMenu(menus: WeekMenu[]) {
    const dates = getConfigDates();
    const days = Object.fromEntries(dates.map((dayKey) => [dayKey, normalizeDay(getMenuForDay(dayKey)?.days?.[dayKey])]));
    const firstWeekStart = getWeekStartForDate(dates[0] ?? new Date().toISOString().slice(0, 10));
    const primaryMenu = menus.find((menu) => menu.weekStart === firstWeekStart);

    return {
      id: primaryMenu?.id ?? '',
      title: primaryMenu?.title ?? '',
      ownerId: primaryMenu?.ownerId ?? currentUser?.uid ?? '',
      members: primaryMenu?.members ?? (currentUser ? [currentUser.uid] : []),
      inviteCode: '',
      weekStart: firstWeekStart,
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

  function getTodayIsoDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function setVisible(isReady: boolean) {
    if (loading) loading.hidden = isReady;
    if (content) content.hidden = !isReady;
  }

  function renderConfig(menu: WeekMenu) {
    if (!configDays) return;

    const today = getTodayIsoDate();
    configDays.innerHTML = getConfigDates()
      .map((isoDate) => {
        const day = normalizeDay(menu.days[isoDate]);
        const primaryMeal = getEnabledMeals()[0] ?? 'lunch';
        const hasPrimaryMeal = !day.skipped && !day.meals[primaryMeal].skipped && day.meals[primaryMeal].items.some(Boolean);
        const summaries = [
          renderDayOptionBadgesHtml(day, dailyOptions, labels.dailyOptionsSummary),
          renderDayCardMealsHtml(prepareDayCardMeals(labels, day, getEnabledMeals(), getParticipants())),
        ].join('');

        return renderDaySummaryCard({
          isoDate,
          isToday: isoDate === today,
          todayLabel: labels.todayShort,
          dayNumber: getDayNumber(isoDate),
          weekday: formatWeekday(isoDate),
          dateLabel: formatDate(isoDate),
          actionLabel: labels.editDay,
          actionAttr: 'data-config-edit',
          summariesHtml: summaries,
          actionKind: hasPrimaryMeal ? 'edit' : 'add',
          className: `configurator-day-card${isoDate === today ? ' configurator-day-card--today' : ''}`,
        });
      })
      .join('');
  }

  function updateLocalDay(dayKey: string, nextState: WeekMenu['days'][string]) {
    currentMenu = currentMenu
      ? {
          ...currentMenu,
          days: {
            ...currentMenu.days,
            [dayKey]: nextState,
          },
        }
      : currentMenu;

    currentMenus = currentMenus.map((menu) =>
      menu.weekStart === getWeekStartForDate(dayKey)
        ? {
            ...menu,
            days: {
              ...menu.days,
              [dayKey]: nextState,
            },
          }
        : menu
    );
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
    saveFeedback.saved(changed ? labels.saveSaved : labels.saveSaved);
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
    getDateLabel: formatDate,
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

  async function watchVisibleMenus(services: Awaited<ReturnType<typeof getFirebaseServices>>) {
    if (!currentUser) return;

    if (loadMoreButton) {
      loadMoreButton.disabled = true;
      loadMoreButton.setAttribute('aria-busy', 'true');
    }

    try {
      currentMenuIdsByWeekStart = await getOrCreateWeekMenus(services, currentUser.uid, getRelevantWeekStarts(), locale);
      unsubscribeMenu?.();
      unsubscribeMenu = watchWeekMenusByIds(
        services,
        Object.values(currentMenuIdsByWeekStart),
        (menus) => {
          currentMenus = menus;
          currentMenu = buildDisplayMenu(menus);
          setVisible(true);
          renderConfig(currentMenu);
        },
        (error) => showStatus(formatError(error), true)
      );
    } finally {
      if (loadMoreButton) {
        loadMoreButton.disabled = false;
        loadMoreButton.setAttribute('aria-busy', 'false');
      }
    }
  }

  if (!hasFirebaseConfig()) {
    setVisible(false);
    showStatus(labels.configMissing, true);
  } else {
    getFirebaseServices()
      .then((services) => {
        loadMoreButton?.addEventListener('click', async () => {
          visibleDayCount += 7;
          await watchVisibleMenus(services);
        });

        configDays?.addEventListener('click', async (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          const button = target.closest<HTMLButtonElement>('[data-config-edit]');
          if (button) {
            dayEditModal.open(button.dataset.configEdit ?? '');
            return;
          }

          const clearButton = target.closest<HTMLButtonElement>('[data-config-clear]');
          if (!clearButton || !currentUser) return;

          const dayKey = clearButton.dataset.configClear ?? '';
          const menuId = getMenuIdForDay(dayKey);
          if (!menuId) return;
          try {
            const services = await getFirebaseServices();
            await clearMenuDay(services, menuId, currentUser.uid, dayKey);
          } catch (error) {
            showStatus(formatError(error), true);
          }
        });

        services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
          currentUser = user;
          unsubscribeMenu?.();
          unsubscribeDishes?.();
          unsubscribeDailyOptions?.();
          unsubscribeProfile?.();
          unsubscribeGroup?.();

          if (!user) {
            window.location.assign(labels.homePath || '/');
            return;
          }

          await ensureUserProfile(services, user, labels.guestSession);
          currentMenus = [];
          visibleDayCount = 7;

          unsubscribeProfile = watchUserProfile(
            services,
            user,
            labels.guestSession,
            (profile) => {
              currentProfile = profile;
              unsubscribeDishes?.();
              unsubscribeDishes = watchUserDishes(
                services,
                user.uid,
                (nextDishes) => {
                  dishes = nextDishes;
                  if (currentMenu) renderConfig(currentMenu);
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
                  if (currentMenu) renderConfig(currentMenu);
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
                    if (currentMenu) renderConfig(currentMenu);
                  },
                  (error) => showStatus(formatError(error), true)
                );
              }
              if (currentMenu) renderConfig(currentMenu);
            },
            (error) => showStatus(formatError(error), true)
          );

          await watchVisibleMenus(services);
        });
      })
      .catch((error: Error) => showStatus(formatError(error), true));
  }
}
