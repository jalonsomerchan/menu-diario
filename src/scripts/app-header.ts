import { closeSession, getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { isAdminUser } from '../lib/firebase/auth';
import { updateUserPreferences, watchUserProfile } from '../lib/menu/repository';
import type { FirebaseUser, ThemePreference } from '../lib/menu/types';

const root = document.querySelector<HTMLElement>('[data-site-header]');
const themes: ThemePreference[] = ['system', 'light', 'dark'];

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const toggle = root.querySelector<HTMLButtonElement>('[data-site-menu-toggle]');
  const panel = root.querySelector<HTMLElement>('[data-site-menu-panel]');

  function setMenuOpen(isOpen: boolean) {
    root!.dataset.menuOpen = String(isOpen);
    toggle?.setAttribute('aria-expanded', String(isOpen));
    toggle?.setAttribute('aria-label', isOpen ? labels.closeMenu : labels.openMenu);
  }

  toggle?.addEventListener('click', () => setMenuOpen(root.dataset.menuOpen !== 'true'));

  panel?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.closest('a')) return;
    setMenuOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || root.dataset.menuOpen !== 'true') return;
    setMenuOpen(false);
    toggle?.focus();
  });
}

if (root && hasFirebaseConfig()) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const guestLabel = labels.guestSession ?? 'Guest session';
  const themeSelect = root.querySelector<HTMLSelectElement>('[data-global-theme]');
  const logoutButton = root.querySelector<HTMLButtonElement>('[data-global-logout]');
  const adminLink = root.querySelector<HTMLAnchorElement>('[data-admin-link]');

  function applyTheme(theme: ThemePreference) {
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.dataset.theme = theme;
    }

    if (themeSelect) themeSelect.value = theme;
  }

  getFirebaseServices().then((services) => {
    logoutButton?.addEventListener('click', () => closeSession());

    services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
      logoutButton?.toggleAttribute('hidden', !user);
      adminLink?.toggleAttribute('hidden', !user);
      if (!user) return;
      adminLink?.toggleAttribute('hidden', !(await isAdminUser(user)));

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
