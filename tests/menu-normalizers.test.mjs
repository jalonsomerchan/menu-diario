import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { emptyDay, normalizeDay, normalizeMeal } from '../src/lib/menu/normalizers.ts';

describe('menu normalizers', () => {
  it('builds an empty day with all meals and day fields initialized', () => {
    assert.deepEqual(emptyDay(), {
      meals: {
        breakfast: { items: [], skipped: false, reason: '', note: '' },
        lunch: { items: [], skipped: false, reason: '', note: '' },
        dinner: { items: [], skipped: false, reason: '', note: '' },
      },
      skipped: false,
      reason: '',
      skipNote: '',
      notes: '',
    });
  });

  it('normalizes legacy lunch fields into the modern lunch meal shape', () => {
    assert.deepEqual(
      normalizeDay({
        lunch: 'Lentejas',
        lunchItems: ['Lentejas', 'Ensalada'],
        noLunch: true,
        noLunchReason: 'away',
        noLunchDescription: 'Viaje',
      }),
      {
        meals: {
          breakfast: { items: [], skipped: false, reason: '', note: '' },
          lunch: { items: ['Lentejas', 'Ensalada'], skipped: true, reason: 'away', note: 'Viaje' },
          dinner: { items: [], skipped: false, reason: '', note: '' },
        },
        lunch: 'Lentejas',
        lunchItems: ['Lentejas', 'Ensalada'],
        noLunch: true,
        noLunchReason: 'away',
        noLunchDescription: 'Viaje',
        skipped: false,
        reason: '',
        skipNote: '',
        notes: '',
      }
    );
  });

  it('keeps modern meals unchanged while filling missing defaults', () => {
    assert.deepEqual(
      normalizeDay({
        meals: {
          breakfast: { items: ['Cafe'] },
          lunch: { items: ['Arroz'], skipped: true, reason: 'other', note: 'Reserva' },
          dinner: { items: ['Sopa'] },
        },
      }),
      {
        meals: {
          breakfast: { items: ['Cafe'], skipped: false, reason: '', note: '' },
          lunch: { items: ['Arroz'], skipped: true, reason: 'other', note: 'Reserva' },
          dinner: { items: ['Sopa'], skipped: false, reason: '', note: '' },
        },
        skipped: false,
        reason: '',
        skipNote: '',
        notes: '',
      }
    );
  });

  it('preserves full-day skipped, reason, skipNote and notes fields', () => {
    const normalized = normalizeDay({
      skipped: true,
      reason: 'eating-out',
      skipNote: 'Celebracion familiar',
      notes: 'No comprar pan',
    });

    assert.equal(normalized.skipped, true);
    assert.equal(normalized.reason, 'eating-out');
    assert.equal(normalized.skipNote, 'Celebracion familiar');
    assert.equal(normalized.notes, 'No comprar pan');
    assert.deepEqual(normalized.meals.lunch, { items: [], skipped: false, reason: '', note: '' });
  });

  it('normalizes malformed meal entries safely', () => {
    assert.deepEqual(normalizeMeal({ items: 'Pasta', skipped: 1, reason: undefined, note: undefined }), {
      items: [],
      skipped: true,
      reason: '',
      note: '',
    });
  });
});
