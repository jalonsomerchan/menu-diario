import { getFirebaseServices, signInAsGuest, signInWithGoogle } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { ensureUserProfile, watchUserProfile } from '../lib/menu/repository';
import type { FirebaseUser, UserProfile } from '../lib/menu/types';
import { buildShoppingListText } from '../lib/shopping/export';
import { createManualShoppingItemId, getToBuyItems, groupShoppingItems, normalizeShoppingItem } from '../lib/shopping/normalize';
import { deleteShoppingList, saveShoppingList, updateShoppingListStatus, watchShoppingLists } from '../lib/shopping/repository';
import type { ShoppingItem, ShoppingListDocument, ShoppingScope } from '../lib/shopping/types';
import { createConfirmDialog } from '../lib/ui/confirm-dialog';
import { createSaveFeedback } from '../lib/ui/save-feedback';
import '../styles/shopping-lists-modern.css';

const root = document.querySelector<HTMLElement>('[data-shopping-lists-app]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const status = root.querySelector<HTMLElement>('[data-status]');
  const authPanel = root.querySelector<HTMLElement>('[data-auth-panel]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const workspace = root.querySelector<HTMLElement>('[data-workspace]');
  const savedLists = root.querySelector<HTMLElement>('[data-saved-lists]');
  const detail = root.querySelector<HTMLElement>('[data-detail]');
  const detailTitle = root.querySelector<HTMLElement>('[data-detail-title]');
  const detailDescription = root.querySelector<HTMLElement>('[data-detail-description]');
  const createListForm = root.querySelector<HTMLFormElement>('[data-create-list-form]');
  const addItemForm = root.querySelector<HTMLFormElement>('[data-add-item-form]');
  const saveButton = root.querySelector<HTMLButtonElement>('[data-save]');
  const shareButton = root.querySelector<HTMLButtonElement>('[data-share]');
  const completeButton = root.querySelector<HTMLButtonElement>('[data-complete]');
  const deleteActiveButton = root.querySelector<HTMLButtonElement>('[data-delete-active]');
  const confirmDialogElement = root.querySelector<HTMLDialogElement>('[data-confirm-dialog]');
  const confirmDialog = confirmDialogElement ? createConfirmDialog(confirmDialogElement) : null;
  const saveFeedback = createSaveFeedback(status, {
    pending: labels.savePending,
    saving: labels.saveSaving,
    saved: labels.saveSaved,
  });

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentLists: ShoppingListDocument[] = [];
  let activeList: ShoppingListDocument | null = null;
  let draftItems: ShoppingItem[] = [];
  let draftDirty = false;
  let unsubscribeProfile: (() => void) | undefined;
  let unsubscribeShoppingLists: (() => void) | undefined;

  function showStatus(message: string, isError = false) {
    if (isError) {
      saveFeedback.error(message);
      return;
    }
    saveFeedback.info(message);
  }

  function setAuthenticated(isAuthenticated: boolean) {
    authPanel?.toggleAttribute('hidden', isAuthenticated);
    workspace?.toggleAttribute('hidden', !isAuthenticated);
    loading?.toggleAttribute('hidden', isAuthenticated);
  }

  function escapeHtml(value = '') {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function getScope(): ShoppingScope {
    return currentProfile?.groupId ? 'group' : 'user';
  }

  function formatDateLabel(dayKey: string) {
    if (!dayKey) return '';
    return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${dayKey}T00:00:00`));
  }

  function formatListRange(list: ShoppingListDocument) {
    if (!list.rangeStart || !list.rangeEnd) return '';
    return (labels.listDateRange ?? '{start} - {end}')
      .replace('{start}', formatDateLabel(list.rangeStart))
      .replace('{end}', formatDateLabel(list.rangeEnd));
  }

  function formatCountLabel(singleKey: string, pluralKey: string, count: number) {
    return count === 1 ? labels[singleKey] : (labels[pluralKey] ?? '').replace('{count}', String(count));
  }

  function renderSavedLists() {
    if (!savedLists) return;
    const visibleLists = currentLists.filter((list) => list.status !== 'archived');
    if (visibleLists.length === 0) {
      savedLists.innerHTML = `<div class="shopping-empty-state"><p class="shopping-empty">${escapeHtml(labels.savedListsEmpty)}</p><a class="button button--primary button--small" href="${escapeHtml(labels.aiPath)}">${escapeHtml(labels.createWithAi)}</a></div>`;
      return;
    }

    savedLists.innerHTML = visibleLists
      .map((list) => {
        const pendingCount = getToBuyItems(list.items).length;
        const reviewedCount = list.items.length - pendingCount;
        const countLabel = formatCountLabel('listItemsCountSingle', 'listItemsCountPlural', pendingCount);
        const rangeLabel = formatListRange(list);
        return `
          <article class="shopping-saved-card" data-list-id="${escapeHtml(list.id)}" data-active="${list.id === activeList?.id}" data-status="${escapeHtml(list.status)}" role="listitem">
            <div class="shopping-saved-card__head">
              <div class="shopping-saved-card__main">
                <h3 class="shopping-saved-card__title">${escapeHtml(list.title || labels.exportTitle)}</h3>
                <p class="shopping-saved-card__meta">
                  <span class="shopping-pill shopping-pill--primary">${escapeHtml(countLabel)}</span>
                  ${rangeLabel ? `<span class="shopping-pill">${escapeHtml(rangeLabel)}</span>` : ''}
                  ${reviewedCount > 0 ? `<span class="shopping-pill">${reviewedCount} ${escapeHtml(labels.doneTitle).toLocaleLowerCase()}</span>` : ''}
                  ${list.status === 'completed' ? `<span class="shopping-pill shopping-pill--completed">${escapeHtml(labels.completed)}</span>` : ''}
                  ${list.id === activeList?.id ? `<span class="shopping-pill shopping-pill--active">${escapeHtml(labels.activeList)}</span>` : ''}
                </p>
              </div>
              <div class="shopping-saved-card__actions">
                <button class="button button--secondary button--small" type="button" data-open-list="${escapeHtml(list.id)}">${escapeHtml(labels.openList)}</button>
                <button class="button button--ghost button--small shopping-saved-card__delete" type="button" data-delete-list="${escapeHtml(list.id)}">${escapeHtml(labels.deleteList)}</button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function renderStatusButton(item: ShoppingItem, value: ShoppingItem['status'], label: string) {
    return `
      <button class="shopping-status__button" type="button" data-set-status="${value}" data-selected="${item.status === value}" data-status="${value}" aria-pressed="${item.status === value}">
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
        <div class="shopping-status" role="group" aria-label="${escapeHtml(labels.itemStatus)}">
          ${renderStatusButton(item, 'to-buy', labels.markToBuy)}
          ${renderStatusButton(item, 'owned', labels.markOwned)}
          ${renderStatusButton(item, 'dismissed', labels.markDismissed)}
          <button class="shopping-status__button shopping-status__button--danger" type="button" data-remove-item>
            ${escapeHtml(labels.removeItem)}
          </button>
        </div>
      </article>
    `;
  }

  function renderDetail() {
    if (!detail) return;
    if (!activeList) {
      detail.innerHTML = `<p class="shopping-empty">${escapeHtml(labels.selectList)}</p>`;
      if (detailTitle) detailTitle.textContent = labels.savedListsTitle;
      if (detailDescription) detailDescription.textContent = labels.selectList;
      updateToolbarState();
      return;
    }

    if (detailTitle) detailTitle.textContent = activeList.title || labels.exportTitle;
    if (detailDescription) {
      const rangeLabel = formatListRange(activeList);
      detailDescription.textContent = activeList.status === 'completed' ? labels.completed : rangeLabel || labels.selectList;
    }

    const pendingItems = draftItems.filter((item) => item.status === 'to-buy');
    const reviewedItems = draftItems.filter((item) => item.status !== 'to-buy');

    detail.innerHTML = `
      <section class="shopping-review-group" data-variant="pending">
        <header class="shopping-review-group__header">
          <h3>${escapeHtml(labels.statusToBuy)}</h3>
          <span class="shopping-review-group__count">${escapeHtml(formatCountLabel('pendingCountSingle', 'pendingCountPlural', pendingItems.length))}</span>
        </header>
        ${pendingItems.length ? pendingItems.map(renderItem).join('') : `<p class="shopping-empty">${escapeHtml(labels.noToBuyItems)}</p>`}
      </section>
      ${
        reviewedItems.length
          ? `<section class="shopping-review-group" data-variant="reviewed">
              <header class="shopping-review-group__header">
                <h3>${escapeHtml(labels.doneTitle)}</h3>
                <span class="shopping-review-group__count">${reviewedItems.length}</span>
              </header>
              ${reviewedItems.map(renderItem).join('')}
            </section>`
          : ''
      }
    `;
    updateToolbarState();
  }

  function openList(list: ShoppingListDocument) {
    activeList = list;
    draftItems = groupShoppingItems(list.items);
    draftDirty = false;
    workspace?.setAttribute('data-view', 'detail');
    renderSavedLists();
    renderDetail();
  }

  function updateToolbarState() {
    const hasList = Boolean(activeList);
    const hasToBuy = getToBuyItems(draftItems).length > 0;
    if (saveButton) saveButton.disabled = !currentUser || !hasList || !draftDirty;
    if (shareButton) shareButton.disabled = !hasList || !hasToBuy || typeof navigator.share !== 'function';
    if (completeButton) {
      completeButton.disabled = !currentUser || !hasList || !activeList?.id;
      completeButton.textContent = activeList?.status === 'completed' ? labels.reopenList : labels.markCompleted;
    }
    if (deleteActiveButton) deleteActiveButton.disabled = !currentUser || !hasList || !activeList?.id;
  }

  function updateItemStatus(itemId: string, nextStatus: ShoppingItem['status']) {
    draftItems = groupShoppingItems(
      draftItems.map((item) => {
        if (item.id !== itemId) return item;
        return normalizeShoppingItem({ ...item, status: nextStatus, checked: nextStatus === 'owned' });
      })
    );
    draftDirty = true;
    renderDetail();
    renderSavedLists();
  }

  function removeItem(itemId: string) {
    draftItems = draftItems.filter((item) => item.id !== itemId);
    draftDirty = true;
    renderDetail();
    renderSavedLists();
  }

  function addManualItem(name: string, quantity: string) {
    if (!activeList) return;
    const nextItem = normalizeShoppingItem(
      {
        id: createManualShoppingItemId(),
        name,
        quantity,
        category: name,
        source: 'manual',
        status: 'to-buy',
        checked: false,
        order: draftItems.length,
      },
      draftItems.length
    );
    draftItems = groupShoppingItems([...draftItems, nextItem]);
    draftDirty = true;
    renderDetail();
    renderSavedLists();
  }

  function createManualList(title: string) {
    const today = new Date().toISOString().slice(0, 10);
    activeList = {
      id: '',
      title: title.trim() || labels.exportTitle,
      ownerId: currentUser?.uid ?? '',
      groupId: currentProfile?.groupId,
      scope: getScope(),
      status: 'active',
      source: 'manual',
      rangeStart: today,
      rangeEnd: today,
      items: [],
    };
    draftItems = [];
    draftDirty = true;
    workspace?.setAttribute('data-view', 'detail');
    renderSavedLists();
    renderDetail();
    showStatus(labels.createdList);
  }

  function buildExportText() {
    const toBuyItems = getToBuyItems(draftItems);
    if (toBuyItems.length === 0) {
      showStatus(labels.noToBuyItems, true);
      return '';
    }

    return buildShoppingListText(toBuyItems, {
      title: activeList?.title || labels.exportTitle,
      emptyLabel: labels.noToBuyItems,
    });
  }

  async function shareCurrentList() {
    const text = buildExportText();
    if (!text || typeof navigator.share !== 'function') return;
    await navigator.share({ text, title: activeList?.title || labels.exportTitle });
    showStatus(labels.shared);
  }

  async function saveCurrentList() {
    if (!currentUser || !activeList) return;

    try {
      saveFeedback.pending();
      const listId = await saveShoppingList(await getFirebaseServices(), {
        userId: currentUser.uid,
        groupId: currentProfile?.groupId,
        scope: getScope(),
        title: activeList.title || labels.exportTitle,
        rangeStart: activeList.rangeStart,
        rangeEnd: activeList.rangeEnd,
        items: draftItems,
        listId: activeList.id || undefined,
        status: activeList.status,
      });
      activeList = { ...activeList, id: listId, items: draftItems };
      draftDirty = false;
      renderSavedLists();
      renderDetail();
      showStatus(labels.saved);
    } catch (error) {
      showStatus(formatError(error), true);
    }
  }

  async function deleteCurrentList(listId: string, returnFocusTo?: HTMLElement | null) {
    if (!currentUser) return;
    const confirmed = await confirmDialog?.open({
      title: labels.deleteListConfirmTitle,
      description: labels.deleteListConfirm,
      confirmLabel: labels.deleteList,
      cancelLabel: labels.confirmCancel,
      confirmVariant: 'danger',
      returnFocusTo,
    });
    if (!confirmed) return;

    try {
      saveFeedback.saving();
      await deleteShoppingList(await getFirebaseServices(), listId);
      if (activeList?.id === listId) {
        activeList = null;
        draftItems = [];
        draftDirty = false;
        renderDetail();
      }
      currentLists = currentLists.filter((list) => list.id !== listId);
      workspace?.setAttribute('data-view', 'index');
      renderSavedLists();
      showStatus(labels.deletedList);
    } catch (error) {
      showStatus(formatError(error), true);
    }
  }

  async function toggleCurrentListCompleted() {
    if (!currentUser || !activeList?.id) return;

    try {
      saveFeedback.saving();
      const nextStatus = activeList.status === 'completed' ? 'active' : 'completed';
      await updateShoppingListStatus(await getFirebaseServices(), {
        listId: activeList.id,
        userId: currentUser.uid,
        status: nextStatus,
      });
      activeList = { ...activeList, status: nextStatus };
      currentLists = currentLists.map((list) => (list.id === activeList?.id ? { ...list, status: nextStatus } : list));
      renderSavedLists();
      renderDetail();
      showStatus(nextStatus === 'completed' ? labels.completedList : labels.reopenedList);
    } catch (error) {
      showStatus(formatError(error), true);
    }
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
        const refreshedActive = activeList ? lists.find((list) => list.id === activeList?.id) : null;
        if (refreshedActive && !draftDirty) {
          activeList = refreshedActive;
          draftItems = groupShoppingItems(refreshedActive.items);
          renderDetail();
        }
        if (activeList && !refreshedActive) {
          activeList = null;
          draftItems = [];
          draftDirty = false;
          renderDetail();
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
    savedLists?.addEventListener('click', (event) => {
      const deleteButton = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-delete-list]');
      if (deleteButton?.dataset.deleteList) {
        deleteCurrentList(deleteButton.dataset.deleteList, deleteButton).catch((error) => showStatus(formatError(error), true));
        return;
      }

      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-open-list]');
      const listId = button?.dataset.openList;
      const list = currentLists.find((entry) => entry.id === listId);
      if (!button || !list) return;
      openList(list);
    });
    detail?.addEventListener('click', (event) => {
      const removeButton = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-remove-item]');
      const removeItemId = removeButton?.closest<HTMLElement>('[data-item-id]')?.dataset.itemId;
      if (removeButton && removeItemId) {
        removeItem(removeItemId);
        return;
      }

      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-set-status]');
      const itemId = button?.closest<HTMLElement>('[data-item-id]')?.dataset.itemId;
      const nextStatus = button?.dataset.setStatus as ShoppingItem['status'] | undefined;
      if (!button || !itemId || !nextStatus) return;
      updateItemStatus(itemId, nextStatus);
    });
    saveButton?.addEventListener('click', () => {
      saveCurrentList().catch((error) => showStatus(formatError(error), true));
    });
    createListForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!currentUser) return;
      const formData = new FormData(createListForm);
      createManualList(String(formData.get('title') ?? ''));
      createListForm.reset();
    });
    addItemForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(addItemForm);
      const name = String(formData.get('name') ?? '').trim();
      if (!name) return;
      addManualItem(name, String(formData.get('quantity') ?? ''));
      addItemForm.reset();
      addItemForm.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    });
    root.querySelector('[data-back-to-lists]')?.addEventListener('click', () => {
      workspace?.setAttribute('data-view', 'index');
    });
    completeButton?.addEventListener('click', () => {
      toggleCurrentListCompleted().catch((error) => showStatus(formatError(error), true));
    });
    deleteActiveButton?.addEventListener('click', () => {
      if (!activeList?.id) return;
      deleteCurrentList(activeList.id, deleteActiveButton).catch((error) => showStatus(formatError(error), true));
    });
    shareButton?.addEventListener('click', () => {
      shareCurrentList().catch((error) => showStatus(formatError(error), true));
    });
  }

  attachEvents();

  if (!hasFirebaseConfig()) {
    loading?.setAttribute('hidden', 'hidden');
    authPanel?.removeAttribute('hidden');
    showStatus(labels.configMissing, true);
  } else {
    getFirebaseServices()
      .then((services) => {
        services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
          currentUser = user;
          if (!user) {
            setAuthenticated(false);
            return;
          }

          setAuthenticated(true);
          await ensureUserProfile(services, user, labels.guestSession);

          unsubscribeProfile?.();
          unsubscribeProfile = watchUserProfile(
            services,
            user,
            labels.guestSession,
            (profile) => {
              currentProfile = profile;
              resubscribeShoppingLists(services);
            },
            (error) => showStatus(formatError(error), true)
          );
        });
      })
      .catch((error: Error) => showStatus(error.message, true));
  }

  renderSavedLists();
  renderDetail();
  updateToolbarState();
}
