import { closeSession, getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { ensureUserProfile, updateUserPreferences, watchUserProfile } from '../lib/menu/repository';
import type { FirebaseUser, ThemePreference } from '../lib/menu/types';

const root = document.querySelector<HTMLElement>('[data-app-header]');
const themes: ThemePreference[] = ['system', 'light', 'dark'];

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

      await ensureUserProfile(services, user, guestLabel);
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
