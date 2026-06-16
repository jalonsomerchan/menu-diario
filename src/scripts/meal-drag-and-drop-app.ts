import { formatAppError } from '../lib/errors';
import { getFirebaseServices } from '../lib/firebase/client';
import { hasFirebaseConfig } from '../lib/firebase/config';
import { getWeekStartForDate, getWeekStartsForDates } from '../lib/menu/dates';
import { emptyMeal, normalizeDay, normalizeMeal } from '../lib/menu/normalizers';
import {
  ensureUserProfile,
  getOrCreateWeekMenus,
  updateMenuDay,
  watchUserProfile,
  watchWeekMenusByIds,
} from '../lib/menu/repository';
import type { DailyMenu, FirebaseUser, MealEntry, MealSlot, UserProfile, WeekMenu } from '../lib/menu/types';
import { createSaveFeedback } from '../lib/ui/save-feedback';

type DragSource = {
  dayKey: string;
  meal: MealSlot;
};

type PointerDragState = {
  pointerId: number;
  row: HTMLElement;
  source: DragSource;
  startX: number;
  startY: number;
  holdTimer: number;
  active: boolean;
};

const mealSlots: MealSlot[] = ['breakfast', 'lunch', 'dinner'];
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
  let dragSource: DragSource | null = null;
  let keyboardSourceRow: HTMLElement | null = null;
  let pointerState: PointerDragState | null = null;
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

  function isMealSlot(value: string | undefined): value is MealSlot {
    return mealSlots.includes(value as MealSlot);
  }

  function getEnabledMeals(): MealSlot[] {
    return currentProfile?.enabledMeals?.length ? currentProfile.enabledMeals : ['lunch'];
  }

  function getVisibleDayKeys() {
    if (!daysContainer) return [];

    return [
      ...new Set(
        Array.from(daysContainer.querySelectorAll<HTMLElement>('[data-day]'))
          .map((card) => card.dataset.day)
          .filter((dayKey): dayKey is string => Boolean(dayKey))
      ),
    ];
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

  function cloneMeal(meal: Partial<MealEntry> | undefined): MealEntry {
    const normalized = normalizeMeal(meal);
    const copy: MealEntry = {
      ...normalized,
      items: [...normalized.items],
    };

    if (normalized.participantIds?.length) {
      copy.participantIds = [...normalized.participantIds];
    } else {
      delete copy.participantIds;
    }

    return copy;
  }

  function isEmptyMeal(meal: MealEntry) {
    return (
      !meal.skipped &&
      meal.items.filter(Boolean).length === 0 &&
      !meal.note.trim() &&
      !meal.participantIds?.length
    );
  }

  function canMoveSource(source: DragSource) {
    const sourceDay = getDay(source.dayKey);
    if (sourceDay.skipped) return false;

    return !isEmptyMeal(cloneMeal(sourceDay.meals[source.meal] ?? emptyMeal()));
  }

  function getSourceFromRow(row: HTMLElement | null): DragSource | null {
    const dayKey = row?.closest<HTMLElement>('[data-day]')?.dataset.day;
    const meal = row?.dataset.dragMeal;
    if (!dayKey || !isMealSlot(meal)) return null;

    return { dayKey, meal };
  }

  function getDayKeyFromTarget(target: EventTarget | null) {
    return target instanceof HTMLElement ? target.closest<HTMLElement>('[data-day]')?.dataset.day ?? '' : '';
  }

  function getDayKeyAtPoint(clientX: number, clientY: number) {
    return document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-day]')?.dataset.day ?? '';
  }

  function clearDropTarget() {
    if (!daysContainer || !currentDropTargetDay) return;
    daysContainer
      .querySelector<HTMLElement>(`[data-day="${CSS.escape(currentDropTargetDay)}"]`)
      ?.classList.remove('history-card--meal-drop-target');
    currentDropTargetDay = '';
  }

  function setDropTarget(dayKey: string, source = dragSource) {
    if (!daysContainer) return;
    if (!dayKey || source?.dayKey === dayKey) {
      clearDropTarget();
      return;
    }

    if (currentDropTargetDay === dayKey) return;
    clearDropTarget();
    currentDropTargetDay = dayKey;
    daysContainer
      .querySelector<HTMLElement>(`[data-day="${CSS.escape(dayKey)}"]`)
      ?.classList.add('history-card--meal-drop-target');
  }

  function clearActiveDrag() {
    clearDropTarget();
    keyboardSourceRow?.classList.remove('day-meal-row--keyboard-source');
    keyboardSourceRow = null;
    dragSource = null;
    daysContainer?.querySelectorAll('.day-meal-row--dragging').forEach((row) => row.classList.remove('day-meal-row--dragging'));
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

  async function syncVisibleMenus() {
    if (!servicesRef || !currentUser) return;

    const visibleDayKeys = getVisibleDayKeys();
    const weekStarts = getWeekStartsForDates(visibleDayKeys);
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
        prepareDraggableMeals();
      },
      (error) => showStatus(formatError(error), true)
    );
  }

  function queueVisibleMenuSync() {
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      prepareDraggableMeals();
      void syncVisibleMenus().catch((error) => showStatus(formatError(error), true));
    }, 80);
  }

  function prepareDraggableMeals() {
    if (!daysContainer || !currentProfile) return;

    const enabledMeals = getEnabledMeals();
    daysContainer.querySelectorAll<HTMLElement>('[data-day]').forEach((card) => {
      card.querySelectorAll<HTMLElement>('.day-meal-row').forEach((row, index) => {
        const meal = enabledMeals[index];
        if (!meal) return;

        row.dataset.dragMeal = meal;
        row.draggable = true;
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        row.setAttribute('aria-label', row.textContent?.trim().replace(/\s+/g, ' ') ?? labels.editDay ?? '');
      });
    });
  }

  async function ensureVisibleMenusReady() {
    await syncVisibleMenus();
  }

  async function moveMealToDay(source: DragSource, targetDayKey: string) {
    if (!servicesRef || !currentUser || source.dayKey === targetDayKey) return;

    await ensureVisibleMenusReady();

    const sourceMenuId = getMenuIdForDay(source.dayKey);
    const targetMenuId = getMenuIdForDay(targetDayKey);
    if (!sourceMenuId || !targetMenuId || !canMoveSource(source)) return;

    const sourceDay = getDay(source.dayKey);
    const targetDay = getDay(targetDayKey);
    const sourceMeal = cloneMeal(sourceDay.meals[source.meal]);
    const targetMeal = cloneMeal(targetDay.meals[source.meal] ?? emptyMeal());
    const nextSourceDay = normalizeDay({
      ...sourceDay,
      meals: {
        ...sourceDay.meals,
        [source.meal]: targetMeal,
      },
    });
    const nextTargetDay = normalizeDay({
      ...targetDay,
      skipped: false,
      reason: '',
      skipNote: '',
      meals: {
        ...targetDay.meals,
        [source.meal]: sourceMeal,
      },
    });

    saveFeedback.saving();

    try {
      await Promise.all([
        updateMenuDay(servicesRef, sourceMenuId, currentUser.uid, source.dayKey, nextSourceDay, currentProfile?.groupId),
        updateMenuDay(servicesRef, targetMenuId, currentUser.uid, targetDayKey, nextTargetDay, currentProfile?.groupId),
      ]);
      updateLocalDay(source.dayKey, nextSourceDay);
      updateLocalDay(targetDayKey, nextTargetDay);
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

    dragSource = source;
    row.classList.add('day-meal-row--dragging');
    event.dataTransfer?.setData('application/x-menu-meal', JSON.stringify(source));
    event.dataTransfer?.setData('text/plain', `${source.dayKey}:${source.meal}`);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function getDragSourceFromDataTransfer(dataTransfer: DataTransfer | null) {
    if (dragSource) return dragSource;
    const rawData = dataTransfer?.getData('application/x-menu-meal');
    if (!rawData) return null;

    try {
      const parsed = JSON.parse(rawData) as Partial<DragSource>;
      return parsed.dayKey && isMealSlot(parsed.meal) ? { dayKey: parsed.dayKey, meal: parsed.meal } : null;
    } catch {
      return null;
    }
  }

  function handleDragOver(event: DragEvent) {
    const source = getDragSourceFromDataTransfer(event.dataTransfer);
    const targetDayKey = getDayKeyFromTarget(event.target);
    if (!source || !targetDayKey || source.dayKey === targetDayKey) return;

    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    setDropTarget(targetDayKey, source);
  }

  function handleDragLeave(event: DragEvent) {
    const targetDayKey = getDayKeyFromTarget(event.target);
    const nextDayKey = getDayKeyFromTarget(event.relatedTarget);
    if (targetDayKey && targetDayKey !== nextDayKey) clearDropTarget();
  }

  function handleDrop(event: DragEvent) {
    const source = getDragSourceFromDataTransfer(event.dataTransfer);
    const targetDayKey = getDayKeyFromTarget(event.target);
    if (!source || !targetDayKey || source.dayKey === targetDayKey) return;

    event.preventDefault();
    void moveMealToDay(source, targetDayKey).finally(clearActiveDrag);
  }

  function handleDragEnd() {
    clearActiveDrag();
  }

  function handleKeyboardMove(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      clearActiveDrag();
      return;
    }

    if (event.key !== 'Enter' && event.key !== ' ') return;

    const row = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-drag-meal]') : null;
    const source = getSourceFromRow(row);
    if (!row || !source) return;

    event.preventDefault();

    if (!dragSource) {
      if (!canMoveSource(source)) return;
      dragSource = source;
      keyboardSourceRow = row;
      row.classList.add('day-meal-row--keyboard-source');
      return;
    }

    const targetDayKey = row.closest<HTMLElement>('[data-day]')?.dataset.day ?? '';
    if (!targetDayKey || targetDayKey === dragSource.dayKey) {
      clearActiveDrag();
      return;
    }

    const sourceToMove = dragSource;
    void moveMealToDay(sourceToMove, targetDayKey).finally(clearActiveDrag);
  }

  function beginPointerDrag(state: PointerDragState) {
    if (pointerState !== state || !canMoveSource(state.source)) return;

    state.active = true;
    dragSource = state.source;
    state.row.classList.add('day-meal-row--dragging');
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse') return;
    const row = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-drag-meal]') : null;
    const source = getSourceFromRow(row);
    if (!row || !source || !canMoveSource(source)) return;

    pointerState = {
      pointerId: event.pointerId,
      row,
      source,
      startX: event.clientX,
      startY: event.clientY,
      holdTimer: window.setTimeout(() => pointerState && beginPointerDrag(pointerState), 220),
      active: false,
    };
    row.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent) {
    if (!pointerState || pointerState.pointerId !== event.pointerId) return;

    const distance = Math.hypot(event.clientX - pointerState.startX, event.clientY - pointerState.startY);
    if (!pointerState.active && distance > 10) {
      window.clearTimeout(pointerState.holdTimer);
      pointerState = null;
      return;
    }

    if (!pointerState.active) return;

    event.preventDefault();
    setDropTarget(getDayKeyAtPoint(event.clientX, event.clientY), pointerState.source);
  }

  function clearPointerState() {
    if (!pointerState) return;
    window.clearTimeout(pointerState.holdTimer);
    pointerState.row.classList.remove('day-meal-row--dragging');
    pointerState = null;
  }

  function handlePointerUp(event: PointerEvent) {
    if (!pointerState || pointerState.pointerId !== event.pointerId) return;

    const state = pointerState;
    const targetDayKey = state.active ? getDayKeyAtPoint(event.clientX, event.clientY) : '';
    clearPointerState();

    if (!state.active || !targetDayKey || targetDayKey === state.source.dayKey) {
      clearActiveDrag();
      return;
    }

    void moveMealToDay(state.source, targetDayKey).finally(clearActiveDrag);
  }

  if (daysContainer) {
    prepareDraggableMeals();
    daysContainer.addEventListener('dragstart', handleDragStart);
    daysContainer.addEventListener('dragover', handleDragOver);
    daysContainer.addEventListener('dragleave', handleDragLeave);
    daysContainer.addEventListener('drop', handleDrop);
    daysContainer.addEventListener('dragend', handleDragEnd);
    daysContainer.addEventListener('keydown', handleKeyboardMove);
    daysContainer.addEventListener('pointerdown', handlePointerDown);
    daysContainer.addEventListener('pointermove', handlePointerMove);
    daysContainer.addEventListener('pointerup', handlePointerUp);
    daysContainer.addEventListener('pointercancel', () => {
      clearPointerState();
      clearActiveDrag();
    });

    new MutationObserver(queueVisibleMenuSync).observe(daysContainer, { childList: true, subtree: true });
  }

  getFirebaseServices()
    .then(async (services) => {
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
              prepareDraggableMeals();
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
