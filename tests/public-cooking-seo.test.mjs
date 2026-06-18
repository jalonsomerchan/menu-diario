import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('public cooking SEO pages', () => {
  it('keeps the extended catalog, routes and recipe index wired', () => {
    const baseData = readText('src/data/public-cooking-seo-pages.ts');
    const catalog = readText('src/data/public-cooking-seo-catalog.ts');
    const detail = readText('src/pages/recetas/[cookingSeoSlug].astro');
    const localizedDetail = readText('src/pages/[locale]/recipes/[cookingSeoSlug].astro');
    const index = readText('src/components/PublicCookingSeoIndexPage.astro');
    const recipeIndex = readText('src/components/PublicRecipeIndexPage.astro');
    const page = readText('src/components/PublicCookingSeoPage.astro');
    const home = readText('src/components/HomeLanding.astro');
    const homeLinks = readText('src/components/HomeCookingSeoLinks.astro');
    const footer = readText('src/components/Footer.astro');

    assert.equal(existsSync(join(root, 'src/pages/recetas.astro')), true);
    assert.equal(existsSync(join(root, 'src/pages/recetas/indice.astro')), true);
    assert.equal(existsSync(join(root, 'src/pages/[locale]/recipes.astro')), true);
    assert.equal(existsSync(join(root, 'src/pages/[locale]/recipes/recipe-index.astro')), true);
    assert.match(baseData, /export const publicCookingSeoPageCount = recipeSeeds\.length \+ tipSeeds\.length/);
    assert.equal((baseData.match(/\n  \['/g) ?? []).length, 100);
    assert.match(catalog, /extraRecipeCount/);
    assert.match(catalog, /getCookingRecipeIndexRoute/);
    assert.match(catalog, /More than 200 public recipe/);
    assert.match(catalog, /Mas de 200 recetas/);
    assert.match(detail, /public-cooking-seo-catalog/);
    assert.match(localizedDetail, /public-cooking-seo-catalog/);
    assert.match(index, /getCookingRecipeIndexRoute/);
    assert.match(recipeIndex, /recipesByLetter/);
    assert.match(page, /public-cooking-seo-catalog/);
    assert.match(page, /Menu Diario/);
    assert.match(home, /HomeCookingSeoLinks/);
    assert.match(homeLinks, /getCookingSeoIndexRoute/);
    assert.match(homeLinks, /getCookingSeoPageRoute/);
    assert.match(footer, /getCookingSeoIndexRoute/);
  });
});
