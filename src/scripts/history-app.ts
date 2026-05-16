import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { watchUserDishes } from '../lib/dishes/repository';
import { readDayDraft } from '../lib/menu/day-form';
import { serializeDay } from '../lib/menu/day-state';
import { getMonday, toIsoDate } from '../lib/menu/dates';
import { renderDayEditor, renderPlateRow } from '../lib/menu/day-editor';
import { normalizeDay } from '../lib/menu/normalizers';
import { attachDishSuggestions } from '../lib/menu/dish-suggestions';
import {
  clearMenuDay,
  ensureUserProfile,
  getOrCreateWeekMenu,
  updateMenuDay,
  watchUserMenus,
  watchUserProfile,
} from '../lib/menu/repository';
import type { Dish, FirebaseUser, MealEntry, MealSlot, UserProfile, WeekMenu } from '../lib/menu/types';
import { getNetworkStatus } from '../lib/pwa/network-status';
import { createDebouncedTaskMap } from '../lib/ui/debounced-task-map';
import { createSaveFeedback } from '../lib/ui/save-feedback';

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
  let dishes: Dish[] = [];
  let editMenuId = '';
  let unsubscribeMenus: (() => void) | undefined;
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

  function escapeHtml(value = '') {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

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
          .map((meal) => `<div class="day-meal-row"><span>${escapeHtml(mealLabel(meal))}:</span><strong>${escapeHtml(found.day.skipped ? labels.skipSummary : renderMealSummary(found.day.meals[meal]))}</strong></div>`)
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
    if (!menu || !modal || !editFields) return;

    editMenuId = menuId;
    editFields.innerHTML = renderDayEditor({
      dayKey,
      dayNumber: getDayNumber(dayKey),
      weekday: formatWeekday(dayKey),
      day: normalizeDay(menu.days[dayKey]),
      enabledMeals: getEnabledMeals(),
      dishes,
      labels,
      compact: true,
    });
    editFields.querySelector<HTMLElement>('[data-day]')?.setAttribute('data-day-state', serializeDay(menu.days[dayKey]));
    modal.showModal();
  }

  function updateLocalDay(dayKey: string, nextDay: WeekMenu['days'][string]) {
    menus = menus.map((menu) =>
      menu.id === editMenuId
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

  async function saveDay(card: HTMLElement) {
    if (getNetworkStatus() !== 'online') {
      saveFeedback.error(labels.offlineReadOnly);
      return;
    }
    if (!currentUser || !editMenuId) return;
    const dayKey = card.dataset.day ?? '';
    const nextDay = readDayDraft(card, getEnabledMeals());
    const nextState = serializeDay(nextDay);
    if (card.dataset.dayState === nextState) {
      saveFeedback.saved();
      return;
    }

    saveFeedback.saving();
    const services = await getFirebaseServices();
    const changed = await updateMenuDay(services, editMenuId, currentUser.uid, dayKey, nextDay, currentProfile?.groupId);
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

        editFields?.addEventListener('change', (event) => {
          const target = event.target;
          if (!(target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
          const card = target.closest<HTMLElement>('[data-day]');
          if (!card) return;
          if (target instanceof HTMLInputElement && target.type === 'checkbox') {
            const wasSkipped = card.dataset.dayState ? JSON.parse(card.dataset.dayState).skipped : false;
            if (target.checked !== wasSkipped) {
              editFields.innerHTML = renderDayEditor({
                dayKey: card.dataset.day ?? '',
                dayNumber: getDayNumber(card.dataset.day ?? ''),
                weekday: formatWeekday(card.dataset.day ?? ''),
                day: readDayDraft(card, getEnabledMeals()),
                enabledMeals: getEnabledMeals(),
                dishes,
                labels,
                compact: true,
              });
              editFields.querySelector<HTMLElement>('[data-day]')?.setAttribute('data-day-state', card.dataset.dayState ?? '');
            }
          }
          editFields.querySelectorAll<HTMLElement>('[data-day]').forEach((item) => scheduleDaySave(item));
        });

        editFields?.addEventListener('click', (event) => {
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

        editForm?.addEventListener('submit', async (event) => {
          const submitter = (event as SubmitEvent).submitter;
          if (submitter instanceof HTMLButtonElement && submitter.value === 'save') {
            event.preventDefault();
            const card = editFields?.querySelector<HTMLElement>('[data-day]');
            if (card) {
              await daySaveQueue.flush(card.dataset.day ?? '');
            }
            modal?.close();
          }
        });

        services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
          currentUser = user;
          unsubscribeMenus?.();
          unsubscribeDishes?.();
          unsubscribeProfile?.();

          if (!user) {
            window.location.assign(labels.homePath || '/');
            return;
          }

          await ensureUserProfile(services, user, labels.guestSession);
          await getOrCreateWeekMenu(services, user.uid, getCurrentWeekStart(), locale);
          unsubscribeProfile = watchUserProfile(
            services,
            user,
            labels.guestSession,
            (profile) => {
              currentProfile = profile;
              unsubscribeDishes?.();
              unsubscribeDishes = watchUserDishes(services, user.uid, (nextDishes) => {
                dishes = nextDishes;
              }, (error) => showStatus(formatError(error), true), false, profile.groupId);
              if (menus.length) renderHistory();
            },
            (error) => showStatus(formatError(error), true)
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
            (error) => showStatus(formatError(error), true),
            60
          );
        });
      })
      .catch((error: Error) => showStatus(formatError(error), true));
  }
}
