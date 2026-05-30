const initializedRoots = new WeakSet<ParentNode>();
let documentListenersReady = false;

function closeDetails(details: HTMLDetailsElement) {
  details.open = false;
}

function closeOtherDetails(current: HTMLDetailsElement) {
  document.querySelectorAll<HTMLDetailsElement>('details[data-day-actions][open], details[data-details-menu][open]').forEach((details) => {
    if (details !== current) closeDetails(details);
  });
}

function installDocumentListeners() {
  if (documentListenersReady) return;
  documentListenersReady = true;

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;

    document.querySelectorAll<HTMLDetailsElement>('details[data-day-actions][open], details[data-details-menu][open]').forEach((details) => {
      if (!details.contains(target)) closeDetails(details);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll<HTMLDetailsElement>('details[data-day-actions][open], details[data-details-menu][open]').forEach(closeDetails);
  });

  document.addEventListener(
    'toggle',
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLDetailsElement) || !target.matches('details[data-day-actions], details[data-details-menu]') || !target.open) return;
      closeOtherDetails(target);
    },
    true
  );
}

export function installDetailsMenuAutoClose(root: ParentNode) {
  if (initializedRoots.has(root)) return;
  initializedRoots.add(root);
  installDocumentListeners();

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest<HTMLButtonElement>('details[data-day-actions] button, details[data-details-menu] button');
    const details = button?.closest<HTMLDetailsElement>('details[data-day-actions], details[data-details-menu]');
    if (details) closeDetails(details);
  });
}
