import {
  buildDishRecommenderPrompt,
  generateGeminiJson,
  getAiErrorCode,
  getAiFeatureFlags,
  isDishRecommendationResponse,
  isMenuSuggestionsAvailable,
  normalizeDishRecommendations,
  type DishRecommendation,
} from '../lib/ai';
import { createManualDish } from '../lib/dishes/repository';
import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { getUpcomingDates, getWeekStartForDate, getWeekStartsForDates } from '../lib/menu/dates';
import { getGroupFoodIntolerancesForPrompt } from '../lib/menu/group-food-intolerances';
import { normalizeDay } from '../lib/menu/normalizers';
import { ensureUserProfile, getOrCreateWeekMenus, updateMenuDay, watchUserMenus, watchUserProfile, watchWeekMenusByIds } from '../lib/menu/repository';
import type { DailyMenu, FirebaseUser, MealSlot, UserProfile, WeekMenu } from '../lib/menu/types';
import { createSaveFeedback } from '../lib/ui/save-feedback';

const root = document.querySelector<HTMLElement>('[data-dish-recommender-app]');

type RecommendationRequest = {
  meal: MealSlot;
  people: number;
  difficulty: 'easy' | 'medium' | 'advanced';
  time: 'short' | 'enough' | 'long' | 'previous-day';
  ingredientMode: 'have' | 'shopping';
  ingredients: string;
  intolerances: string;
  preferences: string[];
  extraPreferences: string;
};

type AssignSlot = { dayKey: string; meal: MealSlot; label: string };
type RenderResultsOptions = { preserveScroll?: boolean };

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const status = root.querySelector<HTMLElement>('[data-status]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const content = root.querySelector<HTMLElement>('[data-content]');
  const form = root.querySelector<HTMLFormElement>('[data-dish-recommender-form]');
  const aiStatus = root.querySelector<HTMLElement>('[data-ai-status]');
  const resultsContainer = root.querySelector<HTMLElement>('[data-dish-results]');
  const summaryContainer = root.querySelector<HTMLElement>('[data-dish-summary]');
  const intolerancesInput = root.querySelector<HTMLTextAreaElement>('[data-dish-intolerances]');
  const submitButton = root.querySelector<HTMLButtonElement>('[data-dish-submit]');
  const panels = [...root.querySelectorAll<HTMLElement>('[data-dish-step]')];
  const indicators = [...root.querySelectorAll<HTMLButtonElement>('[data-dish-step-indicator]')];
  const backButton = root.querySelector<HTMLButtonElement>('[data-dish-back]');
  const nextButton = root.querySelector<HTMLButtonElement>('[data-dish-next]');
  const scrollTarget = root.querySelector<HTMLElement>('[data-dish-recommender-scroll-target]') ?? root;

  let currentStep = 0;
  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentMenus: WeekMenu[] = [];
  let currentMenuIdsByWeekStart: Record<string, string> = {};
  let recentMenus: WeekMenu[] = [];
  let recommendations: DishRecommendation[] = [];
  let syncedIntolerances = false;
  let isGenerating = false;
  let isGeneratingMore = false;
  let showEmptyResults = true;
  let unsubscribeProfile: (() => void) | undefined;
  let unsubscribeMenus: (() => void) | undefined;
  let unsubscribeRecentMenus: (() => void) | undefined;

  const saveFeedback = createSaveFeedback(status, {
    pending: labels.savePending,
    saving: labels.saveSaving,
    saved: labels.saveSaved,
  });

  function escapeHtml(value = '') {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
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

  function showAiStatus(message = '', isError = false) {
    if (!aiStatus) return;
    aiStatus.textContent = message;
    aiStatus.dataset.variant = isError ? 'error' : 'info';
  }

  function showStatus(message: string, isError = false) {
    if (isError) saveFeedback.error(message);
    else saveFeedback.info(message);
  }

  function formatError(error: unknown) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) return labels.permissionsError;
    return error instanceof Error ? error.message : String(error);
  }

  function formatAiError(error: unknown) {
    const code = getAiErrorCode(error);
    if (code === 'invalid-response') return labels.invalidResponse;
    if (code === 'quota-exhausted') return labels.quotaError;
    if (code === 'missing-config' || code === 'disabled') return labels.configError;
    if (code === 'app-check-unavailable') return labels.appCheckError;
    if (code === 'timeout') return labels.timeoutError;
    return labels.requestError || labels.aiError;
  }

  function selectedValue<T extends string>(selector: string, fallback: T): T {
    return (root.querySelector<HTMLInputElement>(`${selector}:checked`)?.value as T | undefined) ?? fallback;
  }

  function readRequest(): RecommendationRequest {
    return {
      meal: selectedValue<MealSlot>('[data-dish-meal]', 'lunch'),
      people: Math.max(1, Math.min(20, Number(root.querySelector<HTMLInputElement>('[data-dish-people]')?.value || 1))),
      difficulty: (root.querySelector<HTMLSelectElement>('[data-dish-difficulty]')?.value as RecommendationRequest['difficulty']) || 'easy',
      time: selectedValue<RecommendationRequest['time']>('[data-dish-time]', 'enough'),
      ingredientMode: selectedValue<RecommendationRequest['ingredientMode']>('[data-dish-ingredient-mode]', 'have'),
      ingredients: root.querySelector<HTMLTextAreaElement>('[data-dish-ingredients]')?.value.trim() ?? '',
      intolerances: intolerancesInput?.value.trim() ?? '',
      preferences: [...root.querySelectorAll<HTMLInputElement>('[data-dish-preference]')].filter((input) => input.checked).map((input) => input.value),
      extraPreferences: root.querySelector<HTMLTextAreaElement>('[data-dish-extra-preferences]')?.value.trim() ?? '',
    };
  }

  function mealLabel(meal: MealSlot) {
    return labels[meal] ?? meal;
  }

  function optionLabel(prefix: string, value: string) {
    const key = `${prefix}${value.charAt(0).toUpperCase()}${value.slice(1).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}`;
    return labels[key] ?? value;
  }

  function renderSummary() {
    if (!summaryContainer) return;
    const request = readRequest();
    const preferences = request.preferences.map((item) => optionLabel('preference', item)).join(', ') || labels.preferenceBalanced;
    summaryContainer.innerHTML = [
      `${labels.mealQuestion}: ${mealLabel(request.meal)}`,
      `${labels.peopleLabel}: ${request.people}`,
      `${labels.difficultyLabel}: ${optionLabel('difficulty', request.difficulty)}`,
      `${labels.timeLabel}: ${optionLabel('time', request.time)}`,
      `${labels.ingredientsQuestion}: ${request.ingredientMode === 'shopping' ? labels.ingredientsShop : labels.ingredientsHave}`,
      `${labels.preferencesQuestion}: ${preferences}`,
    ].map((item) => `<span class="dish-recommender-pill">${escapeHtml(item)}</span>`).join('');
  }

  function formatDate(isoDate: string) {
    return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${isoDate}T00:00:00`));
  }

  function getMenuForDay(dayKey: string) {
    return currentMenus.find((menu) => menu.weekStart === getWeekStartForDate(dayKey)) ?? null;
  }

  function getMenuIdForDay(dayKey: string) {
    return currentMenuIdsByWeekStart[getWeekStartForDate(dayKey)] ?? '';
  }

  function getAssignSlots(meal: MealSlot): AssignSlot[] {
    return getUpcomingDates(new Date(), 1, 21).flatMap((dayKey) => {
      const dayState = normalizeDay(getMenuForDay(dayKey)?.days?.[dayKey]);
      if (dayState.skipped || dayState.meals[meal].skipped || dayState.meals[meal].items.length > 0) return [];
      return [{ dayKey, meal, label: `${formatDate(dayKey)} · ${mealLabel(meal)}` }];
    });
  }

  function getRecentMealsForPrompt(meal: MealSlot) {
    const today = new Date().toISOString().slice(0, 10);
    return recentMenus
      .flatMap((menu) =>
        Object.entries(menu.days).flatMap(([dayKey, rawDay]) => {
          if (dayKey > today) return [];
          const day = normalizeDay(rawDay);
          if (day.skipped || day.meals[meal].skipped) return [];
          return day.meals[meal].items.map((item) => `${dayKey} · ${mealLabel(meal)} · ${item}`);
        })
      )
      .filter(Boolean)
      .sort((left, right) => right.localeCompare(left))
      .slice(0, 28);
  }

  function getAlreadyShownDishesForPrompt() {
    return recommendations.map((dish) => `${dish.title} · ${dish.description}`);
  }

  function preserveScrollAfterRender(scrollY: number | null) {
    if (scrollY === null) return;
    window.requestAnimationFrame(() => window.scrollTo(window.scrollX, scrollY));
  }

  function renderLoading(isMore = false) {
    if (!resultsContainer) return;
    resultsContainer.innerHTML = `
      <div class="dish-recommender-loading" role="status" aria-live="polite">
        <span class="dish-recommender-loading__spinner" aria-hidden="true"></span>
        <div>
          <strong>${escapeHtml(isMore ? labels.loadingMoreTitle : labels.loadingTitle)}</strong>
          <p>${escapeHtml(isMore ? labels.loadingMoreDescription : labels.loadingDescription)}</p>
        </div>
      </div>
    `;
  }

  function renderMoreControl() {
    if (!recommendations.length) return '';
    if (isGeneratingMore) {
      return `
        <div class="dish-recommender-more dish-recommender-more--loading" role="status" aria-live="polite">
          <span class="dish-recommender-loading__spinner" aria-hidden="true"></span>
          <span>${escapeHtml(labels.generatingMore)}</span>
        </div>
      `;
    }
    return `
      <div class="dish-recommender-more">
        <button class="button button--secondary" type="button" data-dish-generate-more>${escapeHtml(labels.generateMore)}</button>
      </div>
    `;
  }

  function renderResults(options: RenderResultsOptions = {}) {
    if (!resultsContainer) return;
    const scrollY = options.preserveScroll ? window.scrollY : null;
    if (isGenerating && !recommendations.length) {
      renderLoading();
      preserveScrollAfterRender(scrollY);
      return;
    }
    if (!recommendations.length) {
      resultsContainer.innerHTML = showEmptyResults ? `<p class="dish-recommender-empty">${escapeHtml(labels.resultsEmpty)}</p>` : '';
      preserveScrollAfterRender(scrollY);
      return;
    }

    const request = readRequest();
    const slots = getAssignSlots(request.meal);
    const slotOptions = slots.length
      ? slots.map((slot) => `<option value="${escapeHtml(`${slot.dayKey}::${slot.meal}`)}">${escapeHtml(slot.label)}</option>`).join('')
      : `<option value="">${escapeHtml(labels.assignEmpty)}</option>`;
    const cards = recommendations.map((dish, index) => `
      <article class="dish-recommender-result">
        <div class="dish-recommender-result__body">
          <h3>${escapeHtml(dish.title)}</h3>
          <p>${escapeHtml(dish.description)}</p>
        </div>
        <div class="dish-recommender-result__footer">
          <div class="dish-recommender-result__secondary-actions">
            <button class="button button--ghost button--small" type="button" data-dish-save="${index}">${escapeHtml(labels.saveDish)}</button>
            <button class="button button--ghost button--small" type="button" data-dish-share="${index}">${escapeHtml(labels.shareDish)}</button>
          </div>
          <label class="dish-recommender-assign">
            <span>${escapeHtml(labels.assignLabel)}</span>
            <span class="dish-recommender-assign__controls">
              <select data-dish-assign-slot="${index}" ${slots.length ? '' : 'disabled'}>${slotOptions}</select>
              <button class="button button--ghost button--small" type="button" data-dish-assign="${index}" ${slots.length ? '' : 'disabled'}>${escapeHtml(labels.assignDish)}</button>
            </span>
          </label>
        </div>
      </article>
    `).join('');
    resultsContainer.innerHTML = `${cards}${renderMoreControl()}`;
    preserveScrollAfterRender(scrollY);
  }

  function go(nextStep: number, focus = false) {
    currentStep = Math.max(0, Math.min(panels.length - 1, nextStep));
    panels.forEach((panel, index) => { panel.hidden = index !== currentStep; });
    indicators.forEach((indicator, index) => {
      if (index === currentStep) indicator.setAttribute('aria-current', 'step');
      else indicator.removeAttribute('aria-current');
    });
    if (backButton) backButton.disabled = currentStep === 0;
    if (nextButton) nextButton.hidden = currentStep === panels.length - 1;
    if (submitButton) submitButton.hidden = currentStep !== panels.length - 1;
    if (currentStep === panels.length - 1) renderSummary();
    if (focus) {
      const title = panels[currentStep]?.querySelector<HTMLElement>('h2');
      title?.setAttribute('tabindex', '-1');
      title?.focus({ preventScroll: true });
      if (window.matchMedia('(max-width: 719px)').matches) {
        const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
        scrollTarget.scrollIntoView({ behavior, block: 'start' });
      }
    }
  }

  async function syncIntolerances(services: Awaited<ReturnType<typeof getFirebaseServices>>) {
    if (!intolerancesInput || syncedIntolerances) return;
    intolerancesInput.value = await getGroupFoodIntolerancesForPrompt(services, currentProfile);
    syncedIntolerances = true;
  }

  async function syncUpcomingMenus(services: Awaited<ReturnType<typeof getFirebaseServices>>) {
    if (!currentUser) return;
    const dates = getUpcomingDates(new Date(), 1, 21);
    const idsByWeek = await getOrCreateWeekMenus(services, currentUser.uid, getWeekStartsForDates(dates), locale);
    currentMenuIdsByWeekStart = idsByWeek;
    unsubscribeMenus?.();
    unsubscribeMenus = watchWeekMenusByIds(services, Object.values(idsByWeek), (menus) => {
      currentMenus = menus;
      renderResults({ preserveScroll: isGeneratingMore });
    }, (error) => showStatus(formatError(error), true));
  }

  function isAiReady() {
    return hasFirebaseConfig() && isMenuSuggestionsAvailable(getAiFeatureFlags());
  }

  async function generateRecommendations(append = false) {
    if (!currentUser) return;
    const request = readRequest();

    if (!isAiReady()) {
      showEmptyResults = false;
      renderResults({ preserveScroll: append });
      showAiStatus(labels.configError || labels.aiMissingConfig, true);
      return;
    }

    if (append) {
      isGeneratingMore = true;
      showAiStatus(labels.generatingMore);
    } else {
      setBusy(true);
      isGenerating = true;
      recommendations = [];
      showAiStatus(labels.generating);
    }

    showEmptyResults = false;
    renderResults({ preserveScroll: append });

    try {
      const previousRecommendations = append ? recommendations : [];
      const response = await generateGeminiJson({
        userId: currentUser.uid,
        prompt: buildDishRecommenderPrompt({
          locale,
          ...request,
          recentMeals: getRecentMealsForPrompt(request.meal),
          alreadyShownDishes: previousRecommendations.length ? getAlreadyShownDishesForPrompt() : [],
        }),
        validator: isDishRecommendationResponse,
      });
      const newRecommendations = normalizeDishRecommendations(response, previousRecommendations);
      recommendations = append ? [...recommendations, ...newRecommendations] : newRecommendations;
      showEmptyResults = recommendations.length === 0;
      if (append) {
        showAiStatus(newRecommendations.length ? labels.generatedMore : labels.noNewDishes, newRecommendations.length === 0);
      } else {
        showAiStatus(recommendations.length ? labels.generated : labels.invalidResponse, recommendations.length === 0);
      }
    } catch (error) {
      showEmptyResults = false;
      showAiStatus(formatAiError(error), true);
    } finally {
      isGenerating = false;
      isGeneratingMore = false;
      renderResults({ preserveScroll: append });
      setBusy(false);
    }
  }

  async function saveDish(index: number) {
    const dish = recommendations[index];
    if (!dish || !currentUser) return;
    try {
      saveFeedback.saving();
      const services = await getFirebaseServices();
      await createManualDish(services, currentUser.uid, dish.title, currentProfile?.groupId);
      saveFeedback.saved(labels.savedDish);
    } catch (error) {
      showStatus(formatError(error), true);
    }
  }

  async function assignDish(index: number) {
    const dish = recommendations[index];
    if (!dish || !currentUser) return;
    const value = resultsContainer?.querySelector<HTMLSelectElement>(`[data-dish-assign-slot="${index}"]`)?.value ?? '';
    const [dayKey, meal] = value.split('::') as [string, MealSlot | undefined];
    if (!dayKey || !meal) return;

    try {
      saveFeedback.saving();
      const services = await getFirebaseServices();
      const menuId = getMenuIdForDay(dayKey);
      if (!menuId) return;
      const day = normalizeDay(getMenuForDay(dayKey)?.days?.[dayKey]);
      const nextDay: DailyMenu = {
        ...day,
        meals: {
          ...day.meals,
          [meal]: { ...day.meals[meal], items: [dish.title], skipped: false, reason: '', note: '' },
        },
      };
      await updateMenuDay(services, menuId, currentUser.uid, dayKey, nextDay, currentProfile?.groupId);
      saveFeedback.saved(labels.assignedDish);
    } catch (error) {
      showStatus(formatError(error), true);
    }
  }

  async function shareDish(index: number) {
    const dish = recommendations[index];
    if (!dish) return;
    const text = `${dish.title}\n${dish.description}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: dish.title, text });
        showStatus(labels.sharedDish);
      } else {
        await navigator.clipboard?.writeText(text);
        showStatus(labels.copiedDish);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      showStatus(formatError(error), true);
    }
  }

  backButton?.addEventListener('click', () => go(currentStep - 1, true));
  nextButton?.addEventListener('click', async () => {
    if (currentStep === 1) {
      const services = await getFirebaseServices();
      await syncIntolerances(services);
    }
    go(currentStep + 1, true);
  });
  indicators.forEach((indicator, index) => indicator.addEventListener('click', () => go(index, true)));
  form?.addEventListener('input', renderSummary);
  form?.addEventListener('change', renderSummary);

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await generateRecommendations(false);
  });

  resultsContainer?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const moreButton = target.closest<HTMLButtonElement>('[data-dish-generate-more]');
    if (moreButton) {
      void generateRecommendations(true);
      return;
    }
    const saveButton = target.closest<HTMLButtonElement>('[data-dish-save]');
    if (saveButton) {
      void saveDish(Number(saveButton.dataset.dishSave));
      return;
    }
    const assignButton = target.closest<HTMLButtonElement>('[data-dish-assign]');
    if (assignButton) {
      void assignDish(Number(assignButton.dataset.dishAssign));
      return;
    }
    const shareButton = target.closest<HTMLButtonElement>('[data-dish-share]');
    if (shareButton) void shareDish(Number(shareButton.dataset.dishShare));
  });

  go(0);

  if (!hasFirebaseConfig()) {
    setVisible(false);
    showStatus(labels.configMissing, true);
  } else {
    getFirebaseServices().then((services) => {
      services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
        currentUser = user;
        unsubscribeProfile?.();
        unsubscribeMenus?.();
        unsubscribeRecentMenus?.();
        if (!user) {
          window.location.assign(labels.homePath || '/');
          return;
        }
        await ensureUserProfile(services, user, labels.guestSession);
        unsubscribeProfile = watchUserProfile(services, user, labels.guestSession, (profile) => {
          currentProfile = profile;
          syncedIntolerances = false;
        }, (error) => showStatus(formatError(error), true));
        unsubscribeRecentMenus = watchUserMenus(
          services,
          user.uid,
          (menus) => {
            recentMenus = menus;
          },
          (error) => showStatus(formatError(error), true),
          12
        );
        showAiStatus(labels.loadingSlots);
        await syncUpcomingMenus(services);
        showAiStatus('');
        setVisible(true);
      });
    }).catch((error) => showStatus(formatError(error), true));
  }
}
