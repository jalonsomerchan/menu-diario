import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('dashboard refactor smoke checks', () => {
  it('uses the shared HTML escaping helper from the dashboard script', () => {
    const helperPath = 'src/lib/ui/html.ts';
    const helper = readText(helperPath);
    const dashboardScript = readText('src/scripts/dashboard-app.ts');

    assert.equal(existsSync(join(root, helperPath)), true, `${helperPath} should exist`);
    assert.match(helper, /export function escapeHtml/);
    assert.match(dashboardScript, /import \{ escapeHtml \} from '\.\.\/lib\/ui\/html'/);
    assert.doesNotMatch(dashboardScript, /function escapeHtml/);
  });

  it('catches async bootstrap errors before they become uncaught promise rejections', () => {
    const dashboardScript = readText('src/scripts/dashboard-app.ts');

    assert.match(dashboardScript, /async function initializeAuthenticatedDashboard/);
    assert.match(dashboardScript, /try \{\s*await initializeAuthenticatedDashboard\(services, user\);/);
    assert.match(dashboardScript, /catch \(error\) \{\s*setVisible\(false\);\s*showStatus\(formatError\(error\), true\);/);
  });

  it('batches dashboard rerenders and keeps catalog updates from repainting the whole screen', () => {
    const dashboardScript = readText('src/scripts/dashboard-app.ts');

    assert.match(dashboardScript, /function scheduleDashboardRender\(\)/);
    assert.match(dashboardScript, /window\.requestAnimationFrame\(/);
    assert.match(dashboardScript, /watchUserDishes\(\s*services,\s*user\.uid,\s*\(nextDishes\) => \{\s*dishes = nextDishes;\s*\}/);
    assert.match(dashboardScript, /watchDailyOptions[\s\S]+scheduleDashboardRender\(\);/);
    assert.match(dashboardScript, /watchGroup[\s\S]+scheduleDashboardRender\(\);/);
  });

  it('exposes shared translated error labels to the dashboard runtime', () => {
    const dashboardComponent = readText('src/components/DashboardApp.astro');

    assert.match(dashboardComponent, /'errors\.unavailable': t\('errors\.unavailable'\)/);
    assert.match(dashboardComponent, /'errors\.generic': t\('errors\.generic'\)/);
    assert.match(dashboardComponent, /'errors\.permissionDenied': t\('errors\.permissionDenied'\)/);
  });
});
