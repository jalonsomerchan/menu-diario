type DaySummaryCardOptions = {
  isoDate: string;
  dayNumber: string;
  monthLabel: string;
  weekday: string;
  dateLabel: string;
  summariesHtml: string;
  actionLabel?: string;
  actionAttr?: string;
  actionStateAttr?: string;
  moreActionsLabel?: string;
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

function renderActionMenu({ isoDate, actionLabel, actionAttr, actionStateAttr = '', moreActionsLabel }: DaySummaryCardOptions) {
  if (!actionLabel || !actionAttr) return '';

  return `
    <details class="day-actions" data-day-actions>
      <summary aria-label="${escapeHtml(moreActionsLabel || actionLabel)}">•••</summary>
      <div>
        <button type="button" data-action-kind="edit" ${actionAttr}="${escapeHtml(isoDate)}" ${actionStateAttr}>${escapeHtml(actionLabel)}</button>
      </div>
    </details>
  `;
}

export function renderDaySummaryCard(options: DaySummaryCardOptions) {
  const {
    isoDate,
    dayNumber,
    monthLabel,
    weekday,
    dateLabel,
    summariesHtml,
    actionHtml,
    notesHtml = '',
    badgesHtml = '',
    menuId = '',
    dayStatus = '',
    className = '',
  } = options;
  const menuAttr = menuId ? ` data-menu="${escapeHtml(menuId)}"` : '';
  const statusAttr = dayStatus ? ` data-day-status="${escapeHtml(dayStatus)}"` : '';
  const classes = ['history-card', 'menu-day-card', className].filter(Boolean).join(' ');

  return `
    <article class="${escapeHtml(classes)}" data-day="${escapeHtml(isoDate)}"${menuAttr}${statusAttr}>
      <div class="history-card__date" aria-label="${escapeHtml(dateLabel)}">
        <span class="history-card__day-number">${escapeHtml(dayNumber)}</span>
        <span class="history-card__month">${escapeHtml(monthLabel)}</span>
      </div>
      <div class="history-card__body">
        <header class="history-card__header">
          <div class="history-card__heading">
            <h2>${escapeHtml(weekday)}</h2>
          </div>
          ${actionHtml ?? renderActionMenu(options)}
        </header>
        <div class="menu-day-card__content">${summariesHtml}</div>
        ${notesHtml}
        ${badgesHtml}
      </div>
    </article>
  `;
}
