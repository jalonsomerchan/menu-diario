const STATUS_SELECTOR = '[data-ai-status]';
const LOADING_PATTERN = /(gener|cargando|prepar|analiz|loading|generat|prepar|analyz)/i;
const observedStatuses = new WeakSet<HTMLElement>();
const scheduledStatuses = new WeakSet<HTMLElement>();

function getStatusText(element: HTMLElement) {
  const previousText = element.dataset.aiStatusText ?? '';
  const currentText = element.textContent?.trim() ?? '';
  const isDecorated = element.dataset.aiStatusDecorated === 'true';

  if (isDecorated && previousText && currentText === previousText) {
    return previousText;
  }

  return currentText;
}

function clearDecoratedStatus(element: HTMLElement, text: string) {
  element.removeAttribute('data-ai-loading');

  if (element.dataset.aiStatusDecorated === 'true') {
    element.textContent = text;
  }

  delete element.dataset.aiStatusDecorated;
  delete element.dataset.aiStatusText;
}

function decorateStatus(element: HTMLElement) {
  if (element.dataset.aiStatusRendering === 'true') return;

  const text = getStatusText(element);
  const isError = element.dataset.variant === 'error';
  const isLoading = Boolean(text) && !isError && LOADING_PATTERN.test(text);

  if (!isLoading) {
    clearDecoratedStatus(element, text);
    return;
  }

  if (element.dataset.aiStatusDecorated === 'true' && element.dataset.aiStatusText === text) {
    return;
  }

  element.dataset.aiStatusRendering = 'true';
  element.dataset.aiStatusDecorated = 'true';
  element.dataset.aiStatusText = text;
  element.setAttribute('data-ai-loading', 'true');

  const spinner = document.createElement('span');
  spinner.className = 'ai-status-spinner__icon';
  spinner.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.className = 'ai-status-spinner__text';
  label.textContent = text;

  element.replaceChildren(spinner, label);
  delete element.dataset.aiStatusRendering;
}

function scheduleDecorateStatus(element: HTMLElement) {
  if (scheduledStatuses.has(element)) return;
  scheduledStatuses.add(element);

  window.requestAnimationFrame(() => {
    scheduledStatuses.delete(element);
    decorateStatus(element);
  });
}

function observeStatus(element: HTMLElement) {
  if (observedStatuses.has(element)) return;
  observedStatuses.add(element);
  decorateStatus(element);

  new MutationObserver(() => scheduleDecorateStatus(element)).observe(element, {
    attributes: true,
    attributeFilter: ['data-variant'],
    childList: true,
    characterData: true,
    subtree: true,
  });
}

document.querySelectorAll<HTMLElement>(STATUS_SELECTOR).forEach(observeStatus);
