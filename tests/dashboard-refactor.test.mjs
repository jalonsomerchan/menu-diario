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
});
