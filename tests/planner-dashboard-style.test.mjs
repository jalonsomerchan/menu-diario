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
    assert.match(configurator, /background: transparent/);
    assert.match(configurator, /data-config-days/);
    assert.match(configurator, /data-config-load-more/);
    assert.match(configurator, /button button--secondary/);
  });

  it('keeps the day timeline date strip rounded without clipping action menus', () => {
    const historyStyles = readText('src/styles/history.css');

    assert.match(historyStyles, /\.history-card \{[^}]*overflow: visible;/);
    assert.match(historyStyles, /\.history-card__date \{[^}]*border-radius: calc\(var\(--radius-2xl\) - 1px\) 0 0 calc\(var\(--radius-2xl\) - 1px\);/);
  });
});
