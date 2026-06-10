type DaySummaryCardOptions = {
  isoDate: string;
  dayNumber: string;
  monthLabel?: string;
  weekday: string;
  dateLabel: string;
  summariesHtml: string;
  actionLabel?: string;
  actionAttr?: string;
  actionStateAttr?: string;
  deleteActionLabel?: string;
  deleteActionAttr?: string;
  deleteActionStateAttr?: string;
  moreActionsLabel?: string;
  actionKind?: 'edit' | 'add';
  statusLabel?: string;
  actionHtml?: string;
  notesHtml?: string;
  badgesHtml?: string;
  menuId?: string;
  dayStatus?: string;
  className?: string;
};

function escapeHtml(value = '') {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function getMonthLabel(isoDate: string) {
  return new Intl.DateTimeFormat(document.documentElement.lang === 'en' ? 'en-US' : 'es-ES', { month: 'short' })
    .format(new Date(`${isoDate}T00:00:00`))
    .replace('.', '')
    .slice(0, 3)
    .toLocaleUpperCase();
}

function renderActionMenu({
  isoDate,
  actionLabel,
  actionAttr,
  actionStateAttr = '',
  deleteActionLabel,
  deleteActionAttr,
  deleteActionStateAttr = '',
  moreActionsLabel,
  actionKind = 'edit',
}: DaySummaryCardOptions) {
  if (!actionLabel || !actionAttr) return '';
  const deleteButton =
    deleteActionLabel && deleteActionAttr
      ? `<button type="button" data-action-kind="delete" ${deleteActionAttr}="${escapeHtml(isoDate)}" ${deleteActionStateAttr}>${escapeHtml(deleteActionLabel)}</button>`
      : '';

  const primaryAction = `
    <button class="day-card-primary-action day-card-primary-action--${escapeHtml(actionKind)}" type="button" aria-label="${escapeHtml(actionLabel)}" ${actionAttr}="${escapeHtml(isoDate)}" ${actionStateAttr}>
      <span class="day-card-primary-action__icon" aria-hidden="true">${actionKind === 'add' ? '+' : '✎'}</span>
      ${actionKind === 'add' ? `<span class="day-card-primary-action__label">${escapeHtml(actionLabel)}</span>` : ''}
      <span class="sr-only">${escapeHtml(actionLabel)}</span>
    </button>
  `;

  if (!deleteButton) return primaryAction;

  return `
    <div class="day-card-actions">
      ${primaryAction}
      <details class="day-actions day-actions--secondary" data-day-actions>
      <summary aria-label="${escapeHtml(moreActionsLabel || actionLabel)}">⋯</summary>
      <div>
        ${deleteButton}
      </div>
      </details>
    </div>
  `;
}

export function renderDaySummaryCard(options: DaySummaryCardOptions) {
  const {
    isoDate,
    dayNumber,
    weekday,
    dateLabel,
    summariesHtml,
    actionHtml,
    notesHtml = '',
    badgesHtml = '',
    statusLabel = '',
    menuId = '',
    dayStatus = '',
    className = '',
  } = options;
  const monthLabel = options.monthLabel ?? getMonthLabel(isoDate);
  const menuAttr = menuId ? ` data-menu="${escapeHtml(menuId)}"` : '';
  const statusAttr = dayStatus ? ` data-day-status="${escapeHtml(dayStatus)}"` : '';
  const classes = ['history-card', 'menu-day-card', className].filter(Boolean).join(' ');

  return `
    <article class="${escapeHtml(classes)}" data-day="${escapeHtml(isoDate)}"${menuAttr}${statusAttr}>
      <div class="history-card__date" aria-label="${escapeHtml(dateLabel)}">
        <span class="history-card__weekday">${escapeHtml(weekday)}</span>
        <span class="history-card__month">${escapeHtml(monthLabel)}</span>
        <span class="history-card__day-number">${escapeHtml(dayNumber)}</span>
      </div>
      <div class="history-card__body">
        <header class="history-card__header">
          ${statusLabel ? `<span class="day-status-pill day-status-pill--planned"><span aria-hidden="true">✓</span>${escapeHtml(statusLabel)}</span>` : ''}
          ${actionHtml ?? renderActionMenu(options)}
        </header>
        <div class="menu-day-card__content">${summariesHtml}</div>
        ${notesHtml}
        ${badgesHtml}
      </div>
    </article>
  `;
}
