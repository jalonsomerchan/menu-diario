type AiErrorPayload = {
  code: string;
  detail?: string;
  status?: number;
  at: number;
};

type WindowWithAiError = Window & {
  __menuDiarioLastAiError?: AiErrorPayload;
};

type RegenerateConfig = {
  rootSelector: string;
  formSelector?: string;
  submitSelector?: string;
  shoppingSummarySelector?: string;
  shoppingNextSelector?: string;
};

const regenerateConfigs: RegenerateConfig[] = [
  {
    rootSelector: '[data-planning-ai-app]',
    formSelector: '[data-plan-form]',
    submitSelector: '[data-plan-submit]',
  },
  {
    rootSelector: '[data-dish-recommender-app]',
    formSelector: '[data-dish-recommender-form]',
    submitSelector: '[data-dish-submit]',
  },
  {
    rootSelector: '[data-shopping-app]',
    shoppingSummarySelector: '[data-wizard-progress-step="summary"] button',
    shoppingNextSelector: '[data-wizard-next]',
  },
];

const copy = {
  es: {
    generateAgain: 'Generar otra vez',
    detail: 'Detalle',
    disabled: 'La ayuda inteligente está desactivada ahora mismo.',
    'missing-config': 'La ayuda inteligente no está configurada ahora mismo.',
    'app-check-unavailable': 'La verificación de seguridad aún no está lista. Inténtalo de nuevo en unos minutos.',
    'quota-exhausted': 'Has alcanzado el límite de peticiones de IA por ahora.',
    timeout: 'La IA ha tardado demasiado en responder.',
    'invalid-response': 'La IA respondió, pero el formato no es válido.',
    'network-error': 'No se ha podido conectar con la IA. Revisa la conexión e inténtalo de nuevo.',
    'server-error': 'El servidor de IA ha devuelto un error interno.',
    'auth-error': 'No se ha podido validar tu sesión para usar la IA.',
    'request-failed': 'No se ha podido completar la petición de IA.',
  },
  en: {
    generateAgain: 'Generate again',
    detail: 'Detail',
    disabled: 'Smart help is disabled right now.',
    'missing-config': 'Smart help is not configured right now.',
    'app-check-unavailable': 'The security check is not ready yet. Try again in a few minutes.',
    'quota-exhausted': 'You have reached the AI request limit for now.',
    timeout: 'The AI took too long to respond.',
    'invalid-response': 'The AI responded, but the format is not valid.',
    'network-error': 'Could not connect to the AI. Check your connection and try again.',
    'server-error': 'The AI server returned an internal error.',
    'auth-error': 'Your session could not be verified for AI usage.',
    'request-failed': 'The AI request could not be completed.',
  },
} as const;

function getLocale() {
  return document.documentElement.lang === 'en' ? 'en' : 'es';
}

function getLocalCopy() {
  return copy[getLocale()];
}

function readRootLabels(root: HTMLElement) {
  try {
    return JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function getFinalStepPanel(status: HTMLElement) {
  return status.closest<HTMLElement>('[data-plan-step], [data-dish-step], [data-wizard-step]');
}

function isPanelVisible(panel: HTMLElement | null) {
  return !panel || !panel.hidden;
}

function getRegenerateLabel(root: HTMLElement, submitButton: HTMLButtonElement | null) {
  const labels = readRootLabels(root);
  return labels.regenerate || labels.retryGeneration || submitButton?.textContent?.trim() || getLocalCopy().generateAgain;
}

function requestFormSubmit(root: HTMLElement, config: RegenerateConfig) {
  const form = config.formSelector ? root.querySelector<HTMLFormElement>(config.formSelector) : null;
  const submitButton = config.submitSelector ? root.querySelector<HTMLButtonElement>(config.submitSelector) : null;

  if (form) {
    form.requestSubmit(submitButton ?? undefined);
    return;
  }

  const summaryButton = config.shoppingSummarySelector
    ? root.querySelector<HTMLButtonElement>(config.shoppingSummarySelector)
    : null;
  const nextButton = config.shoppingNextSelector ? root.querySelector<HTMLButtonElement>(config.shoppingNextSelector) : null;

  summaryButton?.click();
  window.requestAnimationFrame(() => nextButton?.click());
}

function addRegenerateButton(root: HTMLElement, config: RegenerateConfig) {
  const status = root.querySelector<HTMLElement>('[data-ai-status]');
  if (!status || root.querySelector('[data-ai-regenerate]')) return;

  const submitButton = config.submitSelector ? root.querySelector<HTMLButtonElement>(config.submitSelector) : null;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button--secondary button--small';
  button.dataset.aiRegenerate = 'true';
  button.textContent = getRegenerateLabel(root, submitButton);
  button.hidden = true;
  button.addEventListener('click', () => requestFormSubmit(root, config));
  status.insertAdjacentElement('afterend', button);

  const syncButton = () => {
    const panel = getFinalStepPanel(status);
    const isBusy = Boolean(root.querySelector('[aria-busy="true"]'));
    button.hidden = !isPanelVisible(panel);
    button.disabled = isBusy;
  };

  syncButton();
  new MutationObserver(syncButton).observe(root, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ['hidden', 'aria-busy'],
  });
}

function getLastAiError() {
  const payload = (window as WindowWithAiError).__menuDiarioLastAiError;
  if (!payload || Date.now() - payload.at > 8000) return null;
  return payload;
}

function formatTypedAiError(payload: AiErrorPayload) {
  const labels = getLocalCopy();
  const base = labels[payload.code as keyof typeof labels] || labels['request-failed'];
  const detail = payload.detail?.trim();

  if (!detail) return base;
  return `${base} ${labels.detail}: ${detail}`;
}

function syncAiErrorStatus(status: HTMLElement) {
  if (status.dataset.variant !== 'error') return;
  const payload = getLastAiError();
  if (!payload) return;

  const message = formatTypedAiError(payload);
  const signature = `${payload.at}:${message}`;
  if (status.dataset.aiFeedbackSignature === signature) return;

  status.dataset.aiFeedbackSignature = signature;
  status.textContent = message;
}

function watchAiStatus(status: HTMLElement) {
  const sync = () => syncAiErrorStatus(status);
  sync();
  new MutationObserver(sync).observe(status, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true,
    attributeFilter: ['data-variant'],
  });
}

regenerateConfigs.forEach((config) => {
  document.querySelectorAll<HTMLElement>(config.rootSelector).forEach((root) => addRegenerateButton(root, config));
});

document.querySelectorAll<HTMLElement>('[data-ai-status]').forEach(watchAiStatus);
document.addEventListener('menu-diario-ai-error', () => {
  document.querySelectorAll<HTMLElement>('[data-ai-status]').forEach(syncAiErrorStatus);
});
