import { useShoppingWhatsappTranslations } from '../i18n/shopping-whatsapp';

const root = document.querySelector<HTMLElement>('[data-shopping-app]');

if (root) {
  const locale = document.documentElement.lang === 'en' ? 'en' : 'es';
  const t = useShoppingWhatsappTranslations(locale);
  const toolbar = root.querySelector<HTMLElement>('.shopping-toolbar');
  const status = root.querySelector<HTMLElement>('[data-status]');

  if (toolbar && !toolbar.querySelector('[data-whatsapp-export]')) {
    const button = document.createElement('button');
    button.className = 'button button--secondary button--small';
    button.type = 'button';
    button.dataset.whatsappExport = 'true';
    button.textContent = t('action');
    toolbar.insertBefore(button, toolbar.firstChild);
    button.addEventListener('click', () => exportToWhatsapp(t, status));
  }
}

type Translate = ReturnType<typeof useShoppingWhatsappTranslations>;

function exportToWhatsapp(t: Translate, status: HTMLElement | null) {
  const text = buildShoppingText(t);
  if (!text) {
    showStatus(status, t('empty'), true);
    return;
  }

  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  showStatus(status, t('shared'));
}

function buildShoppingText(t: Translate) {
  const items = [...document.querySelectorAll<HTMLElement>('.shopping-item[data-status="to-buy"]')]
    .map((item) => {
      const title = item.querySelector<HTMLElement>('.shopping-item__title')?.textContent?.trim() ?? '';
      const quantity = item.querySelector<HTMLElement>('.shopping-pill')?.textContent?.trim() ?? '';
      return [title, quantity].filter(Boolean).join(' · ');
    })
    .filter(Boolean);

  if (!items.length) return '';

  return [`${t('title')}:`, '', ...items.map((item) => `- ${item}`)].join('\n');
}

function showStatus(status: HTMLElement | null, message: string, isError = false) {
  if (!status) return;
  status.hidden = false;
  status.textContent = message;
  status.dataset.variant = isError ? 'error' : 'info';
}
