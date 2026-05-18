const app = document.querySelector<HTMLElement>('[data-shopping-app]');
const ALEXA_SCHEME = String.fromCharCode(97, 108, 101, 120, 97);
const ALEXA_SHOPPING_LIST_URL = `${ALEXA_SCHEME}://index.html#lists/shopping`;

if (app) {
  const locale = document.documentElement.lang === 'en' ? 'en' : 'es';
  const toolbar = app.querySelector<HTMLElement>('.shopping-toolbar');
  const draft = app.querySelector<HTMLElement>('[data-draft]');
  const status = app.querySelector<HTMLElement>('[data-status]');
  const saveButton = app.querySelector<HTMLButtonElement>('[data-save]');
  const labels = getLabels(locale);
  const alexaButton = document.createElement('button');

  alexaButton.className = 'button button--ghost button--small';
  alexaButton.type = 'button';
  alexaButton.dataset.alexa = '';
  alexaButton.textContent = labels.addToAlexa;
  toolbar?.insertBefore(alexaButton, saveButton ?? null);

  function showStatus(message: string, isError = false) {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.dataset.variant = isError ? 'error' : 'info';
  }

  function getToBuyLabels() {
    return [...app.querySelectorAll<HTMLElement>('[data-item-id][data-status="to-buy"]')]
      .map((item) => {
        const name = item.querySelector<HTMLElement>('.shopping-item__title')?.textContent?.trim() ?? '';
        const quantity = item.querySelector<HTMLElement>('.shopping-pill')?.textContent?.trim() ?? '';
        return [name, quantity].filter(Boolean).join(' ');
      })
      .filter(Boolean);
  }

  function formatNaturalList(items: string[]) {
    if (items.length <= 1) return items[0] ?? '';
    if (items.length === 2) return `${items[0]} ${labels.and} ${items[1]}`;
    return `${items.slice(0, -1).join(', ')} ${labels.and} ${items.at(-1)}`;
  }

  function buildAssistantCommand() {
    return `${labels.commandPrefix} ${formatNaturalList(getToBuyLabels())}`.trim();
  }

  function updateButtonState() {
    alexaButton.disabled = getToBuyLabels().length === 0;
  }

  async function addToAssistantList() {
    const command = buildAssistantCommand();
    if (!command || getToBuyLabels().length === 0) {
      showStatus(labels.noToBuyItems, true);
      return;
    }

    try {
      await navigator.clipboard.writeText(command);
      showStatus(labels.copied);
      window.location.href = ALEXA_SHOPPING_LIST_URL;
    } catch {
      showStatus(labels.copyError, true);
    }
  }

  alexaButton.addEventListener('click', () => {
    void addToAssistantList();
  });

  draft?.addEventListener('click', () => window.requestAnimationFrame(updateButtonState));
  const observer = new MutationObserver(updateButtonState);
  if (draft) observer.observe(draft, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-status'] });
  updateButtonState();
}

function getLabels(locale: 'es' | 'en') {
  if (locale === 'en') {
    return {
      addToAlexa: 'Add to Alexa',
      copied: 'Alexa command copied. Opening Alexa...',
      copyError: 'Could not copy the Alexa command.',
      commandPrefix: 'Add to my shopping list',
      noToBuyItems: 'There are no items marked as buy right now.',
      and: 'and',
    };
  }

  return {
    addToAlexa: 'Añadir a Alexa',
    copied: 'Orden para Alexa copiada. Abriendo Alexa...',
    copyError: 'No se ha podido copiar la orden para Alexa.',
    commandPrefix: 'Añade a la lista de la compra',
    noToBuyItems: 'No hay ingredientes marcados como comprar ahora mismo.',
    and: 'y',
  };
}
