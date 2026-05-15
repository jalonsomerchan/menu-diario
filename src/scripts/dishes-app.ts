import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { archiveDish, createManualDish, renameDish, watchUserDishes } from '../lib/dishes/repository';
import { filterDishes, sortDishes, type DishSortMode } from '../lib/dishes/helpers.mjs';
import type { Dish, FirebaseUser } from '../lib/menu/types';

const root = document.querySelector<HTMLElement>('[data-dishes-app]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const status = root.querySelector<HTMLElement>('[data-status]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const content = root.querySelector<HTMLElement>('[data-content]');
  const form = root.querySelector<HTMLFormElement>('[data-dish-form]');
  const nameInput = root.querySelector<HTMLInputElement>('[data-dish-name]');
  const searchInput = root.querySelector<HTMLInputElement>('[data-dish-search]');
  const sortSelect = root.querySelector<HTMLSelectElement>('[data-dish-sort]');
  const list = root.querySelector<HTMLElement>('[data-dishes-list]');

  let currentUser: FirebaseUser | null = null;
  let dishes: Dish[] = [];
  let unsubscribeDishes: (() => void) | undefined;

  function escapeHtml(value = '') {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function showStatus(message: string, isError = false) {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.dataset.variant = isError ? 'error' : 'info';
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
    const filtered = filterDishes(dishes, searchInput?.value ?? '') as Dish[];
    return sortDishes(filtered, (sortSelect?.value as DishSortMode) ?? 'most-used') as Dish[];
  }

  function renderTags(dish: Dish) {
    if (!dish.tags?.length) return '';
    return `<p class="dish-card__tags"><span>${escapeHtml(labels.tags)}:</span> ${dish.tags.map(escapeHtml).join(', ')}</p>`;
  }

  function renderEmpty() {
    const hasSearch = Boolean(searchInput?.value.trim());
    const title = hasSearch ? labels.emptySearch : labels.empty;
    const hint = hasSearch ? '' : `<p>${escapeHtml(labels.emptyHint)}</p>`;
    return `<article class="app-panel dishes-empty"><h2>${escapeHtml(title)}</h2>${hint}</article>`;
  }

  function renderDishes() {
    if (!list) return;
    const visibleDishes = getVisibleDishes();

    if (!visibleDishes.length) {
      list.innerHTML = renderEmpty();
      return;
    }

    list.innerHTML = visibleDishes
      .map((dish) => {
        const lastUsed = dish.lastUsedAt ? formatDate(dish.lastUsedAt) : labels.neverUsed;
        const createdAt = dish.createdAt ? formatDate(dish.createdAt) : labels.noCreatedAt;

        return `
          <article class="dish-card app-panel" data-dish-id="${escapeHtml(dish.id)}">
            <div class="dish-card__main">
              <h2>${escapeHtml(dish.name)}</h2>
              <dl>
                <div><dt>${escapeHtml(labels.timesUsed)}</dt><dd>${dish.timesUsed}</dd></div>
                <div><dt>${escapeHtml(labels.lastUsed)}</dt><dd>${escapeHtml(lastUsed)}</dd></div>
                <div><dt>${escapeHtml(labels.createdAt)}</dt><dd>${escapeHtml(createdAt)}</dd></div>
              </dl>
              ${renderTags(dish)}
            </div>
            <form class="dish-card__edit" data-edit-form hidden>
              <label>${escapeHtml(labels.addName)}<input type="text" data-edit-name value="${escapeHtml(dish.name)}" minlength="2" maxlength="90" /></label>
              <div class="dish-card__actions">
                <button class="button button--primary button--small" type="submit">${escapeHtml(labels.save)}</button>
                <button class="button button--ghost button--small" type="button" data-cancel-edit>${escapeHtml(labels.cancel)}</button>
              </div>
            </form>
            <div class="dish-card__actions" data-card-actions>
              <button class="button button--secondary button--small" type="button" data-edit-dish>${escapeHtml(labels.edit)}</button>
              <button class="button button--ghost button--small" type="button" data-archive-dish>${escapeHtml(labels.archive)}</button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function errorMessage(error: Error) {
    if (error.message === 'dish-invalid-name') return labels.invalid;
    if (error.message === 'dish-duplicate') return labels.duplicate;
    if (error.message.toLowerCase().includes('permission')) return labels.permissionsError;
    return error.message;
  }

  async function submitNewDish() {
    if (!currentUser || !nameInput) return;
    const services = await getFirebaseServices();
    await createManualDish(services, currentUser.uid, nameInput.value);
    nameInput.value = '';
    nameInput.focus();
    showStatus(labels.added);
  }

  function findDish(card: HTMLElement) {
    return dishes.find((dish) => dish.id === card.dataset.dishId);
  }

  function openEditor(card: HTMLElement) {
    card.querySelector<HTMLElement>('[data-edit-form]')!.hidden = false;
    card.querySelector<HTMLElement>('[data-card-actions]')!.hidden = true;
    card.querySelector<HTMLInputElement>('[data-edit-name]')?.focus();
  }

  function closeEditor(card: HTMLElement) {
    card.querySelector<HTMLElement>('[data-edit-form]')!.hidden = true;
    card.querySelector<HTMLElement>('[data-card-actions]')!.hidden = false;
  }

  if (!hasFirebaseConfig()) {
    setVisible(false);
    showStatus(labels.firebaseMissing || labels.configMissing, true);
  } else {
    getFirebaseServices()
      .then((services) => {
        form?.addEventListener('submit', (event) => {
          event.preventDefault();
          submitNewDish().catch((error: Error) => showStatus(errorMessage(error), true));
        });

        searchInput?.addEventListener('input', renderDishes);
        sortSelect?.addEventListener('change', renderDishes);

        list?.addEventListener('click', (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          const card = target.closest<HTMLElement>('[data-dish-id]');
          if (!card) return;

          if (target.closest('[data-edit-dish]')) openEditor(card);
          if (target.closest('[data-cancel-edit]')) closeEditor(card);
          if (target.closest('[data-archive-dish]')) {
            if (!window.confirm(labels.confirmArchive)) return;
            archiveDish(services, card.dataset.dishId ?? '')
              .then(() => showStatus(labels.archived))
              .catch((error: Error) => showStatus(errorMessage(error), true));
          }
        });

        list?.addEventListener('submit', (event) => {
          event.preventDefault();
          const form = event.target;
          if (!(form instanceof HTMLFormElement)) return;
          const card = form.closest<HTMLElement>('[data-dish-id]');
          const dish = card ? findDish(card) : undefined;
          const input = form.querySelector<HTMLInputElement>('[data-edit-name]');
          if (!card || !dish || !currentUser || !input) return;

          renameDish(services, currentUser.uid, dish, input.value)
            .then(() => showStatus(labels.updated))
            .catch((error: Error) => showStatus(errorMessage(error), true));
        });

        services.authModule.onAuthStateChanged(services.auth, (user: FirebaseUser | null) => {
          currentUser = user;
          unsubscribeDishes?.();

          if (!user) {
            window.location.assign(labels.homePath || '/');
            return;
          }

          unsubscribeDishes = watchUserDishes(
            services,
            user.uid,
            (nextDishes) => {
              dishes = nextDishes;
              setVisible(true);
              renderDishes();
            },
            (error) => showStatus(errorMessage(error), true)
          );
        });
      })
      .catch((error: Error) => showStatus(errorMessage(error), true));
  }
}
