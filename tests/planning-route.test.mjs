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
    const header = readText('src/components/Header.astro');
    const configurator = readText('src/components/ConfiguratorApp.astro');
    const defaultRoute = readText('src/pages/planificacion.astro');
    const localizedRoute = readText('src/pages/[locale]/planificacion.astro');

    assert.match(planningI18n, /Planificación/);
    assert.match(planningI18n, /Planning/);
    assert.match(planningI18n, /Record<Locale/);
    assert.match(header, /usePlanningTranslations/);
    assert.match(header, /tp\('nav'\)/);
    assert.match(configurator, /usePlanningTranslations/);
    assert.match(configurator, /tp\('title'\)/);
    assert.match(configurator, /tp\('hint'\)/);
    assert.match(defaultRoute, /tp\('title'\)/);
    assert.match(localizedRoute, /tp\('title'\)/);
  });
});
