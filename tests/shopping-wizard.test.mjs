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
    assert.match(component, /shopping-wizard__hint/);
  });

  it('uses the same visible format as the planning assistant', () => {
    const component = readText('src/components/ShoppingApp.astro');

    assert.match(component, /planning-ai-app/);
    assert.match(component, /planning-ai-panel/);
    assert.match(component, /planning-ai-section-heading/);
    assert.match(component, /planning-ai-wizard-progress/);
    assert.match(component, /planning-ai-wizard-step/);
    assert.match(component, /planning-ai-section-card/);
    assert.match(component, /planning-ai-request-card/);
    assert.match(component, /planning-ai-wizard-actions/);
    assert.match(component, /shopping-wizard\.ts/);
  });

  it('keeps AI generation behind the summary confirmation step', () => {
    const script = readText('src/scripts/shopping-app.ts');

    assert.match(script, /wizardSteps = \['range', 'meals', 'summary', 'results'\]/);
    assert.match(script, /currentWizardStep: WizardStep = 'range'/);
    assert.match(script, /validateWizardStep/);
    assert.match(script, /if \(currentWizardStep === 'summary'\)/);
    assert.match(script, /goToWizardStep\('results'\);/);
    assert.match(script, /generateWithAi\(\)/);
    assert.match(script, /data-wizard-next/);
    assert.match(script, /data-wizard-prev/);
    assert.match(script, /renderWizardSummary/);
  });

  it('has a dedicated wizard controller with planning-like navigation behavior', () => {
    const script = readText('src/scripts/shopping-wizard.ts');

    assert.match(script, /data-shopping-wizard/);
    assert.match(script, /data-shopping-app/);
    assert.match(script, /planning-ai-wizard-step/);
    assert.match(script, /shopping-wizard:step/);
    assert.match(script, /focusPanel/);
    assert.match(script, /scrollWizardTop/);
    assert.match(script, /MutationObserver/);
  });
});
