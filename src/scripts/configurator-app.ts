import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { getMonday, toIsoDate } from '../lib/menu/dates';
import {
  ensureUserProfile,
  getOrCreateWeekMenu,
  updateMenuPatch,
  watchDishes,
  watchUserProfile,
  watchWeekMenu,
} from '../lib/menu/repository';
import type { DailyMenu, Dish, FirebaseUser, MealEntry, MealSlot, UserProfile, WeekMenu } from '../lib/menu/types';

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

  function escapeHtml(value = '') {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function showStatus(message: string, isError = false) {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.dataset.variant = isError ? 'error' : 'info';
  }

  function emptyMeal(): MealEntry {
    return { items: [], skipped: false, reason: '', note: '' };
  }

  function normalizeMeal(meal?: Partial<MealEntry>): MealEntry {
    return {
      ...emptyMeal(),
      ...meal,
      items: Array.isArray(meal?.items) ? meal.items : [],
      skipped: Boolean(meal?.skipped),
      reason: meal?.reason ?? '',
      note: meal?.note ?? '',
    };
  }

  function normalizeDay(day?: Partial<DailyMenu>): DailyMenu {
    return {
      meals: {
        breakfast: normalizeMeal(day?.meals?.breakfast),
        lunch: normalizeMeal({
          ...(day?.meals?.lunch ?? {}),
          items: day?.meals?.lunch?.items ?? day?.lunchItems ?? (day?.lunch ? [day.lunch] : []),
          skipped: day?.meals?.lunch?.skipped ?? Boolean(day?.noLunch),
          reason: day?.meals?.lunch?.reason ?? day?.noLunchReason ?? '',
          note: day?.meals?.lunch?.note ?? day?.noLunchDescription ?? '',
        }),
        dinner: normalizeMeal({
          ...(day?.meals?.dinner ?? {}),
          items: day?.meals?.dinner?.items ?? (day?.dinner ? [day.dinner] : []),
        }),
      },
      notes: day?.notes ?? '',
    };
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

  function renderMealInputs(dayKey: string, meal: MealSlot, mealData: MealEntry) {
    const listId = `dish-options-${dayKey}-${meal}`;
    const values = mealData.items.length ? mealData.items : [''];
    const skipFields = mealData.skipped
      ? `
        <label>${escapeHtml(labels.reason)}
          <select data-field="meals.${meal}.reason">
            <option value=""></option>
            <option value="away" ${mealData.reason === 'away' ? 'selected' : ''}>${escapeHtml(labels.reasonAway)}</option>
            <option value="eating-out" ${mealData.reason === 'eating-out' ? 'selected' : ''}>${escapeHtml(labels.reasonEatingOut)}</option>
            <option value="not-hungry" ${mealData.reason === 'not-hungry' ? 'selected' : ''}>${escapeHtml(labels.reasonNotHungry)}</option>
            <option value="other" ${mealData.reason === 'other' ? 'selected' : ''}>${escapeHtml(labels.reasonOther)}</option>
          </select>
        </label>
        <label>${escapeHtml(labels.reasonDescription)}
          <textarea data-field="meals.${meal}.note" rows="2">${escapeHtml(mealData.note)}</textarea>
        </label>
      `
      : '';

    return `
      <section class="meal-editor" data-meal="${meal}">
        <header>
          <h4>${escapeHtml(mealLabel(meal))}</h4>
          <button class="button button--ghost button--small" type="button" data-add-plate="${meal}">${escapeHtml(labels.addPlate)}</button>
        </header>
        <div class="plate-list" data-plate-list="${meal}">
          ${values
            .map(
              (value, index) => `
                <label>
                  <span class="sr-only">${escapeHtml(labels.addDish)} ${index + 1}</span>
                  <input type="text" list="${listId}" value="${escapeHtml(value)}" data-plate-input="${meal}" placeholder="${escapeHtml(labels.dishPlaceholder)}" />
                </label>
              `
            )
            .join('')}
        </div>
        <datalist id="${listId}">
          ${dishes.map((dish) => `<option value="${escapeHtml(dish.name)}"></option>`).join('')}
        </datalist>
        <label class="checkbox-row">
          <input type="checkbox" data-field="meals.${meal}.skipped" ${mealData.skipped ? 'checked' : ''} />
          <span>${escapeHtml(labels.noMeal)}</span>
        </label>
        ${skipFields}
      </section>
    `;
  }

  function renderConfig(menu: WeekMenu) {
    if (!configDays) return;

    configDays.innerHTML = getConfigDates()
      .map((isoDate) => {
        const day = normalizeDay(menu.days[isoDate]);
        const mealEditors = getEnabledMeals().map((meal) => renderMealInputs(isoDate, meal, day.meals[meal])).join('');

        return `
          <article class="day-card day-card--editor" id="dia-${isoDate}" data-day="${isoDate}">
            <div class="day-card__date-number">${escapeHtml(getDayNumber(isoDate))}</div>
            <div class="day-card__content">
              <header class="day-card__header">
                <div><h3>${escapeHtml(formatWeekday(isoDate))}</h3><p>${escapeHtml(formatDate(isoDate))}</p></div>
              </header>
              ${mealEditors}
              <label>${escapeHtml(labels.notes)}
                <textarea data-field="notes" rows="2">${escapeHtml(day.notes ?? '')}</textarea>
              </label>
            </div>
          </article>
        `;
      })
      .join('');
  }

  async function saveField(target: HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement) {
    if (!currentUser || !currentMenuId) return;
    const card = target.closest<HTMLElement>('[data-day]');
    const field = target.dataset.field;

    if (!card || !field) return;

    let value: string | boolean = target.value.trim();

    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      value = target.checked;
    }

    const services = await getFirebaseServices();
    await updateMenuPatch(services, currentMenuId, currentUser.uid, {
      dayKey: card.dataset.day ?? '',
      path: field,
      value,
    });
  }

  async function savePlateList(card: HTMLElement, meal: MealSlot) {
    if (!currentUser || !currentMenuId) return;

    const items = [...card.querySelectorAll<HTMLInputElement>(`[data-plate-input="${meal}"]`)]
      .map((input) => input.value.trim())
      .filter(Boolean);
    const services = await getFirebaseServices();

    await updateMenuPatch(services, currentMenuId, currentUser.uid, {
      dayKey: card.dataset.day ?? '',
      path: `meals.${meal}.items`,
      value: items,
    });
  }

  if (!hasFirebaseConfig()) {
    setVisible(false);
    showStatus(labels.configMissing, true);
  } else {
    getFirebaseServices()
      .then((services) => {
        configDays?.addEventListener('change', (event) => {
          const target = event.target;
          if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement || target instanceof HTMLSelectElement) {
            if (target.dataset.plateInput) {
              const card = target.closest<HTMLElement>('[data-day]');
              if (card) savePlateList(card, target.dataset.plateInput as MealSlot).catch((error: Error) => showStatus(error.message, true));
              return;
            }
            saveField(target).catch((error: Error) => showStatus(error.message, true));
          }
        });

        configDays?.addEventListener('click', (event) => {
          const target = event.target;
          if (!(target instanceof HTMLButtonElement) || !target.dataset.addPlate) return;
          const meal = target.dataset.addPlate as MealSlot;
          const card = target.closest<HTMLElement>('[data-day]');
          const list = card?.querySelector<HTMLElement>(`[data-plate-list="${meal}"]`);
          const firstInput = list?.querySelector<HTMLInputElement>(`[data-plate-input="${meal}"]`);

          if (!card || !list || !firstInput) return;

          const label = document.createElement('label');
          const input = document.createElement('input');
          input.type = 'text';
          input.setAttribute('list', firstInput.getAttribute('list') ?? '');
          input.dataset.plateInput = meal;
          input.placeholder = labels.dishPlaceholder;
          label.append(input);
          list.append(label);
          input.focus();
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
              if (currentMenu) renderConfig(currentMenu);
            },
            (error) => showStatus(error.message, true)
          );

          unsubscribeDishes = watchDishes(
            services,
            user.uid,
            (nextDishes) => {
              dishes = nextDishes;
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
