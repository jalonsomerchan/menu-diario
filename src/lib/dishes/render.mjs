import { getDishEditorState } from './editor-state.mjs';

function escapeHtml(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function renderQuickTagsEditor(dish, labels) {
  const selectedTags = Array.isArray(dish.quickTags) ? dish.quickTags : [];
  const availableTags = labels.quickTagsList.filter((tag) => !selectedTags.includes(tag));
  const selectedMarkup = selectedTags.length
    ? selectedTags
        .map(
          (tag) => `
            <span class="dish-tag-chip">
              <button type="button" data-remove-quick-tag="${escapeHtml(tag)}" aria-label="${escapeHtml(labels.removeTag)} ${escapeHtml(labels.tagLabels[tag] ?? tag)}">×</button>
              <span>${escapeHtml(labels.tagLabels[tag] ?? tag)}</span>
            </span>
          `
        )
        .join('')
    : `<span class="dish-tags-empty">${escapeHtml(labels.noQuickTags)}</span>`;

  const availableMarkup = availableTags
    .map(
      (tag) =>
        `<button class="dish-tag-add" type="button" data-add-quick-tag="${escapeHtml(tag)}">+ ${escapeHtml(labels.tagLabels[tag] ?? tag)}</button>`
    )
    .join('');

  return `
    <section class="dish-editor-section" aria-label="${escapeHtml(labels.quickTagsLabel)}">
      <p class="dish-editor-section__title">${escapeHtml(labels.quickTagsLabel)}</p>
      <div class="dish-tag-list" data-selected-tags>${selectedMarkup}</div>
      ${availableMarkup ? `<div class="dish-tag-actions">${availableMarkup}</div>` : ''}
    </section>
  `;
}

function renderQuickTagsReadOnly(dish, labels) {
  const selectedTags = Array.isArray(dish.quickTags) ? dish.quickTags : [];
  const content = selectedTags.length
    ? selectedTags.map((tag) => `<span class="dish-badge">${escapeHtml(labels.tagLabels[tag] ?? tag)}</span>`).join('')
    : `<span class="dish-tags-empty">${escapeHtml(labels.noQuickTags)}</span>`;

  return `
    <section class="dish-editor-section" aria-label="${escapeHtml(labels.quickTagsLabel)}">
      <p class="dish-editor-section__title">${escapeHtml(labels.quickTagsLabel)}</p>
      <div class="dish-tag-list">${content}</div>
    </section>
  `;
}

function renderReadonlyNotice(dish, state, labels) {
  if (state.isReadOnlyGlobal) {
    return `<p class="dish-editor-note">${escapeHtml(labels.globalReadOnlyModal)}</p>`;
  }

  if (!state.canEdit) {
    return `<p class="dish-editor-note">${escapeHtml(labels.notEditable)}</p>`;
  }

  return `<p class="dish-editor-note">${escapeHtml(labels.editableHint)}</p>`;
}

export function renderCompactDishRow(dish, labels) {
  const state = getDishEditorState(dish);
  const favoriteText = dish.favorite ? labels.unmarkFavorite : labels.markFavorite;
  const favoriteControl = state.canToggleFavorite
    ? `
      <button
        class="dish-favorite"
        type="button"
        data-toggle-favorite
        aria-pressed="${dish.favorite ? 'true' : 'false'}"
        aria-label="${escapeHtml(favoriteText)}"
      >
        <span aria-hidden="true">${dish.favorite ? '★' : '☆'}</span>
      </button>
    `
    : `
      <span
        class="dish-favorite dish-favorite--readonly"
        data-favorite-status
        role="img"
        aria-label="${escapeHtml(dish.favorite ? labels.favoriteBadge : labels.notFavoriteBadge)}"
      >
        <span aria-hidden="true">${dish.favorite ? '★' : '☆'}</span>
      </span>
    `;

  return `
    <article class="dish-row app-panel" data-dish-id="${escapeHtml(dish.id)}">
      <div class="dish-row__main">
        <h2>${escapeHtml(dish.name)}</h2>
      </div>
      <div class="dish-row__actions">
        ${favoriteControl}
        <button
          class="button button--secondary button--small dish-row__edit"
          type="button"
          data-edit-dish
          aria-label="${escapeHtml(labels.editDishAria.replace('{dish}', dish.name))}"
        >
          ${escapeHtml(labels.editCompact)}
        </button>
      </div>
    </article>
  `;
}

export function renderDishEditorBody(dish, labels, formatDate, draft = {}) {
  const state = getDishEditorState(dish);
  const name = draft.name ?? dish.name;
  const favorite = draft.favorite ?? Boolean(dish.favorite);
  const blocked = draft.blocked ?? Boolean(dish.blocked);
  const quickTags = Array.isArray(draft.quickTags) ? draft.quickTags : dish.quickTags;
  const lastUsed = dish.lastUsedAt ? formatDate(dish.lastUsedAt) : labels.neverUsed;
  const createdAt = dish.createdAt ? formatDate(dish.createdAt) : labels.noCreatedAt;
  const originKey = dish.isGlobal ? labels.originGlobal : dish.scope === 'group' ? labels.originGroup : labels.originUser;
  const sourceLabels = labels.sourceLabels ?? {};
  const sourceLabel = sourceLabels[dish.source] ?? dish.source;
  const draftDish = { ...dish, favorite, blocked, quickTags };

  return `
    <div class="dish-editor-grid" data-editor-dish-id="${escapeHtml(dish.id)}">
      ${renderReadonlyNotice(dish, state, labels)}

      <label class="dish-editor-field">
        <span>${escapeHtml(labels.addName)}</span>
        <input
          type="text"
          name="name"
          value="${escapeHtml(name)}"
          minlength="2"
          maxlength="90"
          ${state.canRename ? 'data-editor-initial-focus' : 'readonly aria-readonly="true"'}
        />
      </label>

      <section class="dish-editor-section" aria-label="${escapeHtml(labels.statusSection)}">
        <p class="dish-editor-section__title">${escapeHtml(labels.statusSection)}</p>
        <label class="dish-editor-toggle">
          <input type="checkbox" name="favorite" ${favorite ? 'checked' : ''} ${state.canToggleFavorite ? '' : 'disabled'} />
          <span>${escapeHtml(labels.favoriteField)}</span>
        </label>
        <label class="dish-editor-toggle">
          <input type="checkbox" name="blocked" ${blocked ? 'checked' : ''} ${state.canToggleBlocked ? '' : 'disabled'} />
          <span>${escapeHtml(labels.blockedField)}</span>
        </label>
        <p class="dish-editor-status">
          <span>${escapeHtml(labels.archivedField)}:</span>
          <strong>${escapeHtml(dish.archived ? labels.archivedState : labels.activeState)}</strong>
        </p>
      </section>

      ${state.canEditQuickTags ? renderQuickTagsEditor(draftDish, labels) : renderQuickTagsReadOnly(draftDish, labels)}

      <section class="dish-editor-section" aria-label="${escapeHtml(labels.statistics)}">
        <p class="dish-editor-section__title">${escapeHtml(labels.statistics)}</p>
        <dl class="dish-editor-stats">
          <div><dt>${escapeHtml(labels.timesUsed)}</dt><dd>${dish.timesUsed}</dd></div>
          <div><dt>${escapeHtml(labels.lastUsed)}</dt><dd>${escapeHtml(lastUsed)}</dd></div>
          <div><dt>${escapeHtml(labels.createdAt)}</dt><dd>${escapeHtml(createdAt)}</dd></div>
        </dl>
      </section>

      <section class="dish-editor-section" aria-label="${escapeHtml(labels.origin)}">
        <p class="dish-editor-section__title">${escapeHtml(labels.origin)}</p>
        <dl class="dish-editor-meta">
          <div><dt>${escapeHtml(labels.origin)}</dt><dd>${escapeHtml(originKey)}</dd></div>
          <div><dt>${escapeHtml(labels.source)}</dt><dd>${escapeHtml(sourceLabel)}</dd></div>
        </dl>
      </section>
    </div>
  `;
}
