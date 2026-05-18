import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('shared AI wizard polish', () => {
  it('loads the shared AI wizard polish stylesheet globally for planner and shopping pages', () => {
    const layout = readText('src/layouts/BaseLayout.astro');
    const css = readText('src/styles/ai-wizard-polish.css');

    assert.match(layout, /ai-wizard-polish\.css/);
    assert.match(css, /\.planning-ai-app \.planning-ai-wizard-step:hover/);
    assert.match(css, /prefers-reduced-motion: reduce/);
    assert.match(css, /\.planning-ai-app \.planning-ai-results-status\[data-variant='error'\]/);
    assert.match(css, /\.planning-ai-app \.shopping-ai-status\[data-variant='error'\]/);
    assert.match(css, /\.planning-ai-app \.planning-ai-form select/);
  });

  it('keeps planner and shopping using the shared planning wizard structure', () => {
    const planner = readText('src/components/PlanningAiApp.astro');
    const shopping = readText('src/components/ShoppingApp.astro');

    [planner, shopping].forEach((source) => {
      assert.match(source, /planning-ai-app/);
      assert.match(source, /planning-ai-panel/);
      assert.match(source, /planning-ai-wizard-progress/);
      assert.match(source, /planning-ai-wizard-step/);
      assert.match(source, /planning-ai-section-card/);
      assert.match(source, /planning-ai-request-card/);
      assert.match(source, /planning-ai-wizard-actions/);
    });
  });
});
