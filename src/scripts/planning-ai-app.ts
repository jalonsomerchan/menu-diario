import {
  assignPlanningRecommendations,
  buildPlanningAssistantPrompt,
  generateGeminiJson,
  getAiFeatureFlags,
  getAiUiMessageKey,
  getAiUiStateFromError,
  getPendingMealSlots,
  hasPlanningCatalogForMode,
  isMenuSuggestionsAvailable,
  isPlanningRecommendationResponse,
  type PlanningRecommendation,
  type PlanningRecommendationMode,
} from '../lib/ai';
import { watchUserDishes } from '../lib/dishes/repository';
import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { createDayEditModalController } from '../lib/menu/day-edit-modal';
import { getDateOffset, getDatesInRange, getWeekStartForDate, getWeekStartsForDates } from '../lib/menu/dates';
import { attachDishSuggestions } from '../lib/menu/dish-suggestions';
import { normalizeDay } from '../lib/menu/normalizers';
import {
  clearMenuDay,
  ensureUserProfile,
  getOrCreateWeekMenus,
  updateMenuDay,
  watchUserProfile,
  watchWeekMenusByIds,
} from '../lib/menu/repository';
import { serializeDay } from '../lib/menu/day-state';
import type { DailyMenu, Dish, FirebaseUser, MealSlot, UserProfile, WeekMenu } from '../lib/menu/types';
import { getNetworkStatus } from '../lib/pwa/network-status';
import { createSaveFeedback } from '../lib/ui/save-feedback';

const root = document.querySelector<HTMLElement>('[data-planning-ai-app]');

type PlanningRequest = {
  start: string;
  end: string;
  dates: string[];
  meals: MealSlot[];
  mode: PlanningRecommendationMode;
  recommendationCount: number;
};

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const status = root.querySelector<HTMLElement>('[data-status]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const content = root.querySelector<HTMLElement>('[data-content]');
  const form = root.querySelector<HTMLFormElement>('[data-plan-form]');
  const startInput = root.querySelector<HTMLInputElement>('[data-plan-start]');
  const endInput = root.querySelector<HTMLInputElement>('[data-plan-end]');
  const countInput = root.querySelector<HTMLInputElement>('[data-plan-count]');
  const submitButton = root.querySelector<HTMLButtonElement>('[data-plan-submit]');
  const pendingContainer = root.querySelector<HTMLElement>('[data-plan-pending]');
  const resultsContainer = root.querySelector<HTMLElement>('[data-plan-results]');
  const aiStatus = root.querySelector<HTMLElement>('[data-ai-status]');
  const summaryContainer = root.querySelector<HTMLElement>('[data-plan-summary]');

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentMenus: WeekMenu[] = [];
  let currentMenuIdsByWeekStart: Record<string, string> = {};
  let dishes: Dish[] = [];
  let currentRequest: PlanningRequest | null = null;
  let recommendations: PlanningRecommendation[] = [];
  let hasGeneratedResults = false;
  let syncedMealsFromProfile = false;
  let unsubscribeMenus: (() => void) | undefined;
  let unsubscribeProfile: (() => void) | undefined;
  let unsubscribeDishes: (() => void) | undefined;
  const saveFeedback = createSaveFeedback(status, {
    pending: labels.savePending,
    saving: labels.saveSaving,
    saved: labels.saveSaved,
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

  function showAiStatus(message = '', isError = false) {
    if (!aiStatus) return;
    aiStatus.textContent = message;
    aiStatus.dataset.variant = isError ? 'error' : 'info';
  }

  function setVisible(isReady: boolean) {
    if (loading) loading.hidden = isReady;
    if (content) content.hidden = !isReady;
  }

  function setBusy(isBusy: boolean) {
    if (!submitButton) return;
    submitButton.disabled = isBusy;
    submitButton.setAttribute('aria-busy', String(isBusy));
  }

  function formatError(error: unknown) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      return labels.permissionsError;
    }

    return error instanceof Error ? error.message : String(error);
  }

  function getDefaultRange() {
    return {
      start: getDateOffset(new Date(), 1),
      end: getDateOffset(new Date(), 7),
    };
  }

  function applyDefaultRange() {
    const range = getDefaultRange();
    if (startInput && !startInput.value) startInput.value = range.start;
    if (endInput && !endInput.value) endInput.value = range.end;
  }

  function applyPresetRange(totalDays: number) {
    if (!startInput || !endInput) return;
    startInput.value = getDateOffset(new Date(), 1);
    endInput.value = getDateOffset(new Date(), totalDays);
    renderCurrentState();
  }

  function syncPresetButtons() {
    if (!startInput?.value || !endInput?.value) {
      root.querySelectorAll<HTMLButtonElement>('[data-plan-preset]').forEach((button) => {
        button.setAttribute('aria-pressed', 'false');
      });
      return;
    }

    const matchingDays = getDatesInRange(startInput.value, endInput.value).length;
    root.querySelectorAll<HTMLButtonElement>('[data-plan-preset]').forEach((button) => {
      const isSelected = Number(button.dataset.planPreset ?? 0) === matchingDays;
      button.setAttribute('aria-pressed', String(isSelected));
    });
  }

  function applyProfileMeals(enabledMeals: MealSlot[]) {
    if (syncedMealsFromProfile) return;
    root.querySelectorAll<HTMLInputElement>('[data-plan-meal]').forEach((input) => {
      input.checked = enabledMeals.includes(input.value as MealSlot);
    });
    syncedMealsFromProfile = true;
  }

  function getSelectedMeals() {
    const selected = [...root.querySelectorAll<HTMLInputElement>('[data-plan-meal]')]
      .filter((input) => input.checked)
      .map((input) => input.value as MealSlot);

    return selected.length ? selected : (currentProfile?.enabledMeals?.length ? currentProfile.enabledMeals : ['lunch']);
  }

  function getSelectedMode(): PlanningRecommendationMode {
    const selected = root.querySelector<HTMLInputElement>('[data-plan-mode]:checked')?.value;
    return selected === 'own' || selected === 'new' || selected === 'mix' ? selected : 'mix';
  }

  function getSelectedCount() {
    return Math.max(1, Math.min(5, Number(countInput?.value ?? 3)));
  }

  function setSelectedCount(value: number) {
    const normalized = Math.max(1, Math.min(5, value));
    if (countInput) {
      countInput.value = String(normalized);
    }

    root.querySelectorAll<HTMLButtonElement>('[data-plan-count-option]').forEach((button) => {
      const isSelected = Number(button.dataset.planCountOption) === normalized;
      button.setAttribute('aria-pressed', String(isSelected));
    });

    renderCurrentState();
  }

  function readRequestFromForm(): PlanningRequest | null {
    const start = startInput?.value ?? '';
    const end = endInput?.value ?? '';
    const dates = getDatesInRange(start, end);
    if (dates.length === 0) {
      return null;
    }

    return {
      start: dates[0],
      end: dates.at(-1) ?? dates[0],
      dates,
      meals: getSelectedMeals(),
      mode: getSelectedMode(),
      recommendationCount: getSelectedCount(),
    };
  }

  function getMenuForDay(dayKey: string) {
    const weekStart = getWeekStartForDate(dayKey);
    return currentMenus.find((menu) => menu.weekStart === weekStart) ?? null;
  }

  function getMenuIdForDay(dayKey: string) {
    return currentMenuIdsByWeekStart[getWeekStartForDate(dayKey)] ?? '';
  }

  function getDaysForRequest(request: PlanningRequest) {
    return Object.fromEntries(request.dates.map((dayKey) => [dayKey, getMenuForDay(dayKey)?.days?.[dayKey]]));
  }

  function getPendingMealsForRequest(request: PlanningRequest) {
    return getPendingMealSlots(getDaysForRequest(request), request.dates, request.meals);
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

  function mealLabel(meal: MealSlot) {
    return labels[meal] ?? meal;
  }

  function modeLabel(mode: PlanningRecommendationMode) {
    if (mode === 'own') return labels.modeOwn;
    if (mode === 'new') return labels.modeNew;
    return labels.modeMix;
  }

  function getDishOriginLabel(dish: PlanningRecommendation['dishes'][number]) {
    if (dish.isNew || dish.scope === 'new') return labels.originNew;
    if (dish.isGlobal || dish.scope === 'global') return labels.originGlobal;
    if (dish.scope === 'group') return labels.originGroup;
    return labels.originUser;
  }

  function formatPendingMealTitle(dayKey: string, meal: MealSlot) {
    return `${formatWeekday(dayKey)} · ${formatDate(dayKey)} · ${mealLabel(meal)}`;
  }

  function renderPendingMeals() {
    if (!pendingContainer) return;

    if (!currentRequest) {
      pendingContainer.innerHTML = `<p class="planning-ai-empty">${escapeHtml(labels.resultsNotGenerated)}</p>`;
      return;
    }

    const pendingMeals = getPendingMealsForRequest(currentRequest);
    if (pendingMeals.length === 0) {
      pendingContainer.innerHTML = `<p class="planning-ai-empty">${escapeHtml(labels.pendingEmpty)}</p>`;
      return;
    }

    pendingContainer.innerHTML = pendingMeals
      .map(
        (slot) => `
          <article class="planning-ai-pending-card">
            <header>
              <h3>${escapeHtml(formatPendingMealTitle(slot.dayKey, slot.meal))}</h3>
              <span class="planning-ai-slot-badge">${escapeHtml(mealLabel(slot.meal))}</span>
            </header>
          </article>
        `
      )
      .join('');
  }

  function renderResults() {
    if (!resultsContainer) return;

    if (!currentRequest) {
      resultsContainer.innerHTML = `<p class="planning-ai-empty">${escapeHtml(labels.resultsNotGenerated)}</p>`;
      return;
    }

    const pendingKeys = new Set(getPendingMealsForRequest(currentRequest).map((slot) => `${slot.dayKey}::${slot.meal}`));
    recommendations = recommendations.filter((recommendation) =>
      pendingKeys.has(`${recommendation.dayKey}::${recommendation.meal}`)
    );

    if (recommendations.length === 0) {
      resultsContainer.innerHTML = `<p class="planning-ai-empty">${escapeHtml(
        hasGeneratedResults ? labels.resultsEmpty : labels.resultsNotGenerated
      )}</p>`;
      return;
    }

    resultsContainer.innerHTML = recommendations
      .map(
        (recommendation, index) => `
          <article class="planning-ai-result-card">
            <header>
              <div>
                <h3>${escapeHtml(formatPendingMealTitle(recommendation.dayKey, recommendation.meal))}</h3>
              </div>
              <span class="planning-ai-slot-badge">${escapeHtml(mealLabel(recommendation.meal))}</span>
            </header>

            <div class="planning-ai-dish-list">
              ${recommendation.dishes
                .map(
                  (dish, dishIndex) => `
                    <article class="planning-ai-dish-item">
                      <header>
                        <strong>${escapeHtml(dish.name)}</strong>
                        <div class="planning-ai-dish-meta">
                          ${dish.isNew ? `<span class="planning-ai-dish-badge">${escapeHtml(labels.newBadge)}</span>` : ''}
                          <span class="planning-ai-dish-origin">${escapeHtml(getDishOriginLabel(dish))}</span>
                        </div>
                      </header>
                      <button class="button button--ghost button--small" type="button" data-plan-add="${index}" data-plan-dish="${dishIndex}">
                        ${escapeHtml(labels.addDish)}
                      </button>
                    </article>
                  `
                )
                .join('')}
            </div>

            ${
              recommendation.reason
                ? `<p><strong>${escapeHtml(labels.reasonLabel)}:</strong> ${escapeHtml(recommendation.reason)}</p>`
                : ''
            }

            <footer>
              <button class="button button--secondary button--small" type="button" data-plan-apply="${index}">
                ${escapeHtml(labels.applySelection)}
              </button>
            </footer>
          </article>
        `
      )
      .join('');
  }

  function renderRequestSummary() {
    if (!summaryContainer) return;

    const request = readRequestFromForm();
    if (!request) {
      summaryContainer.innerHTML = '';
      return;
    }

    const dayCount = request.dates.length;
    const mealCount = request.meals.length;
    const dayLabel = dayCount === 1 ? labels.daysSingular : labels.daysPlural;
    const mealLabelText = mealCount === 1 ? labels.mealsSingular : labels.mealsPlural;

    summaryContainer.innerHTML = `
      <div class="planning-ai-request-pill"><span>${escapeHtml(labels.summaryRange)}</span>${escapeHtml(`${dayCount} ${dayLabel}`)}</div>
      <div class="planning-ai-request-pill"><span>${escapeHtml(labels.summaryMeals)}</span>${escapeHtml(`${mealCount} ${mealLabelText}`)}</div>
      <div class="planning-ai-request-pill"><span>${escapeHtml(labels.summaryMode)}</span>${escapeHtml(modeLabel(request.mode))}</div>
      <div class="planning-ai-request-pill"><span>${escapeHtml(labels.summaryIdeas)}</span>${escapeHtml(`${request.recommendationCount} ${labels.ideasSuffix}`)}</div>
    `;
  }

  function renderCurrentState() {
    syncPresetButtons();
    renderRequestSummary();
    renderPendingMeals();
    renderResults();
  }

  function isAiReady() {
    return hasFirebaseConfig() && isMenuSuggestionsAvailable(getAiFeatureFlags());
  }

  async function syncRangeMenus(services: Awaited<ReturnType<typeof getFirebaseServices>>, request: PlanningRequest) {
    const menuIdsByWeekStart = await getOrCreateWeekMenus(
      services,
      currentUser?.uid ?? '',
      getWeekStartsForDates(request.dates),
      locale
    );

    currentMenuIdsByWeekStart = menuIdsByWeekStart;
    unsubscribeMenus?.();

    return new Promise<void>((resolve, reject) => {
      let firstSnapshot = true;
      unsubscribeMenus = watchWeekMenusByIds(
        services,
        Object.values(menuIdsByWeekStart),
        (menus) => {
          currentMenus = menus;
          renderCurrentState();
          if (firstSnapshot) {
            firstSnapshot = false;
            resolve();
          }
        },
        (error) => {
          if (firstSnapshot) {
            firstSnapshot = false;
            reject(error);
            return;
          }
          showStatus(formatError(error), true);
        }
      );
    });
  }

  function updateLocalDay(dayKey: string, nextState: WeekMenu['days'][string]) {
    currentMenus = currentMenus.map((menu) =>
      menu.weekStart === getWeekStartForDate(dayKey)
        ? {
            ...menu,
            days: {
              ...menu.days,
              [dayKey]: nextState,
            },
          }
        : menu
    );
  }

  async function saveDay(dayKey: string, nextDay: DailyMenu, card?: HTMLElement) {
    if (getNetworkStatus() !== 'online') {
      throw new Error(labels.offlineReadOnly);
    }
    if (!currentUser) return;

    const menuId = getMenuIdForDay(dayKey);
    if (!menuId) return;

    const previousDay = normalizeDay(getMenuForDay(dayKey)?.days?.[dayKey]);
    const nextState = serializeDay(nextDay);
    if (serializeDay(previousDay) === nextState) {
      saveFeedback.saved();
      return;
    }

    saveFeedback.saving();
    const services = await getFirebaseServices();
    const changed = await updateMenuDay(services, menuId, currentUser.uid, dayKey, nextDay, currentProfile?.groupId);
    card?.setAttribute('data-day-state', nextState);
    updateLocalDay(dayKey, nextDay);
    renderCurrentState();
    saveFeedback.saved(changed ? labels.saveSaved : labels.saveSaved);
  }

  const dayEditModal = createDayEditModalController({
    root,
    labels,
    getDay: (dayKey) => normalizeDay(getMenuForDay(dayKey)?.days?.[dayKey]),
    getDishes: () => dishes,
    getEnabledMeals: () => getSelectedMeals(),
    getSavedDayState: (dayKey) => serializeDay(getMenuForDay(dayKey)?.days?.[dayKey] ?? normalizeDay(undefined)),
    getDayNumber,
    getWeekday: formatWeekday,
    getDateLabel: formatDate,
    canWrite: () => getNetworkStatus() === 'online',
    getWriteErrorMessage: () => labels.offlineReadOnly,
    onSaveDay: (dayKey, nextDay, card) => saveDay(dayKey, nextDay, card),
    onClearDay: async (dayKey) => {
      if (getNetworkStatus() !== 'online' || !currentUser) {
        saveFeedback.error(labels.offlineReadOnly);
        return false;
      }

      const menuId = getMenuIdForDay(dayKey);
      if (!menuId) return false;
      const services = await getFirebaseServices();
      await clearMenuDay(services, menuId, currentUser.uid, dayKey);
      renderCurrentState();
      return true;
    },
  });

  function applyRecommendation(index: number) {
    const recommendation = recommendations[index];
    if (!recommendation) return;

    dayEditModal.applyRecommendedDishes(
      recommendation.dayKey,
      recommendation.meal,
      recommendation.dishes.map((dish) => dish.name)
    );
    showAiStatus(labels.applied);
  }

  function addRecommendedDish(index: number, dishIndex: number) {
    const recommendation = recommendations[index];
    const dish = recommendation?.dishes[dishIndex];
    if (!recommendation || !dish) return;

    dayEditModal.appendRecommendedDish(recommendation.dayKey, recommendation.meal, dish.name);
    showAiStatus(labels.added);
  }

  applyDefaultRange();
  setSelectedCount(getSelectedCount());

  if (!hasFirebaseConfig()) {
    setVisible(false);
    showStatus(labels.configMissing, true);
  } else {
    getFirebaseServices()
      .then((services) => {
        form?.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (!currentUser) return;

          const request = readRequestFromForm();
          if (!request) {
            showAiStatus(labels.invalidRange, true);
            return;
          }

          if (request.mode === 'own' && !hasPlanningCatalogForMode(dishes, 'own')) {
            currentRequest = request;
            recommendations = [];
            hasGeneratedResults = false;
            renderCurrentState();
            showAiStatus(labels.noOwnDishes, true);
            return;
          }

          currentRequest = request;
          recommendations = [];
          hasGeneratedResults = false;
          showAiStatus(labels.loadingSlots);
          setBusy(true);

          try {
            await syncRangeMenus(services, request);
            const pendingMeals = getPendingMealsForRequest(request);

            if (pendingMeals.length === 0) {
              showAiStatus('');
              renderCurrentState();
              return;
            }

            if (!isAiReady()) {
              showAiStatus(labels.aiMissingConfig, true);
              renderCurrentState();
              return;
            }

            showAiStatus(labels.loadingPlan);

            const response = await generateGeminiJson({
              userId: currentUser.uid,
              prompt: buildPlanningAssistantPrompt({
                locale,
                mode: request.mode,
                recommendationCount: request.recommendationCount,
                pendingMeals,
                days: getDaysForRequest(request),
                dishes,
                mealLabels: {
                  breakfast: labels.breakfast,
                  lunch: labels.lunch,
                  dinner: labels.dinner,
                },
              }),
              validator: isPlanningRecommendationResponse,
            });

            recommendations = assignPlanningRecommendations({
              mode: request.mode,
              pendingMeals,
              dishes,
              recommendationCount: request.recommendationCount,
              response,
            });
            hasGeneratedResults = true;
            renderCurrentState();
            showAiStatus(recommendations.length ? labels.generated : labels.resultsEmpty);
          } catch (error) {
            const state = getAiUiStateFromError(error);
            const key = getAiUiMessageKey(state);
            showAiStatus((key && labels[key]) || labels.aiError, true);
          } finally {
            setBusy(false);
          }
        });

        root.querySelectorAll<HTMLButtonElement>('[data-plan-preset]').forEach((button) => {
          button.addEventListener('click', () => {
            applyPresetRange(Number(button.dataset.planPreset ?? 7));
          });
        });

        root.querySelectorAll<HTMLButtonElement>('[data-plan-count-option]').forEach((button) => {
          button.addEventListener('click', () => {
            setSelectedCount(Number(button.dataset.planCountOption ?? 3));
          });
        });

        startInput?.addEventListener('input', () => renderCurrentState());
        endInput?.addEventListener('input', () => renderCurrentState());
        root.querySelectorAll<HTMLInputElement>('[data-plan-meal], [data-plan-mode]').forEach((input) => {
          input.addEventListener('change', () => renderCurrentState());
        });

        resultsContainer?.addEventListener('click', (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;

          const addButton = target.closest<HTMLButtonElement>('[data-plan-add]');
          if (addButton) {
            addRecommendedDish(Number(addButton.dataset.planAdd), Number(addButton.dataset.planDish));
            return;
          }

          const applyButton = target.closest<HTMLButtonElement>('[data-plan-apply]');
          if (!applyButton) return;
          applyRecommendation(Number(applyButton.dataset.planApply));
        });

        services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
          currentUser = user;
          unsubscribeMenus?.();
          unsubscribeProfile?.();
          unsubscribeDishes?.();

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
              applyProfileMeals(profile.enabledMeals);
              unsubscribeDishes?.();
              unsubscribeDishes = watchUserDishes(
                services,
                user.uid,
                (nextDishes) => {
                  dishes = nextDishes;
                  renderCurrentState();
                },
                (error) => showStatus(formatError(error), true),
                false,
                profile.groupId
              );
            },
            (error) => showStatus(formatError(error), true)
          );

          const initialRequest = readRequestFromForm();
          if (initialRequest) {
            currentRequest = initialRequest;
            await syncRangeMenus(services, initialRequest);
          }

          setVisible(true);
          renderCurrentState();
        });
      })
      .catch((error) => showStatus(formatError(error), true));
  }
}
