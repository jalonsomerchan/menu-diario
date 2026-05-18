import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

function readJson(path) {
  return JSON.parse(readText(path));
}

describe('user preference settings', () => {
  it('keeps food intolerances stored on the user profile and editable from settings', () => {
    const types = readText('src/lib/menu/types.ts');
    const repository = readText('src/lib/menu/repository.ts');
    const settingsApp = readText('src/components/SettingsApp.astro');
    const settingsScript = readText('src/scripts/settings-app.ts');
    const docs = readText('docs/user-preferences.md');

    assert.match(types, /foodIntolerances: string/);
    assert.match(repository, /normalizeFoodIntolerances/);
    assert.match(repository, /foodIntolerances: ''/);
    assert.match(repository, /foodIntolerances\?: string/);
    assert.match(settingsApp, /data-food-intolerances-form/);
    assert.match(settingsApp, /data-food-intolerances/);
    assert.match(settingsScript, /maxFoodIntolerancesLength = 1000/);
    assert.match(settingsScript, /syncGroupFoodIntolerances/);
    assert.match(settingsScript, /foodIntolerancesSaved/);
    assert.match(docs, /foodIntolerances/);
  });

  it('keeps group food intolerances aggregated without reading other user profiles', () => {
    const types = readText('src/lib/menu/types.ts');
    const repository = readText('src/lib/menu/repository.ts');
    const docs = readText('docs/user-preferences.md');

    assert.match(types, /memberFoodIntolerances: Record<string, string>/);
    assert.match(repository, /normalizeGroupFoodIntolerances/);
    assert.match(repository, /memberFoodIntolerances/);
    assert.match(repository, /getGroupFoodIntolerances/);
    assert.match(repository, /export async function syncGroupFoodIntolerances/);
    assert.match(docs, /memberFoodIntolerances/);
    assert.match(docs, /agregado/);
  });

  it('includes group food intolerances in AI planning prompts with a bounded payload', () => {
    const planningPrompt = readText('src/lib/ai/planning-assistant.ts');
    const planningScript = readText('src/scripts/planning-ai-app.ts');
    const docs = readText('docs/user-preferences.md');

    assert.match(planningPrompt, /foodIntolerances\?: string/);
    assert.match(planningPrompt, /maxFoodIntolerancesPromptLength = 500/);
    assert.match(planningPrompt, /describeFoodIntolerances/);
    assert.match(planningPrompt, /Food restrictions/);
    assert.match(planningScript, /watchGroup/);
    assert.match(planningScript, /currentGroup/);
    assert.match(planningScript, /getGroupFoodIntolerances\(currentGroup, currentProfile\?\.foodIntolerances\)/);
    assert.match(docs, /planificación con IA/);
    assert.match(docs, /todo el grupo/);
  });

  it('keeps settings namespace translations aligned', () => {
    const es = readJson('src/i18n/translations/settings/es.json');
    const en = readJson('src/i18n/translations/settings/en.json');
    const expectedKeys = Object.keys(es).sort();

    assert.deepEqual(Object.keys(en).sort(), expectedKeys);
    assert.ok(es.foodIntolerancesTitle);
    assert.ok(en.foodIntolerancesTitle);
  });
});
