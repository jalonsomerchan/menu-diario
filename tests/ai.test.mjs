import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

function readJson(path) {
  return JSON.parse(readText(path));
}

describe('Firebase AI foundation', () => {
  it('keeps modular AI foundation files available', () => {
    [
      'src/lib/ai/authenticated-api-client.ts',
      'src/lib/ai/client.ts',
      'src/lib/ai/config.ts',
      'src/lib/ai/errors.ts',
      'src/lib/ai/flags.ts',
      'src/lib/ai/index.ts',
      'src/lib/ai/json.ts',
      'src/lib/ai/limits.ts',
      'src/lib/ai/pending-meal-recommendations.ts',
      'src/lib/ai/shopping-list.ts',
      'src/lib/ai/remote-config.ts',
      'src/lib/ai/ui-state.ts',
      'docs/ai-api.md',
    ].forEach((path) => {
      assert.equal(existsSync(join(root, path)), true, `${path} should exist`);
    });
  });

  it('keeps authenticated AI API config centralized and menu AI enabled by default', () => {
    const envExample = readText('.env.example');
    const config = readText('src/lib/ai/config.ts');
    const flags = readText('src/lib/ai/flags.ts');
    const apiClient = readText('src/lib/ai/authenticated-api-client.ts');

    [
      'PUBLIC_AI_ENABLED',
      'PUBLIC_AI_MENU_SUGGESTIONS_ENABLED',
      'PUBLIC_AI_SHOPPING_LIST_ENABLED',
      'PUBLIC_AI_REMOTE_CONFIG_ENABLED',
      'PUBLIC_FIREBASE_AI_MODEL=gemini-2.5-flash-lite',
      'PUBLIC_FIREBASE_AI_TEMPERATURE=0.35',
      'PUBLIC_FIREBASE_AI_TOP_P=0.9',
      'PUBLIC_FIREBASE_AI_MAX_OUTPUT_TOKENS=768',
      'PUBLIC_FIREBASE_AI_TIMEOUT_MS=15000',
      'PUBLIC_AI_MAX_SESSION_REQUESTS=8',
      'PUBLIC_AI_MAX_USER_DAILY_REQUESTS=20',
    ].forEach((key) => assert.ok(envExample.includes(key), `.env.example should include ${key}`));

    assert.doesNotMatch(envExample, /PUBLIC_AI_API_ENDPOINT/);
    assert.doesNotMatch(config, /PUBLIC_AI_API_ENDPOINT/);
    assert.match(apiClient, /authenticatedAiApiEndpoint/);
    assert.match(apiClient, /https:\/\/alon\.one\/api-ia\/auth\.php/);
    assert.match(config, /aiGenerationConfig/);
    assert.match(config, /aiPromptConfig/);
    assert.match(config, /aiClientLimits/);
    assert.match(flags, /readEnvBoolean\(import\.meta\.env\.PUBLIC_AI_ENABLED, true\)/);
    assert.match(flags, /readEnvBoolean\(import\.meta\.env\.PUBLIC_AI_MENU_SUGGESTIONS_ENABLED, true\)/);
    assert.match(flags, /readEnvBoolean\(import\.meta\.env\.PUBLIC_AI_SHOPPING_LIST_ENABLED, false\)/);
    assert.match(flags, /ai_enabled/);
    assert.match(flags, /ai_menu_suggestions_enabled/);
    assert.match(flags, /ai_shopping_list_enabled/);
  });

  it('keeps reusable authenticated AI API client guarded by token auth, project id, timeout and JSON validation', () => {
    const client = readText('src/lib/ai/client.ts');
    const apiClient = readText('src/lib/ai/authenticated-api-client.ts');
    const index = readText('src/lib/ai/index.ts');
    const json = readText('src/lib/ai/json.ts');
    const errors = readText('src/lib/ai/errors.ts');

    assert.match(apiClient, /generateAuthenticatedAiApiJson/);
    assert.match(apiClient, /authenticatedAiApiEndpoint/);
    assert.match(apiClient, /token:\s*string/);
    assert.match(apiClient, /projectId:\s*string/);
    assert.match(apiClient, /fetcher = globalThis\.fetch\.bind\(globalThis\)/);
    assert.match(apiClient, /Authorization:\s*'Bearer ' \+ input\.token/);
    assert.match(apiClient, /application\/x-www-form-urlencoded/);
    assert.match(apiClient, /project_id:\s*input\.projectId/);
    assert.match(apiClient, /system_prompt:\s*input\.systemPrompt/);
    assert.match(apiClient, /user_prompt:\s*input\.userPrompt/);
    assert.match(apiClient, /withTimeout/);
    assert.match(apiClient, /parseValidatedJson/);
    assert.match(apiClient, /catch \(error\)/);
    assert.match(apiClient, /network request failed/);
    assert.match(apiClient, /status === 401 \|\| status === 403/);

    assert.match(index, /authenticatedAiApiEndpoint/);
    assert.match(index, /generateAuthenticatedAiApiJson/);
    assert.match(index, /AuthenticatedAiApiJsonOptions/);

    assert.match(client, /generateAuthenticatedAiJson/);
    assert.match(client, /generateGeminiJson/);
    assert.match(client, /generateAuthenticatedAiApiJson/);
    assert.match(client, /getFirebaseServices/);
    assert.match(client, /getFirebaseConfig\(\)\.projectId/);
    assert.match(client, /currentUser/);
    assert.match(client, /getIdToken/);
    assert.match(client, /hasFirebaseConfig/);
    assert.match(client, /isAiAvailable/);
    assert.match(client, /assertFirebaseAppCheckReadyForAi/);
    assert.match(client, /assertAiClientLimit/);
    assert.match(client, /registerAiClientUse/);
    assert.match(errors, /console\.warn\('\[ai\]'/);
    assert.match(json, /JSON\.parse/);
    assert.match(json, /stripJsonFence/);
    assert.match(json, /validator\(value\)/);
  });

  it('keeps UI error states translated in all locales', () => {
    const uiState = readText('src/lib/ai/ui-state.ts');
    const pendingMealRecommendations = readText('src/lib/ai/pending-meal-recommendations.ts');
    const es = readJson('src/i18n/translations/es.json');
    const en = readJson('src/i18n/translations/en.json');
    const keys = [
      'ai.loading',
      'ai.disabled',
      'ai.error',
      'ai.quotaExhausted',
      'ai.missingConfig',
      'ai.invalidResponse',
      'ai.retry',
      'ai.pendingMealsTitle',
      'ai.pendingMealsDescription',
      'ai.pendingMealsHint',
      'ai.pendingMealsGenerate',
      'ai.pendingMealsEmpty',
      'ai.pendingMealsNoCatalog',
      'ai.pendingMealsNoResults',
      'ai.pendingMealsApply',
      'ai.pendingMealsApplied',
      'shopping.title',
      'shopping.generate',
      'shopping.statusToBuy',
      'shopping.categoryVegetables',
    ];

    assert.match(uiState, /quota-exhausted/);
    assert.match(uiState, /disabled/);
    assert.match(uiState, /missing-config/);
    assert.match(uiState, /invalid-response/);
    assert.match(pendingMealRecommendations, /getPendingMealSlots/);
    assert.match(pendingMealRecommendations, /assignPendingMealRecommendations/);
    assert.match(pendingMealRecommendations, /buildPendingMealPrompt/);

    keys.forEach((key) => {
      assert.ok(es[key], `es.json should include ${key}`);
      assert.ok(en[key], `en.json should include ${key}`);
    });
  });

  it('documents App Check, authenticated API and client-side limit caveats', () => {
    const firebaseDocs = readText('docs/firebase.md');
    const aiApiDocs = readText('docs/ai-api.md');
    const readme = readText('README.md');

    assert.match(firebaseDocs, /App Check/);
    assert.match(firebaseDocs, /Remote Config/);
    assert.match(firebaseDocs, /shopping list|lista de la compra/i);
    assert.match(firebaseDocs, /sessionStorage/);
    assert.match(firebaseDocs, /no son una protección real/);
    assert.match(firebaseDocs, /comidas pendientes/);
    assert.match(firebaseDocs, /no incluye emails ni notas personales/);
    assert.match(firebaseDocs, /shoppingLists/);
    assert.match(aiApiDocs, /API autenticada de IA/);
    assert.match(aiApiDocs, /https:\/\/alon\.one\/api-ia\/auth\.php/);
    assert.match(aiApiDocs, /Authorization: Bearer/);
    assert.match(aiApiDocs, /application\/x-www-form-urlencoded/);
    assert.match(aiApiDocs, /system_prompt/);
    assert.match(aiApiDocs, /user_prompt/);
    assert.match(readme, /PUBLIC_AI_ENABLED/);
    assert.match(readme, /comidas pendientes/);
    assert.match(readme, /lista de la compra/i);
  });
});