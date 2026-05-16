import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getDatesInRange,
  getUpcomingDates,
  getWeekStartForDate,
  getWeekStartsForDates,
  normalizeDateRange,
} from '../src/lib/menu/dates.ts';

describe('menu dates', () => {
  it('keeps upcoming dates inside the same week when the range does not cross monday', () => {
    assert.deepEqual(getUpcomingDates(new Date('2026-05-11T12:00:00'), 1, 7), [
      '2026-05-12',
      '2026-05-13',
      '2026-05-14',
      '2026-05-15',
      '2026-05-16',
      '2026-05-17',
      '2026-05-18',
    ]);
  });

  it('splits upcoming days into the correct week buckets from thursday to sunday', () => {
    const scenarios = [
      ['2026-05-14T12:00:00', ['2026-05-11', '2026-05-18']],
      ['2026-05-15T12:00:00', ['2026-05-11', '2026-05-18']],
      ['2026-05-16T12:00:00', ['2026-05-11', '2026-05-18']],
      ['2026-05-17T12:00:00', ['2026-05-18']],
    ];

    scenarios.forEach(([baseDate, expectedWeekStarts]) => {
      const nextDates = getUpcomingDates(new Date(baseDate), 1, 7);
      assert.deepEqual(getWeekStartsForDates(nextDates), expectedWeekStarts, `wrong week split for ${baseDate}`);
    });
  });

  it('computes monday week starts from iso dates across weekends', () => {
    assert.equal(getWeekStartForDate('2026-05-14'), '2026-05-11');
    assert.equal(getWeekStartForDate('2026-05-15'), '2026-05-11');
    assert.equal(getWeekStartForDate('2026-05-16'), '2026-05-11');
    assert.equal(getWeekStartForDate('2026-05-17'), '2026-05-11');
    assert.equal(getWeekStartForDate('2026-05-18'), '2026-05-18');
  });

  it('normalizes reversed date ranges before iterating them', () => {
    assert.deepEqual(normalizeDateRange('2026-05-20', '2026-05-18'), {
      start: '2026-05-18',
      end: '2026-05-20',
    });
    assert.deepEqual(getDatesInRange('2026-05-20', '2026-05-18'), [
      '2026-05-18',
      '2026-05-19',
      '2026-05-20',
    ]);
  });
});
