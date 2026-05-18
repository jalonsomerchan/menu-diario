import { getSuggestionDishes, normalizeDishName } from '../dishes/helpers.mjs';
import type { Dish } from './types';

const suggestionLimit = 6;
let inputSequence = 0;

type RenderSuggestionOptions = {
  allowEmptyQuery?: boolean;
};

function escapeHtml(value = '') {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function ensureInputId(input: HTMLInputElement) {
  if (!input.id) {
    inputSequence += 1;
    input.id = `dish-input-${Date.now()}-${inputSequence}`;
  }

  return input.id;
}

function ensureListId(list: HTMLElement, input: HTMLInputElement) {
  if (!list.id) list.id = `${ensureInputId(input)}-listbox`;
  input.setAttribute('aria-controls', list.id);
}

function setExpanded(input: HTMLInputElement, isExpanded: boolean) {
  input.setAttribute('aria-expanded', String(isExpanded));
}

function getMatches(dishes: Dish[], query: string) {
  const normalizedQuery = normalizeDishName(query);

  return getSuggestionDishes(dishes, query)
    .map((dish) => {
      const normalizedName = normalizeDishName(dish.name);
      const startsWith = normalizedQuery ? normalizedName.startsWith(normalizedQuery) : false;
      return { dish, startsWith };
    })
    .sort((a, b) => {
      if (a.startsWith !== b.startsWith) return a.startsWith ? -1 : 1;
      if (Boolean(a.dish.favorite) !== Boolean(b.dish.favorite)) return a.dish.favorite ? -1 : 1;
      return (b.dish.timesUsed ?? 0) - (a.dish.timesUsed ?? 0) || a.dish.name.localeCompare(b.dish.name);
    })
    .slice(0, suggestionLimit)
    .map((item) => item.dish);
}

function hideSuggestions(list: HTMLElement, input?: HTMLInputElement | null) {
  list.hidden = true;
  list.innerHTML = '';
  if (input) setExpanded(input, false);
}

function renderSuggestions(
  list: HTMLElement,
  input: HTMLInputElement,
  dishes: Dish[],
  options: RenderSuggestionOptions = {}
) {
  const query = input.value.trim();
  list.dataset.activeInputId = ensureInputId(input);
  ensureListId(list, input);

  if (!query && !options.allowEmptyQuery) {
    hideSuggestions(list, input);
    return;
  }

  const matches = getMatches(dishes, input.value);

  if (!matches.length) {
    hideSuggestions(list, input);
    return;
  }

  list.innerHTML = matches
    .map(
      (dish) =>
        `<button type="button" role="option" data-suggestion="${escapeHtml(dish.name)}">${dish.favorite ? '<span aria-hidden="true">★</span> ' : ''}${escapeHtml(dish.name)}</button>`
    )
    .join('');
  list.hidden = false;
  setExpanded(input, true);
}

function getSuggestionTarget(input: HTMLInputElement) {
  const plateRow = input.closest<HTMLElement>('.plate-row');
  const mealSection = input.closest<HTMLElement>('[data-meal]');
  const list = plateRow?.querySelector<HTMLElement>('[data-suggestion-list]');

  return list ? { list, mealSection } : null;
}

function selectSuggestion(root: HTMLElement, button: HTMLButtonElement) {
  const list = button.closest<HTMLElement>('[data-suggestion-list]');
  const inputId = list?.dataset.activeInputId;
  const input = inputId ? root.querySelector<HTMLInputElement>(`#${CSS.escape(inputId)}`) : null;

  if (!input || !list) return;

  input.value = button.dataset.suggestion ?? '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  hideSuggestions(list, input);
  input.focus();
}

export function attachDishSuggestions(root: HTMLElement, getDishes: () => Dish[]) {
  root.addEventListener('focusin', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.plateInput) return;

    const target = getSuggestionTarget(input);
    if (!target) return;

    renderSuggestions(target.list, input, getDishes());
  });

  root.addEventListener('input', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.plateInput) return;

    const target = getSuggestionTarget(input);
    if (!target) return;

    renderSuggestions(target.list, input, getDishes());
  });

  root.addEventListener('keydown', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.plateInput || event.key !== 'ArrowDown') return;

    const target = getSuggestionTarget(input);
    if (!target) return;

    event.preventDefault();
    renderSuggestions(target.list, input, getDishes(), { allowEmptyQuery: true });
    target.list.querySelector<HTMLButtonElement>('[data-suggestion]')?.focus();
  });

  root.addEventListener('focusout', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.plateInput) return;

    window.setTimeout(() => {
      const target = getSuggestionTarget(input);
      if (target && !target.mealSection?.contains(document.activeElement)) {
        hideSuggestions(target.list, input);
      }
    }, 120);
  });

  root.addEventListener('pointerdown', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest<HTMLButtonElement>('[data-suggestion]');
    if (!button) return;

    event.preventDefault();
    selectSuggestion(root, button);
  });

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const toggle = target.closest<HTMLButtonElement>('[data-suggestion-toggle]');
    if (toggle) {
      const input = toggle.closest<HTMLElement>('.plate-row')?.querySelector<HTMLInputElement>('[data-plate-input]');
      const suggestionTarget = input ? getSuggestionTarget(input) : null;
      if (!input || !suggestionTarget) return;

      event.preventDefault();
      renderSuggestions(suggestionTarget.list, input, getDishes(), { allowEmptyQuery: true });
      input.focus();
      return;
    }
  });
}
