import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { getMonday, toIsoDate } from '../lib/menu/dates';
import { renderDayEditor } from '../lib/menu/day-editor';
import {
  clearMenuDay,
  ensureUserProfile,
  getOrCreateWeekMenu,
  updateMenuPatch,
  watchDishes,
  watchUserProfile,
  watchWeekMenu,
} from '../lib/menu/repository';
import type { DailyMenu, Dish, FirebaseUser, MealEntry, MealSlot, UserProfile, WeekMenu } from '../lib/menu/types';
import { notifyMenuChanged, requestChangeNotifications } from '../lib/notifications/browser';

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
  const quickModal = root.querySelector<HTMLDialogElement>('[data-quick-modal]');
  const quickForm = root.querySelector<HTMLFormElement>('[data-quick-form]');
  const quickFields = root.querySelector<HTMLElement>('[data-quick-fields]');

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentMenu: WeekMenu | null = null;
  let currentMenuId = '';
  let dishes: Dish[] = [];
  let unsubscribeMenu: (() => void) | undefined;
  let unsubscribeDishes: (() => void) | undefined;
  let unsubscribeProfile: (() => void) | undefined;
  let firstMenuLoad = true;

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
      skipped: Boolean(day?.skipped),
      reason: day?.reason ?? '',
      skipNote: day?.skipNote ?? '',
      notes: day?.notes ?? '',
    };
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

  function getDateOffset(daysFromToday: number) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + daysFromToday);
    return toIsoDate(date);
  }

  function getCurrentWeekStart() {
    return toIsoDate(getMonday(new Date()));
  }

  function getNextSevenDates() {
    return Array.from({ length: 7 }, (_, index) => getDateOffset(index + 1));
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

    const day = normalizeDay(menu.days[getDateOffset(0)]);
    const firstMeal = getEnabledMeals()[0] ?? 'lunch';
    const meal = day.meals[firstMeal];
    const items = day.skipped || meal.skipped || meal.items.length === 0 ? [renderDaySummary(day, firstMeal)] : meal.items;

    todaySummary.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  }

  function renderNextSeven(menu: WeekMenu) {
    if (!nextDays) return;

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
              <header>
                <h3>${escapeHtml(formatWeekday(isoDate))}</h3>
                <details class="day-actions">
                  <summary aria-label="${escapeHtml(labels.moreActions)}">⋯</summary>
                  <div>
                    <button type="button" data-quick-edit="${isoDate}">${escapeHtml(labels.editDay)}</button>
                    <button type="button" data-clear-day="${isoDate}">${escapeHtml(labels.deleteDay)}</button>
                  </div>
                </details>
              </header>
              ${summaries}
            </div>
          </article>
        `;
      })
      .join('');
  }

  function openQuickEdit(dayKey: string) {
    if (!currentMenu || !quickFields || !quickModal) return;

    quickFields.innerHTML = renderDayEditor({
      dayKey,
      dayNumber: getDayNumber(dayKey),
      weekday: formatWeekday(dayKey),
      day: normalizeDay(currentMenu.days[dayKey]),
      enabledMeals: getEnabledMeals(),
      dishes,
      labels,
      compact: true,
    });
    quickModal.showModal();
  }

  async function saveField(card: HTMLElement, path: string, value: string | boolean | string[]) {
    if (!currentUser || !currentMenuId) return;
    const services = await getFirebaseServices();
    await updateMenuPatch(services, currentMenuId, currentUser.uid, {
      dayKey: card.dataset.day ?? '',
      path,
      value,
    });
  }

  async function savePlateList(card: HTMLElement, meal: MealSlot) {
    const items = [...card.querySelectorAll<HTMLInputElement>(`[data-plate-input="${meal}"]`)]
      .map((input) => input.value.trim())
      .filter(Boolean);
    await saveField(card, `meals.${meal}.items`, items);
  }

  function addPlate(card: HTMLElement, meal: MealSlot, value = '') {
    const list = card.querySelector<HTMLElement>(`[data-plate-list="${meal}"]`);
    if (!list) return;

    const row = document.createElement('div');
    row.className = 'plate-row';
    row.innerHTML = `
      <label><span class="sr-only">${labels.addDish}</span><input type="text" value="" data-plate-input="${meal}" placeholder="${labels.dishPlaceholder}" autocomplete="off" /></label>
      <button class="icon-button icon-button--danger" type="button" data-remove-plate="${meal}" aria-label="${labels.removePlate}"><span aria-hidden="true">×</span></button>
    `;
    list.append(row);
    const input = row.querySelector<HTMLInputElement>('input');
    if (input) {
      input.value = value;
      input.focus();
    }
  }

  function renderDashboard(menu: WeekMenu) {
    currentMenu = menu;
    setVisible(true);
    renderToday(menu);
    renderNextSeven(menu);
  }

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
          if (!(target instanceof HTMLButtonElement)) return;

          if (target.dataset.quickEdit) {
            openQuickEdit(target.dataset.quickEdit);
            return;
          }

          if (target.dataset.clearDay && currentUser && currentMenuId) {
            await clearMenuDay(services, currentMenuId, currentUser.uid, target.dataset.clearDay);
          }
        });

        quickFields?.addEventListener('change', (event) => {
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

        quickFields?.addEventListener('click', (event) => {
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
            return;
          }

          if (button.dataset.suggestion) {
            const meal = button.closest<HTMLElement>('[data-meal]')?.dataset.meal as MealSlot | undefined;
            if (!meal) return;
            const emptyInput = card.querySelector<HTMLInputElement>(`[data-plate-input="${meal}"]`);
            if (emptyInput && !emptyInput.value.trim()) {
              emptyInput.value = button.dataset.suggestion;
              savePlateList(card, meal).catch((error: Error) => showStatus(error.message, true));
              return;
            }
            addPlate(card, meal, button.dataset.suggestion);
            savePlateList(card, meal).catch((error: Error) => showStatus(error.message, true));
          }
        });

        quickForm?.addEventListener('submit', (event) => {
          const submitter = (event as SubmitEvent).submitter;
          if (submitter instanceof HTMLButtonElement && submitter.value === 'save') {
            event.preventDefault();
            quickModal?.close();
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
          currentMenuId = await getOrCreateWeekMenu(services, user.uid, getCurrentWeekStart(), locale);
          firstMenuLoad = true;

          unsubscribeProfile = watchUserProfile(
            services,
            user,
            labels.guestSession,
            (profile) => {
              currentProfile = profile;
              applyTheme(profile.theme);
              if (currentMenu) renderDashboard(currentMenu);
            },
            (error) => showStatus(error.message, true)
          );

          unsubscribeDishes = watchDishes(
            services,
            user.uid,
            (nextDishes) => {
              dishes = nextDishes;
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
