import {test,expect} from '@playwright/test';

test('homepage leads with live bento previews, then an inspectable renderer',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4398/');
  await expect(page.getByRole('heading',{name:'Made to feel alive.'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Made to be explored.'})).toBeVisible();
  await expect(page.locator('.home-card')).toHaveCount(9);
  expect(await page.evaluate(()=>Boolean(document.querySelector('#components').compareDocumentPosition(document.querySelector('.home-demo')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await expect(page.getByRole('link',{name:'Open full Renderer'})).toHaveAttribute('href','/renderer/');
  await expect(page.locator('[data-home-intent-form]')).toBeVisible();
  await expect(page.locator('[data-home-examples] button')).toHaveCount(4);
  await expect(page.locator('[data-home-validation]')).toHaveText('Validated');
  await expect(page.locator('[data-home-output] .ir-screen')).toBeVisible();
  await expect(page.locator('[data-home-trace]')).toContainText('Pattern selected');
  await expect(page.locator('[data-home-trace]')).toContainText('Validation');
  await expect(page.locator('[data-home-trace]')).toContainText('Passed');
  await page.locator('[data-home-intent]').fill('Show a release report with comparisons and evidence.');
  await page.getByRole('button',{name:'Render interface'}).click();
  await expect(page.locator('[data-home-validation]')).toHaveText('Validated');
  await expect(page.locator('[data-home-trace]')).toContainText('Show a release report with comparisons and evidence.');
  await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('syntari-intent'))).toBe('Show a release report with comparisons and evidence.');

  await page.locator('[data-home-gallery]').scrollIntoViewIfNeeded();
  await expect(page.locator('.home-card')).toHaveCount(9);
  await expect(page.locator('[data-home-preview="chart-bars"] [data-syntari-component]')).toBeVisible();
  await expect(page.locator('[data-home-preview="otp-input"] .home-otp-note')).toHaveText('Use 123456');
  await expect(page.locator('[data-home-preview="otp-input"] .otp-group')).toBeVisible();
  const approval=page.locator('[data-home-preview="tool-approval"]');
  await expect(approval).not.toContainText('Local demonstration');
  await approval.getByRole('button',{name:'Approve',exact:true}).click();
  await expect(approval.locator('.agent-footer')).toBeHidden();
  await expect(page.locator('[data-home-preview="selectable-cards"] [data-syntari-component]')).toBeVisible();
  await expect(page.locator('[data-home-command]')).toContainText('npx syntari-ui add app-shell');
  await page.getByRole('link',{name:'Explore all components'}).click();
  await expect(page).toHaveURL('http://127.0.0.1:4398/system/');
  expect(errors).toEqual([]);
});

test('homepage is responsive and shares the theme with System',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:4398/');
  await expect(page.locator('[data-home-validation]')).toHaveText('Validated');
  await expect(page.locator('.home-card')).toHaveCount(9);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Switch to light theme'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.getByRole('link',{name:'Explore all components'}).click();
  await expect(page).toHaveURL(/\/system\//);
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});
