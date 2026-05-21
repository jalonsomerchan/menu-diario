const dayActionSelector = '[data-day-actions]';
const skippedPrefixes = ['No se apunta', 'No configurado', 'Not joining', 'Skipped'];

function closeDayActionMenus(except?: HTMLDetailsElement | null) {
  document.querySelectorAll<HTMLDetailsElement>(dayActionSelector).forEach((details) => {
    if (details !== except) details.open = false;
  });
}

function cleanSkippedPrefixes(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('.history-card__items, .day-meal-row strong').forEach((element) => {
    const text = element.textContent?.trim() ?? '';
    const prefix = skippedPrefixes.find((item) => text.startsWith(`${item}:`));
    if (!prefix) return;
    element.textContent = text.slice(prefix.length + 1).trim();
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

cleanSkippedPrefixes();
new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node instanceof Element) cleanSkippedPrefixes(node);
    });
  });
}).observe(document.body, { childList: true, subtree: true });
