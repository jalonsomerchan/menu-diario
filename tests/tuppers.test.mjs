import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

function daysUntilExpiry(expiresAt, today) {
  const expiry = new Date(`${expiresAt}T00:00:00`);
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - base.getTime()) / 86_400_000);
}

function expiryState(tupper, today = '2026-05-16T00:00:00', warningDays = 2) {
  if (['consumed', 'discarded', 'archived'].includes(tupper.status)) return 'done';
  const days = daysUntilExpiry(tupper.expiresAt, today);
  if (days < 0) return 'expired';
  if (days <= warningDays) return 'expiring';
  return 'fresh';
}

function planAssignment(menu, dayKey, meal, tupper, allowAppend = false) {
  const day = menu.days[dayKey];
  if (day?.skipped) return { canAssign: false, reason: 'day-skipped' };
  const currentMeal = day?.meals?.[meal] ?? { items: [], skipped: false };
  if (currentMeal.skipped) return { canAssign: false, reason: 'meal-skipped' };
  if (currentMeal.items.includes(`Tupper: ${tupper.name}`)) return { canAssign: false, reason: 'already-in-meal' };
  if (currentMeal.items.length > 0 && !allowAppend) return { canAssign: false, reason: 'meal-has-items' };
  return { canAssign: true, nextItems: [...currentMeal.items, `Tupper: ${tupper.name}`] };
}

function removeTupperFromItems(items, tupper) {
  const label = `Tupper: ${tupper.name}`;
  const index = items.indexOf(label);
  if (index === -1) return items;
  return items.filter((_, itemIndex) => itemIndex !== index);
}

describe('Tuppers domain helpers', () => {
  it('calculates expiry states with the default two-day warning window', () => {
    assert.equal(expiryState({ expiresAt: '2026-05-20', status: 'active' }), 'fresh');
    assert.equal(expiryState({ expiresAt: '2026-05-18', status: 'active' }), 'expiring');
    assert.equal(expiryState({ expiresAt: '2026-05-15', status: 'active' }), 'expired');
    assert.equal(expiryState({ expiresAt: '2026-05-15', status: 'consumed' }), 'done');
  });

  it('blocks silent overwrites and appends only when confirmed', () => {
    const menu = {
      days: {
        '2026-05-17': {
          meals: {
            lunch: { items: ['Pasta'], skipped: false },
          },
        },
      },
    };

    assert.deepEqual(planAssignment(menu, '2026-05-17', 'lunch', { name: 'Lentejas' }), {
      canAssign: false,
      reason: 'meal-has-items',
    });
    assert.deepEqual(planAssignment(menu, '2026-05-17', 'lunch', { name: 'Lentejas' }, true), {
      canAssign: true,
      nextItems: ['Pasta', 'Tupper: Lentejas'],
    });
    assert.deepEqual(
      planAssignment(
        {
          days: {
            '2026-05-17': {
              meals: {
                lunch: { items: ['Pasta', 'Tupper: Lentejas'], skipped: false },
              },
            },
          },
        },
        '2026-05-17',
        'lunch',
        { name: 'Lentejas' }
      ),
      {
        canAssign: false,
        reason: 'already-in-meal',
      }
    );
    assert.deepEqual(removeTupperFromItems(['Pasta', 'Tupper: Lentejas'], { name: 'Lentejas' }), ['Pasta']);
  });

  it('keeps Tuppers routes, UI, repository and rules wired', () => {
    [
      'src/pages/tuppers.astro',
      'src/pages/[locale]/tuppers.astro',
      'src/components/TuppersApp.astro',
      'src/scripts/tuppers-app.ts',
      'src/i18n/tuppers.ts',
      'src/styles/tuppers.css',
      'src/lib/tuppers/types.ts',
      'src/lib/tuppers/expiry.ts',
      'src/lib/tuppers/state.ts',
      'src/lib/tuppers/assignment.ts',
      'src/lib/tuppers/repository.ts',
      'docs/tuppers.md',
    ].forEach((path) => assert.equal(existsSync(join(root, path)), true, `${path} should exist`));

    const header = readText('src/components/Header.astro');
    const dashboard = readText('src/components/DashboardApp.astro');
    const configurator = readText('src/components/ConfiguratorApp.astro');
    const app = readText('src/components/TuppersApp.astro');
    const script = readText('src/scripts/tuppers-app.ts');
    const repository = readText('src/lib/tuppers/repository.ts');
    const rules = readText('firestore.rules');

    assert.match(header, /getLocalizedPath\('\/tuppers'/);
    assert.match(dashboard, /getLocalizedPath\('\/tuppers'/);
    assert.match(configurator, /getLocalizedPath\('\/tuppers'/);
    assert.match(app, /data-tuppers-app/);
    assert.match(app, /<ConfirmDialog/);
    assert.match(app, /aria-live=\"polite\"/);
    assert.match(app, /data-expiry-alert/);
    assert.match(app, /tt\('unassign'\)/);
    assert.match(script, /watchTuppers/);
    assert.match(script, /resubscribeTuppers/);
    assert.match(script, /currentProfile\?\.groupId/);
    assert.match(script, /assignTupperToMeal/);
    assert.match(script, /removeTupperFromMeal/);
    assert.match(script, /assignment-move-required/);
    assert.match(script, /data-action="unassign"/);
    assert.match(script, /createConfirmDialog/);
    assert.doesNotMatch(script, /window\.confirm/);
    assert.match(repository, /firestoreModule\.where\('groupId', '==', groupId\)/);
    assert.match(repository, /tuppers\.filter\(\(tupper\) => !tupper\.groupId\)/);
    assert.match(repository, /groupId: profile\?\.groupId \?\? null/);
    assert.ok(rules.includes('match /tuppers/{tupperId}'));
  });

  it('documents Firestore model and future integrations', () => {
    const docs = readText('docs/tuppers.md');
    const i18n = readText('src/i18n/tuppers.ts');

    assert.match(docs, /colección `tuppers`/);
    assert.match(docs, /No sobrescribe platos existentes/i);
    assert.match(docs, /quitar una asignación/i);
    assert.match(docs, /recomendador inteligente/i);
    assert.match(docs, /lista de la compra/i);
    assert.match(docs, /grupo/i);
    assert.match(i18n, /es:/);
    assert.match(i18n, /en:/);
    assert.match(i18n, /expiryAlert/);
  });
});
