type DaySummaryCardOptions = {
  isoDate: string;
  dayNumber: string;
  weekday: string;
  dateLabel: string;
  actionLabel: string;
  actionAttr: string;
  actionStateAttr?: string;
  summariesHtml: string;
};

function escapeHtml(value = '') {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function renderDaySummaryCard({
  isoDate,
  dayNumber,
  weekday,
  dateLabel,
  actionLabel,
  actionAttr,
  actionStateAttr = '',
  summariesHtml,
}: DaySummaryCardOptions) {
  return `
    <article class="next-day-card next-day-card--mockup planner-day-card" data-day="${escapeHtml(isoDate)}">
      <div class="next-day-card__number">${escapeHtml(dayNumber)}</div>
      <div class="next-day-card__body">
        <header class="planner-day-card__header">
          <div class="planner-day-card__title">
            <h3>${escapeHtml(weekday)}</h3>
            <p>${escapeHtml(dateLabel)}</p>
          </div>
          <button class="button button--ghost button--small planner-day-card__edit" type="button" ${actionAttr}="${escapeHtml(isoDate)}" ${actionStateAttr}>
            ${escapeHtml(actionLabel)}
          </button>
        </header>
        <div class="planner-day-card__meals">${summariesHtml}</div>
      </div>
    </article>
  `;
}
