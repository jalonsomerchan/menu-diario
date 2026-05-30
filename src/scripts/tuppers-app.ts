import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { watchUserDishes } from '../lib/dishes/repository';
import { createConfirmDialog } from '../lib/ui/confirm-dialog';
import { installDetailsMenuAutoClose } from '../lib/ui/details-menu';
import { toIsoDate } from '../lib/menu/dates';
import { watchUserProfile } from '../lib/menu/repository';
import type { Dish, FirebaseUser, MealSlot, UserProfile } from '../lib/menu/types';
import { getTupperExpiryState } from '../lib/tuppers/expiry';
import { filterTuppers, nextTupperLocation, nextTupperStatus, shouldShowExpiryWarning } from '../lib/tuppers/state';
import {
  assignTupperToMeal,
  createTupper,
  getDishOptions,
  removeTupperFromMeal,
  updateTupper,
  updateTupperState,
  watchTuppers,
} from '../lib/tuppers/repository';
import type { TupperFilter, TupperItem, TupperLocation } from '../lib/tuppers/types';

const root = document.querySelector<HTMLElement>('[data-tuppers-app]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const status = root.querySelector<HTMLElement>('[data-status]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const content = root.querySelector<HTMLElement>('[data-content]');
  const createDialog = root.querySelector<HTMLDialogElement>('[data-create-dialog]');
  const openCreateButton = root.querySelector<HTMLButtonElement>('[data-open-create]');
  const form = root.querySelector<HTMLFormElement>('[data-tupper-form]');
  const dialogTitle = root.querySelector<HTMLElement>('[data-dialog-title]');
  const dialogDescription = root.querySelector<HTMLElement>('[data-dialog-description]');
  const submitLabel = root.querySelector<HTMLButtonElement>('[data-submit-label]');
  const dishSelect = root.querySelector<HTMLSelectElement>('[data-dish-select]');
  const nameInput = root.querySelector<HTMLInputElement>('[data-name]');
  const preparedInput = root.querySelector<HTMLInputElement>('[data-prepared]');
  const expiresInput = root.querySelector<HTMLInputElement>('[data-expires]');
  const portionsInput = root.querySelector<HTMLInputElement>('[data-portions]');
  const locationInput = root.querySelector<HTMLSelectElement>('[data-location]');
  const notesInput = root.querySelector<HTMLTextAreaElement>('[data-notes]');
  const list = root.querySelector<HTMLElement>('[data-tupper-list]');
  const filterButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  const expiryAlert = root.querySelector<HTMLElement>('[data-expiry-alert]');
  const confirmDialog = root.querySelector<HTMLDialogElement>('[data-confirm-dialog]');
  const closeCreateButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-close-create]')];
  const dateFormatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentFilter: TupperFilter = 'all';
  let tuppers: TupperItem[] = [];
  let dishes: Dish[] = [];
  let unsubscribeTuppers: (() => void) | undefined;
  let unsubscribeDishes: (() => void) | undefined;
  let unsubscribeProfile: (() => void) | undefined;
  let firebaseServices: Awaited<ReturnType<typeof getFirebaseServices>> | undefined;
  let editingTupper: TupperItem | null = null;
  const assignmentConfirmation = confirmDialog ? createConfirmDialog(confirmDialog) : null;

  const today = toIsoDate(new Date());
  resetCreateForm();
  installDetailsMenuAutoClose(root);

  function escapeHtml(value = '') {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function showStatus(message: string, isError = false) {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.dataset.variant = isError ? 'error' : 'info';
  }

  function resetCreateForm() {
    editingTupper = null;
    form?.reset();
    if (dialogTitle) dialogTitle.textContent = labels.createTitle;
    if (dialogDescription) dialogDescription.textContent = labels.createDescription;
    if (submitLabel) submitLabel.textContent = labels.create;
    if (preparedInput) preparedInput.value = today;
    if (expiresInput) expiresInput.value = today;
  }

  function openEditForm(tupper: TupperItem) {
    editingTupper = tupper;
    form?.reset();
    if (dialogTitle) dialogTitle.textContent = labels.editTitle;
    if (dialogDescription) dialogDescription.textContent = labels.editDescription;
    if (submitLabel) submitLabel.textContent = labels.update;
    if (dishSelect) dishSelect.value = tupper.dishId ?? '';
    if (nameInput) nameInput.value = tupper.name;
    if (preparedInput) preparedInput.value = tupper.preparedAt;
    if (expiresInput) expiresInput.value = tupper.expiresAt;
    if (portionsInput) portionsInput.value = tupper.portions ? String(tupper.portions) : '';
    if (locationInput) locationInput.value = tupper.location || 'fridge';
    if (notesInput) notesInput.value = tupper.notes;
    createDialog?.showModal();
  }

  function setReady() {
    if (loading) loading.hidden = true;
    if (content) content.hidden = false;
  }

  function resubscribeTuppers() {
    if (!firebaseServices || !currentUser) return;
    unsubscribeTuppers?.();
    unsubscribeTuppers = watchTuppers(
      firebaseServices,
      currentUser.uid,
      currentProfile?.groupId,
      (nextTuppers) => {
        tuppers = nextTuppers;
        setReady();
        render();
      },
      (error) => showStatus(error.message, true)
    );
  }

  function resubscribeDishes() {
    if (!firebaseServices || !currentUser) return;
    unsubscribeDishes?.();
    unsubscribeDishes = watchUserDishes(
      firebaseServices,
      currentUser.uid,
      (nextDishes) => {
        dishes = nextDishes;
        renderDishes();
      },
      (error) => showStatus(error.message, true),
      false,
      currentProfile?.groupId
    );
  }

  function formatDate(isoDate: string) {
    return dateFormatter.format(new Date(`${isoDate}T00:00:00`));
  }

  function getNextTargets() {
    const meals: MealSlot[] = currentProfile?.enabledMeals?.length ? currentProfile.enabledMeals : ['lunch'];
    return Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + dayIndex + 1);
      const dayKey = toIsoDate(date);
      return meals.map((meal) => ({ dayKey, meal, label: `${formatDate(dayKey)} · ${labels[meal] ?? meal}` }));
    }).flat();
  }

  function renderDishes() {
    if (!dishSelect) return;
    const options = getDishOptions(dishes)
      .map((dish) => `<option value="${escapeHtml(dish.id)}" data-name="${escapeHtml(dish.name)}">${escapeHtml(dish.name)}</option>`)
      .join('');
    dishSelect.innerHTML = `<option value="">${escapeHtml(labels.freeTextDish)}</option>${options}`;
  }

  function render() {
    if (!list) return;
    const visibleTuppers = filterTuppers(tuppers, currentFilter);

    if (expiryAlert) expiryAlert.hidden = !shouldShowExpiryWarning(tuppers);

    if (!visibleTuppers.length) {
      list.innerHTML = `<p class="menu-list__empty">${escapeHtml(labels.empty)}</p>`;
      return;
    }

    const targets = getNextTargets();
    list.innerHTML = visibleTuppers.map((tupper) => renderTupperCard(tupper, targets)).join('');
  }

  function renderTupperCard(tupper: TupperItem, targets: ReturnType<typeof getNextTargets>) {
    const state = getTupperExpiryState(tupper);
    const stateLabel = labels[state] ?? state;
    const canAssign = tupper.status === 'active' || tupper.status === 'assigned';
    const locationLabel =
      tupper.location === 'freezer'
        ? labels.locationFreezer
        : tupper.location === 'fridge'
          ? labels.locationFridge
          : labels.locationOther;
    const targetOptions = targets
      .map((target) => {
        const value = `${target.dayKey}|${target.meal}`;
        const isSelected = tupper.assignedDay === target.dayKey && tupper.assignedMeal === target.meal;
        return `<option value="${value}" ${isSelected ? 'selected' : ''}>${escapeHtml(target.label)}</option>`;
      })
      .join('');
    const menuActionButtons = [
      `<button type="button" data-action="edit">${escapeHtml(labels.edit)}</button>`,
      canAssign ? `<button type="button" data-action="consume">${escapeHtml(labels.consume)}</button>` : '',
      canAssign
        ? `<button type="button" data-action="${tupper.location === 'freezer' ? 'defrost' : 'freeze'}">${escapeHtml(
            tupper.location === 'freezer' ? labels.defrost : labels.freeze
          )}</button>`
        : '',
      tupper.status === 'assigned'
        ? `<button type="button" data-action="unassign">${escapeHtml(labels.unassign)}</button>`
        : '',
      canAssign ? `<button type="button" data-action="discard">${escapeHtml(labels.discard)}</button>` : '',
      tupper.status !== 'archived' ? `<button type="button" data-action="archive">${escapeHtml(labels.archive)}</button>` : '',
    ]
      .filter(Boolean)
      .join('');
    const actionsMenu = `<details class="tupper-card__menu" data-details-menu>
      <summary aria-label="${escapeHtml(labels.moreActions)}"><span aria-hidden="true">&#8943;</span></summary>
      <div class="tupper-card__menu-list">${menuActionButtons}</div>
    </details>`;

    return `
      <article class="tupper-card tupper-card--${escapeHtml(state)}" data-tupper-id="${escapeHtml(tupper.id)}">
        <header>
          <div class="tupper-card__topline">
            <div class="tupper-card__meta">
              <p class="menu-app__eyebrow">${escapeHtml(stateLabel)}</p>
              <span class="tupper-card__location">${escapeHtml(locationLabel)}</span>
            </div>
            ${actionsMenu}
          </div>
          <div class="tupper-card__title">
            <h3>${escapeHtml(tupper.name)}</h3>
          </div>
        </header>
        ${
          tupper.status === 'assigned'
            ? `<p class="tupper-card__assignment">${escapeHtml(formatAssignmentLabel(tupper))}</p>`
            : ''
        }
        <dl>
          <div><dt>${escapeHtml(labels.preparedAt)}</dt><dd>${escapeHtml(formatDate(tupper.preparedAt))}</dd></div>
          <div><dt>${escapeHtml(labels.expiresAt)}</dt><dd>${escapeHtml(formatDate(tupper.expiresAt))}</dd></div>
          ${tupper.portions ? `<div><dt>${escapeHtml(labels.portions)}</dt><dd>${tupper.portions}</dd></div>` : ''}
        </dl>
        ${tupper.notes ? `<p class="tupper-card__notes">${escapeHtml(tupper.notes)}</p>` : ''}
        ${
          canAssign
            ? `<form class="tupper-assign" data-assign-form>
          <label>
            <span>${escapeHtml(labels.assignDay)}</span>
            <select data-assign-target>${targetOptions}</select>
          </label>
          <button class="button button--primary button--small" type="submit">
            ${escapeHtml(tupper.status === 'assigned' ? labels.reassign : labels.assign)}
          </button>
        </form>`
            : ''
        }
      </article>
    `;
  }

  function actionMessage(action: string) {
    if (action === 'edit') return labels.updated;
    if (action === 'unassign') return labels.unassigned;
    if (action === 'consume') return labels.consumed;
    if (action === 'discard') return labels.discarded;
    if (action === 'freeze') return labels.frozen;
    if (action === 'defrost') return labels.defrosted;
    if (action === 'archive') return labels.archived;

    return labels.created;
  }

  function formatTargetLabel(dayKey: string, meal: MealSlot) {
    return `${formatDate(dayKey)} · ${labels[meal] ?? meal}`;
  }

  function formatAssignmentLabel(tupper: TupperItem) {
    if (!tupper.assignedDay || !tupper.assignedMeal) return '';
    return `${labels.assignedTo}: ${formatTargetLabel(tupper.assignedDay, tupper.assignedMeal)}`;
  }

  function formatError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'assignment-already-same') return labels.alreadyAssigned;
    if (message === 'day-skipped') return labels.assignmentBlockedDay;
    if (message === 'meal-skipped') return labels.assignmentBlockedMeal;
    if (message === 'already-in-meal') return labels.assignmentBlockedDuplicate;
    if (message === 'meal-has-items') return labels.assignmentBlocked;
    return message || labels.assignmentBlocked;
  }

  async function openAssignmentConfirm(
    mode: 'append' | 'move' | 'unassign' | 'discard' | 'archive',
    returnFocusTo?: HTMLElement | null
  ) {
    if (!assignmentConfirmation) {
      return false;
    }

    if (mode === 'append') {
      return assignmentConfirmation.open({
        eyebrow: labels.assign,
        title: labels.appendConfirmTitle,
        description: labels.appendConfirm,
        confirmLabel: labels.assign,
        cancelLabel: labels.cancel,
        confirmVariant: 'primary',
        returnFocusTo,
        initialFocus: 'cancel',
      });
    }

    if (mode === 'move') {
      return assignmentConfirmation.open({
        eyebrow: labels.reassign,
        title: labels.moveConfirmTitle,
        description: labels.moveConfirm,
        confirmLabel: labels.reassign,
        cancelLabel: labels.cancel,
        confirmVariant: 'primary',
        returnFocusTo,
        initialFocus: 'cancel',
      });
    }

    if (mode === 'unassign') {
      return assignmentConfirmation.open({
        eyebrow: labels.unassign,
        title: labels.unassignConfirmTitle,
        description: labels.unassignConfirm,
        confirmLabel: labels.unassign,
        cancelLabel: labels.cancel,
        confirmVariant: 'danger',
        returnFocusTo,
        initialFocus: 'cancel',
      });
    }

    if (mode === 'discard') {
      return assignmentConfirmation.open({
        eyebrow: labels.discard,
        title: labels.discardConfirmTitle,
        description: labels.discardConfirm,
        confirmLabel: labels.discard,
        cancelLabel: labels.cancel,
        confirmVariant: 'danger',
        returnFocusTo,
        initialFocus: 'cancel',
      });
    }

    return assignmentConfirmation.open({
      eyebrow: labels.archive,
      title: labels.archiveConfirmTitle,
      description: labels.archiveConfirm,
      confirmLabel: labels.archive,
      cancelLabel: labels.cancel,
      confirmVariant: 'danger',
      returnFocusTo,
      initialFocus: 'cancel',
    });
  }

  dishSelect?.addEventListener('change', () => {
    const selected = dishSelect.selectedOptions[0];
    if (selected?.dataset.name && nameInput) nameInput.value = selected.dataset.name;
  });

  openCreateButton?.addEventListener('click', () => {
    resetCreateForm();
    createDialog?.showModal();
  });

  closeCreateButtons.forEach((button) => {
    button.addEventListener('click', () => createDialog?.close());
  });

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      currentFilter = (button.dataset.filter ?? 'all') as TupperFilter;
      filterButtons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      render();
    });
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentUser || !firebaseServices) return;

    try {
      const formData = {
        name: nameInput?.value ?? '',
        dishId: dishSelect?.value || undefined,
        preparedAt: preparedInput?.value ?? '',
        expiresAt: expiresInput?.value ?? '',
        portions: portionsInput?.value ? Number(portionsInput.value) : undefined,
        location: (locationInput?.value ?? 'fridge') as TupperLocation,
        notes: notesInput?.value ?? '',
      };

      if (editingTupper) {
        await updateTupper(firebaseServices, currentUser, editingTupper, formData);
        showStatus(labels.updated);
      } else {
        await createTupper(firebaseServices, currentUser, currentProfile, formData);
        showStatus(labels.created);
      }
      resetCreateForm();
      createDialog?.close();
    } catch (error) {
      showStatus(formatError(error), true);
    }
  });

  list?.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
    if (!button || !firebaseServices) return;
    const tupper = getTupperFromElement(button);
    if (!tupper) return;

    const action = button.dataset.action as 'edit' | 'consume' | 'discard' | 'archive' | 'freeze' | 'defrost' | 'unassign';

    try {
      if (action === 'edit') {
        openEditForm(tupper);
        return;
      }

      if (action === 'unassign') {
        const confirmed = await openAssignmentConfirm('unassign', button);
        if (!confirmed) return;
        await removeTupperFromMeal(firebaseServices, currentUser?.uid ?? tupper.createdBy, tupper);
        showStatus(actionMessage(action));
        return;
      }

      if (action === 'discard') {
        const confirmed = await openAssignmentConfirm('discard', button);
        if (!confirmed) return;
      }

      if (action === 'archive') {
        const confirmed = await openAssignmentConfirm('archive', button);
        if (!confirmed) return;
      }

      await updateTupperState(firebaseServices, tupper, {
        status: nextTupperStatus(tupper.status, action),
        location: nextTupperLocation(tupper.location, action),
      });
      showStatus(actionMessage(action));
    } catch (error) {
      showStatus(formatError(error), true);
    }
  });

  list?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentUser || !firebaseServices) return;
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const tupper = getTupperFromElement(form);
    const target = form.querySelector<HTMLSelectElement>('[data-assign-target]')?.value;
    if (!tupper || !target) return;

    const [dayKey, meal] = target.split('|') as [string, MealSlot];
    const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');

    async function submitAssignment(options: { allowAppend?: boolean; forceMove?: boolean } = {}) {
      await assignTupperToMeal(firebaseServices, currentUser, tupper, {
        dayKey,
        meal,
        locale,
        ...options,
      });
    }

    try {
      await submitAssignment();
      showStatus(labels.assigned);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';

      if (message === 'meal-has-items') {
        const confirmed = await openAssignmentConfirm('append', submitButton);
        if (!confirmed) return;
        await submitAssignment({ allowAppend: true });
        showStatus(labels.assigned);
        return;
      }

      if (message === 'assignment-move-required') {
        const confirmed = await openAssignmentConfirm('move', submitButton);
        if (!confirmed) return;

        try {
          await submitAssignment({ forceMove: true });
          showStatus(labels.assigned);
          return;
        } catch (moveError) {
          const moveMessage = moveError instanceof Error ? moveError.message : '';

          if (moveMessage === 'meal-has-items') {
            const appendConfirmed = await openAssignmentConfirm('append', submitButton);
            if (!appendConfirmed) return;
            await submitAssignment({ forceMove: true, allowAppend: true });
            showStatus(labels.assigned);
            return;
          }

          showStatus(formatError(moveError), true);
          return;
        }
      }

      showStatus(formatError(error), true);
    }
  });

  function getTupperFromElement(element: Element) {
    const id = element.closest<HTMLElement>('[data-tupper-id]')?.dataset.tupperId;
    return tuppers.find((tupper) => tupper.id === id);
  }

  if (!hasFirebaseConfig()) {
    if (loading) loading.hidden = true;
    showStatus(labels.configMissing, true);
  } else {
    getFirebaseServices()
      .then((services) => {
        firebaseServices = services;
        services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
          currentUser = user;
          unsubscribeTuppers?.();
          unsubscribeDishes?.();
          unsubscribeProfile?.();

          if (!user) {
            window.location.assign(labels.dashboardPath || '/');
            return;
          }

          unsubscribeProfile = watchUserProfile(services, user, labels.title, (profile) => {
            currentProfile = profile;
            resubscribeDishes();
            resubscribeTuppers();
            render();
          }, (error) => showStatus(error.message, true));
        });
      })
      .catch((error: Error) => showStatus(error.message, true));
  }
}
