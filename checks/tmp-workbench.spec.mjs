import { test, expect } from '@playwright/test';

test('tmp component workspace paints the selected Syntari component', async ({ page }) => {
  await page.goto('http://127.0.0.1:4398/tmp/components.html#button');
  await expect(page.locator('[data-docs-title]')).toHaveText('Button');
  const surface = page.locator('[data-component-mount] [data-syntari-component="button"]');
  await expect(surface).toBeVisible();
  await expect(surface.locator('button')).toHaveCount(5);
  await expect(page.locator('[data-preview-status]')).toContainText('Live preview');
});

test('tmp component workspace can switch compact primitives without losing the preview', async ({ page }) => {
  await page.goto('http://127.0.0.1:4398/tmp/components.html#icon-button');
  await expect(page.locator('[data-component-mount] [data-syntari-component="icon-button"]')).toBeVisible();
  await expect(page.locator('[data-component-mount] .icon-button')).toHaveCount(6);

  await page.locator('[data-component-slug="segmented-control"]').click();
  await expect(page.locator('[data-component-mount] [data-syntari-component="segmented-control"]')).toBeVisible();
  await expect(page.locator('[data-preview-status]')).toContainText('Live preview');
});