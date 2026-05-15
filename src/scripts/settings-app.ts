import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import {
  addPendingGroupEmail,
  ensureDefaultGroup,
  ensureUserProfile,
  joinGroupByInviteCode,
  leaveGroup,
  updateGroupOptions,
  updateUserPreferences,
  watchGroup,
  watchUserProfile,
} from '../lib/menu/repository';
import type { FirebaseUser, MealSlot, MenuGroup, ThemePreference, UserProfile } from '../lib/menu/types';

const root = document.querySelector<HTMLElement>('[data-settings-app]');
const themes: ThemePreference[] = ['system', 'light', 'dark'];

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const status = root.querySelector<HTMLElement>('[data-status]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const content = root.querySelector<HTMLElement>('[data-content]');
  const themeSelect = root.querySelector<HTMLSelectElement>('[data-theme-select]');
  const inviteCode = root.querySelector<HTMLElement>('[data-invite-code]');
  const members = root.querySelector<HTMLElement>('[data-members]');
  const pending = root.querySelector<HTMLElement>('[data-pending]');

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentGroup: MenuGroup | null = null;
  let unsubscribeProfile: (() => void) | undefined;
  let unsubscribeGroup: (() => void) | undefined;

  function escapeHtml(value = '') {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function showStatus(message: string, isError = false) {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.dataset.variant = isError ? 'error' : 'info';
  }

  function setVisible(isReady: boolean) {
    if (loading) loading.hidden = isReady;
    if (content) content.hidden = !isReady;
  }

  function applyTheme(theme: ThemePreference) {
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.dataset.theme = theme;
    }
    if (themeSelect) themeSelect.value = theme;
  }

  function selectedMeals(): MealSlot[] {
    const selected = [...root.querySelectorAll<HTMLInputElement>('[data-meal-preference]')]
      .filter((input) => input.checked)
      .map((input) => input.value as MealSlot);

    return selected.length ? selected : ['lunch'];
  }

  function renderGroup(group: MenuGroup | null) {
    currentGroup = group;
    setVisible(true);

    if (!group) return;

    if (inviteCode) {
      inviteCode.innerHTML = `<button class="button button--secondary" type="button" data-copy-code>${escapeHtml(group.inviteCode)}</button>`;
    }

    root.querySelectorAll<HTMLInputElement>('[data-meal-preference]').forEach((input) => {
      input.checked = group.enabledMeals.includes(input.value as MealSlot);
    });

    if (members) {
      members.innerHTML = group.memberEmails.length
        ? group.memberEmails.map((email) => `<li>${escapeHtml(email)}</li>`).join('')
        : group.members.map((member) => `<li>${escapeHtml(member)}</li>`).join('');
    }

    if (pending) {
      pending.innerHTML = group.pendingEmails.length
        ? group.pendingEmails.map((email) => `<li>${escapeHtml(email)}</li>`).join('')
        : `<li>${escapeHtml(labels.updated)}</li>`;
    }
  }

  if (!hasFirebaseConfig()) {
    setVisible(false);
    showStatus(labels.configMissing, true);
  } else {
    getFirebaseServices()
      .then((services) => {
        themeSelect?.addEventListener('change', async () => {
          if (!currentUser || !themes.includes(themeSelect.value as ThemePreference)) return;
          const theme = themeSelect.value as ThemePreference;
          applyTheme(theme);
          await updateUserPreferences(services, currentUser.uid, { theme });
        });

        root.querySelectorAll<HTMLInputElement>('[data-meal-preference]').forEach((input) => {
          input.addEventListener('change', async () => {
            if (!currentGroup || !currentUser) return;
            const enabledMeals = selectedMeals();
            await updateGroupOptions(services, currentGroup.id, enabledMeals);
            await updateUserPreferences(services, currentUser.uid, { enabledMeals });
            showStatus(labels.updated);
          });
        });

        root.querySelector('[data-invite-form]')?.addEventListener('submit', async (event) => {
          event.preventDefault();
          const input = root.querySelector<HTMLInputElement>('[data-invite-email]');
          if (!currentGroup || !input?.value) return;
          await addPendingGroupEmail(services, currentGroup.id, input.value);
          input.value = '';
          showStatus(`${labels.copied} ${currentGroup.inviteCode}`);
        });

        root.querySelector('[data-join-form]')?.addEventListener('submit', async (event) => {
          event.preventDefault();
          const input = root.querySelector<HTMLInputElement>('[data-join-code]');
          if (!currentUser || !input?.value) return;
          await joinGroupByInviteCode(services, currentUser, input.value);
          input.value = '';
          showStatus(labels.updated);
        });

        root.querySelector('[data-leave-group]')?.addEventListener('click', async () => {
          if (!currentUser || !currentGroup || !currentProfile) return;
          await leaveGroup(services, currentUser, currentGroup);
          const personalProfile: UserProfile = { ...currentProfile, groupId: undefined };
          const groupId = await ensureDefaultGroup(services, currentUser, personalProfile);
          unsubscribeGroup?.();
          unsubscribeGroup = watchGroup(services, groupId, renderGroup, (error) => showStatus(error.message, true));
        });

        root.addEventListener('click', async (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement) || !target.closest('[data-copy-code]') || !currentGroup) return;
          await navigator.clipboard?.writeText(currentGroup.inviteCode);
          showStatus(labels.copied);
        });

        services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
          currentUser = user;
          unsubscribeProfile?.();
          unsubscribeGroup?.();

          if (!user) {
            window.location.assign(labels.homePath || '/');
            return;
          }

          await ensureUserProfile(services, user, labels.guestSession);
          unsubscribeProfile = watchUserProfile(
            services,
            user,
            labels.guestSession,
            async (profile) => {
              currentProfile = profile;
              applyTheme(profile.theme);
              const groupId = await ensureDefaultGroup(services, user, profile);
              unsubscribeGroup?.();
              unsubscribeGroup = watchGroup(services, groupId, renderGroup, (error) => showStatus(error.message, true));
            },
            (error) => showStatus(error.message, true)
          );
        });
      })
      .catch((error: Error) => showStatus(error.message, true));
  }
}
