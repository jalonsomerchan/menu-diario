import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getAddedDishNamesFromItems } from '../src/lib/menu/dish-usage.mjs';

describe('dish usage diff helpers', () => {
  it('does not count saving the same dishes again as new usage', () => {
    assert.deepEqual(getAddedDishNamesFromItems(['Lentejas', 'Ensalada'], ['Lentejas', 'Ensalada']), []);
  });

  it('counts only dishes added to the meal', () => {
    assert.deepEqual(getAddedDishNamesFromItems(['Lentejas'], ['Lentejas', 'Yogur']), ['Yogur']);
  });

  it('counts a replacement as usage only for the new dish', () => {
    assert.deepEqual(getAddedDishNamesFromItems(['Lentejas'], ['Pollo al horno']), ['Pollo al horno']);
  });

  it('handles repeated dishes by comparing item counts', () => {
    assert.deepEqual(getAddedDishNamesFromItems(['Tortilla'], ['Tortilla', 'Tortilla']), ['Tortilla']);
  });

  it('does not create usage when a dish is removed', () => {
    assert.deepEqual(getAddedDishNamesFromItems(['Tortilla', 'Gazpacho'], ['Tortilla']), []);
  });
});
