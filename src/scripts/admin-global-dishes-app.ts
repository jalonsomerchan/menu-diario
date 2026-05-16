import { buildGlobalDishImportPreview, parseGlobalDishImport } from '../lib/dishes/admin-import.mjs';
import { createGlobalDish, updateGlobalDishMetadata, watchGlobalDishes } from '../lib/dishes/repository';
import { isAdminUser } from '../lib/firebase/auth';
import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import type { Dish, FirebaseUser } from '../lib/menu/types';

const root = document.querySelector<HTMLElement>('[data-admin-dishes-app]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const status = root.querySelector<HTMLElement>('[data-status]');
  const loading = root.querySelector<HTMLElement>('[data-loading]');
  const denied = root.querySelector<HTMLElement>('[data-denied]');
  const content = root.querySelector<HTMLElement>('[data-content]');
  const singleForm = root.querySelector<HTMLFormElement>('[data-single-form]');
  const importForm = root.querySelector<HTMLFormElement>('[data-import-form]');
  const previewButton = root.querySelector<HTMLButtonElement>('[data-preview-import]');
  const applyImportButton = root.querySelector<HTMLButtonElement>('[data-apply-import]');
  const previewContainer = root.querySelector<HTMLElement>('[data-import-preview]');
  const searchInput = root.querySelector<HTMLInputElement>('[data-search]');
  const filterSelect = root.querySelector<HTMLSelectElement>('[data-filter]');
  const list = root.querySelector<HTMLElement>('[data-list]');
  const editorDialog = root.querySelector<HTMLDialogElement>('[data-editor-dialog]');
  const editorForm = root.querySelector<HTMLFormElement>('[data-editor-form]');
  const editorCancel = root.querySelector<HTMLButtonElement>('[data-editor-cancel]');
  const editorStatus = root.querySelector<HTMLElement>('[data-editor-status]');

  let currentUser: FirebaseUser | null = null;
  let globalDishes: Dish[] = [];
  let preview: ReturnType<typeof buildGlobalDishImportPreview> | null = null;
  let editingDishId = '';
  let returnFocusTo: HTMLElement | null = null;

  function escapeHtml(value = '') {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function setStatus(message: string, isError = false) {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.dataset.variant = isError ? 'error' : 'info';
    status.setAttribute('role', isError ? 'alert' : 'status');
  }

  function formatError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'dish-invalid-name') return labels.invalid;
    if (message === 'dish-duplicate-global') return labels.duplicateGlobal;
    if (message.toLowerCase().includes('permission')) return labels.permissionsError;
    return message;
  }

  function setVisible(isReady: boolean, allowed = false) {
    if (loading) loading.hidden = isReady;
    if (denied) denied.hidden = !isReady || allowed;
    if (content) content.hidden = !isReady || !allowed;
  }

  function parseTagInput(value: string) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function getFilteredDishes() {
    const query = searchInput?.value.trim().toLocaleLowerCase('es-ES') ?? '';
    const mode = filterSelect?.value ?? 'all';
    return globalDishes.filter((dish) => {
      if (mode === 'active' && dish.archived) return false;
      if (mode === 'archived' && !dish.archived) return false;
      if (!query) return true;
      return (
        dish.name.toLocaleLowerCase('es-ES').includes(query) ||
        (dish.tags ?? []).some((tag) => tag.toLocaleLowerCase('es-ES').includes(query))
      );
    });
  }

  function renderList() {
    if (!list) return;
    const dishes = getFilteredDishes();
    if (!dishes.length) {
      list.innerHTML = `<p>${escapeHtml(searchInput?.value || filterSelect?.value !== 'all' ? labels.emptySearch : labels.empty)}</p>`;
      return;
    }

    list.innerHTML = dishes
      .map(
        (dish) => `
          <article class="admin-dishes-item" data-dish-id="${escapeHtml(dish.id)}">
            <div class="admin-dishes-item__meta">
              <strong>${escapeHtml(dish.name)}</strong>
              <span>${escapeHtml(dish.archived ? labels.archivedState : labels.activeState)}</span>
            </div>
            <p>${escapeHtml(labels.tags)}: ${escapeHtml((dish.tags ?? []).join(', ') || labels.sourceAdmin)}</p>
            <div class="admin-dishes-item__meta">
              <span>${escapeHtml(labels.quickTags)}: ${escapeHtml((dish.quickTags ?? []).join(', ') || labels.sourceAdmin)}</span>
              <button class="button button--secondary button--small" type="button" data-edit-dish>${escapeHtml(labels.edit)}</button>
            </div>
          </article>
        `
      )
      .join('');
  }

  function renderPreview() {
    if (!previewContainer) return;
    if (!preview || !preview.items.length) {
      previewContainer.textContent = labels.previewEmpty;
      if (applyImportButton) applyImportButton.disabled = true;
      return;
    }

    previewContainer.innerHTML = preview.items
      .map(
        (item) => `
          <article class="admin-dishes-preview-item" data-action="${escapeHtml(item.action)}">
            <p><strong>${escapeHtml(item.name)}</strong></p>
            <p class="admin-dishes-preview-item__meta">${escapeHtml(
              item.action === 'create'
                ? labels.previewCreate
                : item.action === 'update'
                  ? labels.previewUpdate
                  : item.action === 'skip'
                    ? labels.previewSkip
                    : labels.previewReview
            )}</p>
          </article>
        `
      )
      .join('');
    if (applyImportButton) applyImportButton.disabled = !preview.canImport;
  }

  function openEditor(dish: Dish, trigger?: HTMLElement | null) {
    if (!editorForm || !editorDialog) return;
    editingDishId = dish.id;
    returnFocusTo = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    editorForm.elements.namedItem('name') instanceof HTMLInputElement && (editorForm.elements.namedItem('name').value = dish.name);
    editorForm.elements.namedItem('tags') instanceof HTMLInputElement && (editorForm.elements.namedItem('tags').value = (dish.tags ?? []).join(', '));
    editorForm.elements.namedItem('quickTags') instanceof HTMLInputElement && (editorForm.elements.namedItem('quickTags').value = (dish.quickTags ?? []).join(', '));
    editorForm.elements.namedItem('archived') instanceof HTMLInputElement && (editorForm.elements.namedItem('archived').checked = Boolean(dish.archived));
    if (editorStatus) editorStatus.textContent = labels.savePending;
    editorDialog.showModal();
    requestAnimationFrame(() => (editorForm.elements.namedItem('name') as HTMLInputElement | null)?.focus());
  }

  function closeEditor() {
    editorDialog?.close();
  }

  if (!hasFirebaseConfig()) {
    setVisible(false, false);
    setStatus(labels.noFirebase, true);
  } else {
    getFirebaseServices()
      .then((services) => {
        singleForm?.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (!currentUser) return;
          const formData = new FormData(singleForm);
          try {
            await createGlobalDish(services, currentUser.uid, {
              name: String(formData.get('name') ?? ''),
              tags: parseTagInput(String(formData.get('tags') ?? '')),
              quickTags: parseTagInput(String(formData.get('quickTags') ?? '')),
              archived: formData.get('archived') === 'on',
            });
            singleForm.reset();
            setStatus(labels.created);
          } catch (error) {
            setStatus(formatError(error), true);
          }
        });

        previewButton?.addEventListener('click', () => {
          const formData = new FormData(importForm ?? undefined);
          try {
            const entries = parseGlobalDishImport(String(formData.get('payload') ?? ''), String(formData.get('format') ?? 'text'));
            preview = buildGlobalDishImportPreview(entries, globalDishes, String(formData.get('duplicateMode') ?? 'skip'));
            renderPreview();
          } catch (error) {
            preview = null;
            renderPreview();
            setStatus(formatError(error), true);
          }
        });

        importForm?.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (!currentUser || !preview?.canImport) return;

          try {
            let created = 0;
            let updated = 0;
            for (const item of preview.items) {
              if (item.action === 'skip' || item.action === 'review') continue;
              if (item.action === 'update' && item.duplicate) {
                await updateGlobalDishMetadata(services, currentUser.uid, item.duplicate.id, item);
                updated += 1;
                continue;
              }
              await createGlobalDish(services, currentUser.uid, item);
              created += 1;
            }
            setStatus(labels.importResult.replace('{created}', String(created)).replace('{updated}', String(updated)));
          } catch (error) {
            setStatus(formatError(error), true);
          }
        });

        searchInput?.addEventListener('input', renderList);
        filterSelect?.addEventListener('change', renderList);

        list?.addEventListener('click', (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          const card = target.closest<HTMLElement>('[data-dish-id]');
          const dish = globalDishes.find((item) => item.id === card?.dataset.dishId);
          if (!card || !dish || !target.closest('[data-edit-dish]')) return;
          openEditor(dish, target.closest('[data-edit-dish]') as HTMLElement | null);
        });

        editorCancel?.addEventListener('click', closeEditor);
        editorDialog?.addEventListener('click', (event) => {
          if (event.target === editorDialog) closeEditor();
        });
        editorDialog?.addEventListener('close', () => {
          returnFocusTo?.focus();
          returnFocusTo = null;
        });

        editorForm?.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (!currentUser || !editingDishId) return;
          const formData = new FormData(editorForm);
          try {
            if (editorStatus) editorStatus.textContent = labels.saveSaving;
            await updateGlobalDishMetadata(services, currentUser.uid, editingDishId, {
              name: String(formData.get('name') ?? ''),
              tags: parseTagInput(String(formData.get('tags') ?? '')),
              quickTags: parseTagInput(String(formData.get('quickTags') ?? '')),
              archived: formData.get('archived') === 'on',
            });
            if (editorStatus) editorStatus.textContent = labels.updated;
            closeEditor();
          } catch (error) {
            if (editorStatus) editorStatus.textContent = error instanceof Error ? error.message : String(error);
          }
        });

        services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
          currentUser = user;
          if (!user) {
            window.location.assign(labels.homePath || '/');
            return;
          }

          const admin = await isAdminUser(user);
          setVisible(true, admin);
          if (!admin) return;

          watchGlobalDishes(
            services,
            (dishes) => {
              globalDishes = dishes;
              renderList();
              if (preview) {
                preview = buildGlobalDishImportPreview(preview.items, globalDishes, String(new FormData(importForm ?? undefined).get('duplicateMode') ?? 'skip'));
                renderPreview();
              }
            },
            (error) => setStatus(formatError(error), true),
            true
          );
        });
      })
      .catch((error: Error) => {
        setVisible(false, false);
        setStatus(formatError(error), true);
      });
  }
}
