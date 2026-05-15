import { closeSession, getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { updateUserPreferences, watchUserProfile } from '../lib/menu/repository';
import type { FirebaseUser, ThemePreference } from '../lib/menu/types';

const root = document.querySelector<HTMLElement>('[data-app-header]');
const themes: ThemePreference[] = ['system', 'light', 'dark'];

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const toggle = root.querySelector<HTMLButtonElement>('[data-app-menu-toggle]');
  const panel = root.querySelector<HTMLElement>('[data-app-menu-panel]');

  toggle?.addEventListener('click', () => {
    const isOpen = root.dataset.menuOpen === 'true';
    root.dataset.menuOpen = String(!isOpen);
    toggle.setAttribute('aria-expanded', String(!isOpen));
    toggle.setAttribute('aria-label', !isOpen ? labels.closeMenu : labels.openMenu);
  });

  panel?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.closest('a')) return;
    root.dataset.menuOpen = 'false';
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.setAttribute('aria-label', labels.openMenu);
  });
}

if (root && hasFirebaseConfig()) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const guestLabel = labels.guestSession ?? 'Guest session';
  const themeSelect = root.querySelector<HTMLSelectElement>('[data-global-theme]');

  function applyTheme(theme: ThemePreference) {
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.dataset.theme = theme;
    }

    if (themeSelect) themeSelect.value = theme;
  }

  getFirebaseServices().then((services) => {
    root.querySelector('[data-global-logout]')?.addEventListener('click', () => closeSession());

    services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
      if (!user) return;

      const unsubscribe = watchUserProfile(
        services,
        user,
        guestLabel,
        (profile) => applyTheme(profile.theme),
        () => undefined
      );

      themeSelect?.addEventListener('change', async () => {
        if (!themes.includes(themeSelect.value as ThemePreference)) return;
        await updateUserPreferences(services, user.uid, { theme: themeSelect.value as ThemePreference });
      });

      window.addEventListener('beforeunload', () => unsubscribe());
    });
  });
}
