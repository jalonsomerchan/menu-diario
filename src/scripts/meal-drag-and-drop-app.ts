import { formatAppError } from '../lib/errors';
import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { getWeekStartForDate, getWeekStartsForDates } from '../lib/menu/dates';
import { canMoveMeal, createMovedMealDays, type MealDragSource } from '../lib/menu/meal-drag-and-drop';
import {
  clearDropTarget,
  clearMealMoveClasses,
  getDayKeyFromTarget,
  getSourceFromRow,
  getVisibleDayKeys,
  prepareMealRows,
  updateDropTarget,
} from '../lib/menu/meal-dnd-dom';
import { normalizeDay } from '../lib/menu/normalizers';
import {
  ensureUserProfile,
  getOrCreateWeekMenus,
  updateMenuDay,
  watchUserProfile,
  watchWeekMenusByIds,
} from '../lib/menu/repository';
import type { DailyMenu, FirebaseUser, MealSlot, UserProfile, WeekMenu } from '../lib/menu/types';
import { createSaveFeedback } from '../lib/ui/save-feedback';

const root = document.querySelector<HTMLElement>('[data-dashboard-app], [data-configurator-app]');

if (root && hasFirebaseConfig()) {
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const status = root.querySelector<HTMLElement>('[data-status]');
  const daysContainer = root.querySelector<HTMLElement>('[data-next-days], [data-config-days]');
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'es-ES';
  const saveFeedback = createSaveFeedback(status, {
    pending: labels.savePending,
    saving: labels.saveSaving,
    saved: labels.saveSaved,
  });

  let currentUser: FirebaseUser | null = null;
  let currentProfile: UserProfile | null = null;
  let currentMenus: WeekMenu[] = [];
  let currentMenuIdsByWeekStart: Record<string, string> = {};
  let unsubscribeProfile: (() => void) | undefined;
  let unsubscribeMenus: (() => void) | undefined;
  let servicesRef: Awaited<ReturnType<typeof getFirebaseServices>> | null = null;
  let watchedWeekStartsKey = '';
  let syncTimer: number | undefined;
  let activeSource: MealDragSource | null = null;
  let activeSourceRow: HTMLElement | null = null;
  let currentDropTargetDay = '';

  function showStatus(message: string, isError = false) {
    if (isError) {
      saveFeedback.error(message);
      return;
    }

    saveFeedback.info(message);
  }

  function formatError(error: unknown) {
    return formatAppError(error, labels);
  }

  function getEnabledMeals(): MealSlot[] {
    return currentProfile?.enabledMeals?.length ? currentProfile.enabledMeals : ['lunch'];
  }

  function getMenuForDay(dayKey: string) {
    const weekStart = getWeekStartForDate(dayKey);
    return currentMenus.find((menu) => menu.weekStart === weekStart) ?? null;
  }

  function getMenuIdForDay(dayKey: string) {
    return currentMenuIdsByWeekStart[getWeekStartForDate(dayKey)] ?? '';
  }

  function getDay(dayKey: string) {
    return normalizeDay(getMenuForDay(dayKey)?.days?.[dayKey]);
  }

  function canMoveSource(source: MealDragSource) {
    return canMoveMeal(source, getDay(source.dayKey));
  }

  function updateLocalDay(dayKey: string, nextDay: DailyMenu) {
    currentMenus = currentMenus.map((menu) =>
      menu.weekStart === getWeekStartForDate(dayKey)
        ? {
            ...menu,
            days: {
              ...menu.days,
              [dayKey]: nextDay,
            },
          }
        : menu
    );
  }

  function clearActiveMove() {
    if (!daysContainer) return;

    activeSourceRow?.classList.remove('day-meal-row--keyboard-source');
    activeSourceRow = null;
    activeSource = null;
    currentDropTargetDay = clearDropTarget(daysContainer, currentDropTargetDay);
    clearMealMoveClasses(daysContainer);
  }

  function setActiveSource(source: MealDragSource, row: HTMLElement) {
    clearActiveMove();
    activeSource = source;
    activeSourceRow = row;
    row.classList.add('day-meal-row--keyboard-source');
  }

  function prepareVisibleRows() {
    if (!daysContainer) return;
    prepareMealRows(daysContainer, getEnabledMeals(), labels.editDay ?? labels.configureDay ?? '');
  }

  async function syncVisibleMenus() {
    if (!servicesRef || !currentUser || !daysContainer) return;

    const weekStarts = getWeekStartsForDates(getVisibleDayKeys(daysContainer));
    const nextWeekStartsKey = weekStarts.join('|');
    if (!weekStarts.length || nextWeekStartsKey === watchedWeekStartsKey) return;

    watchedWeekStartsKey = nextWeekStartsKey;
    currentMenuIdsByWeekStart = await getOrCreateWeekMenus(servicesRef, currentUser.uid, weekStarts, locale);
    unsubscribeMenus?.();
    unsubscribeMenus = watchWeekMenusByIds(
      servicesRef,
      Object.values(currentMenuIdsByWeekStart),
      (menus) => {
        currentMenus = menus;
        prepareVisibleRows();
      },
      (error) => showStatus(formatError(error), true)
    );
  }

  function queueVisibleMenuSync() {
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      prepareVisibleRows();
      void syncVisibleMenus().catch((error) => showStatus(formatError(error), true));
    }, 80);
  }

  async function moveMealToDay(source: MealDragSource, targetDayKey: string) {
    if (!servicesRef || !currentUser || source.dayKey === targetDayKey) return;

    await syncVisibleMenus();

    const sourceMenuId = getMenuIdForDay(source.dayKey);
    const targetMenuId = getMenuIdForDay(targetDayKey);
    if (!sourceMenuId || !targetMenuId || !canMoveSource(source)) return;

    const { sourceDay, targetDay } = createMovedMealDays(source, getDay(source.dayKey), getDay(targetDayKey));
    saveFeedback.saving();

    try {
      await Promise.all([
        updateMenuDay(servicesRef, sourceMenuId, currentUser.uid, source.dayKey, sourceDay, currentProfile?.groupId),
        updateMenuDay(servicesRef, targetMenuId, currentUser.uid, targetDayKey, targetDay, currentProfile?.groupId),
      ]);
      updateLocalDay(source.dayKey, sourceDay);
      updateLocalDay(targetDayKey, targetDay);
      saveFeedback.saved();
    } catch (error) {
      showStatus(formatError(error), true);
    }
  }

  function handleDragStart(event: DragEvent) {
    const row = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-drag-meal]') : null;
    const source = getSourceFromRow(row);
    if (!row || !source || !canMoveSource(source)) {
      event.preventDefault();
      return;
    }

    activeSource = source;
    row.classList.add('day-meal-row--dragging');
    event.dataTransfer?.setData('application/x-menu-meal', JSON.stringify(source));
    event.dataTransfer?.setData('text/plain', `${source.dayKey}:${source.meal}`);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function getSourceFromTransfer(dataTransfer: DataTransfer | null) {
    if (activeSource) return activeSource;
    const rawData = dataTransfer?.getData('application/x-menu-meal');
    if (!rawData) return null;

    try {
      return JSON.parse(rawData) as MealDragSource;
    } catch {
      return null;
    }
  }

  function handleDragOver(event: DragEvent) {
    if (!daysContainer) return;
    const source = getSourceFromTransfer(event.dataTransfer);
    const targetDayKey = getDayKeyFromTarget(event.target);
    if (!source || !targetDayKey || source.dayKey === targetDayKey) return;

    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    currentDropTargetDay = updateDropTarget(daysContainer, currentDropTargetDay, targetDayKey, source);
  }

  function handleDrop(event: DragEvent) {
    const source = getSourceFromTransfer(event.dataTransfer);
    const targetDayKey = getDayKeyFromTarget(event.target);
    if (!source || !targetDayKey || source.dayKey === targetDayKey) return;

    event.preventDefault();
    void moveMealToDay(source, targetDayKey).finally(clearActiveMove);
  }

  function activateMealRow(row: HTMLElement) {
    const source = getSourceFromRow(row);
    if (!source) return;

    if (!activeSource) {
      if (canMoveSource(source)) setActiveSource(source, row);
      return;
    }

    const targetDayKey = row.closest<HTMLElement>('[data-day]')?.dataset.day ?? '';
    if (!targetDayKey || targetDayKey === activeSource.dayKey) {
      clearActiveMove();
      return;
    }

    const sourceToMove = activeSource;
    void moveMealToDay(sourceToMove, targetDayKey).finally(clearActiveMove);
  }

  function handlePointerActivation(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.closest('button,a,summary,details,input,textarea,select')) return;

    const row = target.closest<HTMLElement>('[data-drag-meal]');
    if (row) activateMealRow(row);
  }

  function handleKeyboardActivation(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      clearActiveMove();
      return;
    }

    if (event.key !== 'Enter' && event.key !== ' ') return;

    const row = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-drag-meal]') : null;
    if (!row) return;

    event.preventDefault();
    activateMealRow(row);
  }

  if (daysContainer) {
    prepareVisibleRows();
    daysContainer.addEventListener('dragstart', handleDragStart);
    daysContainer.addEventListener('dragover', handleDragOver);
    daysContainer.addEventListener('dragleave', (event) => {
      if (!daysContainer) return;
      if (getDayKeyFromTarget(event.target) !== getDayKeyFromTarget(event.relatedTarget)) {
        currentDropTargetDay = clearDropTarget(daysContainer, currentDropTargetDay);
      }
    });
    daysContainer.addEventListener('drop', handleDrop);
    daysContainer.addEventListener('dragend', clearActiveMove);
    daysContainer.addEventListener('click', handlePointerActivation);
    daysContainer.addEventListener('keydown', handleKeyboardActivation);
    new MutationObserver(queueVisibleMenuSync).observe(daysContainer, { childList: true, subtree: true });
  }

  getFirebaseServices()
    .then((services) => {
      servicesRef = services;
      services.authModule.onAuthStateChanged(services.auth, async (user: FirebaseUser | null) => {
        currentUser = user;
        currentProfile = null;
        currentMenus = [];
        currentMenuIdsByWeekStart = {};
        watchedWeekStartsKey = '';
        unsubscribeProfile?.();
        unsubscribeMenus?.();

        if (!user) return;

        try {
          await ensureUserProfile(services, user, labels.guestSession);
          unsubscribeProfile = watchUserProfile(
            services,
            user,
            labels.guestSession,
            (profile) => {
              currentProfile = profile;
              queueVisibleMenuSync();
            },
            (error) => showStatus(formatError(error), true)
          );
        } catch (error) {
          showStatus(formatError(error), true);
        }
      });
    })
    .catch((error: Error) => showStatus(formatError(error), true));
}
