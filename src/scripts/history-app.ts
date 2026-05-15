import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { toIsoDate } from '../lib/menu/dates';
import {
  clearMenuDay,
  ensureUserProfile,
  getOrCreateWeekMenu,
  updateMenuPatch,
  watchUserMenus,
  watchUserProfile,
} from '../lib/menu/repository';
import type { DailyMenu, FirebaseUser, MealEntry, MealSlot, UserProfile, WeekMenu } from '../lib/menu/types';

const root = document.querySelector<HTMLElement>('[data-history-app]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const status = root.querySelector<HTMLElement>('[data-status]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const content = root.querySelector<HTMLElement>('[data-content]');
  const list = root.querySelector<HTMLElement>('[data-history-days]');
  const fromInput = root.querySelector<HTMLInputElement>('[data-date-from]');
  const toInput = root.querySelector<HTMLInputElement>('[data-date-to]');
  const modal = root.querySelector<HTMLDialogElement>('[data-history-modal]');
  const editForm = root.querySelector<HTMLFormElement>('[data-history-edit-form]');
  const editFields = root.querySelector<HTMLElement>('[data-history-edit-fields]');

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let menus: WeekMenu[] = [];
  let editMenuId = '';
  let editDayKey = '';
  let unsubscribeMenus: (() => void) | undefined;
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
    return { ...emptyMeal(), ...meal, items: Array.isArray(meal?.items) ? meal.items : [] };
  }

  function normalizeDay(day?: Partial<DailyMenu>): DailyMenu {
    return {
      meals: {
        breakfast: normalizeMeal(day?.meals?.breakfast),
        lunch: normalizeMeal({
          ...(day?.meals?.lunch ?? {}),
          items: day?.meals?.lunch?.items ?? day?.lunchItems ?? (day?.lunch ? [day.lunch] : []),
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

  function formatWeekday(isoDate: string) {
    return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(`${isoDate}T00:00:00`));
  }

  function getDayNumber(isoDate: string) {
    return new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(new Date(`${isoDate}T00:00:00`));
  }

  function renderMealSummary(meal: MealEntry) {
    if (meal.skipped) return labels.skipSummary;
    return meal.items.length ? meal.items.join(', ') : labels.todayEmpty;
  }

  function findDay(isoDate: string) {
    for (const menu of menus) {
      if (menu.days[isoDate]) return { menu, day: normalizeDay(menu.days[isoDate]) };
    }
    return null;
  }

  function renderHistory() {
    if (!list || !fromInput || !toInput) return;
    const from = fromInput.value || getDateOffset(-30);
    const to = toInput.value || getDateOffset(-1);
    const rows: string[] = [];
    const cursor = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);

    while (cursor <= end) {
      const isoDate = toIsoDate(cursor);
      const found = findDay(isoDate);
      if (found) {
        const summaries = getEnabledMeals()
          .map(
            (meal) =>
              `<div class="day-meal-row"><span>${escapeHtml(mealLabel(meal))}:</span><strong>${escapeHtml(renderMealSummary(found.day.meals[meal]))}</strong></div>`
          )
          .join('');
        rows.unshift(`
          <article class="next-day-card next-day-card--mockup" data-day="${isoDate}" data-menu="${found.menu.id}">
            <div class="next-day-card__number">${escapeHtml(getDayNumber(isoDate))}</div>
            <div class="next-day-card__body">
              <header>
                <h3>${escapeHtml(formatWeekday(isoDate))}</h3>
                <details class="day-actions">
                  <summary aria-label="${escapeHtml(labels.moreActions)}">⋯</summary>
                  <div>
                    <button type="button" data-history-edit="${isoDate}" data-menu="${found.menu.id}">${escapeHtml(labels.editDay)}</button>
                    <button type="button" data-clear-day="${isoDate}" data-menu="${found.menu.id}">${escapeHtml(labels.deleteDay)}</button>
                  </div>
                </details>
              </header>
              ${summaries}
            </div>
          </article>
        `);
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    list.innerHTML = rows.length ? rows.join('') : `<p class="menu-list__empty">${escapeHtml(labels.empty)}</p>`;
  }

  function openEdit(menuId: string, dayKey: string) {
    const menu = menus.find((item) => item.id === menuId);
    const day = normalizeDay(menu?.days[dayKey]);

    if (!menu || !modal || !editFields) return;

    editMenuId = menuId;
    editDayKey = dayKey;
    editFields.innerHTML = getEnabledMeals()
      .map(
        (meal) => `
          <label>${escapeHtml(mealLabel(meal))}
            <textarea data-history-meal="${meal}" rows="3">${escapeHtml(day.meals[meal].items.join('\n'))}</textarea>
          </label>
        `
      )
      .join('');
    modal.showModal();
  }

  async function saveEdit() {
    if (!currentUser || !editMenuId || !editDayKey || !editFields) return;
    const services = await getFirebaseServices();

    await Promise.all(
      [...editFields.querySelectorAll<HTMLTextAreaElement>('[data-history-meal]')].map((textarea) =>
        updateMenuPatch(services, editMenuId, currentUser!.uid, {
          dayKey: editDayKey,
          path: `meals.${textarea.dataset.historyMeal}.items`,
          value: textarea.value
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean),
        })
      )
    );
  }

  if (!hasFirebaseConfig()) {
    if (loading) loading.hidden = true;
    showStatus(labels.configMissing, true);
  } else {
    getFirebaseServices()
      .then((services) => {
        const today = new Date();
        if (toInput) toInput.value = getDateOffset(-1);
        if (fromInput) {
          today.setDate(today.getDate() - 30);
          fromInput.value = toIsoDate(today);
        }

        root.querySelector('[data-history-form]')?.addEventListener('submit', (event) => {
          event.preventDefault();
          renderHistory();
        });

        list?.addEventListener('click', async (event) => {
          const target = event.target;
          if (!(target instanceof HTMLButtonElement) || !currentUser) return;

          if (target.dataset.historyEdit && target.dataset.menu) {
            openEdit(target.dataset.menu, target.dataset.historyEdit);
            return;
          }

          if (target.dataset.clearDay && target.dataset.menu) {
            await clearMenuDay(services, target.dataset.menu, currentUser.uid, target.dataset.clearDay);
          }
        });

        editForm?.addEventListener('submit', (event) => {
          const submitter = (event as SubmitEvent).submitter;
          if (submitter instanceof HTMLButtonElement && submitter.value === 'save') {
            event.preventDefault();
            saveEdit()
              .then(() => modal?.close())
              .catch((error: Error) => showStatus(error.message, true));
          }
        });

        services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
          currentUser = user;
          unsubscribeMenus?.();
          unsubscribeProfile?.();

          if (!user) {
            window.location.assign(labels.homePath || '/');
            return;
          }

          await ensureUserProfile(services, user, 'Sesión invitada');
          await getOrCreateWeekMenu(services, user.uid, getDateOffset(0), locale);
          unsubscribeProfile = watchUserProfile(
            services,
            user,
            'Sesión invitada',
            (profile) => {
              currentProfile = profile;
              if (menus.length) renderHistory();
            },
            (error) => showStatus(error.message, true)
          );
          unsubscribeMenus = watchUserMenus(
            services,
            user.uid,
            (nextMenus) => {
              menus = nextMenus;
              if (loading) loading.hidden = true;
              if (content) content.hidden = false;
              renderHistory();
            },
            (error) => showStatus(error.message, true),
            60
          );
        });
      })
      .catch((error: Error) => showStatus(error.message, true));
  }
}
