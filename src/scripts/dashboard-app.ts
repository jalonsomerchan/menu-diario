import { closeSession, getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { toIsoDate } from '../lib/menu/dates';
import {
  ensureUserProfile,
  getOrCreateWeekMenu,
  watchUserProfile,
  watchWeekMenu,
} from '../lib/menu/repository';
import type { DailyMenu, FirebaseUser, MealEntry, MealSlot, UserProfile, WeekMenu } from '../lib/menu/types';
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

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentMenu: WeekMenu | null = null;
  let unsubscribeMenu: (() => void) | undefined;
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

  function getDateOffset(daysFromToday: number) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + daysFromToday);
    return toIsoDate(date);
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
    const items = meal.skipped || meal.items.length === 0 ? [renderMealSummary(meal)] : meal.items;

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
                <strong>${escapeHtml(renderMealSummary(day.meals[meal]))}</strong>
              </div>
            `
          )
          .join('');

        return `
          <article class="next-day-card next-day-card--mockup">
            <div class="next-day-card__number">${escapeHtml(getDayNumber(isoDate))}</div>
            <div class="next-day-card__body">
              <header>
                <h3>${escapeHtml(formatWeekday(isoDate))}</h3>
                <a class="button button--ghost button--small" href="${labels.configurePath}#dia-${isoDate}">${escapeHtml(labels.editDay)}</a>
              </header>
              ${summaries}
            </div>
          </article>
        `;
      })
      .join('');
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
        root.querySelector('[data-logout]')?.addEventListener('click', () => closeSession());
        root.querySelector('[data-notifications]')?.addEventListener('click', async () => {
          const permission = await requestChangeNotifications();
          showStatus(
            permission === 'granted' ? labels.notificationsEnabled : labels.notificationsDenied,
            permission !== 'granted'
          );
        });

        services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
          currentUser = user;
          unsubscribeMenu?.();
          unsubscribeProfile?.();

          if (!user) {
            window.location.assign(labels.homePath || '/');
            return;
          }

          if (userLabel) userLabel.textContent = `${labels.hello} ${user.displayName || user.email || labels.guestSession}`;

          await ensureUserProfile(services, user, labels.guestSession);
          const menuId = await getOrCreateWeekMenu(services, user.uid, getDateOffset(0), locale);
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

          unsubscribeMenu = watchWeekMenu(
            services,
            menuId,
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
