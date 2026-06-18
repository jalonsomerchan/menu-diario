import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('public cooking SEO pages', () => {
  it('keeps the 100 page catalog and routes wired', () => {
    const data = readText('src/data/public-cooking-seo-pages.ts');
    const detail = readText('src/pages/recetas/[cookingSeoSlug].astro');
    const localizedDetail = readText('src/pages/[locale]/recipes/[cookingSeoSlug].astro');
    const index = readText('src/components/PublicCookingSeoIndexPage.astro');
    const page = readText('src/components/PublicCookingSeoPage.astro');
    const home = readText('src/components/HomeLanding.astro');
    const homeLinks = readText('src/components/HomeCookingSeoLinks.astro');
    const footer = readText('src/components/Footer.astro');

    assert.equal(existsSync(join(root, 'src/pages/recetas.astro')), true);
    assert.equal(existsSync(join(root, 'src/pages/[locale]/recipes.astro')), true);
    assert.match(data, /export const publicCookingSeoPageCount = recipeSeeds\.length \+ tipSeeds\.length/);
    assert.equal((data.match(/\n  \['/g) ?? []).length, 100);
    assert.match(detail, /getPublicCookingSeoPages\(defaultLocale\)/);
    assert.match(localizedDetail, /getPublicCookingSeoPages\(locale\)/);
    assert.match(index, /getCookingSeoPageRoute/);
    assert.match(page, /getPublicCookingSeoRelatedPages/);
    assert.match(page, /Menu Diario/);
    assert.match(home, /HomeCookingSeoLinks/);
    assert.match(homeLinks, /getCookingSeoIndexRoute/);
    assert.match(homeLinks, /getCookingSeoPageRoute/);
    assert.match(footer, /getCookingSeoIndexRoute/);
  });
});
