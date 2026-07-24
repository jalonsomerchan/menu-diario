import { getFirebaseServices } from '../lib/firebase/client';
import { deleteShoppingList } from '../lib/shopping/repository';
import { createConfirmDialog } from '../lib/ui/confirm-dialog';
import { createSaveFeedback } from '../lib/ui/save-feedback';

const root = document.querySelector<HTMLElement>('[data-shopping-app]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const status = root.querySelector<HTMLElement>('[data-status]');
  const savedLists = root.querySelector<HTMLElement>('[data-saved-lists]');
  const newListButton = root.querySelector<HTMLButtonElement>('[data-new-list]');
  const confirmDialogElement = root.querySelector<HTMLDialogElement>('[data-confirm-dialog]');
  const confirmDialog = confirmDialogElement ? createConfirmDialog(confirmDialogElement) : null;
  const saveFeedback = createSaveFeedback(status, {
    pending: labels.savePending,
    saving: labels.saveSaving,
    saved: labels.saveSaved,
  });

  const copy = {
    deleteList: labels.deleteList,
    deleteConfirmTitle: labels.deleteListConfirmTitle,
    deleteConfirm: labels.deleteListConfirm,
    confirmCancel: labels.confirmCancel,
    deleted: labels.deletedList,
    newList: labels.newList,
  };

  function getPermissionSafeMessage(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return message.toLowerCase().includes('permission') ? labels.permissionsError : message;
  }

  function createDeleteButton(listId: string) {
    const button = document.createElement('button');
    button.className = 'button button--ghost button--small shopping-saved-card__delete';
    button.type = 'button';
    button.dataset.deleteList = listId;
    button.textContent = copy.deleteList;
    return button;
  }

  function enhanceSavedLists() {
    if (!savedLists) return;

    savedLists.querySelectorAll<HTMLElement>('.shopping-saved-card').forEach((card) => {
      const listId = card.dataset.listId;
      const head = card.querySelector<HTMLElement>('.shopping-saved-card__head');
      const openButton = card.querySelector<HTMLButtonElement>('[data-open-list]');
      if (!listId || !head || !openButton) return;

      let actions = card.querySelector<HTMLElement>('.shopping-saved-card__actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'shopping-saved-card__actions';
        head.append(actions);
      }

      if (!actions.contains(openButton)) actions.prepend(openButton);
      if (!actions.querySelector('[data-delete-list]')) actions.append(createDeleteButton(listId));
      card.dataset.enhanced = 'true';
    });

    const empty = savedLists.querySelector<HTMLElement>('.shopping-empty');
    if (empty && !savedLists.querySelector('[data-create-empty-list]')) {
      const button = document.createElement('button');
      button.className = 'button button--primary button--small shopping-empty__action';
      button.type = 'button';
      button.dataset.createEmptyList = 'true';
      button.textContent = copy.newList;
      empty.insertAdjacentElement('afterend', button);
    }
  }

  savedLists?.addEventListener('click', async (event) => {
    const createButton = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-create-empty-list]');
    if (createButton) {
      newListButton?.click();
      return;
    }

    const deleteButton = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-delete-list]');
    const listId = deleteButton?.dataset.deleteList;
    if (!deleteButton || !listId) return;

    const confirmed = await confirmDialog?.open({
      title: copy.deleteConfirmTitle,
      description: copy.deleteConfirm,
      confirmLabel: copy.deleteList,
      cancelLabel: copy.confirmCancel,
      confirmVariant: 'danger',
      returnFocusTo: deleteButton,
    });
    if (!confirmed) return;

    try {
      deleteButton.disabled = true;
      saveFeedback.saving();
      const services = await getFirebaseServices();
      await deleteShoppingList(services, listId);
      saveFeedback.info(copy.deleted);
      newListButton?.click();
    } catch (error) {
      saveFeedback.error(getPermissionSafeMessage(error) || labels.permissionsError);
      deleteButton.disabled = false;
    }
  });

  if (savedLists) {
    const observer = new MutationObserver(enhanceSavedLists);
    observer.observe(savedLists, { childList: true, subtree: true });
  }

  enhanceSavedLists();
  window.requestAnimationFrame(enhanceSavedLists);
  window.setTimeout(enhanceSavedLists, 250);
  window.setTimeout(enhanceSavedLists, 1000);
}
