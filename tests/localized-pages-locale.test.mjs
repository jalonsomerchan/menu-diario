import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

const localizedPages = [
  'src/pages/[locale]/index.astro',
  'src/pages/[locale]/dashboard.astro',
  'src/pages/[locale]/compra.astro',
  'src/pages/[locale]/planificador.astro',
  'src/pages/[locale]/planificador-ai.astro',
  'src/pages/[locale]/ajustes.astro',
  'src/pages/[locale]/historico.astro',
  'src/pages/[locale]/mis-platos.astro',
  'src/pages/[locale]/platos.astro',
  'src/pages/[locale]/tuppers.astro',
  'src/pages/[locale]/resumen-semanal.astro',
  'src/pages/[locale]/admin/platos.astro',
];

const localizedLegacyRedirects = [
  'src/pages/[locale]/configurar.astro',
  'src/pages/[locale]/planificacion.astro',
];

describe('localized app pages locale handling', () => {
  it('passes the real route locale to layouts and apps', () => {
    localizedPages.forEach((path) => {
      assert.equal(existsSync(join(root, path)), true, `${path} should exist`);
      const source = readText(path);

      assert.match(source, /export function getStaticPaths\(\)/, `${path} should statically generate locale routes`);
      assert.match(source, /Astro\.params\.locale/, `${path} should read Astro.params.locale`);
      assert.match(source, /isLocale\(localeParam\)/, `${path} should validate locale params`);
      assert.match(source, /locale=\{locale\}/, `${path} should pass locale to BaseLayout or app components`);
      assert.doesNotMatch(source, /const locale: Locale = defaultLocale;/, `${path} must not hardcode default locale`);
      assert.doesNotMatch(source, /<BaseLayout[^>]*locale=\{defaultLocale\}/s, `${path} must not render layout with defaultLocale`);
    });
  });

  it('keeps localized legacy redirects locale-aware', () => {
    localizedLegacyRedirects.forEach((path) => {
      assert.equal(existsSync(join(root, path)), true, `${path} should exist`);
      const source = readText(path);

      assert.match(source, /export function getStaticPaths\(\)/, `${path} should statically generate locale routes`);
      assert.match(source, /Astro\.params\.locale/, `${path} should read Astro.params.locale`);
      assert.match(source, /isLocale\(localeParam\)/, `${path} should validate locale params`);
      assert.match(source, /Astro\.redirect\(getLocalizedPath\(/, `${path} should redirect with localized paths`);
      assert.doesNotMatch(source, /locale=\{defaultLocale\}/, `${path} must not render layout with defaultLocale`);
    });
  });
});
