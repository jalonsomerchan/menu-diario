import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildMenuStatistics, getStatisticsRangePreset, hasEnoughStatisticsData } from '../src/lib/menu/statistics.mjs';

const dishes = [
  {
    id: 'dish-paella',
    name: 'Paella',
    normalizedName: 'paella',
    scope: 'group',
    timesUsed: 4,
    favorite: true,
    quickTags: ['arroz', 'fin de semana'],
    lastUsedAt: new Date('2026-05-01T00:00:00'),
  },
  {
    id: 'dish-lentejas',
    name: 'Lentejas',
    normalizedName: 'lentejas',
    scope: 'group',
    timesUsed: 1,
    favorite: false,
    tags: ['legumbre'],
    lastUsedAt: new Date('2026-01-10T00:00:00'),
  },
  {
    id: 'dish-global',
    name: 'Plato global',
    normalizedName: 'plato global',
    scope: 'global',
    isGlobal: true,
    timesUsed: 0,
  },
];

const menus = [
  {
    id: 'week-1',
    weekStart: '2026-05-04',
    days: {
      '2026-05-04': {
        meals: {
          lunch: { items: ['Paella'], skipped: false, reason: '', note: '' },
          dinner: { items: [], skipped: true, reason: 'eating-out', note: 'Cena fuera' },
        },
      },
      '2026-05-05': {
        notes: 'usar sobras para tupper',
        meals: {
          lunch: { items: ['Lentejas'], skipped: false, reason: '', note: '' },
          dinner: { items: [], skipped: false, reason: '', note: '' },
        },
      },
      '2026-05-06': {
        meals: {
          lunch: { items: ['Paella'], skipped: false, reason: '', note: '' },
          dinner: { items: [], skipped: false, reason: 'other', note: 'Improvisar' },
        },
      },
    },
  },
];

describe('menu statistics helpers', () => {
  it('builds useful statistics from bounded menu and dish data', () => {
    const stats = buildMenuStatistics(menus, dishes, ['lunch', 'dinner'], {
      range: { start: '2026-05-04', end: '2026-05-06' },
      limit: 5,
    });

    assert.equal(stats.totalMealSlots, 6);
    assert.equal(stats.plannedMeals, 3);
    assert.equal(stats.unplannedMeals, 2);
    assert.equal(stats.skippedMeals, 1);
    assert.equal(stats.eatingOutMeals, 1);
    assert.equal(stats.leftoversMeals, 1);
    assert.equal(stats.customDays, 2);
    assert.equal(stats.completionRate, 50);
    assert.deepEqual(stats.topDishes[0], { name: 'Paella', count: 2 });
    assert.deepEqual(stats.favoriteDishes[0], { name: 'Paella', count: 2 });
    assert.ok(stats.varietyTags.some((item) => item.name === 'legumbre' && item.count === 1));
    assert.ok(stats.mealsByWeek.some((item) => item.period === '2026-05-04' && item.count === 3));
    assert.ok(stats.mealsByMonth.some((item) => item.period === '2026-05' && item.count === 3));
    assert.equal(hasEnoughStatisticsData(stats), true);
  });

  it('respects date ranges and detects empty results', () => {
    const stats = buildMenuStatistics(menus, dishes, ['lunch'], {
      range: { start: '2026-06-01', end: '2026-06-30' },
    });

    assert.equal(stats.totalMealSlots, 0);
    assert.equal(stats.plannedMeals, 0);
    assert.equal(stats.topDishes.length, 0);
    assert.equal(hasEnoughStatisticsData(stats), false);
  });

  it('builds stable preset ranges', () => {
    const range = getStatisticsRangePreset(7, new Date('2026-05-20T12:00:00'));
    assert.deepEqual(range, { start: '2026-05-14', end: '2026-05-20' });
  });
});
