import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('planner dashboard style alignment', () => {
  it('uses dashboard panel patterns for the planner surface', () => {
    const configurator = readText('src/components/ConfiguratorApp.astro');

    assert.match(configurator, /class="dashboard-section app-panel configurator-planner-panel"/);
    assert.match(configurator, /configurator-planner-panel__actions/);
    assert.match(configurator, /var\(--panel-background\)/);
    assert.match(configurator, /data-config-days/);
    assert.match(configurator, /data-config-load-more/);
    assert.match(configurator, /button button--secondary/);
  });
});
