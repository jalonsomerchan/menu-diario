import { buildShoppingListContext } from '../lib/ai/shopping-list';
import { watchUserDishes } from '../lib/dishes/repository';
import { buildDishUsageHistory } from '../lib/dishes/usage-history';
import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { getUpcomingDates, getWeekStartForDate, getWeekStartsForDates, shiftWeek } from '../lib/menu/dates';
import { watchUserMenus, watchUserProfile } from '../lib/menu/repository';
import { copyWeekMenuDays, getMergedDaysForKeys, readWeekMenusByStarts } from '../lib/menu/week-menu-actions';
import type { Dish, FirebaseUser, MealSlot, UserProfile, WeekMenu } from '../lib/menu/types';
import { buildMenuShoppingItems } from '../lib/shopping/menu-list-generator';
import { saveShoppingList } from '../lib/shopping/repository';
import { assignTupperToMeal, watchTuppers } from '../lib/tuppers/repository';
import type { TupperItem } from '../lib/tuppers/types';
import { useMenuAutomationTranslations } from '../i18n/menu-automation-actions';

const actionHost = document.querySelector<HTMLElement>('[data-dashboard-app], [data-menu-app], [data-shopping-app], [data-tuppers-app]');
const dishHistoryHost = document.querySelector<HTMLElement>('[data-dishes-app]');

if ((actionHost || dishHistoryHost) && hasFirebaseConfig()) {
  const localeKey = document.documentElement.lang === 'en' ? 'en' : 'es';
  const locale = localeKey === 'en' ? 'en-US' : 'es-ES';
  const t = useMenuAutomationTranslations(localeKey);
  const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const statusTarget = document.querySelector<HTMLElement>(
    '[data-dashboard-app] [data-status], [data-menu-app] [data-status], [data-shopping-app] [data-status], [data-tuppers-app] [data-status], [data-dishes-app] [data-status]'
  );

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let dishes: Dish[] = [];
  let tuppers: TupperItem[] = [];
  let recentMenus: WeekMenu[] = [];
  let servicesCache: Awaited<ReturnType<typeof getFirebaseServices>> | null = null;
  let unsubscribeProfile: (() => void) | undefined;
  let unsubscribeDishes: (() => void) | undefined;
  let unsubscribeTuppers: (() => void) | undefined;
  let unsubscribeMenus: (() => void) | undefined;

  function escapeHtml(value = '') {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function showStatus(message: string, isError = false) {
    if (!statusTarget) return;
    statusTarget.hidden = false;
    statusTarget.textContent = message;
    statusTarget.dataset.variant = isError ? 'error' : 'info';
  }

  function getEnabledMeals(): MealSlot[] {
    return currentProfile?.enabledMeals?.length ? currentProfile.enabledMeals : ['lunch'];
  }

  function getVisibleDayKeys() {
    const dayKeys = [...document.querySelectorAll<HTMLElement>('[data-day]')]
      .map((item) => item.dataset.day ?? '')
      .filter((dayKey) => /^\d{4}-\d{2}-\d{2}$/.test(dayKey));
    return [...new Set(dayKeys)].sort().slice(0, 14).length ? [...new Set(dayKeys)].sort().slice(0, 14) : getUpcomingDates(new Date(), 0, 7);
  }

  function formatDate(dayKey: string) {
    return weekdayFormatter.format(new Date(`${dayKey}T00:00:00`));
  }

  function getTargets() {
    return getVisibleDayKeys().flatMap((dayKey) => getEnabledMeals().map((meal) => ({ dayKey, meal })));
  }

  function renderTupperOptions() {
    const activeTuppers = tuppers.filter((tupper) => tupper.status === 'active' || tupper.status === 'assigned');
    return activeTuppers.length
      ? activeTuppers.map((tupper) => `<option value="${escapeHtml(tupper.id)}">${escapeHtml(tupper.name)}</option>`).join('')
      : `<option value="">${escapeHtml(t('noTuppers'))}</option>`;
  }

  function renderTargetOptions() {
    const targets = getTargets();
    return targets.length
      ? targets
          .map((target) => {
            const label = `${formatDate(target.dayKey)} · ${t(target.meal)}`;
            return `<option value="${escapeHtml(`${target.dayKey}::${target.meal}`)}">${escapeHtml(label)}</option>`;
          })
          .join('')
      : `<option value="">${escapeHtml(t('noTargets'))}</option>`;
  }

  function renderActionPanel() {
    const panel = actionHost?.querySelector<HTMLElement>('[data-menu-automation-actions]');
    if (!panel) return;

    panel.innerHTML = `
      <div class="menu-automation-actions__header">
        <h2>${escapeHtml(t('title'))}</h2>
        <p>${escapeHtml(t('description'))}</p>
      </div>
      <div class="menu-automation-actions__grid">
        <article class="menu-automation-card">
          <h3>${escapeHtml(t('copyTitle'))}</h3>
          <p>${escapeHtml(t('copyDescription'))}</p>
          <button class="button button--secondary" type="button" data-menu-copy-week ${currentUser ? '' : 'disabled'}>${escapeHtml(t('copyAction'))}</button>
        </article>
        <article class="menu-automation-card">
          <h3>${escapeHtml(t('shoppingTitle'))}</h3>
          <p>${escapeHtml(t('shoppingDescription'))}</p>
          <button class="button button--primary" type="button" data-menu-create-shopping ${currentUser ? '' : 'disabled'}>${escapeHtml(t('shoppingAction'))}</button>
        </article>
        <article class="menu-automation-card">
          <h3>${escapeHtml(t('tupperTitle'))}</h3>
          <p>${escapeHtml(t('tupperDescription'))}</p>
          <div class="menu-automation-card__fields">
            <label>${escapeHtml(t('tupperSelect'))}<select data-menu-tupper-select>${renderTupperOptions()}</select></label>
            <label>${escapeHtml(t('targetSelect'))}<select data-menu-target-select>${renderTargetOptions()}</select></label>
          </div>
          <button class="button button--secondary" type="button" data-menu-assign-tupper ${currentUser && tuppers.length ? '' : 'disabled'}>${escapeHtml(t('tupperAction'))}</button>
        </article>
      </div>
    `;
  }

  function ensureActionPanel() {
    if (!actionHost || actionHost.querySelector('[data-menu-automation-actions]')) return;
    const panel = document.createElement('section');
    panel.className = 'menu-automation-actions app-panel';
    panel.dataset.menuAutomationActions = 'true';
    panel.innerHTML = `<p>${escapeHtml(t('loading'))}</p>`;

    const insertionPoint =
      actionHost.querySelector('[data-content]') ?? actionHost.querySelector('[data-workspace]') ?? actionHost;
    insertionPoint.prepend(panel);
  }

  async function copyPreviousWeek() {
    if (!currentUser || !servicesCache) return;
    const targetWeekStart = getWeekStartForDate(getVisibleDayKeys()[0] ?? new Date());
    const sourceWeekStart = shiftWeek(targetWeekStart, -1);
    try {
      await copyWeekMenuDays(servicesCache, { userId: currentUser.uid, sourceWeekStart, targetWeekStart, locale });
      showStatus(t('copied'));
    } catch (error) {
      const message = error instanceof Error && error.message === 'source-week-empty' ? t('sourceEmpty') : t('error');
      showStatus(message, true);
    }
  }

  async function createAutomaticShoppingList() {
    if (!currentUser || !servicesCache) return;
    const dayKeys = getVisibleDayKeys();
    const menus = await readWeekMenusByStarts(servicesCache, currentUser.uid, getWeekStartsForDates(dayKeys));
    const context = buildShoppingListContext({
      locale,
      days: getMergedDaysForKeys(menus, dayKeys),
      dayKeys,
      enabledMeals: getEnabledMeals(),
      dishes,
      tuppers,
    });
    const items = buildMenuShoppingItems(context, { fallbackNote: t('reviewIngredientsNote') });

    if (!items.length) {
      showStatus(t('shoppingEmpty'), true);
      return;
    }

    await saveShoppingList(servicesCache, {
      userId: currentUser.uid,
      groupId: currentProfile?.groupId,
      scope: currentProfile?.groupId ? 'group' : 'user',
      title: t('shoppingTitle'),
      rangeStart: dayKeys[0],
      rangeEnd: dayKeys.at(-1) ?? dayKeys[0],
      items,
    });
    showStatus(t('shoppingCreated'));
  }

  async function assignSelectedTupper() {
    if (!currentUser || !servicesCache || !actionHost) return;
    const tupperId = actionHost.querySelector<HTMLSelectElement>('[data-menu-tupper-select]')?.value ?? '';
    const targetValue = actionHost.querySelector<HTMLSelectElement>('[data-menu-target-select]')?.value ?? '';
    const tupper = tuppers.find((item) => item.id === tupperId);
    const [dayKey, meal] = targetValue.split('::') as [string, MealSlot | undefined];
    if (!tupper || !dayKey || !meal) return;

    await assignTupperToMeal(servicesCache, currentUser, tupper, { dayKey, meal, locale, allowAppend: true, forceMove: true });
    showStatus(t('tupperAssigned'));
  }

  function renderDishHistoryPanel() {
    const panel = dishHistoryHost?.querySelector<HTMLElement>('[data-dish-history-panel]');
    if (!panel) return;
    const selectedDish = panel.querySelector<HTMLSelectElement>('[data-dish-history-select]')?.value || dishes[0]?.name || '';
    const options = dishes
      .filter((dish) => !dish.archived)
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
      .map((dish) => `<option value="${escapeHtml(dish.name)}" ${dish.name === selectedDish ? 'selected' : ''}>${escapeHtml(dish.name)}</option>`)
      .join('');
    const history = buildDishUsageHistory(recentMenus, selectedDish);
    const entries = history.length
      ? history
          .map(
            (entry) => `<li class="menu-dish-history__item"><strong>${escapeHtml(formatDate(entry.dayKey))}</strong><span>${escapeHtml(t(entry.meal))}</span></li>`
          )
          .join('')
      : `<li class="menu-dish-history__item"><span>${escapeHtml(t('dishHistoryEmpty'))}</span></li>`;

    panel.innerHTML = `
      <div class="menu-dish-history__header">
        <h2>${escapeHtml(t('dishHistoryTitle'))}</h2>
        <p>${escapeHtml(t('dishHistoryDescription'))}</p>
      </div>
      <label>${escapeHtml(t('dishSelect'))}<select data-dish-history-select>${options}</select></label>
      <ul class="menu-dish-history__list">${entries}</ul>
    `;
  }

  function ensureDishHistoryPanel() {
    if (!dishHistoryHost || dishHistoryHost.querySelector('[data-dish-history-panel]')) return;
    const panel = document.createElement('section');
    panel.className = 'menu-dish-history app-panel';
    panel.dataset.dishHistoryPanel = 'true';
    panel.innerHTML = `<p>${escapeHtml(t('dishHistoryLoading'))}</p>`;
    const toolbar = dishHistoryHost.querySelector('.dishes-toolbar');
    toolbar?.insertAdjacentElement('afterend', panel);
  }

  function refreshPanels() {
    renderActionPanel();
    renderDishHistoryPanel();
  }

  ensureActionPanel();
  ensureDishHistoryPanel();
  refreshPanels();

  getFirebaseServices()
    .then((services) => {
      servicesCache = services;
      actionHost?.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.closest('[data-menu-copy-week]')) void copyPreviousWeek();
        if (target.closest('[data-menu-create-shopping]')) void createAutomaticShoppingList().catch(() => showStatus(t('error'), true));
        if (target.closest('[data-menu-assign-tupper]')) void assignSelectedTupper().catch(() => showStatus(t('error'), true));
      });
      dishHistoryHost?.addEventListener('change', (event) => {
        if ((event.target as HTMLElement | null)?.matches('[data-dish-history-select]')) renderDishHistoryPanel();
      });

      services.authModule.onAuthStateChanged(services.auth, (user: FirebaseUser | null) => {
        currentUser = user;
        unsubscribeProfile?.();
        unsubscribeDishes?.();
        unsubscribeTuppers?.();
        unsubscribeMenus?.();
        currentProfile = null;
        dishes = [];
        tuppers = [];
        recentMenus = [];
        refreshPanels();

        if (!user) return;
        unsubscribeProfile = watchUserProfile(
          services,
          user,
          t('guestSession'),
          (profile) => {
            currentProfile = profile;
            unsubscribeDishes?.();
            unsubscribeDishes = watchUserDishes(services, user.uid, (next) => { dishes = next; refreshPanels(); }, () => {}, false, profile.groupId);
            unsubscribeTuppers?.();
            unsubscribeTuppers = watchTuppers(services, user.uid, profile.groupId, (next) => { tuppers = next; refreshPanels(); }, () => {});
            refreshPanels();
          },
          () => {}
        );
        unsubscribeMenus = watchUserMenus(services, user.uid, (menus) => { recentMenus = menus; refreshPanels(); }, () => {}, 52);
      });
    })
    .catch(() => showStatus(t('error'), true));
}
