const form = document.querySelector<HTMLElement>('[data-plan-wizard]');

if (form) {
  const app = form.closest<HTMLElement>('[data-planning-ai-app]');
  const scrollTarget = form.closest<HTMLElement>('[data-plan-scroll-target]') ?? form;
  const labels = JSON.parse(app?.dataset.labels ?? '{}') as Record<string, string>;
  const panels = [...form.querySelectorAll<HTMLElement>('[data-plan-step]')];
  const dots = [...form.querySelectorAll<HTMLButtonElement>('[data-plan-step-indicator]')];
  const back = form.querySelector<HTMLButtonElement>('[data-plan-wizard-back]');
  const next = form.querySelector<HTMLButtonElement>('[data-plan-wizard-next]');
  const submit = form.querySelector<HTMLButtonElement>('[data-plan-submit]');
  const start = form.querySelector<HTMLInputElement>('[data-plan-start]');
  const end = form.querySelector<HTMLInputElement>('[data-plan-end]');
  const dateRangeField = form.querySelector<HTMLElement>('.planning-ai-date-range-field');
  const rangeError = form.querySelector<HTMLElement>('[data-plan-range-error]');
  let index = 0;

  function focusPanel() {
    const title = panels[index]?.querySelector<HTMLElement>('h3');
    title?.setAttribute('tabindex', '-1');
    title?.focus({ preventScroll: true });
  }

  function scrollWizardTop() {
    if (!window.matchMedia('(max-width: 719px)').matches) return;
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    scrollTarget.scrollIntoView({ behavior, block: 'start' });
  }

  function visibleDateRangeControl() {
    return [...(dateRangeField?.querySelectorAll<HTMLInputElement>('input') ?? [])]
      .find((input) => input.type !== 'hidden' && !input.hidden);
  }

  function setRangeError(message = '', shouldFocus = true) {
    const control = visibleDateRangeControl();
    control?.setAttribute('aria-describedby', 'planning-ai-date-range-error');
    if (message) control?.setAttribute('aria-invalid', 'true');
    else control?.removeAttribute('aria-invalid');
    if (rangeError) {
      rangeError.textContent = message;
      rangeError.hidden = !message;
    }
    if (message && shouldFocus) control?.focus();
  }

  function selectedMeals() {
    return [...form.querySelectorAll<HTMLInputElement>('[data-plan-meal]')].filter((input) => input.checked);
  }

  function selectedPendingSlots() {
    return [...form.querySelectorAll<HTMLInputElement>('[data-plan-pending-slot]')].filter((input) => input.checked);
  }

  function validate(panelIndex: number, shouldFocus = true) {
    if (panelIndex === 0 && (!start?.value || !end?.value || start.value > end.value)) {
      const message = labels.invalidRange || 'Invalid range';
      setRangeError(message, shouldFocus);
      return message;
    }
    if (panelIndex === 0) setRangeError();
    if (panelIndex === 1 && selectedMeals().length === 0) {
      if (shouldFocus) form.querySelector<HTMLInputElement>('[data-plan-meal]')?.focus();
      return labels.meals || 'Meals';
    }
    if (panelIndex === 2 && selectedPendingSlots().length === 0) {
      if (shouldFocus) form.querySelector<HTMLInputElement>('[data-plan-pending-slot]')?.focus();
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
    notifyStep();
    if (focus) focusPanel();
    if (focus && previousIndex !== index) scrollWizardTop();
  }

  function validateBeforeSubmit(event: Event) {
    for (let panelIndex = 0; panelIndex < panels.length - 1; panelIndex += 1) {
      if (validate(panelIndex, false)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        go(panelIndex, true);
        window.requestAnimationFrame(() => {
          if (panelIndex === 0) visibleDateRangeControl()?.focus();
          else if (panelIndex === 1) form.querySelector<HTMLInputElement>('[data-plan-meal]')?.focus();
          else if (panelIndex === 2) form.querySelector<HTMLInputElement>('[data-plan-pending-slot]')?.focus();
        });
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
  start?.addEventListener('input', () => setRangeError());
  end?.addEventListener('input', () => setRangeError());
  form.addEventListener('submit', validateBeforeSubmit, { capture: true });
  go(0);
}
