import {test,expect} from '@playwright/test';

test('homepage shows the live collection and links into System',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4398/');
  await expect(page.getByRole('heading',{name:/Made to feel alive/})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Made to be explored.'})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('link')).toHaveText(['Components','Renderer']);
  await expect(page.getByRole('link',{name:'Renderer',exact:true})).toHaveAttribute('href','/renderer/');
  await expect(page.getByRole('link',{name:'Syntari on GitHub'})).toHaveAttribute('href','https://github.com/SyntariUI/syntari');
  await expect(page.locator('[data-agent-command]')).toHaveText('npm install syntari-ui');
  await expect(page.getByRole('link',{name:'Quick start',exact:true})).toHaveAttribute('href','/system/?guide=getting-started#button');
  await expect(page.locator('.home-card')).toHaveCount(9);
  await expect(page.locator('.home-demo')).toHaveCount(0);
  await expect(page.locator('[data-home-intent-form]')).toHaveCount(0);
  await expect(page.locator('[data-home-gallery]')).toHaveAttribute('aria-busy','false');
  await page.locator('[data-home-gallery]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-home-preview="simple-data-table"] [data-syntari-component]')).toBeVisible();
  const approval=page.locator('[data-home-preview="tool-approval"]');
  await expect(approval).not.toContainText('Local demonstration');
  await approval.getByRole('button',{name:'Approve',exact:true}).click();
  await expect(approval.locator('.agent-footer')).toBeHidden();
  await expect(page.locator('[data-home-preview="session-card"] [data-syntari-component]')).toBeVisible();
  await expect(page.locator('[data-home-preview="expandable-dock"] [data-syntari-component]')).toBeVisible();
  await expect(page.locator('[data-home-preview="command-palette"] [data-syntari-component]')).toBeVisible();
  await expect(page.locator('[data-home-preview="otp-input"] [data-syntari-component]')).toBeVisible();
  await page.locator('.home-collection').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-component-count]')).toHaveText(/^[1-9]\d*$/);
  await expect(page.locator('.home-collection-actions').getByRole('link',{name:'Read the docs'})).toHaveAttribute('href','/system/?guide=getting-started#button');
  await page.locator('.home-collection-actions').getByRole('link',{name:'Explore all components'}).click();
  await expect(page).toHaveURL('http://127.0.0.1:4398/system/');
  expect(errors).toEqual([]);
});

test('homepage is responsive and shares the theme with System',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:4398/');
  await expect(page.locator('.home-card')).toHaveCount(9);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Switch to light theme'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.locator('.home-section-head').getByRole('link',{name:/Explore all components/}).click();
  await expect(page).toHaveURL(/\/system\//);
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});
