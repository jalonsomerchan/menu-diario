import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

function cssBlock(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? '';
}

describe('AI planner wizard', () => {
  it('keeps the AI planner as a guided wizard before generation', () => {
    const component = readText('src/components/PlanningAiApp.astro');
    const wizard = readText('src/scripts/planning-ai-wizard.ts');
    const planner = readText('src/scripts/planning-ai-app.ts');
    const dateRange = readText('src/scripts/planning-ai-date-range.ts');
    const wizardActionsBlock = cssBlock(component, '.planning-ai-wizard-actions');

    assert.match(component, /Ideas rápidas para tu semana/);
    assert.match(component, /Elige días, marca comidas y deja que la IA sugiera platos/);
    assert.match(component, /app-page-intro/);
    assert.match(component, /data-plan-scroll-target/);
    assert.doesNotMatch(component, /planning-ai-hero app-panel/);
    assert.doesNotMatch(component, /section-heading section-heading--simple/);
    assert.match(component, /data-plan-wizard/);
    assert.match(component, /data-plan-step=\"0\"/);
    assert.match(component, /data-plan-step=\"2\"/);
    assert.match(component, /data-plan-step=\"6\"/);
    assert.match(component, /data-plan-step=\"7\"/);
    assert.match(component, /data-plan-date-range/);
    assert.match(component, /data-plan-start/);
    assert.match(component, /data-plan-end/);
    assert.match(component, /planning-ai-date-range\.ts/);
    assert.doesNotMatch(component, /type=\"date\" data-plan-start/);
    assert.doesNotMatch(component, /type=\"date\" data-plan-end/);
    assert.match(component, /data-plan-pending/);
    assert.match(component, /data-plan-intolerances/);
    assert.match(component, /data-plan-results/);
    assert.match(component, /planning-ai-results-panel/);
    assert.doesNotMatch(component, /planning-ai-panel--results/);
    assert.match(component, /data-plan-step=\"6\"[\s\S]*data-plan-summary/);
    assert.match(component, /data-plan-step=\"7\"[\s\S]*data-plan-results/);
    assert.match(component, /data-plan-step-indicator/);
    assert.match(component, /data-plan-wizard-back/);
    assert.match(component, /data-plan-wizard-next/);
    assert.match(component, /planning-ai-wizard\.ts/);
    assert.match(component, /data-plan-submit hidden/);
    assert.match(wizardActionsBlock, /display:\s*flex/);
    assert.doesNotMatch(wizardActionsBlock, /display:\s*grid/);

    assert.match(dateRange, /flatpickr/);
    assert.match(dateRange, /cdnjs\.cloudflare\.com\/ajax\/libs\/flatpickr\/4\.6\.13/);
    assert.match(dateRange, /mode: 'range'/);
    assert.match(dateRange, /data-plan-date-range/);
    assert.match(dateRange, /data-plan-start/);
    assert.match(dateRange, /data-plan-end/);
    assert.match(dateRange, /syncVisibleRange/);

    assert.match(wizard, /validateBeforeSubmit/);
    assert.match(wizard, /stopImmediatePropagation/);
    assert.match(wizard, /start\.value > end\.value/);
    assert.match(wizard, /selectedMeals\(\)\.length === 0/);
    assert.match(wizard, /selectedPendingSlots\(\)\.length === 0/);
    assert.match(wizard, /planning-ai-wizard:step/);
    assert.match(wizard, /planning-ai-wizard:go/);
    assert.match(wizard, /scrollTarget\.scrollIntoView/);
    assert.match(wizard, /data-plan-scroll-target/);
    assert.match(wizard, /max-width: 719px/);
    assert.match(wizard, /aria-current', 'step'/);

    assert.match(planner, /generateGeminiJson/);
    assert.match(planner, /getSelectedPendingMealsForRequest/);
    assert.match(planner, /data-plan-pending-slot/);
    assert.match(planner, /data-plan-intolerances/);
    assert.match(planner, /getGroupFoodIntolerancesForPrompt/);
    assert.match(planner, /currentWizardStep === 6/);
    assert.match(planner, /form\.requestSubmit/);
  });
});
