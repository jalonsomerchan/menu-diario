import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('AI planner wizard', () => {
  it('keeps the AI planner as a guided wizard before generation', () => {
    const component = readText('src/components/PlanningAiApp.astro');
    const wizard = readText('src/scripts/planning-ai-wizard.ts');
    const planner = readText('src/scripts/planning-ai-app.ts');

    assert.match(component, /data-plan-wizard/);
    assert.match(component, /data-plan-step=\"0\"/);
    assert.match(component, /data-plan-step=\"4\"/);
    assert.match(component, /data-plan-step-indicator/);
    assert.match(component, /data-plan-wizard-back/);
    assert.match(component, /data-plan-wizard-next/);
    assert.match(component, /planning-ai-wizard\.ts/);
    assert.match(component, /data-plan-submit hidden/);

    assert.match(wizard, /validateBeforeSubmit/);
    assert.match(wizard, /stopImmediatePropagation/);
    assert.match(wizard, /start\.value > end\.value/);
    assert.match(wizard, /selectedMeals\(\)\.length === 0/);
    assert.match(wizard, /aria-current', 'step'/);

    assert.match(planner, /generateGeminiJson/);
    assert.match(planner, /getGroupFoodIntolerancesForPrompt/);
  });
});
