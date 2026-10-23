import { test, expect } from '@playwright/test';
import { serveRenderer, openRenderer, prompts, screenIR } from './renderer-harness.mjs';

/*
 * The public Renderer offers templates only, in the System shell: the rail lists the templates, the stage builds the one
 * chosen, and the inspector opens as System's drawer. It opens on a choice of templates and builds nothing until one is
 * chosen; then Jev builds it in front of the person: parts arrive one by one through the same validated build as Claude's
 * answers, the page says Jev built them, and no model is called.
 */
serveRenderer(test);

const building = p => p.evaluate(() => document.querySelector('[data-stage]')?.hasAttribute('data-busy'));
const painted = p => p.locator('.canvas .ir-node[data-ir-id]').count();
const choose = (p, id) => p.locator(`[data-template-nav] [data-template-id="${id}"]`).click();
const inspect = async (p, tab) => { await p.locator('.sys-toolbar [data-shell-tab="ir"]').click(); await p.locator(`[data-tab=${tab}]`).click(); };
const arriving = p => p.waitForFunction(() => document.querySelector('[data-stage]')?.hasAttribute('data-busy') && document.querySelectorAll('.canvas .ir-node[data-ir-id]').length >= 1, null, { timeout: 15000 });

test('the public page opens on its templates and builds nothing until one is chosen', async ({ page: p }) => {
  const errors = await openRenderer(p, { publicPage: true });
  await expect(p.locator('[data-empty-title]')).toHaveText('Choose a template');
  await expect(p.locator('[data-status-label]')).toHaveText('Choose a template');
  await expect(p.locator('[data-template-grid] .template-card')).toHaveCount(await p.locator('[data-examples] button').count());
  await expect(p.locator('[data-composer]')).toBeHidden();
  /* The System shell: the same rail, toolbar, and preview controls as /system. */
  await expect(p.locator('.sys-shell .sys-rail .sys-section-title')).toHaveText(/^Renderer\s*10$/);
  await expect(p.locator('[data-template-nav] .sys-nav-label')).toHaveText(['Review', 'Decide', 'Edge cases']);
  await expect(p.locator('[data-template-nav] [data-template-id]')).toHaveCount(10);
  /* The toolbar keeps one button, the code: it opens the inspector on Screen IR, and its tabs lead to the rest. */
  await expect(p.locator('.sys-toolbar button')).toHaveCount(1);
  await expect(p.locator('.sys-toolbar button')).toHaveAttribute('aria-label', 'View Screen IR');
  await expect(p.locator('.sys-preview-controls [data-viewport]')).toHaveCount(4);
  await expect(p.locator('.sys-preview-controls [data-run]')).toBeHidden();
  await expect(p.locator('.sys-inspector')).toHaveAttribute('aria-hidden', 'true');
  await p.locator('[data-template-search]').fill('renewal');
  await expect(p.locator('[data-template-nav] [data-template-id]')).toHaveText(['Renewal at risk']);
  await p.locator('[data-template-search]').fill('');
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
  await expect(p.locator('[data-template-nav] [aria-current=true]')).toHaveText('Access review');
  await inspect(p, 'activity');
  await expect(p.locator('.sys-workspace')).toHaveAttribute('data-panel', 'inspect');
  await expect(p.locator('[data-activity]')).toContainText('Jev builds it, no model call');
  await expect(p.locator('[data-activity]')).toContainText('Jev planned a');
  await expect(p.locator('[data-activity]')).not.toContainText('Claude');
  expect(await prompts(p)).toEqual([]);
  expect(errors).toEqual([]);
});

test('a template chosen again is built again without piling up copies, and its figures come from its data', async ({ page: p }) => {
  const errors = await openRenderer(p, { publicPage: true });
  await choose(p, 'wealth');
  await expect(p.locator('[data-status-label]')).toHaveText(/^Building “Portfolio dashboard”|^Planning|^Adding/);
  await arriving(p);
  await expect(p.locator('[data-status-label]')).toHaveText(/Ready/, { timeout: 20000 });
  await expect(p.locator('.canvas [data-ir-id=summary-kpis]')).toContainText('48%');
  await expect(p.locator('.canvas [data-ir-id=allocation]')).toContainText('$1.5M');
  const built = await screenIR(p);
  expect(built.children.map(node => node.id)).toContain('performance');
  /* Choosing the same template again builds it again, in place: no second copy in the session. */
  await choose(p, 'wealth');
  await arriving(p);
  await expect(p.locator('[data-status-label]')).toHaveText(/Ready/, { timeout: 20000 });
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v1 /);
  await expect(p.locator('[data-context-sub]')).not.toHaveText(/other screen/);
  expect(await prompts(p)).toEqual([]);
  expect(errors).toEqual([]);
});

test('a template build can be stopped, and the templates come back', async ({ page: p }) => {
  const errors = await openRenderer(p, { publicPage: true });
  await p.locator('[data-template-grid] [data-template="access"]').click();
  await arriving(p);
  /* Stop sits with the preview controls, and only while a template builds. */
  await expect(p.locator('.sys-preview-controls [data-run]')).toBeVisible();
  await p.locator('[data-run]').click();
  await expect(p.locator('[data-status-label]')).toHaveText(/Stopped/);
  expect(await building(p)).toBe(false);
  await expect(p.locator('.sys-preview-controls [data-run]')).toBeHidden();
  await choose(p, 'access');
  await expect(p.locator('[data-status-label]')).toHaveText(/Ready/, { timeout: 20000 });
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v1 /);
  expect(await prompts(p)).toEqual([]);
  expect(errors).toEqual([]);
});

test('a screen sits on the panel while it builds: no block of its own in Fit, and a device width is a card with no border', async ({ page: p }) => {
  const errors = await openRenderer(p, { publicPage: true });
  await p.locator('[data-template-grid] [data-template="renewal"]').click();
  await arriving(p);
  const surface = () => p.evaluate(() => ({ screen: getComputedStyle(document.querySelector('.canvas>.ir-screen')).backgroundColor, frame: getComputedStyle(document.querySelector('.frame')).backgroundColor, border: getComputedStyle(document.querySelector('.frame')).borderTopWidth }));
  /* The screen is a Syntari root, which paints its own page colour elsewhere; on the canvas it takes the panel's. */
  expect(await surface(p)).toEqual({ screen: 'rgba(0, 0, 0, 0)', frame: 'rgba(0, 0, 0, 0)', border: '0px' });
  await expect(p.locator('[data-status-label]')).toHaveText(/Ready/, { timeout: 20000 });
  await p.locator('.sys-preview-controls [data-viewport="834"]').click();
  const device = await surface(p);
  expect(device.screen).toBe('rgba(0, 0, 0, 0)');
  expect(device.frame).not.toBe('rgba(0, 0, 0, 0)');
  expect(device.border).toBe('0px');
  expect(errors).toEqual([]);
});

test('with the inspector open, the screen fits the stage that is left, with padding, and every inspector view stays reachable', async ({ page: p }) => {
  await p.setViewportSize({ width: 1100, height: 900 });
  const errors = await openRenderer(p, { publicPage: true });
  await p.locator('[data-template-grid] [data-template="renewal"]').click();
  await expect(p.locator('[data-status-label]')).toHaveText(/Ready/, { timeout: 20000 });
  await p.locator('.sys-toolbar [data-shell-tab="ir"]').click();
  await expect(p.locator('[data-tab=ir]')).toHaveAttribute('aria-selected', 'true');
  await p.waitForTimeout(600);
  const layout = await p.evaluate(() => {
    const box = selector => document.querySelector(selector).getBoundingClientRect();
    const stage = box('.sys-stage'), screen = box('.canvas>.ir-screen'), drawer = box('.sys-inspector'), status = box('[data-status]'), tool = box('.sys-toolbar');
    const tabs = [...document.querySelectorAll('.sys-inspector [data-tab]')].map(tab => tab.getBoundingClientRect());
    const editor = document.querySelector('.sys-inspector textarea.ir-edit');
    return {
      stage: Math.round(stage.width), left: Math.round(screen.left - stage.left), right: Math.round(stage.right - screen.right),
      statusClear: status.right <= tool.left, statusWidth: Math.round(status.width),
      tabsInside: tabs.every(tab => tab.left >= drawer.left && tab.right <= drawer.right + 1),
      sideways: document.querySelector('[data-stage]').scrollWidth > document.querySelector('[data-stage]').clientWidth,
      editorSideways: editor.scrollWidth > editor.clientWidth + 1
    };
  });
  /* The drawer takes a share of the workspace, not of the window, so a 1100 px window leaves the screen most of the room. */
  expect(layout.stage).toBeGreaterThan(480);
  expect(layout.left).toBeGreaterThanOrEqual(16);
  expect(layout.right).toBeGreaterThanOrEqual(16);
  expect(layout.sideways).toBe(false);
  expect(layout.statusClear).toBe(true);
  expect(layout.statusWidth).toBeGreaterThan(200);
  expect(layout.tabsInside, 'every tab is in view, including Screen IR').toBe(true);
  expect(layout.editorSideways, 'Screen IR wraps instead of running off the drawer').toBe(false);
  expect(errors).toEqual([]);
});
