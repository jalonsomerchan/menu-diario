import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('dish recommender smoke checks', () => {
  it('keeps the dish recommender route, component, script and styles wired', () => {
    [
      'src/pages/recomendador-platos.astro',
      'src/pages/[locale]/recomendador-platos.astro',
      'src/components/DishRecommenderApp.astro',
      'src/scripts/dish-recommender-app.ts',
      'src/styles/dish-recommender.css',
      'src/i18n/dish-recommender.ts',
      'src/lib/ai/dish-recommender.ts',
    ].forEach((path) => assert.equal(existsSync(join(root, path)), true, `${path} should exist`));

    const page = readText('src/pages/recomendador-platos.astro');
    const localizedPage = readText('src/pages/[locale]/recomendador-platos.astro');
    const component = readText('src/components/DishRecommenderApp.astro');
    const script = readText('src/scripts/dish-recommender-app.ts');
    const styles = readText('src/styles/dish-recommender.css');
    const aiIndex = readText('src/lib/ai/index.ts');
    const aiHelper = readText('src/lib/ai/dish-recommender.ts');
    const translations = readText('src/i18n/dish-recommender.ts');

    assert.match(page, /<DishRecommenderApp/);
    assert.match(localizedPage, /getStaticPaths/);
    assert.match(localizedPage, /<DishRecommenderApp/);
    assert.match(component, /data-dish-recommender-app/);
    assert.match(component, /data-dish-step-indicator/);
    assert.match(component, /data-dish-submit/);
    assert.doesNotMatch(component, /menu-app__eyebrow/);
    assert.match(component, /inputmode="numeric"/);
    assert.match(script, /buildDishRecommenderPrompt/);
    assert.match(script, /createManualDish/);
    assert.match(script, /updateMenuDay/);
    assert.match(script, /getGroupFoodIntolerancesForPrompt/);
    assert.match(script, /watchWeekMenusByIds/);
    assert.match(script, /watchUserMenus/);
    assert.match(script, /getRecentMealsForPrompt/);
    assert.match(script, /recentMeals: getRecentMealsForPrompt\(request\.meal\)/);
    assert.match(script, /getAlreadyShownDishesForPrompt/);
    assert.match(script, /alreadyShownDishes: previousRecommendations\.length/);
    assert.match(script, /recommendations = append \? \[\.\.\.recommendations, \.\.\.newRecommendations\]/);
    assert.match(script, /data-dish-generate-more/);
    assert.match(script, /renderLoading/);
    assert.match(script, /showEmptyResults = false/);
    assert.match(script, /formatAiError/);
    assert.match(script, /dish-recommender-result__footer/);
    assert.match(script, /dish-recommender-assign__controls/);
    assert.doesNotMatch(script, /button--primary button--small" type="button" data-dish-assign/);
    assert.match(script, /navigator\.share/);
    assert.match(script, /data-dish-share/);
    assert.match(styles, /dish-recommender-progress/);
    assert.match(styles, /dish-recommender-loading__spinner/);
    assert.match(styles, /dish-recommender-result__footer/);
    assert.match(styles, /dish-recommender-assign__controls/);
    assert.match(styles, /dish-recommender-more/);
    assert.match(styles, /grid-template-columns: minmax\(10rem, 1fr\) auto/);
    assert.match(styles, /appearance: none/);
    assert.match(styles, /resize: vertical/);
    assert.match(styles, /@media \(max-width: 539px\)/);
    assert.match(aiIndex, /dish-recommender/);
    assert.match(aiHelper, /basic pantry items/);
    assert.match(aiHelper, /Recently eaten meals to avoid repeating/);
    assert.match(aiHelper, /Dish recommendations already shown/);
    assert.match(aiHelper, /normalizeDishRecommendations\(response: DishRecommendationResponse, existingDishes/);
    assert.match(aiHelper, /same main protein\/style/);
    assert.match(aiHelper, /isDishRecommendationResponse/);
    assert.match(translations, /generateMore/);
    assert.match(translations, /generatingMore/);
    assert.match(translations, /noNewDishes/);
    assert.match(translations, /loadingTitle/);
    assert.match(translations, /requestError/);
    assert.match(translations, /timeoutError/);
  });

  it('exposes the dish recommender from navigation and app shell cache', () => {
    const header = readText('src/components/Header.astro');
    const serviceWorker = readText('src/pages/sw.js.ts');
    assert.match(header, /useDishRecommenderTranslations/);
    assert.match(header, /getLocalizedPath\('\/recomendador-platos'/);
    assert.match(header, /mdi:chef-hat/);
    assert.match(serviceWorker, /recomendador-platos/);
  });
});
