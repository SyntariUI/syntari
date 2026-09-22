import { test, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:4318';

test('Jev demo visibly generates a real Syntari interface', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(`${origin}/Jev/`);

  const canvas = page.locator('[data-preview]');
  await canvas.locator('.ir-screen').waitFor();

  const geometry = await page.evaluate(() => {
    const box = selector => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect ? { width: rect.width, height: rect.height, top: rect.top, left: rect.left } : null;
    };
    const scenario = document.querySelector('.scenario-list');
    return {
      intent: box('.intent-form'),
      scenario: box('.scenario-list'),
      workbench: box('.renderer-workbench'),
      irPane: box('.ir-pane'),
      renderPane: box('.render-pane'),
      scenarioDisplay: scenario ? getComputedStyle(scenario).display : null,
      scenarioWrap: scenario ? getComputedStyle(scenario).flexWrap : null
    };
  });

  expect(geometry.intent?.width || 0).toBeGreaterThan(900);
  expect(geometry.intent?.height || 0).toBeGreaterThan(45);
  expect(geometry.scenarioDisplay).toBe('flex');
  expect(geometry.scenarioWrap).toBe('nowrap');
  expect(geometry.workbench?.width || 0).toBeGreaterThan(900);
  expect(geometry.irPane?.width || 0).toBeGreaterThan(320);
  expect(geometry.renderPane?.width || 0).toBeGreaterThan(420);

  await expect(canvas.locator('.ir-screen-title')).toHaveText('Q2 performance');
  await expect(canvas.locator('[data-ir-component]')).toHaveCount(5);
  await expect(canvas.locator('[data-ir-component="stat-row"]')).toHaveCount(1);
  await expect(canvas.locator('[data-ir-component="streaming-response"]')).toHaveCount(1);
  await expect(canvas.locator('[data-ir-component="area-chart"]')).toHaveCount(1);
  await expect(canvas.locator('[data-ir-component="comparison-table"]')).toHaveCount(1);
  await expect(canvas.locator('[data-ir-component="source-list"]')).toHaveCount(1);
  await expect(canvas.locator('.ir-fallback')).toHaveCount(0);
  await expect(page.locator('[data-result-status]')).toContainText('real Syntari components');

  const evidence = canvas.locator('.ir-region');
  await expect(evidence).toHaveAttribute('open', '');

  await page.locator('[data-scenario="delete"]').click();
  await expect(canvas.locator('.ir-screen-title')).toHaveText('Workspace action', { timeout: 15000 });
  await expect(canvas.locator('[data-ir-component]')).toHaveCount(1);
  await expect(canvas.locator('[data-ir-component="tool-approval"]')).toHaveCount(1);
  await expect(canvas.locator('[data-ir-component="streaming-response"]')).toHaveCount(0);
  await expect(canvas.locator('.ir-fallback')).toHaveCount(0);
  await expect(page.locator('[data-route-title]')).toHaveText('LLM skipped');

  expect(errors).toEqual([]);
});
