import { hasFirebaseConfig } from '../lib/firebase/config';
import { getFirebaseServices, signInAsGuest, signInWithGoogle } from '../lib/firebase/client';

const root = document.querySelector<HTMLElement>('[data-auth-gate]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const status = root.querySelector<HTMLElement>('[data-auth-status]');

  function showStatus(message: string, isError = false) {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.dataset.variant = isError ? 'error' : 'info';
  }

  function goToDashboard() {
    window.location.assign(labels.dashboardPath || '/dashboard');
  }

  if (!hasFirebaseConfig()) {
    showStatus(labels.configMissing, true);
  } else {
    getFirebaseServices()
      .then((services) => {
        services.authModule.onAuthStateChanged(services.auth, (user: unknown) => {
          if (user) goToDashboard();
        });

        root.querySelector('[data-google-login]')?.addEventListener('click', () =>
          signInWithGoogle().then(goToDashboard).catch((error: Error) => showStatus(error.message, true))
        );

        root.querySelector('[data-guest-login]')?.addEventListener('click', () =>
          signInAsGuest().then(goToDashboard).catch((error: Error) => showStatus(error.message, true))
        );
      })
      .catch((error: Error) => showStatus(error.message, true));
  }
}
