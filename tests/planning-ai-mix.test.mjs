import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('mixed AI planner mode', () => {
  it('requires and preserves a balanced mix of new, own/group and global dishes', () => {
    const planner = readText('src/lib/ai/planning-assistant.ts');

    assert.match(planner, /balanced mix of new dishes, saved own\/group dishes, and saved global dishes/);
    assert.match(planner, /combine three sources whenever they are available/);
    assert.match(planner, /at least one new dish with isNew=true/);
    assert.match(planner, /at least one own\/group saved dish/);
    assert.match(planner, /at least one global saved dish/);
    assert.match(planner, /Never return only saved dishes in mixed mode/);
    assert.match(planner, /getBalancedSuggestions/);
    assert.match(planner, /suggestions\.find\(\(dish\) => dish\.isNew\)/);
    assert.match(planner, /suggestions\.find\(\(dish\) => !dish\.isNew && !dish\.isGlobal && dish\.scope !== 'global'\)/);
    assert.match(planner, /suggestions\.find\(\(dish\) => !dish\.isNew && \(dish\.isGlobal \|\| dish\.scope === 'global'\)\)/);
  });
});
