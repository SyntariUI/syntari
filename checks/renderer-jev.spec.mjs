import { test, expect } from '@playwright/test';
import { serveRenderer, openRenderer, script, prompts, ask, settled, screenIR, openExample } from './renderer-harness.mjs';

/*
 * Jev and Claude: what needs no model is decided by Jev and applied in milliseconds, through the same validated
 * operations; what needs writing goes to Claude, with the part Jev found.
 */
serveRenderer(test);

test('Jev removes, moves, and renames a part without calling Claude, and Undo brings it back', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await openExample(p, 'wealth');
  const before = await screenIR(p);
  await ask(p, 'Remove the positions table');
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v2 .*Jev · change, no model call/);
  await expect(p.locator('.canvas [data-ir-id=holdings]')).toHaveCount(0);
  await expect(p.locator('[data-changes] .change-card').first()).toContainText(/Applied · v1 → v2 · Jev, no model call, [\d.]+ ms/);
  await p.locator('[data-tab=activity]').click();
  await expect(p.locator('[data-activity]')).toContainText('Jev decided this without a model');

  await ask(p, 'Move the risk chart before the return line');
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v3 /);
  const order = await p.$$eval('.canvas > .ir-screen > [data-ir-id]', nodes => nodes.map(node => node.dataset.irId));
  expect(order.indexOf('risk-vs-weight')).toBe(order.indexOf('performance') - 1);

  await ask(p, 'Rename the risk chart to "Risk comes from equities"');
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v4 /);
  await expect(p.locator('.canvas [data-ir-id=risk-vs-weight]')).toContainText('Risk comes from equities');

  expect(await prompts(p)).toEqual([]);
  for (let i = 0; i < 3; i++) await p.locator('[data-undo]').click();
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v1 /);
  expect(await screenIR(p)).toEqual(before);
  expect(errors).toEqual([]);
});

test('a request Jev cannot pin down goes to Claude, with the part Jev found when it found one', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await openExample(p, 'wealth');
  /* Two bar charts: Jev does not guess which. */
  await script(p, JSON.stringify({ version: 'syntari-ops-1', base: '{{BASE}}', summary: 'Remove the liquidity ladder', operations: [{ op: 'remove', target: 'liquidity-ladder' }] }));
  await ask(p, 'Remove the bar chart');
  await settled(p);
  expect(await prompts(p)).toHaveLength(1);
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v2 .*Claude/);
  /* New wording without quotes is Claude's to write, and Jev names the part it found. */
  await script(p, JSON.stringify({ version: 'syntari-ops-1', base: '{{BASE}}', summary: 'New title', operations: [{ op: 'replace', target: 'risk-vs-weight', set: { 'props.title': 'Equities carry the risk' } }] }));
  await ask(p, 'Move the positions table before the customer map');
  await settled(p);
  const sent = await prompts(p);
  expect(sent).toHaveLength(2);
  expect(sent[1]).toContain('Jev found the part this request is about: #holdings');
  expect(errors).toEqual([]);
});
