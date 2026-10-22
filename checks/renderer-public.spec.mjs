import { test, expect } from '@playwright/test';
import { serveRenderer, openRenderer, prompts, screenIR } from './renderer-harness.mjs';

/*
 * The public Renderer: its examples are templates that Jev builds in front of the person. Parts arrive one by one through
 * the same validated build as Claude's answers, the page says Jev built them, and no model is called.
 */
serveRenderer(test);

const building = p => p.evaluate(() => document.querySelector('[data-stage]')?.hasAttribute('data-busy'));
const painted = p => p.locator('.canvas .ir-node[data-ir-id]').count();

test('the public page builds its first template part by part, credits Jev, and calls no model', async ({ page: p }) => {
  const errors = await openRenderer(p, { publicPage: true });
  await expect(p.locator('[data-status-label]')).toHaveText(/^Building “Access review”/);
  /* Some parts are on screen while the build is still running: the person watches it happen. */
  await p.waitForFunction(() => document.querySelector('[data-stage]')?.hasAttribute('data-busy') && document.querySelectorAll('.canvas .ir-node[data-ir-id]').length >= 1, null, { timeout: 15000 });
  expect(await building(p)).toBe(true);
  await expect(p.locator('[data-status-detail]')).toHaveText(/template/);
  await expect(p.locator('[data-status-label]')).toHaveText(/Ready/, { timeout: 20000 });
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v1 .*Example · Access review/);
  expect(await painted(p)).toBeGreaterThan(2);
  await p.locator('[data-tab=activity]').click();
  await expect(p.locator('[data-activity]')).toContainText('Jev builds it, no model call');
  await expect(p.locator('[data-activity]')).toContainText('Jev planned a');
  await expect(p.locator('[data-activity]')).not.toContainText('Claude started writing');
  expect(await prompts(p)).toEqual([]);
  expect(errors).toEqual([]);
});

test('choosing a template builds it again in front of the person, without piling up copies', async ({ page: p }) => {
  const errors = await openRenderer(p, { publicPage: true });
  await expect(p.locator('[data-status-label]')).toHaveText(/Ready/, { timeout: 20000 });
  const choose = async id => { await p.locator('[data-examples-toggle]').click(); await p.locator(`[data-examples] button[data-id="${id}"]`).click(); };
  await choose('wealth');
  await expect(p.locator('[data-status-label]')).toHaveText(/^Building “Portfolio dashboard”/);
  await p.waitForFunction(() => document.querySelector('[data-stage]')?.hasAttribute('data-busy') && document.querySelectorAll('.canvas .ir-node[data-ir-id]').length >= 1, null, { timeout: 15000 });
  await expect(p.locator('[data-status-label]')).toHaveText(/Ready/, { timeout: 20000 });
  /* Bound figures come from the template's data, as when it opens at once. */
  await expect(p.locator('.canvas [data-ir-id=summary-kpis]')).toContainText('48 %');
  const built = await screenIR(p);
  expect(built.children.map(node => node.id)).toContain('performance');
  await choose('wealth');
  await expect(p.locator('[data-status-label]')).toHaveText(/^Building “Portfolio dashboard”/);
  await expect(p.locator('[data-status-label]')).toHaveText(/Ready/, { timeout: 20000 });
  await p.locator('[data-screens-toggle]').click();
  await expect(p.locator('[data-screens] button', { hasText: 'La cartera Ortega' })).toHaveCount(1);
  expect(await prompts(p)).toEqual([]);
  expect(errors).toEqual([]);
});

test('a template build can be stopped, and choosing it again builds it whole', async ({ page: p }) => {
  const errors = await openRenderer(p, { publicPage: true });
  await p.waitForFunction(() => document.querySelectorAll('.canvas .ir-node[data-ir-id]').length >= 1, null, { timeout: 15000 });
  await p.locator('[data-run]').click();
  await expect(p.locator('[data-status-label]')).toHaveText(/Stopped/);
  expect(await building(p)).toBe(false);
  await p.locator('[data-examples-toggle]').click();
  await p.locator('[data-examples] button[data-id="access"]').click();
  await expect(p.locator('[data-status-label]')).toHaveText(/Ready/, { timeout: 20000 });
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v1 /);
  expect(await prompts(p)).toEqual([]);
  expect(errors).toEqual([]);
});
