import { watchUserDishes } from '../lib/dishes/repository';
import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { getWeekStartForDate } from '../lib/menu/dates';
import { buildWeeklySummary } from '../lib/menu/weekly-stats.mjs';
import { ensureUserProfile, watchUserMenus, watchUserProfile } from '../lib/menu/repository';
import type { Dish, FirebaseUser, UserProfile, WeekMenu } from '../lib/menu/types';
import { createSaveFeedback } from '../lib/ui/save-feedback';

const root = document.querySelector<HTMLElement>('[data-weekly-summary-app]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const status = root.querySelector<HTMLElement>('[data-status]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const content = root.querySelector<HTMLElement>('[data-content]');
  const weekSelect = root.querySelector<HTMLSelectElement>('[data-week-select]');
  const metrics = root.querySelector<HTMLElement>('[data-summary-metrics]');
  const topDishes = root.querySelector<HTMLElement>('[data-top-dishes]');
  const repeatedDishes = root.querySelector<HTMLElement>('[data-repeated-dishes]');
  const recommendations = root.querySelector<HTMLElement>('[data-recommendations]');
  const comparison = root.querySelector<HTMLElement>('[data-comparison]');
  const latestDish = root.querySelector<HTMLElement>('[data-latest-dish]');

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let menus: WeekMenu[] = [];
  let dishes: Dish[] = [];
  let selectedWeekStart = getWeekStartForDate(new Date());
  let unsubscribeMenus: (() => void) | undefined;
  let unsubscribeDishes: (() => void) | undefined;
  let unsubscribeProfile: (() => void) | undefined;

  const feedback = createSaveFeedback(status, {
    pending: labels.loading,
    saving: labels.loading,
    saved: labels.saveSaved || '',
  });

  function escapeHtml(value = '') {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function showStatus(message: string, isError = false) {
    if (isError) {
      feedback.error(message);
      return;
    }
    feedback.info(message);
  }

  function formatError(error: unknown) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) return labels.permissionsError;
    return error instanceof Error ? error.message : String(error);
  }

  function getEnabledMeals() {
    return currentProfile?.enabledMeals?.length ? currentProfile.enabledMeals : ['lunch'];
  }

  function setVisible(isReady: boolean) {
    if (loading) loading.hidden = isReady;
    if (content) content.hidden = !isReady;
  }

  function formatWeek(weekStart: string) {
    const start = new Date(`${weekStart}T00:00:00`);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const formatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
    return `${formatter.format(start)} - ${formatter.format(end)}`;
  }

  function formatDishDate(date?: Date) {
    if (!date) return labels.noData;
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date);
  }

  function renderWeekOptions() {
    if (!weekSelect) return;
    const weekStarts = [...new Set([getWeekStartForDate(new Date()), ...menus.map((menu) => menu.weekStart)])].sort((a, b) => b.localeCompare(a));
    if (!weekStarts.includes(selectedWeekStart)) selectedWeekStart = weekStarts[0] ?? getWeekStartForDate(new Date());
    weekSelect.innerHTML = weekStarts
      .map((weekStart) => `<option value="${escapeHtml(weekStart)}" ${weekStart === selectedWeekStart ? 'selected' : ''}>${escapeHtml(formatWeek(weekStart))}</option>`)
      .join('');
  }

  function renderMetricCards(summary: ReturnType<typeof buildWeeklySummary>) {
    if (!metrics) return;
    const cards = [
      { label: labels.plannedMeals, value: summary.current.plannedMeals },
      { label: labels.emptyMeals, value: summary.current.emptyMeals },
      { label: labels.eatingOutMeals, value: summary.current.eatingOutMeals },
      { label: labels.totalMeals, value: summary.current.totalMeals },
    ];
    metrics.innerHTML = cards
      .map((card) => `<article class="weekly-summary-card"><span>${escapeHtml(card.label)}</span><strong>${card.value}</strong></article>`)
      .join('');
  }

  function renderDishList(target: HTMLElement | null, items: Array<{ name: string; count: number }>, emptyLabel: string) {
    if (!target) return;
    target.innerHTML = items.length
      ? `<ol class="weekly-summary-list">${items.map((item) => `<li><span>${escapeHtml(item.name)}</span><strong>${item.count}</strong></li>`).join('')}</ol>`
      : `<p class="weekly-summary-empty">${escapeHtml(emptyLabel)}</p>`;
  }

  function renderRecommendations(summary: ReturnType<typeof buildWeeklySummary>) {
    if (!recommendations) return;
    recommendations.innerHTML = summary.recommendations
      .map((item) => {
        const label = labels[`recommendation.${item.type}`] ?? labels.recommendationDefault;
        return `<li>${escapeHtml(label.replace('{dish}', item.dishName).replace('{count}', String(item.value)))}</li>`;
      })
      .join('');
  }

  function renderComparison(summary: ReturnType<typeof buildWeeklySummary>) {
    if (!comparison) return;
    if (!summary.comparison.hasHistory) {
      comparison.innerHTML = `<p class="weekly-summary-empty">${escapeHtml(labels.notEnoughHistory)}</p>`;
      return;
    }

    const rows = [
      { label: labels.plannedMeals, value: summary.comparison.plannedDelta },
      { label: labels.emptyMeals, value: summary.comparison.emptyDelta },
      { label: labels.eatingOutMeals, value: summary.comparison.eatingOutDelta },
    ];
    comparison.innerHTML = `<dl class="weekly-summary-comparison">${rows
      .map((row) => `<div><dt>${escapeHtml(row.label)}</dt><dd>${row.value > 0 ? '+' : ''}${row.value}</dd></div>`)
      .join('')}</dl>`;
  }

  function renderLatestDish(summary: ReturnType<typeof buildWeeklySummary>) {
    if (!latestDish) return;
    if (!summary.latestAddedDish) {
      latestDish.innerHTML = `<p class="weekly-summary-empty">${escapeHtml(labels.noLatestDish)}</p>`;
      return;
    }

    latestDish.innerHTML = `<strong>${escapeHtml(summary.latestAddedDish.name)}</strong><span>${escapeHtml(formatDishDate(summary.latestAddedDish.createdAt))}</span>`;
  }

  function renderSummary() {
    renderWeekOptions();
    const summary = buildWeeklySummary({
      menus,
      dishes,
      currentWeekStart: selectedWeekStart,
      enabledMeals: getEnabledMeals(),
    });

    renderMetricCards(summary);
    renderDishList(topDishes, summary.topUsedDishes, labels.emptyTopDishes);
    renderDishList(repeatedDishes, summary.current.repeatedDishes, labels.emptyRepeatedDishes);
    renderRecommendations(summary);
    renderComparison(summary);
    renderLatestDish(summary);
  }

  weekSelect?.addEventListener('change', () => {
    selectedWeekStart = weekSelect.value;
    renderSummary();
  });

  if (!hasFirebaseConfig()) {
    setVisible(false);
    showStatus(labels.configMissing, true);
  } else {
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
                  renderSummary();
                },
                (error) => showStatus(formatError(error), true),
                false,
                profile.groupId
              );
              renderSummary();
            },
            (error) => showStatus(formatError(error), true)
          );

          unsubscribeMenus = watchUserMenus(
            services,
            user.uid,
            (nextMenus) => {
              menus = nextMenus;
              setVisible(true);
              renderSummary();
            },
            (error) => showStatus(formatError(error), true),
            16
          );
        });
      })
      .catch((error: Error) => showStatus(formatError(error), true));
  }
}
