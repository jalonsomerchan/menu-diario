type SaveFeedbackLabels = {
  pending: string;
  saving: string;
  saved: string;
};

export function createSaveFeedback(element: HTMLElement | null, labels: SaveFeedbackLabels) {
  function show(message: string, variant: 'info' | 'error' = 'info') {
    if (!element) return;
    element.hidden = false;
    element.textContent = message;
    element.dataset.variant = variant;
    if (variant === 'info') {
      element.setAttribute('role', 'status');
    } else {
      element.setAttribute('role', 'alert');
    }
  }

  return {
    pending() {
      show(labels.pending);
    },
    saving() {
      show(labels.saving);
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
