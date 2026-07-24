import {
  buildShoppingListContext,
  buildShoppingListPrompt,
  generateGeminiJson,
  getAiFeatureFlags,
  getAiUiMessageKey,
  getAiUiStateFromError,
  isShoppingListAiAvailable,
  isShoppingListAiResponse,
} from '../lib/ai';
import { watchUserDishes } from '../lib/dishes/repository';
import { getFirebaseServices, signInAsGuest, signInWithGoogle } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { getUpcomingDateRange, getWeekStartForDate, getWeekStartsForDates } from '../lib/menu/dates';
import { ensureUserProfile, getOrCreateWeekMenus, watchUserProfile, watchWeekMenusByIds } from '../lib/menu/repository';
import type { Dish, FirebaseUser, MealSlot, UserProfile, WeekMenu } from '../lib/menu/types';
import { buildShoppingListText } from '../lib/shopping/export';
import { fromAiResponseItems, getToBuyItems, groupShoppingItems, mergeShoppingDraftItems, normalizeShoppingItem } from '../lib/shopping/normalize';
import { saveShoppingList, watchShoppingLists } from '../lib/shopping/repository';
import type { ShoppingItem, ShoppingListDocument, ShoppingScope } from '../lib/shopping/types';
import { watchTuppers } from '../lib/tuppers/repository';
import type { TupperItem } from '../lib/tuppers/types';
import { createConfirmDialog } from '../lib/ui/confirm-dialog';
import { createSaveFeedback } from '../lib/ui/save-feedback';

const root = document.querySelector<HTMLElement>('[data-shopping-app]');
const wizardSteps = ['range', 'meals', 'summary', 'results'] as const;
type WizardStep = (typeof wizardSteps)[number];

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const status = root.querySelector<HTMLElement>('[data-status]');
  const authPanel = root.querySelector<HTMLElement>('[data-auth-panel]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const workspace = root.querySelector<HTMLElement>('[data-workspace]');
  const savedLists = root.querySelector<HTMLElement>('[data-saved-lists]');
  const newListButton = root.querySelector<HTMLButtonElement>('[data-new-list]');
  const rangePicker = root.querySelector<HTMLElement>('[data-range-picker]');
  const selectionSummary = root.querySelector<HTMLElement>('[data-selection-summary]');
  const meals = root.querySelector<HTMLElement>('[data-meals]');
  const draft = root.querySelector<HTMLElement>('[data-draft]');
  const aiStatus = root.querySelector<HTMLElement>('[data-ai-status]');
  const scopeLabel = root.querySelector<HTMLElement>('[data-scope-label]');
  const inventoryHint = root.querySelector<HTMLElement>('[data-inventory-hint]');
  const saveButton = root.querySelector<HTMLButtonElement>('[data-save]');
  const shareButton = root.querySelector<HTMLButtonElement>('[data-share]');
  const wizardError = root.querySelector<HTMLElement>('[data-wizard-error]');
  const wizardSummary = root.querySelector<HTMLElement>('[data-wizard-summary]');
  const wizardPrev = root.querySelector<HTMLButtonElement>('[data-wizard-prev]');
  const wizardNext = root.querySelector<HTMLButtonElement>('[data-wizard-next]');
  const confirmDialogElement = root.querySelector<HTMLDialogElement>('[data-confirm-dialog]');
  const confirmDialog = confirmDialogElement ? createConfirmDialog(confirmDialogElement) : null;
  const saveFeedback = createSaveFeedback(status, {
    pending: labels.savePending,
    saving: labels.saveSaving,
    saved: labels.saveSaved,
  });

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentMenu: WeekMenu | null = null;
  let currentDishes: Dish[] = [];
  let currentTuppers: TupperItem[] = [];
  let currentLists: ShoppingListDocument[] = [];
  let activeListId = '';
  let currentDraftItems: ShoppingItem[] = [];
  let selectedDayKeys = getAvailableRange().dates;
  let currentWizardStep: WizardStep = 'range';
  let draftDirty = false;
  let currentServices: Awaited<ReturnType<typeof getFirebaseServices>> | null = null;
  let unsubscribeMenus: (() => void) | undefined;
  let unsubscribeProfile: (() => void) | undefined;
  let unsubscribeDishes: (() => void) | undefined;
  let unsubscribeTuppers: (() => void) | undefined;
  let unsubscribeShoppingLists: (() => void) | undefined;

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

  function showWizardError(message = '') {
    if (!wizardError) return;
    wizardError.hidden = !message;
    wizardError.textContent = message;
  }

  function setAuthenticated(isAuthenticated: boolean) {
    authPanel?.toggleAttribute('hidden', isAuthenticated);
    workspace?.toggleAttribute('hidden', !isAuthenticated);
    loading?.toggleAttribute('hidden', isAuthenticated);
  }

  function getAvailableRange() {
    return getUpcomingDateRange(new Date(), 1, 7);
  }

  function getRange() {
    const availableRange = getAvailableRange();
    const dates = [...selectedDayKeys].sort();

    return {
      rangeStart: dates[0] ?? availableRange.rangeStart,
      rangeEnd: dates.at(-1) ?? availableRange.rangeEnd,
      dates,
    };
  }

  function getEnabledMeals(): MealSlot[] {
    return currentProfile?.enabledMeals?.length ? currentProfile.enabledMeals : ['lunch'];
  }

  function getScope(): ShoppingScope {
    return currentProfile?.groupId ? 'group' : 'user';
  }

  function getRelevantWeekStarts() {
    return getWeekStartsForDates(getAvailableRange().dates);
  }

  function getMealContext() {
    return buildShoppingListContext({
      locale,
      days: currentMenu?.days ?? {},
      dayKeys: getRange().dates,
      enabledMeals: getEnabledMeals(),
      dishes: currentDishes,
      tuppers: currentTuppers,
    });
  }

  function formatCountLabel(singleKey: string, pluralKey: string, count: number) {
    if (count === 1) {
      return labels[singleKey];
    }

    return (labels[pluralKey] ?? '').replace('{count}', String(count));
  }

  function escapeHtml(value = '') {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function formatDateLabel(dayKey: string) {
    return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${dayKey}T00:00:00`));
  }

  function formatMealLabel(dayKey: string, meal: string) {
    const date = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short' }).format(
      new Date(`${dayKey}T00:00:00`)
    );
    return `${date} · ${labels[meal] ?? meal}`;
  }

  function formatListRange(list: ShoppingListDocument) {
    return (labels.listDateRange ?? '{start} - {end}')
      .replace('{start}', list.rangeStart ? formatDateLabel(list.rangeStart) : '')
      .replace('{end}', list.rangeEnd ? formatDateLabel(list.rangeEnd) : '');
  }

  function getDatesBetween(start: string, end: string) {
    if (!start || !end) return getAvailableRange().dates;
    const dates: string[] = [];
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return getAvailableRange().dates;
    const cursor = new Date(startDate);
    while (cursor <= endDate && dates.length < 31) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  function getDefaultListTitle() {
    const { rangeStart, rangeEnd } = getRange();
    if (rangeStart === rangeEnd) return `${labels.exportTitle} · ${formatDateLabel(rangeStart)}`;
    return `${labels.exportTitle} · ${formatDateLabel(rangeStart)} - ${formatDateLabel(rangeEnd)}`;
  }

  function renderSavedLists() {
    if (!savedLists) return;
    const visibleLists = currentLists.filter((list) => list.status !== 'archived');
    if (visibleLists.length === 0) {
      savedLists.innerHTML = `<p class="shopping-empty">${escapeHtml(labels.savedListsEmpty)}</p>`;
      return;
    }

    savedLists.innerHTML = visibleLists
      .map((list) => {
        const pendingCount = getToBuyItems(list.items).length;
        const countLabel = formatCountLabel('listItemsCountSingle', 'listItemsCountPlural', pendingCount);
        return `
          <article class="shopping-saved-card" data-list-id="${escapeHtml(list.id)}" data-active="${list.id === activeListId}" role="listitem">
            <div class="shopping-saved-card__head">
              <div>
                <h3 class="shopping-saved-card__title">${escapeHtml(list.title || labels.exportTitle)}</h3>
                <p class="shopping-saved-card__meta">
                  <span class="shopping-pill">${escapeHtml(countLabel)}</span>
                  <span class="shopping-pill">${escapeHtml(formatListRange(list))}</span>
                  ${list.id === activeListId ? `<span class="shopping-pill">${escapeHtml(labels.activeList)}</span>` : ''}
                </p>
              </div>
              <button class="button button--secondary button--small" type="button" data-open-list="${escapeHtml(list.id)}">${escapeHtml(labels.openList)}</button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function openShoppingList(list: ShoppingListDocument) {
    activeListId = list.id;
    selectedDayKeys = getDatesBetween(list.rangeStart, list.rangeEnd);
    hydrateDraft(list.items);
    draftDirty = false;
    renderRangePicker();
    renderMeals();
    renderSavedLists();
    goToWizardStep('results');
  }

  function startNewList() {
    activeListId = '';
    selectedDayKeys = getAvailableRange().dates;
    hydrateDraft([]);
    draftDirty = false;
    showAiStatus('');
    renderRangePicker();
    renderMeals();
    renderSavedLists();
    goToWizardStep('range');
  }

  function validateWizardStep(step: WizardStep) {
    if (step === 'range' && selectedDayKeys.length === 0) return labels.wizardRangeRequired;
    if (step === 'meals' && getMealContext().meals.length === 0) return labels.wizardMealsRequired;
    return '';
  }

  function goToWizardStep(step: WizardStep) {
    currentWizardStep = step;
    showWizardError('');
    renderWizard();
  }

  function renderWizardSummary() {
    if (!wizardSummary) return;
    const context = getMealContext();
    const rangeLabel = getRange().dates.map(formatDateLabel).join(' · ');
    const scopeLabelText = getScope() === 'group' ? labels.groupScope : labels.userScope;
    const mealsLabel = formatCountLabel('selectedMealsSingle', 'selectedMealsPlural', context.meals.length);
    const tupperLabel = currentTuppers.length ? labels.inventoryHint : labels.exportEmpty;

    wizardSummary.innerHTML = `
      <dl>
        <div>
          <dt>${escapeHtml(labels.rangeTitle)}</dt>
          <dd>${escapeHtml(rangeLabel || labels.selectedDaysNone)}</dd>
        </div>
        <div>
          <dt>${escapeHtml(labels.mealsTitle)}</dt>
          <dd>${escapeHtml(mealsLabel)}</dd>
        </div>
        <div>
          <dt>${escapeHtml(labels.groupScope)}</dt>
          <dd>${escapeHtml(scopeLabelText)}</dd>
        </div>
        <div>
          <dt>${escapeHtml(labels.inventoryHint)}</dt>
          <dd>${escapeHtml(tupperLabel)}</dd>
        </div>
      </dl>
    `;
  }

  function renderWizard() {
    root.querySelectorAll<HTMLElement>('[data-wizard-step]').forEach((section) => {
      section.hidden = section.dataset.wizardStep !== currentWizardStep;
    });
    root.querySelectorAll<HTMLElement>('[data-wizard-progress-step]').forEach((item) => {
      const isCurrent = item.dataset.wizardProgressStep === currentWizardStep;
      item.toggleAttribute('aria-current', isCurrent);
      if (isCurrent) item.setAttribute('aria-current', 'step');
    });

    if (wizardPrev) wizardPrev.disabled = currentWizardStep === 'range';
    if (wizardNext) {
      wizardNext.disabled =
        currentWizardStep === 'results' || (currentWizardStep === 'range' && selectedDayKeys.length === 0);
    }

    if (currentWizardStep === 'summary') renderWizardSummary();
    updateToolbarState();
  }

  function renderRangePicker() {
    if (!rangePicker) return;

    rangePicker.innerHTML = getAvailableRange().dates
      .map((dayKey) => {
        const date = new Date(`${dayKey}T00:00:00`);
        const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
        const dayLabel = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date);

        return `
          <button class="shopping-range__day" type="button" data-day-key="${escapeHtml(dayKey)}" data-selected="${selectedDayKeys.includes(dayKey)}" aria-pressed="${selectedDayKeys.includes(dayKey)}">
            <strong>${escapeHtml(dayLabel)}</strong>
            <span>${escapeHtml(weekday)}</span>
          </button>
        `;
      })
      .join('');
  }

  function renderSelectionSummary() {
    if (!selectionSummary) return;

    const selectedCount = selectedDayKeys.length;
    const mealCount = getMealContext().meals.length;

    if (selectedCount === 0) {
      selectionSummary.innerHTML = `<span class="shopping-summary-empty">${escapeHtml(labels.selectedDaysNone)}</span>`;
      return;
    }

    selectionSummary.innerHTML = `
      <span class="shopping-summary-pill">${escapeHtml(
        formatCountLabel('selectedDaysSingle', 'selectedDaysPlural', selectedCount)
      )}</span>
      <span class="shopping-summary-pill">${escapeHtml(
        formatCountLabel('selectedMealsSingle', 'selectedMealsPlural', mealCount)
      )}</span>
    `;
  }

  function renderMeals() {
    if (!meals || !scopeLabel || !inventoryHint) return;

    scopeLabel.textContent = getScope() === 'group' ? labels.groupScope : labels.userScope;
    inventoryHint.textContent = currentTuppers.length ? labels.inventoryHint : '';

    const context = getMealContext();
    renderSelectionSummary();
    if (currentWizardStep === 'summary') renderWizardSummary();

    if (selectedDayKeys.length === 0) {
      meals.innerHTML = `<p class="shopping-empty">${escapeHtml(labels.selectedDaysNone)}</p>`;
      renderWizard();
      return;
    }

    if (context.meals.length === 0) {
      meals.innerHTML = `<p class="shopping-empty">${escapeHtml(currentMenu ? labels.emptyPlannedMeals : labels.emptyMeals)}</p>`;
      renderWizard();
      return;
    }

    meals.innerHTML = context.meals
      .map(
        (meal) => `
          <article class="shopping-meal-card">
            <h3>${escapeHtml(formatMealLabel(meal.dayKey, meal.meal))}</h3>
            <p>${escapeHtml(meal.dishes.join(', '))}</p>
            ${
              meal.recipeIngredients.length
                ? `<p class="shopping-empty">${escapeHtml(
                    meal.recipeIngredients
                      .map((ingredient) => ingredient.name + (ingredient.quantity ? ` (${ingredient.quantity})` : ''))
                      .join(', ')
                  )}</p>`
                : ''
            }
          </article>
        `
      )
      .join('');
    renderWizard();
  }

  function renderStatusButton(item: ShoppingItem, value: ShoppingItem['status'], label: string) {
    return `
      <button
        class="shopping-status__button"
        type="button"
        data-set-status="${value}"
        data-selected="${item.status === value}"
        data-status="${value}"
        aria-pressed="${item.status === value}"
      >
        ${escapeHtml(label)}
      </button>
    `;
  }

  function renderItem(item: ShoppingItem) {
    return `
      <article class="shopping-item" data-item-id="${escapeHtml(item.id)}" data-status="${escapeHtml(item.status)}">
        <div class="shopping-item__head">
          <h3 class="shopping-item__title">${escapeHtml(item.name)}</h3>
          ${item.quantity ? `<span class="shopping-pill">${escapeHtml(item.quantity)}</span>` : ''}
        </div>
        <div class="shopping-item__actions">
          <div class="shopping-status" role="group" aria-label="${escapeHtml(labels.itemStatus)}">
            ${renderStatusButton(item, 'to-buy', labels.markToBuy)}
            ${renderStatusButton(item, 'owned', labels.markOwned)}
            ${renderStatusButton(item, 'dismissed', labels.markDismissed)}
          </div>
        </div>
      </article>
    `;
  }

  function renderDraft() {
    if (!draft) return;

    if (currentDraftItems.length === 0) {
      draft.innerHTML = `<p class="shopping-empty">${escapeHtml(labels.startByGenerating)}</p>`;
      return;
    }

    const pendingItems = currentDraftItems.filter((item) => item.status === 'to-buy');
    const reviewedItems = currentDraftItems.filter((item) => item.status !== 'to-buy');

    draft.innerHTML = `
      <section class="shopping-review-group" data-variant="pending">
        <header class="shopping-review-group__header">
          <h3>${escapeHtml(labels.statusToBuy)}</h3>
          <span class="shopping-review-group__count">${escapeHtml(
            formatCountLabel('pendingCountSingle', 'pendingCountPlural', pendingItems.length)
          )}</span>
        </header>
        ${
          pendingItems.length
            ? pendingItems.map((item) => renderItem(item)).join('')
            : `<p class="shopping-empty">${escapeHtml(labels.noToBuyItems)}</p>`
        }
      </section>
      ${
        reviewedItems.length
          ? `
            <section class="shopping-review-group" data-variant="reviewed">
              <header class="shopping-review-group__header">
                <h3>${escapeHtml(labels.doneTitle)}</h3>
                <span class="shopping-review-group__count">${reviewedItems.length}</span>
              </header>
              ${reviewedItems.map((item) => renderItem(item)).join('')}
            </section>
          `
          : ''
      }
    `;
  }

  function updateToolbarState() {
    const hasSelectedDays = selectedDayKeys.length > 0;
    const hasItems = currentDraftItems.length > 0;
    const hasToBuy = getToBuyItems(currentDraftItems).length > 0;
    const aiReady = hasFirebaseConfig() && isShoppingListAiAvailable(getAiFeatureFlags());

    if (saveButton) saveButton.disabled = !currentUser || !hasItems || !hasSelectedDays;
    if (shareButton) shareButton.disabled = !hasToBuy || !hasSelectedDays || typeof navigator.share !== 'function';
    if (wizardNext) {
      wizardNext.textContent = currentWizardStep === 'summary' ? labels.generate : labels.wizardNext;
      wizardNext.disabled =
        currentWizardStep === 'results' ||
        (currentWizardStep === 'range' && selectedDayKeys.length === 0) ||
        (currentWizardStep === 'summary' && (!aiReady || !currentUser || !hasSelectedDays));
    }
  }

  function hydrateDraft(items: ShoppingItem[]) {
    currentDraftItems = groupShoppingItems(items);
    renderDraft();
    updateToolbarState();
  }

  async function generateWithAi() {
    if (!currentUser) return;

    const stepError = validateWizardStep('meals');
    if (stepError) {
      showWizardError(stepError);
      goToWizardStep('meals');
      return;
    }

    const flags = getAiFeatureFlags();
    if (!flags.aiEnabled || !flags.shoppingListEnabled) {
      showAiStatus(labels.aiDisabled, true);
      return;
    }

    if (!hasFirebaseConfig()) {
      showAiStatus(labels.aiMissingConfig, true);
      return;
    }

    const context = getMealContext();
    if (context.meals.length === 0) {
      showAiStatus(labels.emptyPlannedMeals, true);
      return;
    }

    const hasAiItems = currentDraftItems.some((item) => item.source === 'ai');
    const hasManualItems = currentDraftItems.some((item) => item.source === 'manual');
    if (hasAiItems && hasManualItems) {
      const confirmed = await confirmDialog?.open({
        title: labels.regenerateConfirmTitle,
        description: labels.regenerateConfirm,
        confirmLabel: labels.regenerate,
        cancelLabel: labels.confirmCancel,
        confirmVariant: 'primary',
        returnFocusTo: wizardNext,
      });
      if (!confirmed) return;
    }

    if (hasAiItems) {
      showAiStatus(labels.generating, false);
    }

    try {
      updateToolbarState();
      showAiStatus(labels.generating, false);
      wizardNext?.setAttribute('aria-busy', 'true');
      const response = await generateGeminiJson({
        userId: currentUser.uid,
        prompt: buildShoppingListPrompt(context),
        validator: isShoppingListAiResponse,
      });
      const aiItems = fromAiResponseItems(response.items);
      currentDraftItems = mergeShoppingDraftItems(currentDraftItems, aiItems);
      draftDirty = true;
      renderDraft();
      updateToolbarState();
      showAiStatus(aiItems.length ? labels.updated : labels.noToBuyItems, false);
    } catch (error) {
      const state = getAiUiStateFromError(error);
      const key = getAiUiMessageKey(state);
      showAiStatus(key ? labels[key] ?? labels.invalidResponse : labels.invalidResponse, true);
    } finally {
      wizardNext?.removeAttribute('aria-busy');
    }
  }

  async function saveCurrentList() {
    if (!currentUser) return;

    try {
      saveFeedback.pending();
      const { rangeStart, rangeEnd } = getRange();
      const listId = await saveShoppingList(await getFirebaseServices(), {
        userId: currentUser.uid,
        groupId: currentProfile?.groupId,
        scope: getScope(),
        title: currentLists.find((list) => list.id === activeListId)?.title || getDefaultListTitle(),
        rangeStart,
        rangeEnd,
        items: currentDraftItems,
        listId: activeListId || undefined,
      });
      activeListId = listId;
      draftDirty = false;
      renderSavedLists();
      showStatus(labels.saved);
    } catch (error) {
      showStatus(formatError(error), true);
    }
  }

  function buildExportText() {
    const toBuyItems = getToBuyItems(currentDraftItems);
    if (toBuyItems.length === 0) {
      showStatus(labels.noToBuyItems, true);
      return '';
    }

    return buildShoppingListText(toBuyItems, {
      title: labels.exportTitle,
      emptyLabel: labels.exportEmpty,
    });
  }

  async function shareCurrentList() {
    const text = buildExportText();
    if (!text || typeof navigator.share !== 'function') return;
    await navigator.share({ text, title: labels.exportTitle });
    showStatus(labels.shared);
  }

  function updateItemStatus(itemId: string, nextStatus: ShoppingItem['status']) {
    currentDraftItems = groupShoppingItems(
      currentDraftItems.map((item) => {
        if (item.id !== itemId) return item;
        return normalizeShoppingItem({ ...item, status: nextStatus, checked: nextStatus === 'owned' });
      })
    );
    draftDirty = true;
    renderDraft();
    renderSavedLists();
    updateToolbarState();
  }

  function buildDisplayMenu(menus: WeekMenu[]) {
    const visibleRange = getAvailableRange();
    const days = Object.fromEntries(
      visibleRange.dates.map((dayKey) => {
        const weekStart = getWeekStartForDate(dayKey);
        const menu = menus.find((entry) => entry.weekStart === weekStart);
        return [dayKey, menu?.days?.[dayKey]];
      })
    );

    return {
      id: '',
      title: '',
      ownerId: currentUser?.uid ?? '',
      members: currentUser ? [currentUser.uid] : [],
      inviteCode: '',
      weekStart: visibleRange.rangeStart,
      days,
    } as WeekMenu;
  }

  function resubscribeShoppingLists(services: Awaited<ReturnType<typeof getFirebaseServices>>) {
    unsubscribeShoppingLists?.();
    if (!currentUser) return;

    unsubscribeShoppingLists = watchShoppingLists(
      services,
      {
        scope: getScope(),
        ownerId: currentUser.uid,
        groupId: currentProfile?.groupId,
      },
      (lists) => {
        currentLists = lists;
        const activeList = lists.find((list) => list.id === activeListId);
        if (activeList && !draftDirty) {
          currentDraftItems = activeList.items;
          renderDraft();
        }
        renderSavedLists();
      },
      (error) => showStatus(formatError(error), true)
    );
  }

  function formatError(error: unknown) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      return labels.permissionsError;
    }

    return error instanceof Error ? error.message : String(error);
  }

  function attachEvents() {
    root.querySelector('[data-google-login]')?.addEventListener('click', () =>
      signInWithGoogle().catch((error: Error) => showStatus(error.message, true))
    );
    root.querySelector('[data-guest-login]')?.addEventListener('click', () =>
      signInAsGuest().catch((error: Error) => showStatus(error.message, true))
    );
    newListButton?.addEventListener('click', startNewList);
    savedLists?.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-open-list]');
      const listId = button?.dataset.openList;
      const list = currentLists.find((entry) => entry.id === listId);
      if (!button || !list) return;
      openShoppingList(list);
    });
    saveButton?.addEventListener('click', () => {
      saveCurrentList().catch((error) => showStatus(formatError(error), true));
    });
    shareButton?.addEventListener('click', () => {
      shareCurrentList().catch((error) => showStatus(formatError(error), true));
    });
    wizardPrev?.addEventListener('click', () => {
      const index = wizardSteps.indexOf(currentWizardStep);
      goToWizardStep(wizardSteps[Math.max(0, index - 1)]);
    });
    wizardNext?.addEventListener('click', () => {
      const error = validateWizardStep(currentWizardStep);
      if (error) {
        showWizardError(error);
        return;
      }
      if (currentWizardStep === 'summary') {
        goToWizardStep('results');
        generateWithAi().catch((error) => showAiStatus(formatError(error), true));
        return;
      }
      const index = wizardSteps.indexOf(currentWizardStep);
      goToWizardStep(wizardSteps[Math.min(wizardSteps.length - 1, index + 1)]);
    });

    rangePicker?.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-day-key]');
      const dayKey = button?.dataset.dayKey;
      if (!button || !dayKey) return;

      selectedDayKeys = selectedDayKeys.includes(dayKey)
        ? selectedDayKeys.filter((entry) => entry !== dayKey)
        : [...selectedDayKeys, dayKey].sort();
      renderRangePicker();
      renderMeals();
      updateToolbarState();
    });

    draft?.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-set-status]');
      const itemId = button?.closest<HTMLElement>('[data-item-id]')?.dataset.itemId;
      const nextStatus = button?.dataset.setStatus as ShoppingItem['status'] | undefined;
      if (!button || !itemId || !nextStatus) return;
      updateItemStatus(itemId, nextStatus);
    });
  }

  if (!hasFirebaseConfig()) {
    loading?.setAttribute('hidden', 'hidden');
    authPanel?.removeAttribute('hidden');
    showStatus(labels.configMissing, true);
    attachEvents();
  } else {
    attachEvents();
    getFirebaseServices()
      .then((services) => {
        currentServices = services;
        services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
          currentUser = user;
          if (!user) {
            setAuthenticated(false);
            showAiStatus('');
            return;
          }

          setAuthenticated(true);
          await ensureUserProfile(services, user, labels.guestSession);

          unsubscribeProfile?.();
          unsubscribeProfile = watchUserProfile(
            services,
            user,
            labels.guestSession,
            async (profile) => {
              currentProfile = profile;
              resubscribeShoppingLists(services);
              const menuIdsByWeekStart = await getOrCreateWeekMenus(services, user.uid, getRelevantWeekStarts(), locale);

              unsubscribeMenus?.();
              unsubscribeMenus = watchWeekMenusByIds(
                services,
                Object.values(menuIdsByWeekStart),
                (menus) => {
                  currentMenu = buildDisplayMenu(menus);
                  renderMeals();
                },
                (error) => showStatus(formatError(error), true)
              );

              unsubscribeDishes?.();
              unsubscribeDishes = watchUserDishes(
                services,
                user.uid,
                (dishes) => {
                  currentDishes = dishes;
                  renderMeals();
                },
                (error) => showStatus(formatError(error), true),
                false,
                profile.groupId
              );
            },
            (error) => showStatus(formatError(error), true)
          );

          unsubscribeTuppers?.();
          unsubscribeTuppers = watchTuppers(
            services,
            user.uid,
            profile.groupId,
            (tuppers) => {
              currentTuppers = tuppers;
              renderMeals();
            },
            (error) => showStatus(formatError(error), true)
          );
        });
      })
      .catch((error: Error) => showStatus(error.message, true));
  }

  renderRangePicker();
  renderSelectionSummary();
  renderSavedLists();
  renderDraft();
  renderWizard();
  updateToolbarState();
}
