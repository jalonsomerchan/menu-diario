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

    assert.match(planner, /mandatory genuinely new dish/);
    assert.match(planner, /every mixed-mode recommendation must include at least one genuinely new dish/);
    assert.match(planner, /first dish in every mixed-mode dishes array MUST be a never-saved dish/);
    assert.match(planner, /Do not mark saved catalog dishes as new/);
    assert.match(planner, /Do not return only saved dishes in mixed mode/);
    assert.match(planner, /omit that slot instead of returning only saved dishes/);
    assert.match(planner, /input\.mode === 'mix' && !suggestions\.some\(\(dish\) => dish\.isNew\)/);
    assert.match(planner, /getBalancedSuggestions/);
    assert.match(planner, /suggestions\.find\(\(dish\) => dish\.isNew\)/);
    assert.match(planner, /suggestions\.find\(\(dish\) => !dish\.isNew && !dish\.isGlobal && dish\.scope !== 'global'\)/);
    assert.match(planner, /suggestions\.find\(\(dish\) => !dish\.isNew && \(dish\.isGlobal \|\| dish\.scope === 'global'\)\)/);
  });
});
