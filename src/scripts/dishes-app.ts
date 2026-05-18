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
    nameInput.focus();
    saveFeedback.saved(labels.added);
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
        form?.addEventListener('submit', (event) => {
          event.preventDefault();
          submitNewDish(services).catch((error: Error) => showStatus(errorMessage(error), true));
        });

        searchInput?.addEventListener('input', renderDishes);
        sortSelect?.addEventListener('change', renderDishes);
        filterSelect?.addEventListener('change', renderDishes);
        tagFilterSelect?.addEventListener('change', renderDishes);

        editorDialog?.addEventListener('close', () => {
          editorDishId = null;
          editorBody && (editorBody.innerHTML = '');
          returnFocusTo?.focus();
          returnFocusTo = null;
        });

        editorDialog?.addEventListener('click', (event) => {
          if (event.target === editorDialog) closeEditor();
        });

        cancelEditorButton?.addEventListener('click', () => closeEditor());

        list?.addEventListener('click', (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;

          const card = target.closest<HTMLElement>('[data-dish-id]');
          const dish = findDishById(card?.dataset.dishId);
          if (!card || !dish) return;

          if (target.closest('[data-toggle-favorite]')) {
            saveFavoritePreference(services, dish, !dish.favorite).catch((error: Error) => showStatus(errorMessage(error), true));
            return;
          }

          const editButton = target.closest<HTMLElement>('[data-edit-dish]');
          if (editButton) openEditor(dish, editButton);
        });

        editorBody?.addEventListener('click', (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement) || !editorDishId) return;
          const dish = findDishById(editorDishId);
          if (!dish || !getDishEditorState(dish).canEditQuickTags) return;

          const addedTag = target.closest<HTMLElement>('[data-add-quick-tag]')?.dataset.addQuickTag;
          const removedTag = target.closest<HTMLElement>('[data-remove-quick-tag]')?.dataset.removeQuickTag;
          if (!addedTag && !removedTag) return;

          const draft = getEditorDraft(dish);
          draft.quickTags = getNextQuickTags({ ...dish, quickTags: draft.quickTags }, addedTag ?? removedTag ?? '', Boolean(addedTag));
          syncEditor(dish, draft);
          requestAnimationFrame(() => focusEditor());
        });

        archiveEditorButton?.addEventListener('click', async () => {
          if (!editorDishId) return;
          const dish = findDishById(editorDishId);
          if (!dish) return;

          const confirmed = await confirmArchive(archiveEditorButton);
          if (!confirmed) return;

          saveFeedback.saving();
          archiveDish(services, dish.id)
            .then(() => {
              saveFeedback.saved(labels.archived);
              closeEditor('saved');
            })
            .catch((error: Error) => showStatus(errorMessage(error), true));
        });

        duplicateEditorButton?.addEventListener('click', () => {
          if (!editorDishId || !currentUser) return;
          const dish = findDishById(editorDishId);
          if (!dish) return;

          saveFeedback.saving();
          duplicateGlobalDish(services, currentUser.uid, dish, currentProfile?.groupId)
            .then(() => {
              saveFeedback.saved(labels.duplicated);
              closeEditor('saved');
            })
            .catch((error: Error) => showStatus(errorMessage(error), true));
        });

        editorForm?.addEventListener('submit', (event) => {
          event.preventDefault();
          if (!editorDishId || !currentUser) return;
          const dish = findDishById(editorDishId);
          if (!dish) return;

          const state = getDishEditorState(dish);
          if (!state.canEdit) {
            showStatus(labels.notEditable, true);
            return;
          }

          const draft = getEditorDraft(dish);
          const nextName = draft.name.trim().replace(/\s+/g, ' ');
          const nextFavorite = draft.favorite;
          const nextBlocked = draft.blocked;
          const nextQuickTags = draft.quickTags;

          const changed =
            nextName !== dish.name.trim() ||
            nextFavorite !== Boolean(dish.favorite) ||
            nextBlocked !== Boolean(dish.blocked) ||
            !hasSameQuickTags(nextQuickTags, dish.quickTags ?? []);

          if (!changed) {
            closeEditor('cancel');
            saveFeedback.saved();
            return;
          }

          saveFeedback.saving();
          saveDishEdits(services, currentUser.uid, dish, {
            name: nextName,
            favorite: nextFavorite,
            blocked: nextBlocked,
            quickTags: nextQuickTags,
          })
            .then(() => {
              saveFeedback.saved(labels.updated);
              closeEditor('saved');
            })
            .catch((error: Error) => showStatus(errorMessage(error), true));
        });

        services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
          currentUser = user;
          unsubscribeDishes?.();
          unsubscribeProfile?.();

          if (!user) {
            window.location.assign(labels.homePath || '/');
            return;
          }

          await ensureUserProfile(services, user, labels.guestSession ?? labels.configMissing);
          unsubscribeProfile = watchUserProfile(
            services,
            user,
            labels.guestSession ?? labels.configMissing,
            (profile) => {
              currentProfile = profile;
              unsubscribeDishes?.();
              unsubscribeDishes = watchUserDishes(
                services,
                user.uid,
                (nextDishes) => {
                  dishes = nextDishes;
                  setVisible(true);
                  renderDishes();
                  syncOpenEditor();
                },
                (error) => showStatus(errorMessage(error), true),
                false,
                profile.groupId
              );
            },
            (error) => showStatus(errorMessage(error), true)
          );
        });
      })
      .catch((error: Error) => showStatus(errorMessage(error), true));
  }
}
