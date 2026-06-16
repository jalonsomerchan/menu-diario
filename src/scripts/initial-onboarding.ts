type OnboardingLabels = {
  title: string;
  description: string;
  stepMealsTitle: string;
  stepMealsDescription: string;
  stepDishesTitle: string;
  stepDishesDescription: string;
  stepTuppersTitle: string;
  stepTuppersDescription: string;
  primaryAction: string;
  secondaryAction: string;
  tertiaryAction: string;
  dismiss: string;
  finish: string;
};

type OnboardingPaths = {
  settings: string;
  dishes: string;
  tuppers: string;
};

const storageKey = 'menu-diario-initial-onboarding-dismissed-v1';
const root = document.querySelector<HTMLElement>('[data-initial-onboarding]');

if (root && !isDismissed()) {
  const labels = readJson<OnboardingLabels>(root.dataset.labels, {} as OnboardingLabels);
  const paths = readJson<OnboardingPaths>(root.dataset.paths, { settings: '/', dishes: '/', tuppers: '/' });
  renderOnboarding(labels, paths);
}

function readJson<T>(value: string | undefined, fallback: T): T {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function isDismissed() {
  try {
    return window.localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

function dismissOnboarding(dialog: HTMLDialogElement) {
  try {
    window.localStorage.setItem(storageKey, '1');
  } catch {
    // Ignore private browsing storage errors.
  }
  dialog.close();
  dialog.addEventListener('transitionend', () => dialog.remove(), { once: true });
  setTimeout(() => dialog.remove(), 250);
}

function renderOnboarding(labels: OnboardingLabels, paths: OnboardingPaths) {
  const dialog = document.createElement('dialog');
  dialog.className = 'initial-onboarding';
  dialog.setAttribute('aria-labelledby', 'initial-onboarding-title');
  dialog.innerHTML = `
    <article class="initial-onboarding__surface">
      <header class="initial-onboarding__header">
        <span class="initial-onboarding__eyebrow">MenuDiario</span>
        <h2 id="initial-onboarding-title">${escapeHtml(labels.title)}</h2>
        <p>${escapeHtml(labels.description)}</p>
      </header>
      <ol class="initial-onboarding__steps">
        ${renderStep('1', labels.stepMealsTitle, labels.stepMealsDescription)}
        ${renderStep('2', labels.stepDishesTitle, labels.stepDishesDescription)}
        ${renderStep('3', labels.stepTuppersTitle, labels.stepTuppersDescription)}
      </ol>
      <nav class="initial-onboarding__actions" aria-label="${escapeHtml(labels.title)}">
        <a class="button button--primary" href="${escapeAttribute(paths.settings)}" data-onboarding-action>${escapeHtml(labels.primaryAction)}</a>
        <a class="button button--secondary" href="${escapeAttribute(paths.dishes)}" data-onboarding-action>${escapeHtml(labels.secondaryAction)}</a>
        <a class="button button--ghost" href="${escapeAttribute(paths.tuppers)}" data-onboarding-action>${escapeHtml(labels.tertiaryAction)}</a>
      </nav>
      <footer class="initial-onboarding__footer">
        <button class="button button--ghost" type="button" data-onboarding-dismiss>${escapeHtml(labels.dismiss)}</button>
        <button class="button button--secondary" type="button" data-onboarding-finish>${escapeHtml(labels.finish)}</button>
      </footer>
    </article>
  `;

  document.body.append(dialog);
  dialog.querySelectorAll('[data-onboarding-action]').forEach((link) => link.addEventListener('click', () => markDismissed()));
  dialog.querySelector('[data-onboarding-dismiss]')?.addEventListener('click', () => dismissOnboarding(dialog));
  dialog.querySelector('[data-onboarding-finish]')?.addEventListener('click', () => dismissOnboarding(dialog));
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    dismissOnboarding(dialog);
  });
  dialog.showModal();
}

function markDismissed() {
  try {
    window.localStorage.setItem(storageKey, '1');
  } catch {
    // Ignore private browsing storage errors.
  }
}

function renderStep(number: string, title: string, description: string) {
  return `
    <li class="initial-onboarding__step">
      <span aria-hidden="true">${escapeHtml(number)}</span>
      <div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
      </div>
    </li>
  `;
}

function escapeHtml(value = '') {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function escapeAttribute(value = '') {
  return escapeHtml(value).replaceAll("'", '&#39;');
}
