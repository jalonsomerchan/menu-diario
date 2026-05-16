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
import { buildShoppingListText, createShoppingExportFilename, groupItemsByCategory } from '../lib/shopping/export';
import {
  fromAiResponseItems,
  getToBuyItems,
  groupShoppingItems,
  mergeShoppingDraftItems,
  normalizeShoppingItem,
} from '../lib/shopping/normalize';
import { saveShoppingList, watchShoppingList } from '../lib/shopping/repository';
import type { ShoppingCategory, ShoppingItem, ShoppingScope } from '../lib/shopping/types';
import { watchTuppers } from '../lib/tuppers/repository';
import type { TupperItem } from '../lib/tuppers/types';
import { createSaveFeedback } from '../lib/ui/save-feedback';

const root = document.querySelector<HTMLElement>('[data-shopping-app]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const status = root.querySelector<HTMLElement>('[data-status]');
  const authPanel = root.querySelector<HTMLElement>('[data-auth-panel]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const workspace = root.querySelector<HTMLElement>('[data-workspace]');
  const meals = root.querySelector<HTMLElement>('[data-meals]');
  const draft = root.querySelector<HTMLElement>('[data-draft]');
  const aiStatus = root.querySelector<HTMLElement>('[data-ai-status]');
  const scopeLabel = root.querySelector<HTMLElement>('[data-scope-label]');
  const inventoryHint = root.querySelector<HTMLElement>('[data-inventory-hint]');
  const generateButton = root.querySelector<HTMLButtonElement>('[data-generate]');
  const addItemButton = root.querySelector<HTMLButtonElement>('[data-add-item]');
  const saveButton = root.querySelector<HTMLButtonElement>('[data-save]');
  const copyButton = root.querySelector<HTMLButtonElement>('[data-copy]');
  const shareButton = root.querySelector<HTMLButtonElement>('[data-share]');
  const downloadButton = root.querySelector<HTMLButtonElement>('[data-download]');
  const saveFeedback = createSaveFeedback(status, {
    pending: labels.savePending,
    saving: labels.saveSaving,
    saved: labels.saveSaved,
  });

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentMenus: WeekMenu[] = [];
  let currentMenu: WeekMenu | null = null;
  let currentMenuIdsByWeekStart: Record<string, string> = {};
  let currentDishes: Dish[] = [];
  let currentTuppers: TupperItem[] = [];
  let currentSavedItems: ShoppingItem[] = [];
  let currentDraftItems: ShoppingItem[] = [];
  let draftDirty = false;
  let unsubscribeMenus: (() => void) | undefined;
  let unsubscribeProfile: (() => void) | undefined;
  let unsubscribeDishes: (() => void) | undefined;
  let unsubscribeTuppers: (() => void) | undefined;
  let unsubscribeShoppingList: (() => void) | undefined;

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

  function setAuthenticated(isAuthenticated: boolean) {
    authPanel?.toggleAttribute('hidden', isAuthenticated);
    workspace?.toggleAttribute('hidden', !isAuthenticated);
    loading?.toggleAttribute('hidden', isAuthenticated);
  }

  function getEnabledMeals(): MealSlot[] {
    return currentProfile?.enabledMeals?.length ? currentProfile.enabledMeals : ['lunch'];
  }

  function getScope(): ShoppingScope {
    return currentProfile?.groupId ? 'group' : 'user';
  }

  function getRange() {
    return getUpcomingDateRange(new Date(), 1, 7);
  }

  function getRelevantWeekStarts() {
    return getWeekStartsForDates(getRange().dates);
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

  function getCategoryLabel(category: ShoppingCategory) {
    const key = `category${category.charAt(0).toUpperCase()}${category.slice(1)}`;
    return labels[`shopping.${key}`] ?? labels[key] ?? category;
  }

  function renderMeals() {
    if (!meals || !scopeLabel || !inventoryHint) return;

    scopeLabel.textContent = getScope() === 'group' ? labels.groupScope : labels.userScope;
    inventoryHint.textContent = currentTuppers.length ? labels.inventoryHint : '';

    const context = getMealContext();
    if (context.meals.length === 0) {
      meals.innerHTML = `<p class="shopping-empty">${escapeHtml(currentMenu ? labels.emptyPlannedMeals : labels.emptyMeals)}</p>`;
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
  }

  function renderDraft() {
    if (!draft) return;

    const grouped = groupItemsByCategory(currentDraftItems);
    if (grouped.length === 0) {
      draft.innerHTML = `<p class="shopping-empty">${escapeHtml(labels.noToBuyItems)}</p>`;
      return;
    }

    draft.innerHTML = grouped
      .map(
        ({ category, items }) => `
          <details class="shopping-category" open>
            <summary>
              <span>${escapeHtml(getCategoryLabel(category))}</span>
              <span class="shopping-category__count">${items.length}</span>
            </summary>
            <div class="shopping-category__items">
              ${items.map((item) => renderItem(item)).join('')}
            </div>
          </details>
        `
      )
      .join('');
  }

  function renderItem(item: ShoppingItem) {
    return `
      <article class="shopping-item" data-item-id="${escapeHtml(item.id)}">
        <div class="shopping-item__meta">
          <span class="shopping-pill">${escapeHtml(item.source === 'manual' ? labels.sourceManual : labels.sourceAi)}</span>
          <span class="shopping-pill">${escapeHtml(readConfidenceLabel(item.confidence))}</span>
        </div>
        <div class="shopping-fields">
          <label>
            <span>${escapeHtml(labels.itemName)}</span>
            <input data-field="name" value="${escapeHtml(item.name)}" />
          </label>
          <label>
            <span>${escapeHtml(labels.itemQuantity)}</span>
            <input data-field="quantity" value="${escapeHtml(item.quantity)}" />
          </label>
          <label>
            <span>${escapeHtml(labels.itemCategory)}</span>
            <input data-field="category" value="${escapeHtml(getCategoryLabel(item.category))}" list="shopping-categories" />
          </label>
          <label data-field-meals>
            <span>${escapeHtml(labels.itemMeals)}</span>
            <textarea data-field="forMeals">${escapeHtml(item.forMeals.join(', '))}</textarea>
          </label>
        </div>
        <div class="shopping-status">
          <fieldset>
            <legend>${escapeHtml(labels.itemStatus)}</legend>
            <div class="shopping-status__options">
              ${renderStatusOption(item, 'to-buy', labels.statusToBuy)}
              ${renderStatusOption(item, 'owned', labels.statusOwned)}
              ${renderStatusOption(item, 'dismissed', labels.statusDismissed)}
            </div>
          </fieldset>
        </div>
        <div class="shopping-item__footer">
          <span class="shopping-empty">${escapeHtml(labels.itemConfidence)}: ${escapeHtml(readConfidenceLabel(item.confidence))}</span>
          <button class="button button--ghost button--small shopping-item__remove" type="button" data-remove-item="${escapeHtml(item.id)}">
            ${escapeHtml(labels.removeItem)}
          </button>
        </div>
      </article>
    `;
  }

  function renderStatusOption(item: ShoppingItem, value: ShoppingItem['status'], label: string) {
    return `
      <label class="shopping-status__option">
        <input type="radio" name="status-${escapeHtml(item.id)}" value="${value}" data-field="status" ${item.status === value ? 'checked' : ''} />
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  function escapeHtml(value = '') {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function formatMealLabel(dayKey: string, meal: string) {
    const date = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short' }).format(
      new Date(`${dayKey}T00:00:00`)
    );
    return `${date} · ${labels[meal] ?? meal}`;
  }

  function readConfidenceLabel(confidence: ShoppingItem['confidence']) {
    if (confidence === 'high') return labels.confidenceHigh;
    if (confidence === 'low') return labels.confidenceLow;
    return labels.confidenceMedium;
  }

  function updateToolbarState() {
    const hasItems = currentDraftItems.length > 0;
    const hasToBuy = getToBuyItems(currentDraftItems).length > 0;
    const aiReady = hasFirebaseConfig() && isShoppingListAiAvailable(getAiFeatureFlags());
    if (generateButton) {
      generateButton.disabled = !aiReady || !currentUser;
      generateButton.textContent = currentDraftItems.some((item) => item.source === 'ai') ? labels.regenerate : labels.generate;
    }
    if (saveButton) saveButton.disabled = !currentUser || !hasItems;
    if (copyButton) copyButton.disabled = !hasToBuy;
    if (downloadButton) downloadButton.disabled = !hasToBuy;
    if (shareButton) shareButton.disabled = !hasToBuy || typeof navigator.share !== 'function';
    addItemButton?.toggleAttribute('disabled', !currentUser);
  }

  function hydrateDraft(items: ShoppingItem[]) {
    currentDraftItems = groupShoppingItems(items);
    renderDraft();
    updateToolbarState();
  }

  async function generateWithAi() {
    if (!currentUser) return;
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
    if (hasAiItems && (!hasManualItems || window.confirm(labels.regenerateConfirm))) {
      showAiStatus(labels.generating, false);
    } else if (hasAiItems) {
      return;
    }

    try {
      updateToolbarState();
      showAiStatus(labels.generating, false);
      generateButton?.setAttribute('aria-busy', 'true');
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
      generateButton?.removeAttribute('aria-busy');
    }
  }

  async function saveCurrentList() {
    if (!currentUser) return;

    try {
      saveFeedback.pending();
      const { rangeStart, rangeEnd } = getRange();
      await saveShoppingList(await getFirebaseServices(), {
        userId: currentUser.uid,
        groupId: currentProfile?.groupId,
        scope: getScope(),
        rangeStart,
        rangeEnd,
        items: currentDraftItems,
      });
      currentSavedItems = currentDraftItems;
      draftDirty = false;
      showStatus(labels.saved);
    } catch (error) {
      showStatus(formatError(error), true);
    }
  }

  async function copyCurrentList() {
    const text = buildExportText();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    showStatus(labels.copied);
  }

  async function shareCurrentList() {
    const text = buildExportText();
    if (!text || typeof navigator.share !== 'function') return;
    await navigator.share({ text, title: labels.exportTitle });
    showStatus(labels.shared);
  }

  function downloadCurrentList() {
    const text = buildExportText();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const { rangeStart, rangeEnd } = getRange();
    anchor.href = url;
    anchor.download = createShoppingExportFilename(rangeStart, rangeEnd);
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    showStatus(labels.exported);
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
      categoryLabel: getCategoryLabel,
    });
  }

  function addManualItem() {
    currentDraftItems = groupShoppingItems([
      ...currentDraftItems,
      normalizeShoppingItem({
        name: labels.newItemName,
        category: 'other',
        source: 'manual',
        status: 'to-buy',
        quantity: '',
        forMeals: [],
      }),
    ]);
    draftDirty = true;
    renderDraft();
    updateToolbarState();
  }

  function removeItem(itemId: string) {
    currentDraftItems = currentDraftItems.filter((item) => item.id !== itemId);
    draftDirty = true;
    renderDraft();
    updateToolbarState();
  }

  function updateItem(itemId: string, field: string, value: string) {
    currentDraftItems = groupShoppingItems(
      currentDraftItems.map((item) => {
        if (item.id !== itemId) return item;
        const nextItem =
          field === 'status'
            ? { ...item, status: value as ShoppingItem['status'] }
            : field === 'forMeals'
              ? { ...item, forMeals: value.split(',').map((meal) => meal.trim()).filter(Boolean) }
              : { ...item, [field]: value };
        return normalizeShoppingItem(nextItem);
      })
    );
    draftDirty = true;
    renderDraft();
    updateToolbarState();
  }

  function buildDisplayMenu(menus: WeekMenu[]) {
    const range = getRange();
    const days = Object.fromEntries(
      range.dates.map((dayKey) => {
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
      weekStart: range.rangeStart,
      days,
    } as WeekMenu;
  }

  function resubscribeShoppingList(services: Awaited<ReturnType<typeof getFirebaseServices>>) {
    unsubscribeShoppingList?.();
    if (!currentUser) return;
    const { rangeStart, rangeEnd } = getRange();
    unsubscribeShoppingList = watchShoppingList(
      services,
      {
        scope: getScope(),
        ownerId: currentUser.uid,
        groupId: currentProfile?.groupId,
        rangeStart,
        rangeEnd,
      },
      (list) => {
        currentSavedItems = list?.items ?? [];
        if (!draftDirty || currentDraftItems.length === 0) {
          hydrateDraft(currentSavedItems);
        }
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
    generateButton?.addEventListener('click', () => {
      generateWithAi().catch((error) => showAiStatus(formatError(error), true));
    });
    addItemButton?.addEventListener('click', addManualItem);
    saveButton?.addEventListener('click', () => {
      saveCurrentList().catch((error) => showStatus(formatError(error), true));
    });
    copyButton?.addEventListener('click', () => {
      copyCurrentList().catch((error) => showStatus(formatError(error), true));
    });
    shareButton?.addEventListener('click', () => {
      shareCurrentList().catch((error) => showStatus(formatError(error), true));
    });
    downloadButton?.addEventListener('click', downloadCurrentList);

    draft?.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      if (!(target instanceof HTMLButtonElement) || !target.dataset.removeItem) return;
      removeItem(target.dataset.removeItem);
    });

    draft?.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
      const itemId = target?.closest<HTMLElement>('[data-item-id]')?.dataset.itemId;
      const field = target?.dataset.field;
      if (!target || !itemId || !field) return;
      updateItem(itemId, field, target.value);
    });

    draft?.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement | null;
      const itemId = target?.closest<HTMLElement>('[data-item-id]')?.dataset.itemId;
      const field = target?.dataset.field;
      if (!target || !itemId || !field) return;
      updateItem(itemId, field, target.value);
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
              resubscribeShoppingList(services);
              const menuIdsByWeekStart = await getOrCreateWeekMenus(
                services,
                user.uid,
                getRelevantWeekStarts(),
                locale
              );
              currentMenuIdsByWeekStart = menuIdsByWeekStart;

              unsubscribeMenus?.();
              unsubscribeMenus = watchWeekMenusByIds(
                services,
                Object.values(menuIdsByWeekStart),
                (menus) => {
                  currentMenus = menus;
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

  renderDraft();
  updateToolbarState();
}
