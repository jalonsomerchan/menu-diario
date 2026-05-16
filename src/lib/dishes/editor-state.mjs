import { isEditableDish } from './helpers.mjs';

export function getDishEditorState(dish) {
  const editable = isEditableDish(dish);

  return {
    canEdit: editable,
    canRename: editable,
    canToggleFavorite: editable,
    canToggleBlocked: editable,
    canEditQuickTags: editable,
    canArchive: editable,
    canDuplicate: Boolean(dish?.isGlobal),
    isReadOnlyGlobal: Boolean(dish?.isGlobal) && !editable,
  };
}

export function getNextQuickTags(dish, tag, shouldAdd) {
  const currentTags = Array.isArray(dish?.quickTags) ? dish.quickTags : [];
  if (shouldAdd) return [...new Set([...currentTags, tag])];
  return currentTags.filter((item) => item !== tag);
}

export function hasSameQuickTags(left = [], right = []) {
  if (left.length !== right.length) return false;
  return left.every((tag, index) => tag === right[index]);
}
