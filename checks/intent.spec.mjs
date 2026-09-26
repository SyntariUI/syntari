import { test, expect } from '@playwright/test';

test('homepage renders a bounded screen and exposes its decisions', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4398/');
  await expect(page.getByRole('heading', { name: 'From intent to interface.' })).toBeVisible();
  await expect(page.locator('[data-intent-output] .ir-screen')).toBeVisible();
  await expect(page.locator('[data-intent-trace]')).toContainText('Release review');
  await expect(page.locator('[data-intent-trace]')).toContainText('Validation');
  await expect(page.locator('[data-intent-output] .ir-fallback')).toHaveCount(0);
  await expect(page.locator('[data-intent-spec]')).toContainText('syntari-ir-1');
  expect(errors).toEqual([]);
});

test('intent examples select different registry compositions', async ({ page }) => {
  await page.goto('http://127.0.0.1:4398/');
  await page.locator('[data-intent-output] .ir-screen').waitFor();
  await page.getByRole('button', { name: 'Analytics dashboard' }).click();
  await expect(page.locator('[data-intent-trace]')).toContainText('Analytics overview');
  await expect(page.locator('[data-intent-output] .ir-screen-title')).toContainText('analytics dashboard');
  await expect(page.locator('[data-intent-output] .ir-fallback')).toHaveCount(0);
  await page.getByRole('button', { name: 'Approval review' }).click();
  await expect(page.locator('[data-intent-trace]')).toContainText('Approval review');
  await expect(page.locator('[data-intent-output] [data-ir-component="tool-approval"]')).toHaveCount(1);
  await expect(page.locator('[data-intent-diagnostics]')).toContainText('No diagnostics');
});
