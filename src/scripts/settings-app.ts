import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { formatAppError } from '../lib/errors';
import {
  buildGroupInviteUrl,
  buildGroupInvitePath,
  groupInviteStorageKey,
  readGroupInviteCode,
} from '../lib/menu/group-invite-link';
import { deleteDailyOption, saveDailyOption, watchDailyOptions } from '../lib/menu/daily-options-repository';
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
import type { DailyOption } from '../lib/menu/types';
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
  const inviteLinkInput = root.querySelector<HTMLInputElement>('[data-invite-link]');
  const members = root.querySelector<HTMLElement>('[data-members]');
  const pending = root.querySelector<HTMLElement>('[data-pending]');
  const leaveButton = root.querySelector<HTMLButtonElement>('[data-leave-group]');
  const joinLinkStatus = root.querySelector<HTMLElement>('[data-join-link-status]');
  const joinLinkAction = root.querySelector<HTMLButtonElement>('[data-join-link-action]');
  const confirmDialogElement = root.querySelector<HTMLDialogElement>('[data-confirm-dialog]');
  const confirmDialog = confirmDialogElement ? createConfirmDialog(confirmDialogElement) : null;
  const dailyOptionsList = root.querySelector<HTMLElement>('[data-daily-options-list]');
  const dailyOptionForm = root.querySelector<HTMLFormElement>('[data-daily-option-form]');
  const dailyOptionIdInput = root.querySelector<HTMLInputElement>('[data-daily-option-id]');
  const dailyOptionNameInput = root.querySelector<HTMLInputElement>('[data-daily-option-name]');
  const dailyOptionDescriptionInput = root.querySelector<HTMLInputElement>('[data-daily-option-description]');
  const dailyOptionColorInput = root.querySelector<HTMLSelectElement>('[data-daily-option-color]');
  const dailyOptionIconInput = root.querySelector<HTMLSelectElement>('[data-daily-option-icon]');
  const dailyOptionOrderInput = root.querySelector<HTMLInputElement>('[data-daily-option-order]');
  const dailyOptionActiveInput = root.querySelector<HTMLInputElement>('[data-daily-option-active]');

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentGroup: MenuGroup | null = null;
  let pendingInviteCode = '';
  let dailyOptions: DailyOption[] = [];
  let unsubscribeProfile: (() => void) | undefined;
  let unsubscribeGroup: (() => void) | undefined;
  let unsubscribeDailyOptions: (() => void) | undefined;

  function escapeHtml(value = '') {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function normalizeFoodIntolerances(value: string) {
    return value.trim().slice(0, maxFoodIntolerancesLength);
  }

  function readStoredInviteCode() {
    if (typeof sessionStorage === 'undefined') return '';
    return sessionStorage.getItem(groupInviteStorageKey)?.trim().toUpperCase() ?? '';
  }

  function storeInviteCode(inviteCode: string) {
    if (typeof sessionStorage === 'undefined') return;
    const normalizedCode = inviteCode.trim().toUpperCase();
    if (normalizedCode) {
      sessionStorage.setItem(groupInviteStorageKey, normalizedCode);
      return;
    }
    sessionStorage.removeItem(groupInviteStorageKey);
  }

  function clearInviteCodeFromUrl() {
    const nextPath = buildGroupInvitePath(labels.settingsPath || window.location.pathname, '');
    window.history.replaceState({}, '', nextPath);
  }

  function syncPendingInviteCode() {
    pendingInviteCode = readGroupInviteCode(window.location.search) || readStoredInviteCode();
    return pendingInviteCode;
  }

  function renderPendingInviteState() {
    const inviteCode = syncPendingInviteCode();
    if (joinLinkStatus) {
      joinLinkStatus.textContent = inviteCode ? labels.joinLinkReady : labels.joinLinkMissing;
    }
    if (joinLinkAction) {
      joinLinkAction.disabled = !inviteCode;
      joinLinkAction.setAttribute('aria-disabled', String(!inviteCode));
    }
  }

  function showStatus(message: string, isError = false) {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.dataset.variant = isError ? 'error' : 'info';
  }

  function reportError(error: unknown) {
    showStatus(formatAppError(error, labels), true);
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

  function readDailyOptionForm() {
    return {
      id: dailyOptionIdInput?.value.trim() || undefined,
      name: dailyOptionNameInput?.value.trim() ?? '',
      description: dailyOptionDescriptionInput?.value.trim() ?? '',
      color: dailyOptionColorInput?.value ?? 'blue',
      icon: dailyOptionIconInput?.value ?? 'note',
      order: Number(dailyOptionOrderInput?.value || dailyOptions.length),
      active: dailyOptionActiveInput?.checked ?? true,
    };
  }

  function resetDailyOptionForm() {
    if (dailyOptionIdInput) dailyOptionIdInput.value = '';
    if (dailyOptionNameInput) dailyOptionNameInput.value = '';
    if (dailyOptionDescriptionInput) dailyOptionDescriptionInput.value = '';
    if (dailyOptionColorInput) dailyOptionColorInput.value = 'blue';
    if (dailyOptionIconInput) dailyOptionIconInput.value = 'note';
    if (dailyOptionOrderInput) dailyOptionOrderInput.value = String(dailyOptions.length);
    if (dailyOptionActiveInput) dailyOptionActiveInput.checked = true;
  }

  function editDailyOption(option: DailyOption) {
    if (dailyOptionIdInput) dailyOptionIdInput.value = option.id;
    if (dailyOptionNameInput) dailyOptionNameInput.value = option.name;
    if (dailyOptionDescriptionInput) dailyOptionDescriptionInput.value = option.description;
    if (dailyOptionColorInput) dailyOptionColorInput.value = option.color;
    if (dailyOptionIconInput) dailyOptionIconInput.value = option.icon;
    if (dailyOptionOrderInput) dailyOptionOrderInput.value = String(option.order);
    if (dailyOptionActiveInput) dailyOptionActiveInput.checked = option.active;
    dailyOptionNameInput?.focus();
  }

  function renderDailyOptions(nextOptions = dailyOptions) {
    dailyOptions = nextOptions;
    if (!dailyOptionsList) return;
    dailyOptionsList.innerHTML = dailyOptions.length
      ? dailyOptions
          .map((option) => `
            <article class="settings-daily-option-item" data-daily-option="${escapeHtml(option.id)}">
              <div class="settings-daily-option-item__header">
                <div>
                  <strong>${escapeHtml(option.name)}</strong>
                  ${option.description ? `<p>${escapeHtml(option.description)}</p>` : ''}
                </div>
                <span class="day-option-badge day-option-badge--${escapeHtml(option.color)}">${escapeHtml(option.icon)}</span>
              </div>
              <p>${escapeHtml(option.active ? labels.dailyOptionActive : labels.dailyOptionInactive)}</p>
              <div class="settings-daily-option-item__actions">
                <button class="button button--ghost button--small" type="button" data-daily-option-edit="${escapeHtml(option.id)}">${escapeHtml(labels.dailyOptionEdit)}</button>
                <button class="button button--ghost button--small" type="button" data-daily-option-delete="${escapeHtml(option.id)}">${escapeHtml(labels.dailyOptionDelete)}</button>
              </div>
            </article>
          `)
          .join('')
      : `<p>${escapeHtml(labels.dailyOptionEmpty)}</p>`;
    resetDailyOptionForm();
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

    if (inviteLinkInput) {
      inviteLinkInput.value = buildGroupInviteUrl(window.location.origin, labels.settingsPath || window.location.pathname, group.inviteCode);
    }

    root.querySelectorAll<HTMLInputElement>('[data-meal-preference]').forEach((input) => {
      input.checked = group.enabledMeals.includes(input.value as MealSlot);
    });

    renderList(members, group.memberEmails.length ? group.memberEmails : group.members, labels.membersEmpty);
    renderList(pending, group.pendingEmails, labels.pendingEmpty);
    renderPendingInviteState();
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

        dailyOptionForm?.addEventListener('submit', (event) => {
          event.preventDefault();
          runAction(async () => {
            if (!currentUser || !currentGroup || currentGroup.ownerId !== currentUser.uid) return;
            const values = readDailyOptionForm();
            if (values.name.length < 2) {
              showStatus(labels.dailyOptionInvalid, true);
              return;
            }
            await saveDailyOption(services, currentUser.uid, values, currentGroup.id, currentGroup.members);
            showStatus(labels.dailyOptionSaved);
          });
        });

        root.querySelector('[data-daily-option-reset]')?.addEventListener('click', resetDailyOptionForm);

        dailyOptionsList?.addEventListener('click', (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;

          const editButton = target.closest<HTMLButtonElement>('[data-daily-option-edit]');
          if (editButton) {
            const option = dailyOptions.find((item) => item.id === editButton.dataset.dailyOptionEdit);
            if (option) editDailyOption(option);
            return;
          }

          const deleteButton = target.closest<HTMLButtonElement>('[data-daily-option-delete]');
          if (!deleteButton) return;
          runAction(async () => {
            if (!currentUser || !currentGroup || currentGroup.ownerId !== currentUser.uid) return;
            await deleteDailyOption(services, deleteButton.dataset.dailyOptionDelete ?? '');
            showStatus(labels.dailyOptionDeleted);
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

        joinLinkAction?.addEventListener('click', () => {
          runAction(async () => {
            const inviteCode = syncPendingInviteCode();
            if (!currentUser || !inviteCode) return;
            await joinGroupByInviteCode(services, currentUser, inviteCode);
            storeInviteCode('');
            clearInviteCodeFromUrl();
            renderPendingInviteState();
            showStatus(labels.joinedFromLink);
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
            if (!(target instanceof HTMLElement) || !target.closest('[data-copy-code]') || !currentGroup || !inviteLinkInput?.value) return;
            await navigator.clipboard?.writeText(inviteLinkInput.value);
            showStatus(labels.copied);
          });
        });

        services.authModule.onAuthStateChanged(services.auth, (user: FirebaseUser | null) => {
          runAction(async () => {
            currentUser = user;
            unsubscribeProfile?.();
            unsubscribeGroup?.();
            unsubscribeDailyOptions?.();

            if (!user) {
              const inviteCode = syncPendingInviteCode();
              if (inviteCode) {
                storeInviteCode(inviteCode);
              }
              window.location.assign(labels.homePath || '/');
              return;
            }

            renderPendingInviteState();
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
                  unsubscribeDailyOptions?.();
                  unsubscribeDailyOptions = watchDailyOptions(
                    services,
                    { userId: user.uid, groupId },
                    renderDailyOptions,
                    reportError
                  );
                });
              },
              reportError
            );
          });
        });
      })
      .catch(reportError);
  }

  renderPendingInviteState();
}
