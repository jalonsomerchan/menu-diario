import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { watchUserDishes } from '../lib/dishes/repository';
import { readDayDraft } from '../lib/menu/day-form';
import { serializeDay } from '../lib/menu/day-state';
import { getUpcomingDates, getWeekStartForDate, getWeekStartsForDates } from '../lib/menu/dates';
import { renderDayEditor, renderPlateRow } from '../lib/menu/day-editor';
import { normalizeDay } from '../lib/menu/normalizers';
import { attachDishSuggestions } from '../lib/menu/dish-suggestions';
import {
  ensureUserProfile,
  getOrCreateWeekMenus,
  updateMenuDay,
  watchUserProfile,
  watchWeekMenusByIds,
} from '../lib/menu/repository';
import type { Dish, FirebaseUser, MealSlot, UserProfile, WeekMenu } from '../lib/menu/types';
import { getNetworkStatus } from '../lib/pwa/network-status';
import { createDebouncedTaskMap } from '../lib/ui/debounced-task-map';
import { createSaveFeedback } from '../lib/ui/save-feedback';

const root = document.querySelector<HTMLElement>('[data-configurator-app]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const status = root.querySelector<HTMLElement>('[data-status]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const content = root.querySelector<HTMLElement>('[data-content]');
  const configDays = root.querySelector<HTMLElement>('[data-config-days]');

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentMenu: WeekMenu | null = null;
  let currentMenus: WeekMenu[] = [];
  let currentMenuIdsByWeekStart: Record<string, string> = {};
  let dishes: Dish[] = [];
  let unsubscribeMenu: (() => void) | undefined;
  let unsubscribeDishes: (() => void) | undefined;
  let unsubscribeProfile: (() => void) | undefined;
  const saveFeedback = createSaveFeedback(status, {
    pending: labels.savePending,
    saving: labels.saveSaving,
    saved: labels.saveSaved,
  });
  const daySaveQueue = createDebouncedTaskMap({
    delay: 500,
    onError: (error) => saveFeedback.error(formatError(error)),
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
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      return labels.permissionsError;
    }
    return error instanceof Error ? error.message : String(error);
  }

  function getEnabledMeals(): MealSlot[] {
    return currentProfile?.enabledMeals?.length ? currentProfile.enabledMeals : ['lunch'];
  }

  function getConfigDates() {
    return getUpcomingDates(new Date(), 1, 7);
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
    const days = Object.fromEntries(getConfigDates().map((dayKey) => [dayKey, normalizeDay(getMenuForDay(dayKey)?.days?.[dayKey])]));
    const firstWeekStart = getWeekStartForDate(getConfigDates()[0] ?? new Date().toISOString().slice(0, 10));
    const primaryMenu = menus.find((menu) => menu.weekStart === firstWeekStart);

    return {
      id: primaryMenu?.id ?? '',
      title: primaryMenu?.title ?? '',
      ownerId: primaryMenu?.ownerId ?? currentUser?.uid ?? '',
      members: primaryMenu?.members ?? (currentUser ? [currentUser.uid] : []),
      inviteCode: primaryMenu?.inviteCode ?? '',
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

  function setVisible(isReady: boolean) {
    if (loading) loading.hidden = isReady;
    if (content) content.hidden = !isReady;
  }

  function renderConfig(menu: WeekMenu) {
    if (!configDays) return;

    configDays.innerHTML = getConfigDates()
      .map((isoDate) =>
        renderDayEditor({
          dayKey: isoDate,
          dayNumber: getDayNumber(isoDate),
          weekday: formatWeekday(isoDate),
          dateLabel: formatDate(isoDate),
          day: normalizeDay(menu.days[isoDate]),
          enabledMeals: getEnabledMeals(),
          dishes,
          labels,
        })
      )
      .join('');
    getConfigDates().forEach((dayKey) => {
      configDays.querySelector<HTMLElement>(`[data-day="${dayKey}"]`)?.setAttribute('data-day-state', serializeDay(menu.days[dayKey]));
    });
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

  async function saveDay(card: HTMLElement) {
    if (getNetworkStatus() !== 'online') {
      saveFeedback.error(labels.offlineReadOnly);
      return;
    }
    if (!currentUser) return;
    const dayKey = card.dataset.day ?? '';
    const menuId = getMenuIdForDay(dayKey);
    if (!menuId) return;

    const nextDay = readDayDraft(card, getEnabledMeals());
    const nextState = serializeDay(nextDay);
    if (card.dataset.dayState === nextState) {
      saveFeedback.saved();
      return;
    }

    saveFeedback.saving();
    const services = await getFirebaseServices();
    const changed = await updateMenuDay(services, menuId, currentUser.uid, dayKey, nextDay, currentProfile?.groupId);
    card.dataset.dayState = nextState;
    updateLocalDay(dayKey, nextDay);
    saveFeedback.saved(changed ? labels.saveSaved : labels.saveSaved);
  }

  function scheduleDaySave(card: HTMLElement) {
    saveFeedback.pending();
    daySaveQueue.schedule(card.dataset.day ?? '', () => saveDay(card));
  }

  function addPlate(card: HTMLElement, meal: MealSlot) {
    const list = card.querySelector<HTMLElement>(`[data-plate-list="${meal}"]`);
    if (!list) return;

    list.insertAdjacentHTML('beforeend', renderPlateRow(labels, meal, '', list.children.length, dishes));
    list.querySelector<HTMLInputElement>('.plate-row:last-child input')?.focus();
  }

  if (!hasFirebaseConfig()) {
    setVisible(false);
    showStatus(labels.configMissing, true);
  } else {
    getFirebaseServices()
      .then((services) => {
        configDays?.addEventListener('change', (event) => {
          const target = event.target;
          if (!(target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

          const card = target.closest<HTMLElement>('[data-day]');
          if (!card) return;
          if (target instanceof HTMLInputElement && target.type === 'checkbox') {
            const wasSkipped = card.dataset.dayState ? JSON.parse(card.dataset.dayState).skipped : false;
            if (target.checked !== wasSkipped) {
              renderConfig(
                currentMenu
                  ? {
                      ...currentMenu,
                      days: {
                        ...currentMenu.days,
                        [card.dataset.day ?? '']: readDayDraft(card, getEnabledMeals()),
                      },
                    }
                  : buildDisplayMenu(currentMenus)
              );
            }
          }
          configDays.querySelectorAll<HTMLElement>('[data-day]').forEach((item) => {
            if (item.dataset.day === card.dataset.day) scheduleDaySave(item);
          });
        });

        configDays?.addEventListener('click', (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          const button = target.closest<HTMLButtonElement>('button');
          if (!button) return;

          const card = button.closest<HTMLElement>('[data-day]');
          if (!card) return;

          if (button.dataset.addPlate) {
            addPlate(card, button.dataset.addPlate as MealSlot);
            return;
          }

          if (button.dataset.removePlate) {
            button.closest('.plate-row')?.remove();
            scheduleDaySave(card);
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

          await ensureUserProfile(services, user, labels.guestSession);
          currentMenuIdsByWeekStart = await getOrCreateWeekMenus(services, user.uid, getRelevantWeekStarts(), locale);
          currentMenus = [];

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
              if (currentMenu) renderConfig(currentMenu);
            },
            (error) => showStatus(formatError(error), true)
          );

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
        });
      })
      .catch((error: Error) => showStatus(formatError(error), true));
  }
}
