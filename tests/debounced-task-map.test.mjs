import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createDebouncedTaskMap } from '../src/lib/ui/debounced-task-map.ts';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('debounced task map', () => {
  it('runs only the latest scheduled task for the same key', async () => {
    const calls = [];
    const tasks = createDebouncedTaskMap({ delay: 20 });

    tasks.schedule('day-1', () => {
      calls.push('first');
    });
    tasks.schedule('day-1', () => {
      calls.push('second');
    });

    await wait(40);

    assert.deepEqual(calls, ['second']);
  });

  it('flushes a pending task immediately', async () => {
    let calls = 0;
    const tasks = createDebouncedTaskMap({ delay: 200 });

    tasks.schedule('day-2', () => {
      calls += 1;
    });

    await tasks.flush('day-2');
    await wait(20);

    assert.equal(calls, 1);
  });
});
