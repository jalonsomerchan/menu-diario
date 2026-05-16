export function getAddedDishNamesFromItems(previousItems = [], nextItems = []) {
  const previousCounts = new Map();
  previousItems.filter(Boolean).forEach((item) => {
    previousCounts.set(item, (previousCounts.get(item) ?? 0) + 1);
  });

  return nextItems.filter(Boolean).filter((item) => {
    const remaining = previousCounts.get(item) ?? 0;
    if (remaining > 0) {
      previousCounts.set(item, remaining - 1);
      return false;
    }
    return true;
  });
}
