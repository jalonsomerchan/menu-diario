import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('public home page', () => {
  it('shows the product pitch, Google sign-in and explanatory sections', () => {
    const home = readText('src/pages/index.astro');
    const authGate = readText('src/components/AuthGate.astro');

    assert.match(home, /Menu Diario/);
    assert.match(home, /Organiza tus comidas de una manera fácil y con inteligecia artificial/);
    assert.match(home, /home-hero/);
    assert.match(home, /home-hero__auth/);
    assert.match(home, /<AuthGate locale=\{locale\} \/>/);
    assert.match(home, /home-feature-grid/);
    assert.match(home, /Planifica desayunos, comidas y cenas/);
    assert.match(home, /Recomendaciones con inteligencia artificial/);
    assert.match(home, /Platos guardados y menús reutilizables/);
    assert.match(home, /Pensado para familias y grupos/);
    assert.doesNotMatch(home, /siteConfig\.repositoryUrl/);

    assert.match(authGate, /google-signin-button/);
    assert.match(authGate, /data-google-login/);
    assert.match(authGate, /viewBox=\"0 0 48 48\"/);
    assert.match(authGate, /data-guest-login/);
    assert.doesNotMatch(authGate, /<h2>\{t\('home.loginTitle'\)\}<\/h2>/);
  });
});
