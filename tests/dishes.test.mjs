import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterDishes,
  getSuggestionDishes,
  hasDishTag,
  isSuggestableDish,
  normalizeDishName,
  sortDishes,
} from '../src/lib/dishes/helpers.mjs';

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

  it('filters dishes by favorites, blocked state and quick tags', () => {
    const dishes = [
      { name: 'Lentejas', timesUsed: 3, favorite: true, quickTags: ['healthy', 'cheap'] },
      { name: 'Pizza', timesUsed: 4, blocked: true, quickTags: ['treat'] },
      { name: 'Pasta', timesUsed: 2, quickTags: ['kids'] },
      { name: 'Sopa archivada', timesUsed: 1, archived: true, quickTags: ['healthy'] },
    ];

    assert.deepEqual(filterDishes(dishes, '', { mode: 'favorites' }).map((dish) => dish.name), ['Lentejas']);
    assert.deepEqual(filterDishes(dishes, '', { mode: 'blocked' }).map((dish) => dish.name), ['Pizza']);
    assert.deepEqual(filterDishes(dishes, '', { tag: 'healthy' }).map((dish) => dish.name), ['Lentejas']);
    assert.equal(hasDishTag(dishes[0], 'cheap'), true);
  });

  it('excludes blocked and archived dishes from automatic suggestions', () => {
    const dishes = [
      { name: 'Lentejas', timesUsed: 3, favorite: true },
      { name: 'Pizza', timesUsed: 4, blocked: true },
      { name: 'Sopa archivada', timesUsed: 1, archived: true },
    ];

    assert.equal(isSuggestableDish(dishes[0]), true);
    assert.equal(isSuggestableDish(dishes[1]), false);
    assert.deepEqual(getSuggestionDishes(dishes, '').map((dish) => dish.name), ['Lentejas']);
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

  it('prioritizes favorites in the default recommendation order', () => {
    const dishes = [
      { name: 'Arroz', timesUsed: 8 },
      { name: 'Lentejas', timesUsed: 2, favorite: true },
    ];

    assert.deepEqual(sortDishes(dishes, 'most-used').map((dish) => dish.name), ['Lentejas', 'Arroz']);
  });
});
