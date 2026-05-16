type ConfirmDialogOptions = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  eyebrow?: string;
  confirmVariant?: 'danger' | 'primary';
  returnFocusTo?: HTMLElement | null;
  initialFocus?: 'cancel' | 'confirm';
};

export function createConfirmDialog(dialog: HTMLDialogElement) {
  const title = dialog.querySelector<HTMLElement>('[data-confirm-dialog-title]');
  const description = dialog.querySelector<HTMLElement>('[data-confirm-dialog-description]');
  const eyebrow = dialog.querySelector<HTMLElement>('[data-confirm-dialog-eyebrow]');
  const cancelButton = dialog.querySelector<HTMLButtonElement>('[data-confirm-dialog-cancel]');
  const confirmButton = dialog.querySelector<HTMLButtonElement>('[data-confirm-dialog-confirm]');

  if (!title || !description || !cancelButton || !confirmButton) {
    throw new Error('confirm-dialog-missing-elements');
  }

  return {
    open(options: ConfirmDialogOptions) {
      title.textContent = options.title;
      description.textContent = options.description;
      cancelButton.textContent = options.cancelLabel;
      confirmButton.textContent = options.confirmLabel;
      confirmButton.classList.toggle('button--danger', options.confirmVariant !== 'primary');
      confirmButton.classList.toggle('button--primary', options.confirmVariant === 'primary');

      if (eyebrow) {
        eyebrow.textContent = options.eyebrow ?? '';
        eyebrow.hidden = !options.eyebrow;
      }

      return new Promise<boolean>((resolve) => {
        const returnFocusTo =
          options.returnFocusTo ??
          (document.activeElement instanceof HTMLElement ? document.activeElement : null);

        const handleClose = () => {
          dialog.removeEventListener('click', handleBackdropClick);
          returnFocusTo?.focus();
          resolve(dialog.returnValue === 'confirm');
        };

        const handleBackdropClick = (event: MouseEvent) => {
          if (event.target === dialog) dialog.close('cancel');
        };

        dialog.addEventListener('close', handleClose, { once: true });
        dialog.addEventListener('click', handleBackdropClick);
        dialog.showModal();

        requestAnimationFrame(() => {
          if (options.initialFocus === 'confirm') {
            confirmButton.focus();
            return;
          }
          cancelButton.focus();
        });
      });
    },
  };
}
