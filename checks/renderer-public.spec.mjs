import { test, expect } from '@playwright/test';
import { serveRenderer, openRenderer, prompts, screenIR } from './renderer-harness.mjs';

/*
 * The public Renderer offers templates only. It opens on a choice of templates and builds nothing until one is chosen;
 * then Jev builds it in front of the person: parts arrive one by one through the same validated build as Claude's answers,
 * the page says Jev built them, and no model is called.
 */
serveRenderer(test);

const building = p => p.evaluate(() => document.querySelector('[data-stage]')?.hasAttribute('data-busy'));
const painted = p => p.locator('.canvas .ir-node[data-ir-id]').count();
const arriving = p => p.waitForFunction(() => document.querySelector('[data-stage]')?.hasAttribute('data-busy') && document.querySelectorAll('.canvas .ir-node[data-ir-id]').length >= 1, null, { timeout: 15000 });

test('the public page opens on its templates and builds nothing until one is chosen', async ({ page: p }) => {
  const errors = await openRenderer(p, { publicPage: true });
  await expect(p.locator('[data-empty-title]')).toHaveText('Choose a template');
  await expect(p.locator('[data-status-label]')).toHaveText('Choose a template');
  await expect(p.locator('[data-template-grid] .template-card')).toHaveCount(await p.locator('[data-examples] button').count());
  await expect(p.locator('[data-composer]')).toBeHidden();
  await p.waitForTimeout(1500);
  expect(await building(p)).toBe(false);
  expect(await painted(p)).toBe(0);
  expect(await prompts(p)).toEqual([]);
  expect(errors).toEqual([]);
});

test('a chosen template is built part by part, credits Jev, and calls no model', async ({ page: p }) => {
  const errors = await openRenderer(p, { publicPage: true });
  await p.locator('[data-template-grid] [data-template="access"]').click();
  await expect(p.locator('[data-status-label]')).toHaveText(/^Building “Access review”|^Planning|^Adding/);
  /* Some parts are on screen while the build is still running: the person watches it happen. */
  await arriving(p);
  await expect(p.locator('[data-status-detail]')).toHaveText(/template/);
  await expect(p.locator('[data-empty-title]')).not.toHaveText('Claude is thinking');
  await expect(p.locator('[data-status-label]')).toHaveText(/Ready/, { timeout: 20000 });
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v1 .*Example · Access review/);
  expect(await painted(p)).toBeGreaterThan(2);
  await p.locator('[data-tab=activity]').click();
  await expect(p.locator('[data-activity]')).toContainText('Jev builds it, no model call');
  await expect(p.locator('[data-activity]')).toContainText('Jev planned a');
  await expect(p.locator('[data-activity]')).not.toContainText('Claude');
  expect(await prompts(p)).toEqual([]);
  expect(errors).toEqual([]);
});

test('a template chosen again is built again without piling up copies, and its figures come from its data', async ({ page: p }) => {
  const errors = await openRenderer(p, { publicPage: true });
  const choose = async id => { await p.locator('[data-examples-toggle]').click(); await p.locator(`[data-examples] button[data-id="${id}"]`).click(); };
  await choose('wealth');
  await expect(p.locator('[data-status-label]')).toHaveText(/^Building “Portfolio dashboard”|^Planning|^Adding/);
  await arriving(p);
  await expect(p.locator('[data-status-label]')).toHaveText(/Ready/, { timeout: 20000 });
  await expect(p.locator('.canvas [data-ir-id=summary-kpis]')).toContainText('48%');
  await expect(p.locator('.canvas [data-ir-id=allocation]')).toContainText('$1.5M');
  const built = await screenIR(p);
  expect(built.children.map(node => node.id)).toContain('performance');
  await choose('wealth');
  await arriving(p);
  await expect(p.locator('[data-status-label]')).toHaveText(/Ready/, { timeout: 20000 });
  await p.locator('[data-screens-toggle]').click();
  await expect(p.locator('[data-screens] button', { hasText: 'The Ortega portfolio' })).toHaveCount(1);
  expect(await prompts(p)).toEqual([]);
  expect(errors).toEqual([]);
});

test('a template build can be stopped, and the templates come back', async ({ page: p }) => {
  const errors = await openRenderer(p, { publicPage: true });
  await p.locator('[data-template-grid] [data-template="access"]').click();
  await arriving(p);
  /* Stop is the one control the composer shows on this page, and only while a template builds. */
  await expect(p.locator('[data-run]')).toBeVisible();
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
