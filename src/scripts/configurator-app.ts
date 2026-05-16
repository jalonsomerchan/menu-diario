import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { getMonday, toIsoDate } from '../lib/menu/dates';
import { renderDayEditor, renderPlateRow } from '../lib/menu/day-editor';
import { normalizeDay } from '../lib/menu/normalizers';
import { attachDishSuggestions } from '../lib/menu/dish-suggestions';
import {
  ensureUserProfile,
  getOrCreateWeekMenu,
  updateMenuPatch,
  watchDishes,
  watchUserProfile,
  watchWeekMenu,
} from '../lib/menu/repository';
import type { Dish, FirebaseUser, MealSlot, UserProfile, WeekMenu } from '../lib/menu/types';

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
  let currentMenuId = '';
  let currentMenu: WeekMenu | null = null;
  let dishes: Dish[] = [];
  let unsubscribeMenu: (() => void) | undefined;
  let unsubscribeDishes: (() => void) | undefined;
  let unsubscribeProfile: (() => void) | undefined;

  attachDishSuggestions(root, () => dishes);

  function showStatus(message: string, isError = false) {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.dataset.variant = isError ? 'error' : 'info';
  }

  function getEnabledMeals(): MealSlot[] {
    return currentProfile?.enabledMeals?.length ? currentProfile.enabledMeals : ['lunch'];
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

  function getConfigDates() {
    return Array.from({ length: 7 }, (_, index) => getDateOffset(index + 1));
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
  }

  async function saveField(card: HTMLElement, path: string, value: string | boolean | string[]) {
    if (!currentUser || !currentMenuId) return;
    const services = await getFirebaseServices();
    await updateMenuPatch(
      services,
      currentMenuId,
      currentUser.uid,
      {
        dayKey: card.dataset.day ?? '',
        path,
        value,
      },
      currentProfile?.groupId
    );
  }

  async function savePlateList(card: HTMLElement, meal: MealSlot) {
    const items = [...card.querySelectorAll<HTMLInputElement>(`[data-plate-input="${meal}"]`)]
      .map((input) => input.value.trim())
      .filter(Boolean);
    await saveField(card, `meals.${meal}.items`, items);
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

          if (target.dataset.plateInput) {
            savePlateList(card, target.dataset.plateInput as MealSlot).catch((error: Error) => showStatus(error.message, true));
            return;
          }

          const field = target.dataset.field;
          if (!field) return;

          const value = target instanceof HTMLInputElement && target.type === 'checkbox' ? target.checked : target.value.trim();
          saveField(card, field, value).catch((error: Error) => showStatus(error.message, true));
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
            const meal = button.dataset.removePlate as MealSlot;
            button.closest('.plate-row')?.remove();
            savePlateList(card, meal).catch((error: Error) => showStatus(error.message, true));
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
          currentMenuId = await getOrCreateWeekMenu(services, user.uid, getCurrentWeekStart(), locale);

          unsubscribeProfile = watchUserProfile(
            services,
            user,
            labels.guestSession,
            (profile) => {
              currentProfile = profile;
              unsubscribeDishes?.();
              unsubscribeDishes = watchDishes(
                services,
                user.uid,
                (nextDishes) => {
                  dishes = nextDishes;
                  if (currentMenu) renderConfig(currentMenu);
                },
                (error) => showStatus(error.message, true),
                profile.groupId
              );
              if (currentMenu) renderConfig(currentMenu);
            },
            (error) => showStatus(error.message, true)
          );

          unsubscribeMenu = watchWeekMenu(
            services,
            currentMenuId,
            (menu) => {
              if (!menu) return;
              currentMenu = menu;
              setVisible(true);
              renderConfig(menu);
            },
            (error) => showStatus(error.message, true)
          );
        });
      })
      .catch((error: Error) => showStatus(error.message, true));
  }
}
