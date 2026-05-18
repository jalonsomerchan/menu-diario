const wizard = document.querySelector<HTMLElement>('[data-shopping-wizard]');

if (wizard) {
  const app = wizard.closest<HTMLElement>('[data-shopping-app]');
  const scrollTarget = wizard.closest<HTMLElement>('.planning-ai-panel') ?? wizard;
  const panels = [...wizard.querySelectorAll<HTMLElement>('[data-wizard-step]')];
  const indicators = [...wizard.querySelectorAll<HTMLButtonElement>('.planning-ai-wizard-step')];
  const back = wizard.querySelector<HTMLButtonElement>('[data-wizard-prev]');
  const next = wizard.querySelector<HTMLButtonElement>('[data-wizard-next]');
  let currentIndex = getCurrentIndex();

  function getCurrentIndex() {
    const visibleIndex = panels.findIndex((panel) => !panel.hidden);
    return visibleIndex >= 0 ? visibleIndex : 0;
  }

  function focusPanel() {
    const title = panels[currentIndex]?.querySelector<HTMLElement>('h3');
    title?.setAttribute('tabindex', '-1');
    title?.focus({ preventScroll: true });
  }

  function scrollWizardTop() {
    if (!window.matchMedia('(max-width: 719px)').matches) return;
    scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function syncIndicators() {
    indicators.forEach((indicator, index) => {
      if (index === currentIndex) {
        indicator.setAttribute('aria-current', 'step');
        indicator.closest('[data-wizard-progress-step]')?.setAttribute('aria-current', 'step');
      } else {
        indicator.removeAttribute('aria-current');
        indicator.closest('[data-wizard-progress-step]')?.removeAttribute('aria-current');
      }
    });
  }

  function notifyStep(previousIndex: number, shouldFocus: boolean) {
    app?.dispatchEvent(new CustomEvent('shopping-wizard:step', { detail: { step: currentIndex } }));
    syncIndicators();
    if (!shouldFocus || previousIndex === currentIndex) return;
    focusPanel();
    scrollWizardTop();
  }

  function updateFromDom(shouldFocus = false) {
    const previousIndex = currentIndex;
    currentIndex = getCurrentIndex();
    notifyStep(previousIndex, shouldFocus);
  }

  function clickControl(control: HTMLButtonElement | null | undefined) {
    if (!control || control.disabled || control.hidden) return false;
    const previousIndex = getCurrentIndex();
    control.click();
    updateFromDom(true);
    return previousIndex !== currentIndex;
  }

  function go(targetIndex: number) {
    const nextIndex = Math.max(0, Math.min(panels.length - 1, targetIndex));
    const direction = nextIndex > currentIndex ? 1 : -1;

    while (currentIndex !== nextIndex) {
      const moved = clickControl(direction > 0 ? next : back);
      if (!moved) break;
    }
  }

  indicators.forEach((indicator, index) => {
    indicator.dataset.shoppingStepIndicator = String(index);
    indicator.addEventListener('click', () => go(index));
  });

  [back, next].forEach((control) => {
    control?.addEventListener('click', () => window.requestAnimationFrame(() => updateFromDom(true)));
  });

  const observer = new MutationObserver(() => updateFromDom(false));
  panels.forEach((panel) => observer.observe(panel, { attributes: true, attributeFilter: ['hidden'] }));
  updateFromDom(false);
}
