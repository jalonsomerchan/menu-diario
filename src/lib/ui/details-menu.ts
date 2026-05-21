export function bindDetailsMenuDismiss(root: ParentNode, selector = '[data-day-actions]') {
  const closeMenus = (except?: HTMLDetailsElement | null) => {
    root.querySelectorAll<HTMLDetailsElement>(selector).forEach((details) => {
      if (details !== except) details.open = false;
    });
  };

  root.addEventListener(
    'toggle',
    (event) => {
      const details = event.target;
      if (details instanceof HTMLDetailsElement && details.matches(selector) && details.open) {
        closeMenus(details);
      }
    },
    true
  );

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const selectedMenu = target.closest<HTMLDetailsElement>(selector);
    if (!selectedMenu || !root.contains(target)) {
      closeMenus();
      return;
    }

    closeMenus(selectedMenu);
    if (target.closest('[data-action-kind]')) selectedMenu.open = false;
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenus();
  });
}
