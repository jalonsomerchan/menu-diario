import { watchUserDishes } from '../lib/dishes/repository';
import { formatAppError } from '../lib/errors';
import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { getWeekStartForDate } from '../lib/menu/dates';
import { buildMenuStatistics, getStatisticsRangePreset, hasEnoughStatisticsData } from '../lib/menu/statistics.mjs';
import { ensureUserProfile, watchUserMenusByWeekRange, watchUserProfile } from '../lib/menu/repository';
import type { Dish, FirebaseUser, UserProfile, WeekMenu } from '../lib/menu/types';
import { createSaveFeedback } from '../lib/ui/save-feedback';

const root = document.querySelector<HTMLElement>('[data-statistics-app]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const status = root.querySelector<HTMLElement>('[data-status]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const content = root.querySelector<HTMLElement>('[data-content]');
  const empty = root.querySelector<HTMLElement>('[data-empty]');
  const form = root.querySelector<HTMLFormElement>('[data-statistics-form]');
  const fromInput = root.querySelector<HTMLInputElement>('[data-statistics-from]');
  const toInput = root.querySelector<HTMLInputElement>('[data-statistics-to]');
  const rangeSummary = root.querySelector<HTMLElement>('[data-range-summary]');
  const insights = root.querySelector<HTMLElement>('[data-insights]');
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const feedback = createSaveFeedback(status, { pending: labels.loading, saving: labels.loading, saved: labels.loading });

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let menus: WeekMenu[] = [];
  let dishes: Dish[] = [];
  let unsubscribeMenus: (() => void) | undefined;
  let unsubscribeDishes: (() => void) | undefined;
  let unsubscribeProfile: (() => void) | undefined;

  function escapeHtml(value = '') {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function formatError(error: unknown) {
    return formatAppError(error, labels);
  }

  function showError(error: unknown) {
    feedback.error(formatError(error) || labels.errorOffline);
  }

  function getSelectedPreset() {
    return root.querySelector<HTMLInputElement>('input[name="statistics-range"]:checked')?.value ?? '30';
  }

  function setPresetRange(days: number) {
    const range = getStatisticsRangePreset(days);
    if (fromInput) fromInput.value = range.start;
    if (toInput) toInput.value = range.end;
  }

  function getRange() {
    const fallback = getStatisticsRangePreset(30);
    const start = fromInput?.value || fallback.start;
    const end = toInput?.value || fallback.end;
    return start <= end ? { start, end } : { start: end, end: start };
  }

  function getEnabledMeals() {
    return currentProfile?.enabledMeals?.length ? currentProfile.enabledMeals : ['lunch'];
  }

  function formatDate(value: string) {
    if (!value) return labels.neverUsed;
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
  }

  function formatPeriod(value: string) {
    if (/^\d{4}-\d{2}$/.test(value)) {
      return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(new Date(`${value}-01T00:00:00`));
    }
    return formatDate(value);
  }

  function updateRangeSummary() {
    if (!rangeSummary) return;
    const range = getRange();
    rangeSummary.textContent = `${formatDate(range.start)} · ${formatDate(range.end)}`;
  }

  function renderKpi(name: string, value: string | number) {
    const node = root.querySelector<HTMLElement>(`[data-kpi="${name}"]`);
    if (node) node.textContent = String(value);
  }

  function formatCount(count: number) {
    return labels.times.replace('{count}', String(count));
  }

  function renderList(name: string, items: Array<{ name: string; count: number; lastUsed?: string }>) {
    const node = root.querySelector<HTMLElement>(`[data-list="${name}"]`);
    if (!node) return;
    if (!items.length) {
      node.innerHTML = `<p class="statistics-muted">${escapeHtml(labels.noItems)}</p>`;
      return;
    }
    node.innerHTML = `<ol class="statistics-list">${items
      .map((item) => {
        const meta = item.lastUsed
          ? labels.lastUsed.replace('{date}', formatDate(item.lastUsed))
          : formatCount(item.count);
        return `<li><span>${escapeHtml(item.name)}</span><strong>${escapeHtml(meta)}</strong></li>`;
      })
      .join('')}</ol>`;
  }

  function renderBars(name: string, items: Array<{ period: string; count: number }>) {
    const node = root.querySelector<HTMLElement>(`[data-bars="${name}"]`);
    if (!node) return;
    if (!items.length) {
      node.innerHTML = `<p class="statistics-muted">${escapeHtml(labels.noItems)}</p>`;
      return;
    }
    const max = Math.max(1, ...items.map((item) => item.count));
    node.innerHTML = `<div class="statistics-bars">${items
      .map((item) => {
        const width = Math.max(8, Math.round((item.count / max) * 100));
        const text = labels.chartLabel.replace('{label}', formatPeriod(item.period)).replace('{count}', String(item.count));
        return `
          <div class="statistics-bar" aria-label="${escapeHtml(text)}">
            <span>${escapeHtml(formatPeriod(item.period))}</span>
            <strong>${item.count}</strong>
            <i style="--bar-width: ${width}%"></i>
          </div>
        `;
      })
      .join('')}</div>`;
  }

  function renderInsights(stats: ReturnType<typeof buildMenuStatistics>) {
    if (!insights) return;
    if (!hasEnoughStatisticsData(stats)) {
      insights.innerHTML = `<p>${escapeHtml(labels.insightEmpty)}</p>`;
      return;
    }
    const messages = [
      labels.insightPlanning.replace('{planned}', String(stats.plannedMeals)).replace('{total}', String(stats.totalMealSlots)),
    ];
    const topDish = stats.topDishes[0];
    if (topDish) {
      messages.push(labels.insightVariety.replace('{dish}', topDish.name).replace('{count}', String(topDish.count)));
    }
    insights.innerHTML = messages.map((message) => `<p>${escapeHtml(message)}</p>`).join('');
  }

  function renderStatistics() {
    const range = getRange();
    const stats = buildMenuStatistics(menus, dishes, getEnabledMeals(), { range, limit: 6 });
    const hasData = hasEnoughStatisticsData(stats);
    renderKpi('plannedMeals', stats.plannedMeals);
    renderKpi('completionRate', `${stats.completionRate}%`);
    renderKpi('unplannedMeals', stats.unplannedMeals);
    renderKpi('eatingOutMeals', stats.eatingOutMeals);
    renderKpi('skippedMeals', stats.skippedMeals);
    renderKpi('leftoversMeals', stats.leftoversMeals);
    renderKpi('customDays', stats.customDays);
    renderKpi('totalMealSlots', stats.totalMealSlots);
    renderList('topDishes', stats.topDishes);
    renderList('favoriteDishes', stats.favoriteDishes);
    renderList('staleDishes', stats.staleDishes);
    renderList('varietyTags', stats.varietyTags);
    renderBars('mealsByWeek', stats.mealsByWeek);
    renderBars('mealsByMonth', stats.mealsByMonth);
    renderInsights(stats);
    updateRangeSummary();
    if (empty) empty.hidden = hasData;
  }

  function subscribeRange() {
    if (!currentUser) return;
    const range = getRange();
    const startWeek = getWeekStartForDate(range.start);
    const endWeek = getWeekStartForDate(range.end);
    unsubscribeMenus?.();
    menus = [];
    renderStatistics();

    getFirebaseServices()
      .then((services) => {
        unsubscribeMenus = watchUserMenusByWeekRange(
          services,
          currentUser?.uid ?? '',
          startWeek,
          endWeek,
          (nextMenus) => {
            menus = nextMenus;
            if (loading) loading.hidden = true;
            if (content) content.hidden = false;
            renderStatistics();
          },
          showError
        );
      })
      .catch(showError);
  }

  function handlePresetChange() {
    const preset = getSelectedPreset();
    if (preset === '7' || preset === '30' || preset === '90') {
      setPresetRange(Number(preset));
      subscribeRange();
    }
  }

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    root.querySelector<HTMLInputElement>('input[name="statistics-range"][value="custom"]')?.click();
    subscribeRange();
  });

  root.querySelectorAll<HTMLInputElement>('input[name="statistics-range"]').forEach((input) => {
    input.addEventListener('change', handlePresetChange);
  });

  [fromInput, toInput].forEach((input) => {
    input?.addEventListener('change', () => {
      root.querySelector<HTMLInputElement>('input[name="statistics-range"][value="custom"]')?.click();
      subscribeRange();
    });
  });

  if (!hasFirebaseConfig()) {
    if (loading) loading.hidden = true;
    showError(new Error(labels.configMissing));
  } else {
    setPresetRange(30);
    updateRangeSummary();
    getFirebaseServices()
      .then((services) => {
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
                  renderStatistics();
                },
                showError,
                false,
                profile.groupId
              );
              renderStatistics();
            },
            showError
          );
          subscribeRange();
        });
      })
      .catch(showError);
  }
}
