import {
  assignPendingMealRecommendations,
  buildPendingMealPrompt,
  generateGeminiJson,
  getAiFeatureFlags,
  getAiUiMessageKey,
  getAiUiStateFromError,
  getPendingMealSlots,
  isMenuSuggestionsAvailable,
  isPendingMealRecommendationResponse,
} from '../lib/ai';
import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { watchUserDishes } from '../lib/dishes/repository';
import { createDayEditModalController } from '../lib/menu/day-edit-modal';
import { serializeDay } from '../lib/menu/day-state';
import { getUpcomingDates, getWeekStartForDate, getWeekStartsForDates } from '../lib/menu/dates';
import { normalizeDay } from '../lib/menu/normalizers';
import { attachDishSuggestions } from '../lib/menu/dish-suggestions';
import {
  clearMenuDay,
  ensureUserProfile,
  getOrCreateWeekMenus,
  updateMenuDay,
  watchUserProfile,
  watchWeekMenusByIds,
} from '../lib/menu/repository';
import type { Dish, FirebaseUser, MealSlot, UserProfile, WeekMenu } from '../lib/menu/types';
import { getNetworkStatus } from '../lib/pwa/network-status';
import { createDebouncedTaskMap } from '../lib/ui/debounced-task-map';
import { createSaveFeedback } from '../lib/ui/save-feedback';

const root = document.querySelector<HTMLElement>('[data-configurator-app]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const status = root.querySelector<HTMLElement>('[data-status]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const content = root.querySelector<HTMLElement>('[data-content]');
  const configDays = root.querySelector<HTMLElement>('[data-config-days]');
  const aiGenerateButton = root.querySelector<HTMLButtonElement>('[data-ai-generate]');
  const aiHelper = root.querySelector<HTMLElement>('[data-ai-helper]');
  const aiStatus = root.querySelector<HTMLElement>('[data-ai-status]');
  const aiResults = root.querySelector<HTMLElement>('[data-ai-results]');

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentMenu: WeekMenu | null = null;
  let currentMenus: WeekMenu[] = [];
  let currentMenuIdsByWeekStart: Record<string, string> = {};
  let dishes: Dish[] = [];
  let pendingAiRecommendations: Array<{ dayKey: string; meal: MealSlot; dishes: string[]; reason: string }> = [];
  let unsubscribeMenu: (() => void) | undefined;
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

  function getConfigDates() {
    return getUpcomingDates(new Date(), 1, 7);
  }

  function getPendingMeals() {
    return getPendingMealSlots(currentMenu?.days ?? {}, getConfigDates(), getEnabledMeals());
  }

  function getRelevantWeekStarts() {
    return getWeekStartsForDates(getConfigDates());
  }

  function getMenuIdForDay(dayKey: string) {
    return currentMenuIdsByWeekStart[getWeekStartForDate(dayKey)] ?? '';
  }

  function getMenuForDay(dayKey: string) {
    const weekStart = getWeekStartForDate(dayKey);
    return currentMenus.find((menu) => menu.weekStart === weekStart) ?? null;
  }

  function buildDisplayMenu(menus: WeekMenu[]) {
    const days = Object.fromEntries(getConfigDates().map((dayKey) => [dayKey, normalizeDay(getMenuForDay(dayKey)?.days?.[dayKey])]));
    const firstWeekStart = getWeekStartForDate(getConfigDates()[0] ?? new Date().toISOString().slice(0, 10));
    const primaryMenu = menus.find((menu) => menu.weekStart === firstWeekStart);

    return {
      id: primaryMenu?.id ?? '',
      title: primaryMenu?.title ?? '',
      ownerId: primaryMenu?.ownerId ?? currentUser?.uid ?? '',
      members: primaryMenu?.members ?? (currentUser ? [currentUser.uid] : []),
      inviteCode: primaryMenu?.inviteCode ?? '',
      weekStart: firstWeekStart,
      days,
      updatedAt: primaryMenu?.updatedAt,
      updatedBy: primaryMenu?.updatedBy,
    } satisfies WeekMenu;
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

  function setVisible(isReady: boolean) {
    if (loading) loading.hidden = isReady;
    if (content) content.hidden = !isReady;
  }

  function mealLabel(meal: MealSlot) {
    return labels[meal] ?? meal;
  }

  function reasonLabel(reason = '') {
    if (reason === 'away') return labels.reasonAway;
    if (reason === 'eating-out') return labels.reasonEatingOut;
    if (reason === 'not-hungry') return labels.reasonNotHungry;
    if (reason === 'other') return labels.reasonOther;
    return '';
  }

  function renderMealSummary(day: WeekMenu['days'][string], meal: MealSlot) {
    if (day.skipped) {
      const reason = reasonLabel(day.reason);
      return reason ? `${labels.noDay}: ${reason}` : labels.noDay;
    }

    const mealState = day.meals[meal];
    if (mealState.skipped) {
      const reason = reasonLabel(mealState.reason);
      return reason ? `${labels.noMeal}: ${reason}` : labels.noMeal;
    }

    return mealState.items.length ? mealState.items.join(', ') : labels.todayEmpty;
  }

  function showAiStatus(message = '', isError = false) {
    if (!aiStatus) return;
    aiStatus.textContent = message;
    aiStatus.dataset.variant = isError ? 'error' : 'info';
  }

  function setAiBusy(isBusy: boolean) {
    if (!aiGenerateButton) return;
    aiGenerateButton.disabled = isBusy;
    aiGenerateButton.setAttribute('aria-busy', String(isBusy));
  }

  function isAiReady() {
    return hasFirebaseConfig() && isMenuSuggestionsAvailable(getAiFeatureFlags());
  }

  function renderAiResults() {
    if (!aiResults || !aiHelper) return;

    const pendingMeals = getPendingMeals();
    const pendingKeySet = new Set(pendingMeals.map((slot) => `${slot.dayKey}::${slot.meal}`));
    pendingAiRecommendations = pendingAiRecommendations.filter((item) =>
      pendingKeySet.has(`${item.dayKey}::${item.meal}`)
    );
    if (aiGenerateButton) {
      aiGenerateButton.disabled = !isAiReady() || pendingMeals.length === 0 || dishes.length === 0;
    }

    aiHelper.textContent = isAiReady() ? labels.aiPendingHint : labels.aiMissingConfig;
    if (!isAiReady()) {
      aiResults.innerHTML = `<p class="ai-meals-panel__empty">${escapeHtml(labels.aiMissingConfig)}</p>`;
      return;
    }

    if (pendingMeals.length === 0) {
      aiResults.innerHTML = `<p class="ai-meals-panel__empty">${escapeHtml(labels.aiPendingEmpty)}</p>`;
      return;
    }

    if (dishes.length === 0) {
      aiResults.innerHTML = `<p class="ai-meals-panel__empty">${escapeHtml(labels.aiPendingNoCatalog)}</p>`;
      return;
    }

    if (pendingAiRecommendations.length === 0) {
      aiResults.innerHTML = `<p class="ai-meals-panel__empty">${escapeHtml(labels.aiPendingNoResults)}</p>`;
      return;
    }

    aiResults.innerHTML = pendingAiRecommendations
      .map(
        (recommendation, index) => `
          <article class="ai-meals-panel__card">
            <header>
              <div>
                <h3>${escapeHtml(formatPendingMealTitle(recommendation.dayKey, recommendation.meal))}</h3>
              </div>
              <span class="ai-meals-panel__badge">${escapeHtml(labels.aiPendingMealLabel)}</span>
            </header>
            <ul class="ai-meals-panel__list">
              ${recommendation.dishes.map((dish) => `<li>${escapeHtml(dish)}</li>`).join('')}
            </ul>
            ${
              recommendation.reason
                ? `<p class="ai-meals-panel__reason"><strong>${escapeHtml(labels.aiPendingReasonLabel)}:</strong> ${escapeHtml(recommendation.reason)}</p>`
                : ''
            }
            <button class="button button--secondary button--small" type="button" data-ai-apply="${index}">
              ${escapeHtml(labels.aiPendingApply)}
            </button>
          </article>
        `
      )
      .join('');
  }

  function formatPendingMealTitle(dayKey: string, meal: MealSlot) {
    return `${formatWeekday(dayKey)} · ${formatDate(dayKey)} · ${labels[meal] ?? meal}`;
  }

  function renderConfig(menu: WeekMenu) {
    if (!configDays) return;

    configDays.innerHTML = getConfigDates()
      .map((isoDate) => {
        const day = normalizeDay(menu.days[isoDate]);
        const summaries = getEnabledMeals()
          .map(
            (meal) => `
              <div class="day-meal-row">
                <span>${escapeHtml(mealLabel(meal))}:</span>
                <strong>${escapeHtml(renderMealSummary(day, meal))}</strong>
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
                <button class="button button--ghost button--small" type="button" data-config-edit="${isoDate}">
                  ${escapeHtml(labels.editDay)}
                </button>
              </header>
              ${summaries}
            </div>
          </article>
        `;
      })
      .join('');
    renderAiResults();
  }

  function updateLocalDay(dayKey: string, nextState: WeekMenu['days'][string]) {
    currentMenu = currentMenu
      ? {
          ...currentMenu,
          days: {
            ...currentMenu.days,
            [dayKey]: nextState,
          },
        }
      : currentMenu;

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

  async function saveDay(card: HTMLElement) {
    if (getNetworkStatus() !== 'online') {
      saveFeedback.error(labels.offlineReadOnly);
      return;
    }
    if (!currentUser) return;
    const dayKey = card.dataset.day ?? '';
    const menuId = getMenuIdForDay(dayKey);
    if (!menuId) return;

    const nextDay = readDayDraft(card, getEnabledMeals());
    const nextState = serializeDay(nextDay);
    if (card.dataset.dayState === nextState) {
      saveFeedback.saved();
      return;
    }

    saveFeedback.saving();
    const services = await getFirebaseServices();
    const changed = await updateMenuDay(services, menuId, currentUser.uid, dayKey, nextDay, currentProfile?.groupId);
    card.dataset.dayState = nextState;
    updateLocalDay(dayKey, nextDay);
    saveFeedback.saved(changed ? labels.saveSaved : labels.saveSaved);
  }

  function scheduleDaySave(card: HTMLElement) {
    saveFeedback.pending();
    daySaveQueue.schedule(card.dataset.day ?? '', () => saveDay(card));
  }

  const dayEditModal = createDayEditModalController({
    root,
    labels,
    getDay: (dayKey) => normalizeDay(currentMenu?.days[dayKey]),
    getDishes: () => dishes,
    getEnabledMeals,
    getSavedDayState: (dayKey) => serializeDay(currentMenu?.days[dayKey] ?? normalizeDay(undefined)),
    getDayNumber,
    getWeekday: formatWeekday,
    getDateLabel: formatDate,
    onScheduleSave: scheduleDaySave,
    onFlushSave: (dayKey) => daySaveQueue.flush(dayKey),
    onClearDay: async (dayKey) => {
      if (getNetworkStatus() !== 'online' || !currentUser) {
        saveFeedback.error(labels.offlineReadOnly);
        return false;
      }

      const menuId = getMenuIdForDay(dayKey);
      if (!menuId) return false;
      const services = await getFirebaseServices();
      await clearMenuDay(services, menuId, currentUser.uid, dayKey);
      return true;
    },
  });

  function applyAiRecommendation(index: number) {
    const recommendation = pendingAiRecommendations[index];
    if (!recommendation) return;

    dayEditModal.applyRecommendedDishes(recommendation.dayKey, recommendation.meal, recommendation.dishes);
    pendingAiRecommendations = pendingAiRecommendations.filter((_, itemIndex) => itemIndex !== index);
    showAiStatus(labels.aiPendingApplied);
    renderAiResults();
  }

  if (!hasFirebaseConfig()) {
    setVisible(false);
    showStatus(labels.configMissing, true);
  } else {
    getFirebaseServices()
      .then((services) => {
        aiGenerateButton?.addEventListener('click', async () => {
          if (!currentUser) return;

          const pendingMeals = getPendingMeals();
          if (pendingMeals.length === 0) {
            showAiStatus(labels.aiPendingEmpty);
            renderAiResults();
            return;
          }

          if (!isAiReady()) {
            showAiStatus(labels.aiMissingConfig, true);
            renderAiResults();
            return;
          }

          if (dishes.length === 0) {
            showAiStatus(labels.aiPendingNoCatalog, true);
            renderAiResults();
            return;
          }

          setAiBusy(true);
          showAiStatus(labels.aiLoading);

          try {
            const response = await generateGeminiJson({
              userId: currentUser.uid,
              prompt: buildPendingMealPrompt({
                locale,
                pendingMeals,
                dishes,
                mealLabels: {
                  breakfast: labels.breakfast,
                  lunch: labels.lunch,
                  dinner: labels.dinner,
                },
              }),
              validator: isPendingMealRecommendationResponse,
            });
            pendingAiRecommendations = assignPendingMealRecommendations({
              pendingMeals,
              dishes,
              response,
            });

            if (pendingAiRecommendations.length === 0) {
              showAiStatus(labels.aiPendingNoResults);
            } else {
              showAiStatus('');
            }
            renderAiResults();
          } catch (error) {
            const state = getAiUiStateFromError(error);
            const key = getAiUiMessageKey(state);
            showAiStatus((key && labels[key]) || labels.aiError, true);
          } finally {
            setAiBusy(false);
          }
        });

        configDays?.addEventListener('click', (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          const button = target.closest<HTMLButtonElement>('[data-config-edit]');
          if (!button) return;
          dayEditModal.open(button.dataset.configEdit ?? '');
        });

        aiResults?.addEventListener('click', (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;

          const button = target.closest<HTMLButtonElement>('[data-ai-apply]');
          if (!button) return;

          applyAiRecommendation(Number(button.dataset.aiApply));
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

          await ensureUserProfile(services, user, labels.guestSession);
          currentMenuIdsByWeekStart = await getOrCreateWeekMenus(services, user.uid, getRelevantWeekStarts(), locale);
          currentMenus = [];

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
                  if (currentMenu) renderConfig(currentMenu);
                },
                (error) => showStatus(formatError(error), true),
                false,
                profile.groupId
              );
              if (currentMenu) renderConfig(currentMenu);
            },
            (error) => showStatus(formatError(error), true)
          );

          unsubscribeMenu = watchWeekMenusByIds(
            services,
            Object.values(currentMenuIdsByWeekStart),
            (menus) => {
              currentMenus = menus;
              currentMenu = buildDisplayMenu(menus);
              setVisible(true);
              renderConfig(currentMenu);
            },
            (error) => showStatus(formatError(error), true)
          );
        });
      })
      .catch((error: Error) => showStatus(formatError(error), true));
  }
}
