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
import { createConfirmDialog } from '../lib/ui/confirm-dialog';

const root = document.querySelector<HTMLElement>('[data-settings-app]');
const themes: ThemePreference[] = ['system', 'light', 'dark'];
const maxFoodIntolerancesLength = 1000;

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const status = root.querySelector<HTMLElement>('[data-status]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const content = root.querySelector<HTMLElement>('[data-content]');
  const themeSelect = root.querySelector<HTMLSelectElement>('[data-theme-select]');
  const foodIntolerancesInput = root.querySelector<HTMLTextAreaElement>('[data-food-intolerances]');
  const inviteCode = root.querySelector<HTMLElement>('[data-invite-code]');
  const members = root.querySelector<HTMLElement>('[data-members]');
  const pending = root.querySelector<HTMLElement>('[data-pending]');
  const leaveButton = root.querySelector<HTMLButtonElement>('[data-leave-group]');
  const confirmDialogElement = root.querySelector<HTMLDialogElement>('[data-confirm-dialog]');
  const confirmDialog = confirmDialogElement ? createConfirmDialog(confirmDialogElement) : null;

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentGroup: MenuGroup | null = null;
  let unsubscribeProfile: (() => void) | undefined;
  let unsubscribeGroup: (() => void) | undefined;

  function escapeHtml(value = '') {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function normalizeFoodIntolerances(value: string) {
    return value.trim().slice(0, maxFoodIntolerancesLength);
  }

  function showStatus(message: string, isError = false) {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.dataset.variant = isError ? 'error' : 'info';
  }

  function reportError(error: unknown) {
    showStatus(error instanceof Error ? error.message : String(error), true);
  }

  function runAction(action: () => Promise<void>) {
    action().catch(reportError);
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

  function renderProfile(profile: UserProfile) {
    currentProfile = profile;
    applyTheme(profile.theme);
    if (foodIntolerancesInput) {
      foodIntolerancesInput.value = profile.foodIntolerances;
    }
  }

  function selectedMeals(): MealSlot[] {
    const selected = [...root.querySelectorAll<HTMLInputElement>('[data-meal-preference]')]
      .filter((input) => input.checked)
      .map((input) => input.value as MealSlot);

    return selected.length ? selected : ['lunch'];
  }

  function renderList(container: HTMLElement | null, values: string[], emptyLabel: string) {
    if (!container) return;
    container.innerHTML = values.length
      ? values.map((value) => `<li>${escapeHtml(value)}</li>`).join('')
      : `<li>${escapeHtml(emptyLabel)}</li>`;
  }

  function setGroupAdminState(isOwner: boolean) {
    root.querySelectorAll<HTMLElement>('[data-group-admin-section]').forEach((section) => {
      section.dataset.disabled = String(!isOwner);
    });
    root.querySelectorAll<HTMLElement>('[data-group-permission-note]').forEach((note) => {
      note.hidden = isOwner;
    });
    root.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLFieldSetElement>('[data-group-admin-control] input, [data-group-admin-control] button, [data-group-admin-control]').forEach((control) => {
      control.disabled = !isOwner;
    });
  }

  function renderGroup(group: MenuGroup | null) {
    currentGroup = group;
    setVisible(true);

    if (!group) return;

    const isOwner = currentUser?.uid === group.ownerId;
    setGroupAdminState(isOwner);

    if (inviteCode) {
      inviteCode.innerHTML = `<button class="button button--secondary" type="button" data-copy-code ${isOwner ? '' : 'disabled'}>${escapeHtml(group.inviteCode)}</button>`;
    }

    root.querySelectorAll<HTMLInputElement>('[data-meal-preference]').forEach((input) => {
      input.checked = group.enabledMeals.includes(input.value as MealSlot);
    });

    renderList(members, group.memberEmails.length ? group.memberEmails : group.members, labels.membersEmpty);
    renderList(pending, group.pendingEmails, labels.pendingEmpty);
  }

  if (!hasFirebaseConfig()) {
    setVisible(false);
    showStatus(labels.configMissing, true);
  } else {
    getFirebaseServices()
      .then((services) => {
        themeSelect?.addEventListener('change', () => {
          runAction(async () => {
            if (!currentUser || !themes.includes(themeSelect.value as ThemePreference)) return;
            const theme = themeSelect.value as ThemePreference;
            applyTheme(theme);
            await updateUserPreferences(services, currentUser.uid, { theme });
          });
        });

        root.querySelector('[data-food-intolerances-form]')?.addEventListener('submit', (event) => {
          event.preventDefault();
          runAction(async () => {
            if (!currentUser || !foodIntolerancesInput) return;
            const foodIntolerances = normalizeFoodIntolerances(foodIntolerancesInput.value);
            foodIntolerancesInput.value = foodIntolerances;
            await updateUserPreferences(services, currentUser.uid, { foodIntolerances });
            showStatus(labels.foodIntolerancesSaved);
          });
        });

        root.querySelectorAll<HTMLInputElement>('[data-meal-preference]').forEach((input) => {
          input.addEventListener('change', () => {
            runAction(async () => {
              if (!currentGroup || !currentUser || currentGroup.ownerId !== currentUser.uid) return;
              const enabledMeals = selectedMeals();
              await updateGroupOptions(services, currentGroup.id, enabledMeals);
              await updateUserPreferences(services, currentUser.uid, { enabledMeals });
              showStatus(labels.updated);
            });
          });
        });

        root.querySelector('[data-invite-form]')?.addEventListener('submit', (event) => {
          event.preventDefault();
          runAction(async () => {
            const input = root.querySelector<HTMLInputElement>('[data-invite-email]');
            if (!currentGroup || !currentUser || currentGroup.ownerId !== currentUser.uid || !input?.value) return;
            await addPendingGroupEmail(services, currentGroup.id, input.value);
            input.value = '';
            showStatus(labels.updated);
          });
        });

        root.querySelector('[data-join-form]')?.addEventListener('submit', (event) => {
          event.preventDefault();
          runAction(async () => {
            const input = root.querySelector<HTMLInputElement>('[data-join-code]');
            if (!currentUser || !input?.value) return;
            await joinGroupByInviteCode(services, currentUser, input.value);
            input.value = '';
            showStatus(labels.updated);
          });
        });

        leaveButton?.addEventListener('click', () => {
          runAction(async () => {
            if (!currentUser || !currentGroup || !currentProfile) return;
            const confirmed = await confirmDialog?.open({
              title: labels.leaveConfirmTitle,
              description: labels.leaveConfirmDescription,
              confirmLabel: labels.leaveConfirmConfirm,
              cancelLabel: labels.leaveConfirmCancel,
              confirmVariant: 'danger',
              returnFocusTo: leaveButton,
            });
            if (!confirmed) return;
            await leaveGroup(services, currentUser, currentGroup);
            const personalProfile: UserProfile = { ...currentProfile, groupId: undefined };
            const groupId = await ensureDefaultGroup(services, currentUser, personalProfile);
            unsubscribeGroup?.();
            unsubscribeGroup = watchGroup(services, groupId, renderGroup, reportError);
          });
        });

        root.addEventListener('click', (event) => {
          runAction(async () => {
            const target = event.target;
            if (!(target instanceof HTMLElement) || !target.closest('[data-copy-code]') || !currentGroup) return;
            await navigator.clipboard?.writeText(currentGroup.inviteCode);
            showStatus(labels.copied);
          });
        });

        services.authModule.onAuthStateChanged(services.auth, (user: FirebaseUser | null) => {
          runAction(async () => {
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
              (profile) => {
                runAction(async () => {
                  renderProfile(profile);
                  const groupId = await ensureDefaultGroup(services, user, profile);
                  unsubscribeGroup?.();
                  unsubscribeGroup = watchGroup(services, groupId, renderGroup, reportError);
                });
              },
              reportError
            );
          });
        });
      })
      .catch(reportError);
  }
}
