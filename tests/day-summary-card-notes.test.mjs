import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('upcoming day card notes', () => {
  it('keeps note rendering wired without empty blocks', () => {
    const dashboard = readText('src/scripts/dashboard-app.ts');
    const card = readText('src/lib/menu/day-summary-card.ts');
    const component = readText('src/components/DashboardApp.astro');

    assert.ok(card.includes('notesHtml?: string'));
    assert.ok(card.includes("notesHtml = ''"));
    assert.ok(card.includes('${notesHtml}'));

    assert.ok(dashboard.includes('function collectDayNotes'));
    assert.ok(dashboard.includes('day.notes'));
    assert.ok(dashboard.includes("day.skipped ? day.skipNote : ''"));
    assert.ok(dashboard.includes('day.meals[meal]?.note'));
    assert.ok(dashboard.includes("if (!notes.length) return ''"));
    assert.ok(dashboard.includes('aria-label="${escapeHtml(labels.notes)}"'));
    assert.ok(dashboard.includes('notesHtml: renderDayNotesHtml(day)'));

    assert.ok(component.includes("notes: t('menu.notes')"));
    assert.ok(component.includes('planner-day-card__notes'));
    assert.ok(component.includes('-webkit-line-clamp: 2'));
  });
});
