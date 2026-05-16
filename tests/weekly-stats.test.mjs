import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWeeklyRecommendations,
  buildWeeklySummary,
  compareWeekWithHistory,
  getLatestAddedDish,
  getTopUsedDishes,
  summarizeWeek,
} from '../src/lib/menu/weekly-stats.mjs';

function meal(items = [], skipped = false, reason = '') {
  return { items, skipped, reason, note: '' };
}

function day(meals, skipped = false, reason = '') {
  return { skipped, reason, skipNote: '', notes: '', meals };
}

const emptyMeals = {
  breakfast: meal(),
  lunch: meal(),
  dinner: meal(),
};

describe('weekly menu statistics', () => {
  it('summarizes planned, empty, eating out and repeated dishes for a week', () => {
    const summary = summarizeWeek(
      {
        weekStart: '2026-05-11',
        days: {
          '2026-05-11': day({ ...emptyMeals, lunch: meal(['Lentejas']), dinner: meal(['Tortilla']) }),
          '2026-05-12': day({ ...emptyMeals, lunch: meal(['Lentejas']), dinner: meal([], true, 'eating-out') }),
          '2026-05-13': day({ ...emptyMeals, lunch: meal(), dinner: meal(['Pasta']) }),
        },
      },
      ['lunch', 'dinner']
    );

    assert.equal(summary.totalMeals, 6);
    assert.equal(summary.plannedMeals, 4);
    assert.equal(summary.emptyMeals, 1);
    assert.equal(summary.eatingOutMeals, 1);
    assert.deepEqual(summary.repeatedDishes, [{ name: 'Lentejas', count: 2 }]);
  });

  it('builds top used dishes across several menus', () => {
    const top = getTopUsedDishes([
      { weekStart: '2026-05-11', days: { a: day({ ...emptyMeals, lunch: meal(['Pasta', 'Pasta']) }) } },
      { weekStart: '2026-05-04', days: { b: day({ ...emptyMeals, lunch: meal(['Lentejas']) }) } },
    ], ['lunch']);

    assert.deepEqual(top.slice(0, 2), [
      { name: 'Pasta', count: 2 },
      { name: 'Lentejas', count: 1 },
    ]);
  });

  it('compares the selected week against historical averages', () => {
    const current = { plannedMeals: 4, emptyMeals: 2, eatingOutMeals: 1, totalMeals: 7 };
    const previousMenus = [
      { weekStart: '2026-05-04', days: { a: day({ ...emptyMeals, lunch: meal(['Arroz']) }) } },
      { weekStart: '2026-04-27', days: { b: day({ ...emptyMeals, lunch: meal() }) } },
    ];

    const comparison = compareWeekWithHistory(current, previousMenus, ['lunch']);

    assert.equal(comparison.hasHistory, true);
    assert.equal(comparison.weeksCompared, 2);
    assert.equal(comparison.plannedDelta, 4);
    assert.equal(comparison.emptyDelta, 2);
  });

  it('detects the latest added dish and non-AI recommendations', () => {
    const dishes = [
      { name: 'Gazpacho', createdAt: new Date('2026-04-01'), lastUsedAt: new Date('2026-03-01') },
      { name: 'Pisto', createdAt: new Date('2026-05-01'), lastUsedAt: new Date('2026-05-01') },
    ];
    const summary = {
      totalMeals: 4,
      emptyMeals: 2,
      plannedMeals: 2,
      repeatedDishes: [{ name: 'Pasta', count: 2 }],
    };

    assert.equal(getLatestAddedDish(dishes).name, 'Pisto');
    assert.deepEqual(
      buildWeeklyRecommendations(summary, dishes, new Date('2026-05-16')).map((item) => item.type),
      ['empty-week', 'repeated-dish', 'stale-dish']
    );
  });

  it('builds a full weekly summary with current week and previous menus', () => {
    const summary = buildWeeklySummary({
      currentWeekStart: '2026-05-11',
      enabledMeals: ['lunch'],
      menus: [
        { weekStart: '2026-05-11', days: { a: day({ ...emptyMeals, lunch: meal(['Pasta']) }) } },
        { weekStart: '2026-05-04', days: { b: day({ ...emptyMeals, lunch: meal(['Arroz']) }) } },
      ],
      dishes: [{ name: 'Pasta', createdAt: new Date('2026-05-01'), lastUsedAt: new Date('2026-05-01') }],
    });

    assert.equal(summary.current.plannedMeals, 1);
    assert.equal(summary.previousMenus.length, 1);
    assert.equal(summary.comparison.hasHistory, true);
    assert.equal(summary.topUsedDishes[0].name, 'Arroz');
  });
});
