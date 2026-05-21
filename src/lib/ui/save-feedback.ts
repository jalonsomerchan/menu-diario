type SaveFeedbackLabels = {
  pending: string;
  saving: string;
  saved: string;
};

export function createSaveFeedback(element: HTMLElement | null, labels: SaveFeedbackLabels) {
  let hideTimer: number | undefined;

  function clearHideTimer() {
    if (hideTimer === undefined) return;
    window.clearTimeout(hideTimer);
    hideTimer = undefined;
  }

  function scheduleHide(delay = 3200) {
    if (!element) return;
    clearHideTimer();
    hideTimer = window.setTimeout(() => {
      element.hidden = true;
      element.removeAttribute('data-variant');
      hideTimer = undefined;
    }, delay);
  }

  function show(message: string, variant: 'info' | 'error' = 'info', autoHide = true) {
    if (!element) return;
    clearHideTimer();
    element.hidden = false;
    element.textContent = message;
    element.dataset.variant = variant;
    if (variant === 'info') {
      element.setAttribute('role', 'status');
    } else {
      element.setAttribute('role', 'alert');
    }
    if (autoHide) scheduleHide(variant === 'error' ? 5200 : 3200);
  }

  return {
    pending() {
      show(labels.pending, 'info', false);
    },
    saving() {
      show(labels.saving, 'info', false);
    },
    saved(message = labels.saved) {
      show(message);
    },
    error(message: string) {
      show(message, 'error');
    },
    info(message: string) {
      show(message);
    },
  };
}
