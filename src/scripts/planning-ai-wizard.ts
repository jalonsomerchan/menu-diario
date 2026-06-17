const form = document.querySelector<HTMLElement>('[data-plan-wizard]');

if (form) {
  const app = form.closest<HTMLElement>('[data-planning-ai-app]');
  const scrollTarget = form.closest<HTMLElement>('[data-plan-scroll-target]') ?? form;
  const progress = form.querySelector<HTMLElement>('.planning-ai-wizard-progress');
  const labels = JSON.parse(app?.dataset.labels ?? '{}') as Record<string, string>;
  const panels = [...form.querySelectorAll<HTMLElement>('[data-plan-step]')];
  const dots = [...form.querySelectorAll<HTMLButtonElement>('[data-plan-step-indicator]')];
  const back = form.querySelector<HTMLButtonElement>('[data-plan-wizard-back]');
  const next = form.querySelector<HTMLButtonElement>('[data-plan-wizard-next]');
  const submit = form.querySelector<HTMLButtonElement>('[data-plan-submit]');
  const start = form.querySelector<HTMLInputElement>('[data-plan-start]');
  const end = form.querySelector<HTMLInputElement>('[data-plan-end]');
  let index = 0;

  function focusPanel() {
    const title = panels[index]?.querySelector<HTMLElement>('h3');
    title?.setAttribute('tabindex', '-1');
    title?.focus({ preventScroll: true });
  }

  function scrollActiveStep() {
    const dot = dots[index];
    if (!progress || !dot) return;
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    window.requestAnimationFrame(() => {
      dot.scrollIntoView({ behavior, block: 'nearest', inline: 'center' });
    });
  }

  function scrollWizardTop() {
    if (!window.matchMedia('(max-width: 719px)').matches) return;
    scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function selectedMeals() {
    return [...form.querySelectorAll<HTMLInputElement>('[data-plan-meal]')].filter((input) => input.checked);
  }

  function selectedPendingSlots() {
    return [...form.querySelectorAll<HTMLInputElement>('[data-plan-pending-slot]')].filter((input) => input.checked);
  }

  function validate(panelIndex: number) {
    if (panelIndex === 0 && (!start?.value || !end?.value || start.value > end.value)) {
      start?.focus();
      return labels.invalidRange || 'Invalid range';
    }
    if (panelIndex === 1 && selectedMeals().length === 0) {
      form.querySelector<HTMLInputElement>('[data-plan-meal]')?.focus();
      return labels.meals || 'Meals';
    }
    if (panelIndex === 2 && selectedPendingSlots().length === 0) {
      form.querySelector<HTMLInputElement>('[data-plan-pending-slot]')?.focus();
      return labels.pendingEmpty || 'Pending slots';
    }
    return '';
  }

  function notifyStep() {
    app?.dispatchEvent(new CustomEvent('planning-ai-wizard:step', { detail: { step: index } }));
  }

  function go(nextIndex: number, focus = false) {
    const previousIndex = index;
    index = Math.max(0, Math.min(panels.length - 1, nextIndex));
    panels.forEach((panel, panelIndex) => {
      panel.hidden = panelIndex !== index;
    });
    dots.forEach((dot, dotIndex) => {
      if (dotIndex === index) dot.setAttribute('aria-current', 'step');
      else dot.removeAttribute('aria-current');
    });
    if (back) back.disabled = index === 0;
    if (next) next.hidden = index === panels.length - 1;
    if (submit) submit.hidden = true;
    if (previousIndex !== index || focus) scrollActiveStep();
    notifyStep();
    if (focus) focusPanel();
    if (focus && previousIndex !== index) scrollWizardTop();
  }

  function validateBeforeSubmit(event: Event) {
    for (let panelIndex = 0; panelIndex < panels.length - 1; panelIndex += 1) {
      if (validate(panelIndex)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        go(panelIndex, true);
        return;
      }
    }
  }

  back?.addEventListener('click', () => go(index - 1, true));
  next?.addEventListener('click', () => {
    if (!validate(index)) go(index + 1, true);
  });
  dots.forEach((dot, dotIndex) => {
    dot.addEventListener('click', () => {
      const direction = dotIndex > index ? 1 : -1;
      for (let cursor = index; cursor !== dotIndex; cursor += direction) {
        if (direction > 0 && validate(cursor)) return;
      }
      go(dotIndex, true);
    });
  });
  app?.addEventListener('planning-ai-wizard:go', (event) => {
    const targetIndex = (event as CustomEvent<{ step?: number }>).detail?.step;
    if (typeof targetIndex !== 'number') return;
    go(targetIndex, true);
  });
  form.addEventListener('submit', validateBeforeSubmit, { capture: true });
  go(0);
}
