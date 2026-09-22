import { test, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:4318';

test('Renderer uses the shared System workspace and renders trusted Syntari UI', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/Jev/`);

  const canvas = page.locator('[data-preview]');
  await canvas.locator('.ir-screen').waitFor({ timeout: 15000 });
  await expect(canvas.locator('[data-ir-component]')).toHaveCount(5, { timeout: 15000 });

  const geometry = await page.evaluate(() => {
    const box = selector => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect ? {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        width: rect.width,
        height: rect.height
      } : null;
    };
    return {
      viewport: innerWidth,
      rail: box('.renderer-rail'),
      workspace: box('.renderer-workspace'),
      stage: box('.renderer-stage'),
      toolbar: box('.renderer-toolbar'),
      composer: box('.renderer-composer'),
      inspectorHidden: document.querySelector('[data-renderer-inspector]')?.getAttribute('aria-hidden')
    };
  });

  expect(geometry.rail?.width || 0).toBeGreaterThan(200);
  expect((geometry.workspace?.width || 0) / geometry.viewport).toBeGreaterThan(0.75);
  expect((geometry.workspace?.width || 0) / geometry.viewport).toBeLessThan(0.88);
  expect(geometry.stage?.width || 0).toBeGreaterThan(1000);
  expect(geometry.toolbar?.top || 999).toBeLessThan(40);
  expect((geometry.toolbar?.right || 0)).toBeGreaterThan((geometry.stage?.right || 0) - 210);
  expect(geometry.composer?.width || 0).toBeGreaterThan(600);
  expect(geometry.inspectorHidden).toBe('true');

  await expect(canvas.locator('.ir-screen-title')).toHaveText('Q2 performance');
  await expect(canvas.locator('[data-ir-component="stat-row"]')).toHaveCount(1);
  await expect(canvas.locator('[data-ir-component="streaming-response"]')).toHaveCount(1);
  await expect(canvas.locator('[data-ir-component="area-chart"]')).toHaveCount(1);
  await expect(canvas.locator('[data-ir-component="comparison-table"]')).toHaveCount(1);
  await expect(canvas.locator('[data-ir-component="source-list"]')).toHaveCount(1);
  await expect(canvas.locator('.ir-fallback')).toHaveCount(0);
  await expect(page.locator('[data-result-status]')).toContainText('real Syntari components');

  const registered = await page.evaluate(async () => {
    const registry = await window.SyntariIR.registry();
    const ids = [...document.querySelectorAll('[data-preview] [data-ir-component]')]
      .map(node => node.dataset.irComponent);
    return ids.length > 0 && ids.every(id => registry.entries.has(id));
  });
  expect(registered).toBe(true);

  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain('Jev');

  await page.locator('[data-open-logic]').click();
  await expect(page.locator('[data-workspace]')).toHaveAttribute('data-panel', 'logic');
  await expect(page.locator('[data-renderer-inspector]')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('[data-route-title]')).toContainText(/Reasoning|required|Synthesis|LLM/i);

  await page.locator('[data-open-ir]').click();
  await expect(page.locator('[data-workspace]')).toHaveAttribute('data-panel', 'ir');
  await expect(page.locator('[data-ir-code]')).toContainText('syntari.stat-row');

  await page.locator('[data-close-inspector]').click();
  await expect(page.locator('[data-workspace]')).toHaveAttribute('data-panel', 'none');

  await page.locator('[data-replay]').click();
  await canvas.locator('.ir-screen [data-ir-component]').first().waitFor({ timeout: 15000 });
  const capturedRoot = await page.evaluate(() => {
    window.__rendererProgressiveRoot = document.querySelector('[data-preview] .ir-screen');
    return Boolean(window.__rendererProgressiveRoot);
  });
  expect(capturedRoot).toBe(true);
  await expect(canvas.locator('[data-ir-component]')).toHaveCount(5, { timeout: 15000 });
  const rootStayedMounted = await page.evaluate(
    () => window.__rendererProgressiveRoot === document.querySelector('[data-preview] .ir-screen')
  );
  expect(rootStayedMounted).toBe(true);

  const followedScroll = await page.evaluate(() => {
    const canvas = document.querySelector('[data-preview]');
    return canvas.scrollHeight <= canvas.clientHeight + 2 ||
      canvas.scrollTop + canvas.clientHeight >= canvas.scrollHeight - 30;
  });
  expect(followedScroll).toBe(true);

  await page.locator('[data-scenario="delete"]').click();
  await expect(canvas.locator('.ir-screen-title')).toHaveText('Workspace action', { timeout: 15000 });
  await expect(canvas.locator('[data-ir-component="tool-approval"]')).toHaveCount(1);
  await expect(canvas.locator('.ir-fallback')).toHaveCount(0);
  await page.locator('[data-open-logic]').click();
  await expect(page.locator('[data-route-title]')).toHaveText('LLM skipped');

  expect(errors).toEqual([]);
});
