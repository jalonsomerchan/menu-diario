import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('planner dashboard style alignment', () => {
  it('uses a clean planner header and dashboard panel surface', () => {
    const configurator = readText('src/components/ConfiguratorApp.astro');

    assert.match(configurator, /class="configurator-page-header"/);
    assert.match(configurator, /class="button button--primary" href=\{planningPath\}/);
    assert.doesNotMatch(configurator, /configurator-planner-panel__actions/);
    assert.doesNotMatch(configurator, /configurator-ai-shortcut/);
    assert.match(configurator, /class="dashboard-section app-panel configurator-planner-panel"/);
    assert.match(configurator, /var\(--panel-background\)/);
    assert.match(configurator, /data-config-days/);
    assert.match(configurator, /data-config-load-more/);
    assert.match(configurator, /button button--secondary/);
  });
});
