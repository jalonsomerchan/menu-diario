import { closeSession, getFirebaseAuthServices, getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { isAdminUser } from '../lib/firebase/auth';
import { updateUserPreferences, watchUserProfile } from '../lib/menu/repository';
import type { FirebaseUser, ThemePreference } from '../lib/menu/types';

const root = document.querySelector<HTMLElement>('[data-site-header]');
const themes: ThemePreference[] = ['system', 'light', 'dark'];
const themeStorageKey = 'menu-diario-theme';
const themeSelects = root
  ? [...root.querySelectorAll<HTMLSelectElement>('[data-global-theme]')]
  : [];

function rememberTheme(theme: ThemePreference) {
  try {
    if (theme === 'system') {
      window.localStorage.removeItem(themeStorageKey);
    } else {
      window.localStorage.setItem(themeStorageKey, theme);
    }
  } catch {
    // Storage can be disabled in private contexts; the live theme still applies.
  }
}

function applyTheme(theme: ThemePreference) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.dataset.theme = theme;
  }

  rememberTheme(theme);
  themeSelects.forEach((themeSelect) => {
    themeSelect.value = theme;
  });
}

const initialTheme = document.documentElement.dataset.theme;
themeSelects.forEach((themeSelect) => {
  themeSelect.value = initialTheme === 'light' || initialTheme === 'dark' ? initialTheme : 'system';
  themeSelect.addEventListener('change', () => {
    if (!themes.includes(themeSelect.value as ThemePreference)) return;
    applyTheme(themeSelect.value as ThemePreference);
  });
});

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const toggle = root.querySelector<HTMLElement>('[data-site-menu-toggle]');
  const panel = root.querySelector<HTMLElement>('[data-site-menu-panel]');
  const mobileMenu = root.querySelector<HTMLDetailsElement>('[data-mobile-menu]');

  function setMenuOpen(isOpen: boolean) {
    if (mobileMenu && mobileMenu.open !== isOpen) {
      mobileMenu.open = isOpen;
    }

    root!.dataset.menuOpen = String(isOpen);
    toggle?.setAttribute('aria-expanded', String(isOpen));
    toggle?.setAttribute('aria-label', isOpen ? labels.closeMenu : labels.openMenu);
  }

  mobileMenu?.addEventListener('toggle', () => {
    root!.dataset.menuOpen = String(mobileMenu.open);
    toggle?.setAttribute('aria-expanded', String(mobileMenu.open));
    toggle?.setAttribute('aria-label', mobileMenu.open ? labels.closeMenu : labels.openMenu);
  });

  panel?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest('a') || target.closest('[data-global-logout]')) setMenuOpen(false);
  });

  document.addEventListener('click', (event) => {
    if (!mobileMenu?.open) return;
    const target = event.target;
    if (!(target instanceof Element) || mobileMenu.contains(target)) return;
    setMenuOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (root.dataset.menuOpen !== 'true' && !mobileMenu?.open) return;
    setMenuOpen(false);
    toggle?.focus();
  });
}

if (root && hasFirebaseConfig()) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const guestLabel = labels.guestSession ?? 'Guest session';
  const logoutButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-global-logout]')];
  const adminLinks = [...root.querySelectorAll<HTMLAnchorElement>('[data-admin-link]')];

  getFirebaseAuthServices().then((services) => {
    let currentUser: FirebaseUser | null = null;

    logoutButtons.forEach((logoutButton) => {
      logoutButton.addEventListener('click', () => closeSession());
    });

    themeSelects.forEach((themeSelect) => {
      themeSelect.addEventListener('change', async () => {
        if (!currentUser || !themes.includes(themeSelect.value as ThemePreference)) return;
        await updateUserPreferences(services, currentUser.uid, {
          theme: themeSelect.value as ThemePreference,
        });
      });
    });

    services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
      currentUser = user;
      logoutButtons.forEach((logoutButton) => logoutButton.toggleAttribute('hidden', !user));
      adminLinks.forEach((adminLink) => adminLink.toggleAttribute('hidden', !user));
      if (!user) return;

      const isAdmin = await isAdminUser(user);
      adminLinks.forEach((adminLink) => adminLink.toggleAttribute('hidden', !isAdmin));

      const unsubscribe = watchUserProfile(
        services,
        user,
        guestLabel,
        (profile) => applyTheme(profile.theme),
        () => undefined
      );
      window.addEventListener('beforeunload', () => unsubscribe());
    });
  });
}
