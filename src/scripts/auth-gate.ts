import { hasFirebaseConfig } from '../lib/firebase/config';
import { getFirebaseServices, signInAsGuest, signInWithGoogle } from '../lib/firebase/client';

const root = document.querySelector<HTMLElement>('[data-auth-gate]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const status = root.querySelector<HTMLElement>('[data-auth-status]');
  const sessionLoading = root.querySelector<HTMLElement>('[data-auth-session-loading]');
  const googleButton = root.querySelector<HTMLButtonElement>('[data-google-login]');
  const guestButton = root.querySelector<HTMLButtonElement>('[data-guest-login]');

  function setSessionLoading(isLoading: boolean) {
    if (sessionLoading) {
      sessionLoading.hidden = !isLoading;
      sessionLoading.setAttribute('aria-busy', String(isLoading));
    }

    [googleButton, guestButton].forEach((button) => {
      if (!button) return;
      button.hidden = isLoading;
      button.disabled = isLoading;
    });
  }

  function revealLogin() {
    setSessionLoading(false);
  }

  function showStatus(message: string, isError = false) {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.dataset.variant = isError ? 'error' : 'info';
  }

  function goToDashboard() {
    window.location.assign(labels.dashboardPath || '/dashboard');
  }

  setSessionLoading(true);

  if (!hasFirebaseConfig()) {
    revealLogin();
    showStatus(labels.configMissing, true);
    [googleButton, guestButton].forEach((button) => {
      if (button) button.disabled = true;
    });
  } else {
    getFirebaseServices()
      .then((services) => {
        services.authModule.onAuthStateChanged(services.auth, (user: unknown) => {
          if (user) {
            goToDashboard();
            return;
          }

          revealLogin();
        });

        googleButton?.addEventListener('click', () =>
          signInWithGoogle().then(goToDashboard).catch((error: Error) => showStatus(error.message, true))
        );

        guestButton?.addEventListener('click', () =>
          signInAsGuest().then(goToDashboard).catch((error: Error) => showStatus(error.message, true))
        );
      })
      .catch((error: Error) => {
        revealLogin();
        showStatus(error.message, true);
      });
  }
}
