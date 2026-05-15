import { closeSession, getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { getMonday, getWeekDays, toIsoDate } from '../lib/menu/dates';
import {
  ensureUserProfile,
  getOrCreateWeekMenu,
  updateMenuPatch,
  updateUserPreferences,
  watchDishes,
  watchUserProfile,
  watchWeekMenu,
} from '../lib/menu/repository';
import type { DailyMenu, Dish, FirebaseUser, MealEntry, MealSlot, ThemePreference, UserProfile, WeekMenu } from '../lib/menu/types';
import { notifyMenuChanged, requestChangeNotifications } from '../lib/notifications/browser';

const root = document.querySelector<HTMLElement>('[data-dashboard-app]');
const mealSlots: MealSlot[] = ['breakfast', 'lunch', 'dinner'];
const themeValues: ThemePreference[] = ['system', 'light', 'dark'];

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const dayLabels = (labels.days ?? '').split('|').filter(Boolean);
  const status = root.querySelector<HTMLElement>('[data-status]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const content = root.querySelector<HTMLElement>('[data-content]');
  const userLabel = root.querySelector<HTMLElement>('[data-user-label]');
  const todaySummary = root.querySelector<HTMLElement>('[data-today-summary]');
  const nextDays = root.querySelector<HTMLElement>('[data-next-days]');
  const configDays = root.querySelector<HTMLElement>('[data-config-days]');
  const configSection = root.querySelector<HTMLElement>('[data-config-section]');
  const themeSelect = root.querySelector<HTMLSelectElement>('[data-theme-select]');

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentMenuId = '';
  let currentMenu: WeekMenu | null = null;
  let dishes: Dish[] = [];
  let unsubscribeMenu: (() => void) | undefined;
  let unsubscribeDishes: (() => void) | undefined;
  let unsubscribeProfile: (() => void) | undefined;
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

  function formatDate(isoDate: string, includeWeekday = true) {
    return new Intl.DateTimeFormat(locale, {
      weekday: includeWeekday ? 'short' : undefined,
      day: 'numeric',
      month: 'short',
    }).format(new Date(`${isoDate}T00:00:00`));
  }

  function getNextSevenDates() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      return toIsoDate(date);
    });
  }

  function getEnabledMeals() {
    return currentProfile?.enabledMeals?.length ? currentProfile.enabledMeals : ['lunch'];
  }

  function applyTheme(theme: ThemePreference) {
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.dataset.theme = theme;
    }

    if (themeSelect) themeSelect.value = theme;
  }

  function setVisible(isReady: boolean) {
    if (loading) loading.hidden = isReady;
    if (content) content.hidden = !isReady;
  }

  function renderMealSummary(meal: MealEntry) {
    if (meal.skipped) {
      const reason = reasonLabel(meal.reason);
      return reason ? `${labels.skipSummary}: ${reason}` : labels.skipSummary;
    }

    return meal.items.length ? meal.items.join(', ') : labels.todayEmpty;
  }

  function renderToday(menu: WeekMenu) {
    if (!todaySummary) return;

    const todayKey = toIsoDate(new Date());
    const day = normalizeDay(menu.days[todayKey]);
    const userName = currentUser?.displayName || currentUser?.email || labels.guestSession;
    const meals = getEnabledMeals()
      .map((meal) => `${mealLabel(meal)}: ${renderMealSummary(day.meals[meal])}`)
      .join(' · ');

    todaySummary.textContent = `${labels.hello} ${userName}, ${labels.todayIntro} ${meals}`;
  }

  function renderNextSeven(menu: WeekMenu) {
    if (!nextDays) return;

    nextDays.innerHTML = getNextSevenDates()
      .map((isoDate) => {
        const day = normalizeDay(menu.days[isoDate]);
        const mealSummaries = getEnabledMeals()
          .map(
            (meal) => `
              <li>
                <span>${escapeHtml(mealLabel(meal))}</span>
                <strong>${escapeHtml(renderMealSummary(day.meals[meal]))}</strong>
              </li>
            `
          )
          .join('');

        return `
          <article class="next-day-card" data-day="${isoDate}">
            <header>
              <span>${escapeHtml(formatDate(isoDate))}</span>
              <button class="button button--ghost button--small" type="button" data-edit-day="${isoDate}">${escapeHtml(labels.editDay)}</button>
            </header>
            <ul>${mealSummaries}</ul>
          </article>
        `;
      })
      .join('');
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

    const weekStart = toIsoDate(getMonday());
    const days = getWeekDays(weekStart, dayLabels);

    configDays.innerHTML = days
      .map((weekDay) => {
        const day = normalizeDay(menu.days[weekDay.key]);
        const mealEditors = getEnabledMeals().map((meal) => renderMealInputs(weekDay.key, meal, day.meals[meal])).join('');

        return `
          <article class="day-card day-card--editor" data-day="${weekDay.key}">
            <header class="day-card__header">
              <div><h3>${escapeHtml(weekDay.label)}</h3><p>${escapeHtml(formatDate(weekDay.isoDate))}</p></div>
            </header>
            ${mealEditors}
            <label>${escapeHtml(labels.notes)}
              <textarea data-field="notes" rows="2">${escapeHtml(day.notes ?? '')}</textarea>
            </label>
          </article>
        `;
      })
      .join('');
  }

  function renderPreferences(profile: UserProfile) {
    currentProfile = profile;
    applyTheme(profile.theme);

    root.querySelectorAll<HTMLInputElement>('[data-meal-preference]').forEach((input) => {
      input.checked = profile.enabledMeals.includes(input.value as MealSlot);
    });
  }

  function renderDashboard(menu: WeekMenu) {
    currentMenu = menu;
    setVisible(true);
    renderToday(menu);
    renderNextSeven(menu);
    renderConfig(menu);
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

  async function savePreferences() {
    if (!currentUser) return;

    const enabledMeals = [...root.querySelectorAll<HTMLInputElement>('[data-meal-preference]')]
      .filter((input) => input.checked)
      .map((input) => input.value as MealSlot);
    const services = await getFirebaseServices();

    await updateUserPreferences(services, currentUser.uid, {
      enabledMeals: enabledMeals.length ? enabledMeals : ['lunch'],
    });
  }

  if (!hasFirebaseConfig()) {
    setVisible(false);
    showStatus(labels.configMissing, true);
  } else {
    getFirebaseServices()
      .then((services) => {
        root.querySelector('[data-logout]')?.addEventListener('click', () => closeSession());
        root.querySelector('[data-notifications]')?.addEventListener('click', async () => {
          const permission = await requestChangeNotifications();
          showStatus(
            permission === 'granted' ? labels.notificationsEnabled : labels.notificationsDenied,
            permission !== 'granted'
          );
        });
        root.querySelector('[data-open-config]')?.addEventListener('click', () => {
          if (!configSection) return;
          configSection.hidden = false;
          configSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        themeSelect?.addEventListener('change', async () => {
          if (!currentUser || !themeValues.includes(themeSelect.value as ThemePreference)) return;
          const theme = themeSelect.value as ThemePreference;
          applyTheme(theme);
          await updateUserPreferences(services, currentUser.uid, { theme });
        });
        root.querySelectorAll<HTMLInputElement>('[data-meal-preference]').forEach((input) => {
          input.addEventListener('change', () => savePreferences().catch((error: Error) => showStatus(error.message, true)));
        });

        nextDays?.addEventListener('click', (event) => {
          const target = event.target;
          if (!(target instanceof HTMLButtonElement) || !target.dataset.editDay || !configSection) return;
          configSection.hidden = false;
          const editor = configDays?.querySelector<HTMLElement>(`[data-day="${target.dataset.editDay}"]`);
          (editor ?? configSection).scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        configDays?.addEventListener('change', (event) => {
          const target = event.target;
          if (
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLInputElement ||
            target instanceof HTMLSelectElement
          ) {
            if (target.dataset.plateInput) {
              const card = target.closest<HTMLElement>('[data-day]');
              if (card) {
                savePlateList(card, target.dataset.plateInput as MealSlot).catch((error: Error) => showStatus(error.message, true));
              }
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

          if (userLabel) userLabel.textContent = user.displayName || user.email || labels.guestSession;

          await ensureUserProfile(services, user, labels.guestSession);
          const weekStart = toIsoDate(getMonday());
          currentMenuId = await getOrCreateWeekMenu(services, user.uid, weekStart, locale);
          firstMenuLoad = true;

          unsubscribeProfile = watchUserProfile(
            services,
            user,
            labels.guestSession,
            (profile) => {
              renderPreferences(profile);
              if (currentMenu) renderDashboard(currentMenu);
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
              const changedByOtherUser = !firstMenuLoad && menu.updatedBy && menu.updatedBy !== currentUser?.uid;
              renderDashboard(menu);
              if (changedByOtherUser) notifyMenuChanged(labels.updated, labels.updatedBody);
              firstMenuLoad = false;
            },
            (error) => showStatus(error.message, true)
          );
        });
      })
      .catch((error: Error) => showStatus(error.message, true));
  }
}
