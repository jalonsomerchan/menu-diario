import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('planning route smoke checks', () => {
  it('keeps the planning routes and legacy configurator routes available', () => {
    [
      'src/pages/planificacion.astro',
      'src/pages/[locale]/planificacion.astro',
      'src/pages/configurar.astro',
      'src/pages/[locale]/configurar.astro',
    ].forEach((path) => assert.equal(existsSync(join(root, path)), true, `${path} should exist`));
  });

  it('uses localized planning labels without hardcoding visible copy', () => {
    const planningI18n = readText('src/i18n/planning.ts');
    const translations = readText('src/i18n/translations/es.json');
    const header = readText('src/components/Header.astro');
    const configurator = readText('src/components/ConfiguratorApp.astro');
    const planningAi = readText('src/components/PlanningAiApp.astro');
    const defaultRoute = readText('src/pages/planificacion.astro');
    const localizedRoute = readText('src/pages/[locale]/planificacion.astro');

    assert.match(planningI18n, /Planificador IA/);
    assert.match(planningI18n, /AI Planner/);
    assert.match(planningI18n, /Record<Locale/);
    assert.match(translations, /"appNav\.planning": "Planificador"/);
    assert.match(header, /appNav\.planning/);
    assert.match(header, /getLocalizedPath\('\/configurar'/);
    assert.match(header, /tp\('nav'\)/);
    assert.match(configurator, /planningPath/);
    assert.match(planningAi, /planningAi\.title/);
    assert.match(planningAi, /planningAi\.formTitle/);
    assert.match(planningAi, /planning-ai-app\.ts/);
    assert.match(defaultRoute, /<PlanningAiApp/);
    assert.match(localizedRoute, /<PlanningAiApp/);
  });
});
