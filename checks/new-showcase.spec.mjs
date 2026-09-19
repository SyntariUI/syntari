import {test,expect} from '@playwright/test';

test('new compositions are interactive and responsive',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));

  await page.goto('http://127.0.0.1:4318/new/command-palette/');
  const search=page.getByRole('searchbox',{name:'Search commands'});
  await search.fill('settings');
  await expect(page.getByRole('option',{name:/Open settings/})).toBeVisible();
  await expect(page.locator('.command-item:not([hidden])')).toHaveCount(1);
  await search.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Open settings selected.');

  await page.goto('http://127.0.0.1:4318/new/revenue-card/');
  const line=page.locator('[data-revenue-line]');
  const before=await line.getAttribute('d');
  await page.getByLabel('Revenue period').selectOption('90d');
  await expect(page.locator('[data-revenue-value]')).toHaveText('€68,920');
  await expect.poll(async()=>await line.getAttribute('d')).not.toBe(before);

  await page.goto('http://127.0.0.1:4318/new/team-projects-report/');
  await page.getByLabel('Report period').selectOption('month');
  await expect(page.locator('[data-efficiency]')).toHaveText('81%');
  await expect(page.locator('[data-report-rows] tr')).toHaveCount(4);

  for(const width of [390,1440]){
    await page.setViewportSize({width,height:900});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  }
  expect(errors).toEqual([]);
});
