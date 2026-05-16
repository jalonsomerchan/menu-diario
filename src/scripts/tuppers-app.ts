import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { watchUserDishes } from '../lib/dishes/repository';
import { toIsoDate } from '../lib/menu/dates';
import { watchUserProfile } from '../lib/menu/repository';
import type { Dish, FirebaseUser, MealSlot, UserProfile } from '../lib/menu/types';
import { getTupperExpiryState } from '../lib/tuppers/expiry';
import { filterTuppers, nextTupperLocation, nextTupperStatus, shouldShowExpiryWarning } from '../lib/tuppers/state';
import {
  assignTupperToMeal,
  createTupper,
  getDishOptions,
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
  const form = root.querySelector<HTMLFormElement>('[data-tupper-form]');
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

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentFilter: TupperFilter = 'all';
  let tuppers: TupperItem[] = [];
  let dishes: Dish[] = [];
  let unsubscribeTuppers: (() => void) | undefined;
  let unsubscribeDishes: (() => void) | undefined;
  let unsubscribeProfile: (() => void) | undefined;
  let firebaseServices: Awaited<ReturnType<typeof getFirebaseServices>> | undefined;

  const today = toIsoDate(new Date());
  if (preparedInput) preparedInput.value = today;
  if (expiresInput) expiresInput.value = today;

  function escapeHtml(value = '') {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function showStatus(message: string, isError = false) {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.dataset.variant = isError ? 'error' : 'info';
  }

  function setReady() {
    if (loading) loading.hidden = true;
    if (content) content.hidden = false;
  }

  function formatDate(isoDate: string) {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(`${isoDate}T00:00:00`));
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
    const locationLabel = tupper.location === 'freezer' ? labels.locationFreezer : tupper.location === 'fridge' ? labels.locationFridge : labels.locationOther;
    const targetOptions = targets
      .map((target) => `<option value="${target.dayKey}|${target.meal}">${escapeHtml(target.label)}</option>`)
      .join('');

    return `
      <article class="tupper-card" data-tupper-id="${escapeHtml(tupper.id)}">
        <header>
          <div>
            <p class="menu-app__eyebrow">${escapeHtml(stateLabel)}</p>
            <h3>${escapeHtml(tupper.name)}</h3>
          </div>
          <span class="tupper-card__location">${escapeHtml(locationLabel)}</span>
        </header>
        <dl>
          <div><dt>${escapeHtml(labels.preparedAt)}</dt><dd>${escapeHtml(formatDate(tupper.preparedAt))}</dd></div>
          <div><dt>${escapeHtml(labels.expiresAt)}</dt><dd>${escapeHtml(formatDate(tupper.expiresAt))}</dd></div>
          ${tupper.portions ? `<div><dt>${escapeHtml(labels.portions)}</dt><dd>${tupper.portions}</dd></div>` : ''}
        </dl>
        ${tupper.notes ? `<p>${escapeHtml(tupper.notes)}</p>` : ''}
        <form class="tupper-assign" data-assign-form>
          <label>
            <span>${escapeHtml(labels.assignDay)}</span>
            <select data-assign-target>${targetOptions}</select>
          </label>
          <button class="button button--primary button--small" type="submit">${escapeHtml(labels.assign)}</button>
        </form>
        <div class="tupper-card__actions">
          <button type="button" data-action="consume">${escapeHtml(labels.consume)}</button>
          <button type="button" data-action="discard">${escapeHtml(labels.discard)}</button>
          <button type="button" data-action="freeze">${escapeHtml(labels.freeze)}</button>
          <button type="button" data-action="defrost">${escapeHtml(labels.defrost)}</button>
          <button type="button" data-action="archive">${escapeHtml(labels.archive)}</button>
        </div>
      </article>
    `;
  }

  function actionMessage(action: string) {
    if (action === 'consume') return labels.consumed;
    if (action === 'discard') return labels.discarded;
    if (action === 'freeze') return labels.frozen;
    if (action === 'defrost') return labels.defrosted;
    if (action === 'archive') return labels.archived;

    return labels.created;
  }

  dishSelect?.addEventListener('change', () => {
    const selected = dishSelect.selectedOptions[0];
    if (selected?.dataset.name && nameInput) nameInput.value = selected.dataset.name;
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
      await createTupper(firebaseServices, currentUser, currentProfile, {
        name: nameInput?.value ?? '',
        dishId: dishSelect?.value || undefined,
        preparedAt: preparedInput?.value ?? '',
        expiresAt: expiresInput?.value ?? '',
        portions: portionsInput?.value ? Number(portionsInput.value) : undefined,
        location: (locationInput?.value ?? 'fridge') as TupperLocation,
        notes: notesInput?.value ?? '',
      });
      form.reset();
      if (preparedInput) preparedInput.value = today;
      if (expiresInput) expiresInput.value = today;
      showStatus(labels.created);
    } catch (error) {
      showStatus(error instanceof Error ? error.message : labels.assignmentBlocked, true);
    }
  });

  list?.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
    if (!button || !firebaseServices) return;
    const tupper = getTupperFromElement(button);
    if (!tupper) return;

    const action = button.dataset.action as 'consume' | 'discard' | 'archive' | 'freeze' | 'defrost';
    await updateTupperState(firebaseServices, tupper, {
      status: nextTupperStatus(tupper.status, action),
      location: nextTupperLocation(tupper.location, action),
    });
    showStatus(actionMessage(action));
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
    const allowAppend = window.confirm(labels.appendConfirm);

    try {
      await assignTupperToMeal(firebaseServices, currentUser, tupper, {
        dayKey,
        meal,
        locale,
        allowAppend,
      });
      showStatus(labels.assigned);
    } catch (error) {
      showStatus(error instanceof Error ? error.message : labels.assignmentBlocked, true);
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
            render();
          }, (error) => showStatus(error.message, true));

          unsubscribeDishes = watchUserDishes(services, user.uid, (nextDishes) => {
            dishes = nextDishes;
            renderDishes();
          }, (error) => showStatus(error.message, true));

          unsubscribeTuppers = watchTuppers(services, user.uid, (nextTuppers) => {
            tuppers = nextTuppers;
            setReady();
            render();
          }, (error) => showStatus(error.message, true));
        });
      })
      .catch((error: Error) => showStatus(error.message, true));
  }
}
