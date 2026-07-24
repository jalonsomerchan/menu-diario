import { closeSession, getFirebaseAuthServices, getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { isAdminUser } from '../lib/firebase/auth';
import { updateUserPreferences, watchUserProfile } from '../lib/menu/repository';
import type { FirebaseUser, ThemePreference } from '../lib/menu/types';

const root = document.querySelector<HTMLElement>('[data-site-header]');
const themes: ThemePreference[] = ['system', 'light', 'dark'];
const themeStorageKey = 'menu-diario-theme';
const themeSelects = root ? [...root.querySelectorAll<HTMLSelectElement>('[data-global-theme]')] : [];
const systemDarkMode = window.matchMedia('(prefers-color-scheme: dark)');
const themeColor = document.querySelector<HTMLMetaElement>('[data-theme-color]');

function syncThemeColor(theme: ThemePreference) {
  const effectiveTheme = theme === 'system' ? (systemDarkMode.matches ? 'dark' : 'light') : theme;
  themeColor?.setAttribute('content', effectiveTheme === 'dark' ? '#0b0b0d' : '#f5f5f7');
}

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
  syncThemeColor(theme);
  themeSelects.forEach((themeSelect) => {
    themeSelect.value = theme;
  });
}

let storedTheme: ThemePreference = 'system';
try {
  const value = window.localStorage.getItem(themeStorageKey);
  if (value === 'light' || value === 'dark') storedTheme = value;
} catch {
  // Keep the system preference when storage is unavailable.
}
syncThemeColor(storedTheme);

systemDarkMode.addEventListener('change', () => {
  if (!document.documentElement.dataset.theme) syncThemeColor('system');
});

themeSelects.forEach((themeSelect) => {
  themeSelect.value = storedTheme;
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
  const menuScrim = root.querySelector<HTMLButtonElement>('[data-site-menu-scrim]');
  const desktopMenus = [...root.querySelectorAll<HTMLDetailsElement>('.main-nav--desktop details')];

  function setMenuOpen(isOpen: boolean) {
    if (mobileMenu && mobileMenu.open !== isOpen) {
      mobileMenu.open = isOpen;
    }

    root!.dataset.menuOpen = String(isOpen);
    document.documentElement.classList.toggle('is-navigation-open', isOpen);
    toggle?.setAttribute('aria-expanded', String(isOpen));
    toggle?.setAttribute('aria-label', isOpen ? labels.closeMenu : labels.openMenu);
  }

  mobileMenu?.addEventListener('toggle', () => {
    root!.dataset.menuOpen = String(mobileMenu.open);
    document.documentElement.classList.toggle('is-navigation-open', mobileMenu.open);
    toggle?.setAttribute('aria-expanded', String(mobileMenu.open));
    toggle?.setAttribute('aria-label', mobileMenu.open ? labels.closeMenu : labels.openMenu);
  });

  panel?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest('a') || target.closest('[data-global-logout]')) setMenuOpen(false);
  });

  menuScrim?.addEventListener('click', () => setMenuOpen(false));

  desktopMenus.forEach((details) => {
    details.addEventListener('toggle', () => {
      if (!details.open) return;
      desktopMenus.forEach((candidate) => {
        if (candidate !== details) candidate.open = false;
      });
    });
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (mobileMenu?.open && !mobileMenu.contains(target)) setMenuOpen(false);
    desktopMenus.forEach((details) => {
      if (details.open && !details.contains(target)) details.open = false;
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    if (root.dataset.menuOpen === 'true' || mobileMenu?.open) {
      setMenuOpen(false);
      toggle?.focus();
      return;
    }

    const openDesktopMenu = desktopMenus.find((details) => details.open);
    if (!openDesktopMenu) return;
    openDesktopMenu.open = false;
    openDesktopMenu.querySelector<HTMLElement>('summary')?.focus();
  });

  window.matchMedia('(min-width: 1024px)').addEventListener('change', (event) => {
    if (event.matches) setMenuOpen(false);
  });
}

if (root && hasFirebaseConfig()) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const guestLabel = labels.guestSession ?? 'Guest session';
  const logoutButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-global-logout]')];
  const adminLinks = [...root.querySelectorAll<HTMLAnchorElement>('[data-admin-link]')];

  getFirebaseAuthServices().then((services) => {
    logoutButtons.forEach((logoutButton) => {
      logoutButton.addEventListener('click', () => closeSession());
    });

    services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
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

      themeSelects.forEach((themeSelect) => {
        themeSelect.addEventListener('change', async () => {
          if (!themes.includes(themeSelect.value as ThemePreference)) return;
          const theme = themeSelect.value as ThemePreference;
          await updateUserPreferences(services, user.uid, { theme });
        });
      });

      window.addEventListener('beforeunload', () => unsubscribe());
    });
  });
}
