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
  expect(await page.locator('.column-fill').first().evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test('intent examples select different registry compositions', async ({ page }) => {
  await page.goto('http://127.0.0.1:4398/');
  await page.locator('[data-intent-output] .ir-screen').waitFor();
  await page.getByRole('button', { name: 'Analytics overview' }).click();
  await expect(page.locator('[data-intent-trace]')).toContainText('Analytics overview');
  await expect(page.locator('[data-intent-output] .ir-screen-title')).toContainText('analytics dashboard');
  await expect(page.locator('[data-intent-output] .ir-fallback')).toHaveCount(0);
  await page.getByRole('button', { name: 'Approval review' }).click();
  await expect(page.locator('[data-intent-trace]')).toContainText('Approval review');
  await expect(page.locator('[data-intent-output] [data-ir-component="tool-approval"]')).toHaveCount(1);
  await expect(page.locator('[data-intent-diagnostics]')).toContainText('No diagnostics');
});


test('workspace navigation and inspectors remain reachable on mobile', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:4398/');
  await expect(page.locator('[data-intent-output] .ir-screen')).toBeVisible();
  await expect(page.locator('[data-rail]')).toHaveAttribute('inert','');
  await page.getByRole('button',{name:'Open Renderer navigation'}).click();
  await page.getByRole('button',{name:'Approval review',exact:true}).click();
  await expect(page.locator('[data-intent-output] [data-ir-component="tool-approval"]')).toHaveCount(1);
  await page.getByRole('button',{name:'Logic',exact:true}).click();
  await expect(page.locator('[data-intent-trace]')).toBeVisible();
  await expect(page.locator('[data-workspace-stage]')).toHaveAttribute('inert','');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Logic',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'IR',exact:true}).click();
  await expect(page.locator('[data-intent-spec]')).toBeVisible();
  await page.getByRole('button',{name:'Close inspector'}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('unmatched requests explain the fallback and rapidly selected patterns settle correctly', async ({ page }) => {
  await page.goto('http://127.0.0.1:4398/');
  await page.locator('[data-intent-output] .ir-screen').waitFor();
  await page.getByLabel('Describe what you want to build').fill('A virtual aquarium of glowing jellyfish');
  await page.getByRole('button',{name:'Render interface',exact:true}).click();
  await expect(page.locator('[data-intent-status]')).toContainText('No matching pattern');
  await expect(page.locator('[data-intent-trace]')).toContainText('No supported keyword');
  await page.getByRole('button',{name:'Analytics overview',exact:true}).click();
  await page.getByRole('button',{name:'Approval review',exact:true}).click();
  await expect(page.locator('[data-intent-pattern]')).toHaveText('Approval review');
  await expect(page.locator('[data-intent-output] .ir-screen')).toHaveCount(1);
  await expect(page.locator('[data-intent-output] [data-ir-component="tool-approval"]')).toHaveCount(1);
});
