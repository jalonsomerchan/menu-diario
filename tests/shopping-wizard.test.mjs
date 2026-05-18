import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('shopping wizard smoke checks', () => {
  it('renders shopping as a four-step wizard before AI generation', () => {
    const component = readText('src/components/ShoppingApp.astro');

    assert.match(component, /data-shopping-wizard/);
    assert.match(component, /data-wizard-progress/);
    ['range', 'meals', 'summary', 'results'].forEach((step) => {
      assert.match(component, new RegExp(`data-wizard-step=\\"${step}\\"`));
      assert.match(component, new RegExp(`data-wizard-progress-step=\\"${step}\\"`));
    });
    assert.match(component, /data-wizard-summary/);
    assert.match(component, /data-wizard-error/);
    assert.match(component, /data-wizard-prev/);
    assert.match(component, /data-wizard-next/);
    assert.match(component, /data-wizard-cancel/);
    assert.match(component, /data-generate/);
  });

  it('keeps AI generation behind the summary confirmation step', () => {
    const script = readText('src/scripts/shopping-app.ts');

    assert.match(script, /wizardSteps = \['range', 'meals', 'summary', 'results'\]/);
    assert.match(script, /currentWizardStep: WizardStep = 'range'/);
    assert.match(script, /validateWizardStep/);
    assert.match(script, /goToWizardStep\('results'\)/);
    assert.match(script, /currentWizardStep !== 'summary'/);
    assert.match(script, /data-wizard-next/);
    assert.match(script, /data-wizard-prev/);
    assert.match(script, /renderWizardSummary/);
  });
});
