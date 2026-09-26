import {test,expect} from '@playwright/test';
test('earlier workspace previews lead to the canonical product routes',async({page})=>{
 await page.goto('http://127.0.0.1:4398/Jev/');
 await expect(page).toHaveURL('http://127.0.0.1:4398/');
 await expect(page.locator('[data-intent-output] .ir-screen')).toBeVisible();
 await page.goto('http://127.0.0.1:4398/tmp/system/#tool-approval');
 await expect(page).toHaveURL('http://127.0.0.1:4398/system/#tool-approval');
 await expect(page.locator('[data-syntari-component="tool-approval"]')).toBeVisible();
});
