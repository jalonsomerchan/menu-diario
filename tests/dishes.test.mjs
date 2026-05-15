import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterDishes, normalizeDishName, sortDishes } from '../src/lib/dishes/helpers.mjs';

describe('dish helpers', () => {
  it('normalizes dish names for duplicate detection', () => {
    assert.equal(normalizeDishName('  Lentejas   con verduras  '), 'lentejas con verduras');
    assert.equal(normalizeDishName('Árroz con Ñoras'), 'arroz con noras');
  });

  it('filters dishes by normalized name', () => {
    const dishes = [
      { name: 'Tortilla de patatas', timesUsed: 1 },
      { name: 'Arroz al horno', timesUsed: 1 },
    ];

    assert.deepEqual(filterDishes(dishes, 'patátas').map((dish) => dish.name), ['Tortilla de patatas']);
  });

  it('sorts dishes by usage, recent usage, oldest usage and name', () => {
    const dishes = [
      { name: 'Zanahorias', timesUsed: 1, lastUsedAt: '2026-04-01', createdAt: '2026-01-01' },
      { name: 'Arroz', timesUsed: 4, lastUsedAt: '2026-03-01', createdAt: '2026-02-01' },
      { name: 'Lentejas', timesUsed: 2, lastUsedAt: '2026-05-01', createdAt: '2026-03-01' },
    ];

    assert.deepEqual(sortDishes(dishes, 'most-used').map((dish) => dish.name), ['Arroz', 'Lentejas', 'Zanahorias']);
    assert.deepEqual(sortDishes(dishes, 'recent').map((dish) => dish.name), ['Lentejas', 'Zanahorias', 'Arroz']);
    assert.deepEqual(sortDishes(dishes, 'oldest').map((dish) => dish.name), ['Arroz', 'Zanahorias', 'Lentejas']);
    assert.deepEqual(sortDishes(dishes, 'name').map((dish) => dish.name), ['Arroz', 'Lentejas', 'Zanahorias']);
  });
});
