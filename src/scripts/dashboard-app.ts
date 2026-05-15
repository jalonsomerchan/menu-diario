import { closeSession, getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { getMonday, getWeekDays, toIsoDate } from '../lib/menu/dates';
import {
  ensureUserProfile,
  getOrCreateWeekMenu,
  updateMenuPatch,
  watchDishes,
  watchWeekMenu,
} from '../lib/menu/repository';
import type { DailyMenu, Dish, FirebaseUser, WeekMenu } from '../lib/menu/types';
import { notifyMenuChanged, requestChangeNotifications } from '../lib/notifications/browser';

const root = document.querySelector<HTMLElement>('[data-dashboard-app]');

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

  let currentUser: FirebaseUser | null = null;
  let currentMenuId = '';
  let currentMenu: WeekMenu | null = null;
  let dishes: Dish[] = [];
  let unsubscribeMenu: (() => void) | undefined;
  let unsubscribeDishes: (() => void) | undefined;
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

  function normalizeDay(day?: Partial<DailyMenu>): DailyMenu {
    return {
      lunchItems: day?.lunchItems ?? (day?.lunch ? [day.lunch] : []),
      noLunch: Boolean(day?.noLunch),
      noLunchReason: day?.noLunchReason ?? '',
      noLunchDescription: day?.noLunchDescription ?? '',
      notes: day?.notes ?? '',
    };
  }

  function formatDate(isoDate: string) {
    return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short' }).format(
      new Date(`${isoDate}T00:00:00`)
    );
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

  function getReasonLabel(reason: string) {
    if (reason === 'away') return labels.reasonAway;
    if (reason === 'eating-out') return labels.reasonEatingOut;
    if (reason === 'other') return labels.reasonOther;
    return '';
  }

  function getLunchText(day: DailyMenu) {
    if (day.noLunch) {
      const reason = getReasonLabel(day.noLunchReason);
      return reason ? `${labels.todayNoLunch}: ${reason}` : labels.todayNoLunch;
    }

    if (day.lunchItems.length > 0) {
      return day.lunchItems.join(', ');
    }

    return labels.todayEmpty;
  }

  function setVisible(isReady: boolean) {
    if (loading) loading.hidden = isReady;
    if (content) content.hidden = !isReady;
  }

  function renderToday(menu: WeekMenu) {
    if (!todaySummary) return;

    const todayKey = toIsoDate(new Date());
    const day = normalizeDay(menu.days[todayKey]);
    const userName = currentUser?.displayName || currentUser?.email || labels.guestSession;
    const lunch = getLunchText(day);

    todaySummary.textContent = `${labels.hello} ${userName}, ${labels.todayLunch} ${lunch}`;
  }

  function renderNextSeven(menu: WeekMenu) {
    if (!nextDays) return;

    nextDays.innerHTML = getNextSevenDates()
      .map((isoDate) => {
        const day = normalizeDay(menu.days[isoDate]);
        return `
          <article class="next-day-card">
            <span>${escapeHtml(formatDate(isoDate))}</span>
            <strong>${escapeHtml(getLunchText(day))}</strong>
            ${day.noLunchDescription ? `<p>${escapeHtml(day.noLunchDescription)}</p>` : ''}
          </article>
        `;
      })
      .join('');
  }

  function renderSuggestions(dayKey: string) {
    if (dishes.length === 0) return '';

    return `
      <div class="dish-suggestions" aria-label="${escapeHtml(labels.suggestions)}">
        <span>${escapeHtml(labels.suggestions)}</span>
        ${dishes
          .slice(0, 8)
          .map(
            (dish) =>
              `<button type="button" class="dish-chip" data-add-suggestion="${escapeHtml(dish.name)}" data-day="${dayKey}">${escapeHtml(dish.name)}</button>`
          )
          .join('')}
      </div>
    `;
  }

  function renderConfig(menu: WeekMenu) {
    if (!configDays) return;

    const weekStart = toIsoDate(getMonday());
    const days = getWeekDays(weekStart, dayLabels);

    configDays.innerHTML = days
      .map((weekDay) => {
        const day = normalizeDay(menu.days[weekDay.key]);
        const dishValue = escapeHtml(day.lunchItems.join('\n'));
        return `
          <article class="day-card" data-day="${weekDay.key}">
            <header class="day-card__header">
              <div><h3>${escapeHtml(weekDay.label)}</h3><p>${escapeHtml(formatDate(weekDay.isoDate))}</p></div>
            </header>

            <label>${escapeHtml(labels.addDish)}
              <textarea data-field="lunchItems" rows="3" placeholder="${escapeHtml(labels.dishPlaceholder)}">${dishValue}</textarea>
            </label>

            ${renderSuggestions(weekDay.key)}

            <label class="checkbox-row">
              <input type="checkbox" data-field="noLunch" ${day.noLunch ? 'checked' : ''} />
              <span>${escapeHtml(labels.noLunch)}</span>
            </label>

            <label>${escapeHtml(labels.reason)}
              <select data-field="noLunchReason">
                <option value=""></option>
                <option value="away" ${day.noLunchReason === 'away' ? 'selected' : ''}>${escapeHtml(labels.reasonAway)}</option>
                <option value="eating-out" ${day.noLunchReason === 'eating-out' ? 'selected' : ''}>${escapeHtml(labels.reasonEatingOut)}</option>
                <option value="other" ${day.noLunchReason === 'other' ? 'selected' : ''}>${escapeHtml(labels.reasonOther)}</option>
              </select>
            </label>

            <label>${escapeHtml(labels.reasonDescription)}
              <textarea data-field="noLunchDescription" rows="2">${escapeHtml(day.noLunchDescription)}</textarea>
            </label>

            <label>${escapeHtml(labels.notes)}
              <textarea data-field="notes" rows="2">${escapeHtml(day.notes)}</textarea>
            </label>
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
    renderConfig(menu);
  }

  async function saveField(target: HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement) {
    if (!currentUser || !currentMenuId) return;
    const card = target.closest<HTMLElement>('[data-day]');
    const field = target.dataset.field;

    if (!card || !field) return;

    let value: string | string[] | boolean = target.value.trim();

    if (target instanceof HTMLTextAreaElement && field === 'lunchItems') {
      value = target.value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      value = target.checked;
    }

    const services = await getFirebaseServices();
    await updateMenuPatch(services, currentMenuId, currentUser.uid, {
      dayKey: card.dataset.day ?? '',
      slot: field as any,
      value,
    });
  }

  async function addSuggestedDish(dayKey: string, dishName: string) {
    if (!currentMenu || !currentUser) return;
    const currentDay = normalizeDay(currentMenu.days[dayKey]);
    const nextItems = Array.from(new Set([...currentDay.lunchItems, dishName]));
    const services = await getFirebaseServices();

    await updateMenuPatch(services, currentMenuId, currentUser.uid, {
      dayKey,
      slot: 'lunchItems',
      value: nextItems,
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

        configDays?.addEventListener('change', (event) => {
          const target = event.target;
          if (
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLInputElement ||
            target instanceof HTMLSelectElement
          ) {
            saveField(target).catch((error: Error) => showStatus(error.message, true));
          }
        });

        configDays?.addEventListener('click', (event) => {
          const target = event.target;
          if (target instanceof HTMLButtonElement && target.dataset.addSuggestion && target.dataset.day) {
            addSuggestedDish(target.dataset.day, target.dataset.addSuggestion).catch((error: Error) =>
              showStatus(error.message, true)
            );
          }
        });

        services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
          currentUser = user;
          unsubscribeMenu?.();
          unsubscribeDishes?.();

          if (!user) {
            window.location.assign(labels.homePath || '/');
            return;
          }

          if (userLabel) userLabel.textContent = user.displayName || user.email || labels.guestSession;

          await ensureUserProfile(services, user, labels.guestSession);
          const weekStart = toIsoDate(getMonday());
          currentMenuId = await getOrCreateWeekMenu(services, user.uid, weekStart, locale);
          firstMenuLoad = true;

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
