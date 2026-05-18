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

    assert.match(page, /<DishRecommenderApp/);
    assert.match(localizedPage, /getStaticPaths/);
    assert.match(localizedPage, /<DishRecommenderApp/);
    assert.match(component, /data-dish-recommender-app/);
    assert.match(component, /data-dish-step-indicator/);
    assert.match(component, /data-dish-submit/);
    assert.match(script, /buildDishRecommenderPrompt/);
    assert.match(script, /createManualDish/);
    assert.match(script, /updateMenuDay/);
    assert.match(script, /getGroupFoodIntolerancesForPrompt/);
    assert.match(script, /watchWeekMenusByIds/);
    assert.match(script, /navigator\.share/);
    assert.match(script, /data-dish-share/);
    assert.match(styles, /dish-recommender-progress/);
    assert.match(styles, /@media \(max-width: 539px\)/);
    assert.match(aiIndex, /dish-recommender/);
    assert.match(aiHelper, /basic pantry items/);
    assert.match(aiHelper, /isDishRecommendationResponse/);
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
