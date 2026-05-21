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
    const rootHome = readText('src/pages/index.astro');
    const localizedHome = readText('src/pages/[locale]/index.astro');
    const landing = readText('src/components/HomeLanding.astro');
    const authGate = readText('src/components/AuthGate.astro');
    const authScript = readText('src/scripts/auth-gate.ts');

    assert.match(rootHome, /<HomeLanding locale=\{locale\} \/>/);
    assert.match(localizedHome, /<HomeLanding locale=\{locale\} \/>/);
    assert.match(landing, /Bienvenido a Menu Diario/);
    assert.match(landing, /Tu app para planificar comidas con tu familia o grupo/);
    assert.match(landing, /home-landing-hero/);
    assert.match(landing, /home-landing-grid/);
    assert.match(landing, /Toda la semana en una sola vista/);
    assert.match(landing, /Pensado para decidir en grupo/);
    assert.match(landing, /IA y platos guardados cuando hagan falta/);
    assert.match(landing, /showGuest=\{false\}/);
    assert.doesNotMatch(landing, /siteConfig\.repositoryUrl/);

    assert.match(authGate, /auth-session-loading/);
    assert.match(authGate, /data-auth-session-loading/);
    assert.match(authGate, /Iniciando sesión/);
    assert.match(authGate, /google-signin-button/);
    assert.match(authGate, /data-google-login hidden/);
    assert.match(authGate, /viewBox=\"0 0 48 48\"/);
    assert.match(authGate, /showGuest/);
    assert.match(authScript, /setSessionLoading\(true\)/);
    assert.match(authScript, /revealLogin\(\)/);
    assert.doesNotMatch(authGate, /<h2>\{t\('home.loginTitle'\)\}<\/h2>/);
  });
});
