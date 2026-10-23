import {test,expect} from '@playwright/test';

test('homepage showcases five live components without embedding the Renderer',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4398/');
  await expect(page.getByRole('heading',{name:'Made to feel alive.'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Made to be explored.'})).toBeVisible();
  await expect(page.locator('.home-card')).toHaveCount(5);
  await expect(page.locator('.home-demo')).toHaveCount(0);
  await expect(page.locator('[data-home-intent-form]')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Renderer',exact:true})).toHaveCount(0);
  await expect(page.locator('[data-home-gallery]')).toHaveAttribute('aria-busy','false');
  await page.locator('[data-home-gallery]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-home-preview="chart-bars"] [data-syntari-component]')).toBeVisible();
  const approval=page.locator('[data-home-preview="tool-approval"]');
  await expect(approval).not.toContainText('Local demonstration');
  await approval.getByRole('button',{name:'Approve',exact:true}).click();
  await expect(approval.locator('.agent-footer')).toBeHidden();
  await expect(page.locator('[data-home-preview="session-card"] [data-syntari-component]')).toBeVisible();
  await expect(page.locator('[data-home-preview="expandable-dock"] [data-syntari-component]')).toBeVisible();
  await expect(page.locator('[data-home-preview="command-palette"] [data-syntari-component]')).toBeVisible();
  await expect(page.locator('.home-card').first()).toHaveCSS('box-shadow','none');
  await expect(page.locator('.home-card').first()).toHaveCSS('border-top-width','0px');
  await expect(page.locator('[data-home-command]')).toContainText('npx syntari-ui add app-shell');
  await page.getByRole('link',{name:'Explore all components'}).click();
  await expect(page).toHaveURL('http://127.0.0.1:4398/system/');
  expect(errors).toEqual([]);
});

test('homepage is responsive and shares the theme with System',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:4398/');
  await expect(page.locator('.home-card')).toHaveCount(5);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Switch to light theme'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.getByRole('link',{name:'Explore all components'}).click();
  await expect(page).toHaveURL(/\/system\//);
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});
