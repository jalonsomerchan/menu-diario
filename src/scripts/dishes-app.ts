import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { archiveDish, createManualDish, duplicateGlobalDish, saveDishEdits, updateDishPreferences, watchUserDishes } from '../lib/dishes/repository';
import { getDishEditorState, getNextQuickTags, hasSameQuickTags } from '../lib/dishes/editor-state.mjs';
import { filterDishes, isEditableDish, sortDishes } from '../lib/dishes/helpers.mjs';
import { renderCompactDishRow, renderDishEditorBody } from '../lib/dishes/render.mjs';
import { formatAppError } from '../lib/errors';
import { ensureUserProfile, watchUserProfile } from '../lib/menu/repository';
import { createConfirmDialog } from '../lib/ui/confirm-dialog';
import { createSaveFeedback } from '../lib/ui/save-feedback';
import type { Dish, FirebaseUser, UserProfile } from '../lib/menu/types';

type DishFilterMode = 'all' | 'favorites' | 'blocked';
type DishSortMode = 'most-used' | 'recent' | 'oldest' | 'name';
type DishEditorDraft = { name: string; favorite: boolean; blocked: boolean; quickTags: string[] };

const root = document.querySelector<HTMLElement>('[data-dishes-app]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, any>;
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const status = root.querySelector<HTMLElement>('[data-status]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const content = root.querySelector<HTMLElement>('[data-content]');
  const form = root.querySelector<HTMLFormElement>('[data-dish-form]');
  const nameInput = root.querySelector<HTMLInputElement>('[data-dish-name]');
  const searchInput = root.querySelector<HTMLInputElement>('[data-dish-search]');
  const sortSelect = root.querySelector<HTMLSelectElement>('[data-dish-sort]');
  const filterSelect = root.querySelector<HTMLSelectElement>('[data-dish-filter]');
  const tagFilterSelect = root.querySelector<HTMLSelectElement>('[data-dish-tag-filter]');
  const list = root.querySelector<HTMLElement>('[data-dishes-list]');
  const confirmDialog = root.querySelector<HTMLDialogElement>('[data-confirm-dialog]');
  const createDialog = root.querySelector<HTMLDialogElement>('[data-dish-create-dialog]');
  const openCreateButton = root.querySelector<HTMLButtonElement>('[data-open-dish-create]');
  const closeCreateButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-close-dish-create]')];
  const editorDialog = root.querySelector<HTMLDialogElement>('[data-dish-editor-dialog]');
  const editorForm = root.querySelector<HTMLFormElement>('[data-dish-editor-form]');
  const editorBody = root.querySelector<HTMLElement>('[data-dish-editor-body]');
  const editorTitle = root.querySelector<HTMLElement>('[data-dish-editor-title]');
  const editorEyebrow = root.querySelector<HTMLElement>('[data-dish-editor-eyebrow]');
  const editorDescription = root.querySelector<HTMLElement>('[data-dish-editor-description]');
  const cancelEditorButton = root.querySelector<HTMLButtonElement>('[data-dish-editor-cancel]');
  const archiveEditorButton = root.querySelector<HTMLButtonElement>('[data-dish-editor-archive]');
  const duplicateEditorButton = root.querySelector<HTMLButtonElement>('[data-dish-editor-duplicate]');
  const saveEditorButton = root.querySelector<HTMLButtonElement>('[data-dish-editor-save]');

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let dishes: Dish[] = [];
  let unsubscribeDishes: (() => void) | undefined;
  let unsubscribeProfile: (() => void) | undefined;
  let editorDishId: string | null = null;
  let returnFocusTo: HTMLElement | null = null;
  const archiveConfirmation = confirmDialog ? createConfirmDialog(confirmDialog) : null;
  const saveFeedback = createSaveFeedback(status, {
    pending: labels.savePending,
    saving: labels.saveSaving,
    saved: labels.saveSaved,
  });

  function escapeHtml(value = '') {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function showStatus(message: string, isError = false) {
    if (isError) {
      saveFeedback.error(message);
      return;
    }
    saveFeedback.info(message);
  }

  function setVisible(isReady: boolean) {
    if (loading) loading.hidden = isReady;
    if (content) content.hidden = !isReady;
  }

  function formatDate(date?: Date) {
    if (!date) return '';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
  }

  function getVisibleDishes() {
    const filtered = filterDishes(dishes, searchInput?.value ?? '', {
      mode: (filterSelect?.value as DishFilterMode) ?? 'all',
      tag: tagFilterSelect?.value ?? '',
    }) as Dish[];
    return sortDishes(filtered, (sortSelect?.value as DishSortMode) ?? 'most-used') as Dish[];
  }

  function findDishById(dishId?: string | null) {
    return dishes.find((dish) => dish.id === dishId);
  }

  function renderEmpty() {
    const hasSearch = Boolean(searchInput?.value.trim()) || Boolean(tagFilterSelect?.value) || filterSelect?.value !== 'all';
    const title = hasSearch ? labels.emptySearch : labels.empty;
    const hint = hasSearch ? '' : `<p>${escapeHtml(labels.emptyHint)}</p>`;
    return `<article class="app-panel dishes-empty"><h2>${escapeHtml(title)}</h2>${hint}</article>`;
  }

  function renderDishes() {
    if (!list) return;
    const visibleDishes = getVisibleDishes();
    list.innerHTML = visibleDishes.length ? visibleDishes.map((dish) => renderCompactDishRow(dish, labels)).join('') : renderEmpty();
  }

  function getEditorDraft(dish: Dish): DishEditorDraft {
    const nameField = editorForm?.querySelector<HTMLInputElement>('input[name="name"]');
    const favoriteField = editorForm?.querySelector<HTMLInputElement>('input[name="favorite"]');
    const blockedField = editorForm?.querySelector<HTMLInputElement>('input[name="blocked"]');
    const quickTags = Array.from(editorForm?.querySelectorAll<HTMLElement>('[data-remove-quick-tag]') ?? []).map(
      (button) => button.dataset.removeQuickTag ?? ''
    );

    return {
      name: nameField?.value ?? dish.name,
      favorite: favoriteField?.checked ?? Boolean(dish.favorite),
      blocked: blockedField?.checked ?? Boolean(dish.blocked),
      quickTags,
    };
  }

  function focusEditor() {
    const initialFocus =
      editorDialog?.querySelector<HTMLElement>('[data-editor-initial-focus]') ??
      (duplicateEditorButton?.hidden ? cancelEditorButton : duplicateEditorButton);
    initialFocus?.focus();
  }

  function syncEditor(dish: Dish, draft?: DishEditorDraft) {
    if (!editorBody || !editorTitle || !editorDescription || !saveEditorButton || !archiveEditorButton || !duplicateEditorButton || !editorEyebrow) return;

    const state = getDishEditorState(dish);
    editorBody.innerHTML = renderDishEditorBody(dish, labels, formatDate, draft);
    editorTitle.textContent = labels.editTitle.replace('{dish}', dish.name);
    editorEyebrow.textContent = dish.isGlobal ? labels.globalBadge : labels.groupBadge;
    editorDescription.textContent = state.canEdit ? labels.editableHint : state.isReadOnlyGlobal ? labels.globalReadOnlyModal : labels.notEditable;
    saveEditorButton.hidden = !state.canEdit;
    archiveEditorButton.hidden = !state.canArchive;
    duplicateEditorButton.hidden = !state.canDuplicate;
  }

  function closeEditor(result = 'cancel') {
    editorDialog?.close(result);
  }

  function openEditor(dish: Dish, trigger?: HTMLElement | null) {
    if (!editorDialog) return;
    editorDishId = dish.id;
    returnFocusTo = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    syncEditor(dish);
    editorDialog.showModal();
    requestAnimationFrame(() => focusEditor());
  }

  function closeCreate(result = 'cancel') {
    createDialog?.close(result);
  }

  function openCreate() {
    if (!createDialog || !nameInput) return;
    form?.reset();
    returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    createDialog.showModal();
    requestAnimationFrame(() => nameInput.focus());
  }

  function syncOpenEditor() {
    if (!editorDialog?.open || !editorDishId) return;
    const dish = findDishById(editorDishId);
    if (!dish || dish.archived) {
      closeEditor('saved');
      return;
    }
    syncEditor(dish, getEditorDraft(dish));
  }

  function errorMessage(error: unknown) {
    return formatAppError(error, labels);
  }

  async function submitNewDish(services: Awaited<ReturnType<typeof getFirebaseServices>>) {
    if (!currentUser || !nameInput) return;
    saveFeedback.saving();
    await createManualDish(services, currentUser.uid, nameInput.value, currentProfile?.groupId);
    nameInput.value = '';
    saveFeedback.saved(labels.added);
    closeCreate('created');
  }

  async function confirmArchive(button: HTMLButtonElement) {
    if (!archiveConfirmation) return false;
    return archiveConfirmation.open({
      eyebrow: labels.archive,
      title: labels.confirmArchiveTitle,
      description: labels.confirmArchiveDescription,
      confirmLabel: labels.confirmArchiveConfirm,
      cancelLabel: labels.confirmArchiveCancel,
      confirmVariant: 'danger',
      returnFocusTo: button,
    });
  }

  async function saveFavoritePreference(services: Awaited<ReturnType<typeof getFirebaseServices>>, dish: Dish, favorite: boolean) {
    if (!isEditableDish(dish)) {
      showStatus(labels.notEditable, true);
      return;
    }
    if (favorite === Boolean(dish.favorite)) {
      saveFeedback.saved();
      return;
    }
    saveFeedback.saving();
    await updateDishPreferences(services, dish.id, { favorite });
    saveFeedback.saved(labels.preferencesUpdated);
  }

  if (!hasFirebaseConfig()) {
    setVisible(false);
    showStatus(labels.firebaseMissing || labels.configMissing, true);
  } else {
    getFirebaseServices()
      .then((services) => {
        openCreateButton?.addEventListener('click', openCreate);
        closeCreateButtons.forEach((button) => button.addEventListener('click', () => closeCreate()));
        createDialog?.addEventListener('close', () => {
          returnFocusTo?.focus();
          returnFocusTo = null;
        });

        form?.addEventListener('submit', (event) => {
          event.preventDefault();
          submitNewDish(services).catch((error: Error) => showStatus(errorMessage(error), true));
        });

        searchInput?.addEventListener('input', renderDishes);
        sortSelect?.addEventListener('change', renderDishes);
        filterSelect?.addEventListener('change', renderDishes);
        tagFilterSelect?.addEventListener('change', renderDishes);

        editorDialog?.addEventListener('close', () => {
          if (editorDialog.returnValue !== 'saved') {
            returnFocusTo?.focus();
          }
          editorDishId = null;
          returnFocusTo = null;
        });

        cancelEditorButton?.addEventListener('click', () => closeEditor());
        editorForm?.addEventListener('input', () => {
          const dish = findDishById(editorDishId);
          if (!dish || !saveEditorButton) return;
          saveEditorButton.disabled = hasSameQuickTags(dish, getEditorDraft(dish).quickTags);
        });

        editorForm?.addEventListener('click', (event) => {
          const target = event.target instanceof HTMLElement ? event.target : null;
          const removeButton = target?.closest<HTMLButtonElement>('[data-remove-quick-tag]');
          const addButton = target?.closest<HTMLButtonElement>('[data-add-quick-tag]');

          if (!removeButton && !addButton) return;
          event.preventDefault();
          const dish = findDishById(editorDishId);
          if (!dish) return;

          const draft = getEditorDraft(dish);
          if (removeButton) {
            draft.quickTags = draft.quickTags.filter((tag) => tag !== removeButton.dataset.removeQuickTag);
          }
          if (addButton?.dataset.addQuickTag) {
            draft.quickTags = [...new Set([...draft.quickTags, addButton.dataset.addQuickTag])];
          }
          syncEditor(dish, draft);
          saveEditorButton && (saveEditorButton.disabled = hasSameQuickTags(dish, draft.quickTags));
        });

        saveEditorButton?.addEventListener('click', () => {
          const dish = findDishById(editorDishId);
          if (!dish) return;
          saveFeedback.saving();
          saveDishEdits(services, dish, getEditorDraft(dish))
            .then(() => {
              closeEditor('saved');
              saveFeedback.saved(labels.updated);
            })
            .catch((error: Error) => showStatus(errorMessage(error), true));
        });

        duplicateEditorButton?.addEventListener('click', () => {
          const dish = findDishById(editorDishId);
          if (!dish || !currentUser) return;
          saveFeedback.saving();
          duplicateGlobalDish(services, dish, currentUser.uid, currentProfile?.groupId)
            .then(() => {
              closeEditor('saved');
              saveFeedback.saved(labels.duplicated);
            })
            .catch((error: Error) => showStatus(errorMessage(error), true));
        });

        archiveEditorButton?.addEventListener('click', async () => {
          const dish = findDishById(editorDishId);
          if (!dish || !archiveEditorButton) return;
          const confirmed = await confirmArchive(archiveEditorButton);
          if (!confirmed) return;
          saveFeedback.saving();
          archiveDish(services, dish.id)
            .then(() => {
              closeEditor('saved');
              saveFeedback.saved(labels.archived);
            })
            .catch((error: Error) => showStatus(errorMessage(error), true));
        });

        list?.addEventListener('click', (event) => {
          const button = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('[data-edit-dish], [data-toggle-favorite]') : null;
          if (!button) return;
          const row = button.closest<HTMLElement>('[data-dish-id]');
          const dish = findDishById(row?.dataset.dishId);
          if (!dish) return;
          if (button.matches('[data-toggle-favorite]')) {
            saveFavoritePreference(services, dish, !Boolean(dish.favorite)).catch((error: Error) => showStatus(errorMessage(error), true));
            return;
          }
          openEditor(dish, button);
        });

        watchUserProfile((profile) => {
          currentUser = profile.user;
          currentProfile = profile.profile;
        })
          .then((unsubscribe) => {
            unsubscribeProfile = unsubscribe;
          })
          .catch((error: Error) => showStatus(errorMessage(error), true));

        ensureUserProfile()
          .then(({ user }) => {
            currentUser = user;
            unsubscribeDishes = watchUserDishes(user.uid, (items) => {
              dishes = items;
              renderDishes();
              syncOpenEditor();
              setVisible(true);
            });
          })
          .catch((error: Error) => {
            setVisible(false);
            showStatus(errorMessage(error), true);
          });
      })
      .catch((error: Error) => {
        setVisible(false);
        showStatus(errorMessage(error), true);
      });
  }

  window.addEventListener('beforeunload', () => {
    unsubscribeDishes?.();
    unsubscribeProfile?.();
  });
}
