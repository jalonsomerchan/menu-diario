const dayActionSelector = '[data-day-actions]';

function closeDayActionMenus(except?: HTMLDetailsElement | null) {
  document.querySelectorAll<HTMLDetailsElement>(dayActionSelector).forEach((details) => {
    if (details !== except) details.open = false;
  });
}

document.addEventListener(
  'toggle',
  (event) => {
    const details = event.target;
    if (details instanceof HTMLDetailsElement && details.matches(dayActionSelector) && details.open) {
      closeDayActionMenus(details);
    }
  },
  true
);

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const selectedMenu = target.closest<HTMLDetailsElement>(dayActionSelector);
  if (!selectedMenu) {
    closeDayActionMenus();
    return;
  }

  closeDayActionMenus(selectedMenu);
  if (target.closest('[data-action-kind]')) selectedMenu.open = false;
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDayActionMenus();
});
