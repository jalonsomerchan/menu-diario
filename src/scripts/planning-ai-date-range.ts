type FlatpickrInstance = {
  setDate: (dates: string[], triggerChange?: boolean) => void;
};

type FlatpickrFactory = (
  element: HTMLInputElement,
  options: {
    mode: 'range';
    dateFormat: string;
    altInput: boolean;
    altFormat: string;
    defaultDate: string[];
    locale: string;
    onChange: (selectedDates: Date[]) => void;
  }
) => FlatpickrInstance;

declare global {
  interface Window {
    flatpickr?: FlatpickrFactory;
  }
}

const root = document.querySelector<HTMLElement>('[data-planning-ai-app]');

if (root) {
  const dateRangeInput = root.querySelector<HTMLInputElement>('[data-plan-date-range]');
  const startInput = root.querySelector<HTMLInputElement>('[data-plan-start]');
  const endInput = root.querySelector<HTMLInputElement>('[data-plan-end]');

  if (dateRangeInput && startInput && endInput) {
    const locale = document.documentElement.lang === 'en' ? 'en' : 'es';
    let picker: FlatpickrInstance | null = null;

    function toIsoDate(date: Date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    function notifyRangeChange() {
      startInput?.dispatchEvent(new Event('input', { bubbles: true }));
      endInput?.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function syncVisibleRange(triggerChange = false) {
      if (!picker || !startInput?.value || !endInput?.value) return;
      picker.setDate([startInput.value, endInput.value], triggerChange);
    }

    function loadStyles() {
      if (document.querySelector('link[data-flatpickr-cdn]')) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.13/flatpickr.min.css';
      link.dataset.flatpickrCdn = 'true';
      document.head.append(link);
    }

    function loadScript() {
      return new Promise<void>((resolve, reject) => {
        if (window.flatpickr) {
          resolve();
          return;
        }

        const existing = document.querySelector<HTMLScriptElement>('script[data-flatpickr-cdn]');
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('flatpickr load failed')), { once: true });
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.13/flatpickr.min.js';
        script.defer = true;
        script.dataset.flatpickrCdn = 'true';
        script.addEventListener('load', () => resolve(), { once: true });
        script.addEventListener('error', () => reject(new Error('flatpickr load failed')), { once: true });
        document.head.append(script);
      });
    }

    async function initDateRangePicker() {
      try {
        loadStyles();
        await loadScript();
        if (!window.flatpickr) return;

        picker = window.flatpickr(dateRangeInput, {
          mode: 'range',
          dateFormat: 'Y-m-d',
          altInput: true,
          altFormat: locale === 'en' ? 'M j, Y' : 'j M Y',
          defaultDate: [startInput.value, endInput.value].filter(Boolean),
          locale,
          onChange(selectedDates) {
            if (selectedDates[0]) startInput.value = toIsoDate(selectedDates[0]);
            if (selectedDates[1]) endInput.value = toIsoDate(selectedDates[1]);
            if (selectedDates.length >= 2) notifyRangeChange();
          },
        });

        syncVisibleRange(false);
      } catch {
        dateRangeInput.type = 'text';
      }
    }

    root.querySelectorAll<HTMLButtonElement>('[data-plan-preset]').forEach((button) => {
      button.addEventListener('click', () => {
        queueMicrotask(() => syncVisibleRange(false));
      });
    });

    startInput.addEventListener('input', () => syncVisibleRange(false));
    endInput.addEventListener('input', () => syncVisibleRange(false));

    initDateRangePicker();
  }
}

export {};
