import { test, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:4318';

test('tmp System is a persistent component workspace', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/tmp/system/`);

  const workspace = page.locator('[data-workspace]');
  const preview = page.locator('[data-component-mount] > [data-syntari-component]');
  await preview.waitFor({ timeout: 15000 });

  await expect(page.locator('.sys-rail')).toBeVisible();
  await expect(workspace).toBeVisible();
  await expect(page.locator('.sys-toolbar')).toBeVisible();
  await expect(preview).toHaveCount(1);

  const geometry = await page.evaluate(() => {
    const box = selector => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.right } : null;
    };
    return {
      viewport: innerWidth,
      workspace: box('.sys-workspace'),
      stage: box('.sys-stage'),
      host: box('.sys-preview-host'),
      toolbar: box('.sys-toolbar')
    };
  });

  const ratio = (geometry.workspace?.width || 0) / geometry.viewport;
  expect(ratio).toBeGreaterThan(0.75);
  expect(ratio).toBeLessThan(0.86);

  const stageCenter = (geometry.stage?.left || 0) + (geometry.stage?.width || 0) / 2;
  const hostCenter = (geometry.host?.left || 0) + (geometry.host?.width || 0) / 2;
  expect(Math.abs(stageCenter - hostCenter)).toBeLessThan(70);

  expect((geometry.toolbar?.right || 0)).toBeGreaterThan((geometry.stage?.right || 0) - 180);
  expect((geometry.toolbar?.top || 999)).toBeLessThan(40);

  const workspaceHandle = await workspace.elementHandle();
  const navItems = page.locator('[data-slug]');
  expect(await navItems.count()).toBeGreaterThan(10);

  const currentSlug = await preview.getAttribute('data-syntari-component');
  const alternate = navItems.filter({ hasNotText: currentSlug || '' }).nth(1);
  await alternate.click();
  await expect(page.locator('[data-status]')).toContainText('real Syntari component');

  const workspaceStayed = await page.evaluate(node => node === document.querySelector('[data-workspace]'), workspaceHandle);
  expect(workspaceStayed).toBe(true);

  await page.locator('[data-inspect]').click();
  await expect(workspace).toHaveAttribute('data-panel', 'info');
  await expect(page.locator('[data-description]')).not.toBeEmpty();

  await page.locator('[data-code]').click();
  await expect(workspace).toHaveAttribute('data-panel', 'code');
  await expect(page.locator('[data-source]')).not.toBeEmpty();

  expect(errors).toEqual([]);
});
