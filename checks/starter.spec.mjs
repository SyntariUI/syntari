import { test, expect } from '@playwright/test';
import { component, fitsViewport, origin } from './component.mjs';
import { setTheme } from './theme.mjs';

const watchErrors = page => { const errors = []; page.on('pageerror', e => errors.push(e.message)); return errors; };

test('starter controls work on their System routes', async ({ page }) => {
  const errors = watchErrors(page);
  let c = await component(page, 'Searchable select');
  await c.getByRole('combobox').fill('Jamie'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(c.getByRole('combobox')).toHaveValue('Jamie Chen');

  c = await component(page, 'Multiselect');
  await c.getByRole('combobox').fill('Design'); await c.getByRole('option', { name: 'Design', exact: true }).click();
  await expect(c.getByRole('button', { name: 'Remove Design' })).toBeVisible();
  await c.getByRole('button', { name: 'Remove Design' }).click();
  await expect(c.getByRole('button', { name: 'Remove Design' })).toHaveCount(0);

  c = await component(page, 'Number stepper');
  await c.getByRole('button', { name: 'Increase Seats' }).click();
  await expect(c.getByRole('spinbutton')).toHaveValue('4');

  c = await component(page, 'Password field');
  await c.getByLabel('Password', { exact: true }).fill('syntari1234'); await c.getByRole('button', { name: 'Show password' }).click();
  await expect(c.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');

  c = await component(page, 'Date range picker');
  await c.locator('[data-date-range]').click();
  await page.getByRole('button', { name: 'September 5, 2026', exact: true }).click();
  await page.getByRole('button', { name: 'September 12, 2026', exact: true }).click();
  await page.locator('[data-range-apply]').click();
  await expect(page.locator('#starter-dialog')).not.toBeVisible();
  await expect(c.locator('[data-date-range]')).toHaveAttribute('data-end', '2026-09-12');

  c = await component(page, 'Time picker');
  await c.locator('[data-time-picker]').click();
  const hours = page.getByRole('listbox', { name: 'Hours' });
  await expect(hours.getByRole('option', { selected: true })).toHaveText('09');
  await hours.press('ArrowDown');
  await expect(hours.getByRole('option', { selected: true })).toHaveText('10');
  await page.getByRole('button', { name: 'Apply time' }).click();
  await expect(c.locator('[data-time-picker]')).toHaveAttribute('data-time', '10:30');
  await expect(page.locator('#starter-dialog')).not.toBeVisible();

  c = await component(page, 'Data table');
  await c.getByRole('searchbox').fill('Brand'); await expect(c.locator('tbody tr')).toHaveCount(1);
  await c.getByRole('checkbox', { name: 'Select Brand refresh' }).check();
  await expect(c.locator('[data-table-selection]')).toBeVisible();
  await c.getByRole('button', { name: 'Brand refresh Jamie Chen', exact: true }).click();
  await expect(c.locator('.expanded-record')).toBeVisible();
  expect(errors).toEqual([]);
});

test('starter screens save, create, onboard and navigate by command', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${origin}/preview.html?screen=settings`);
  await page.locator('[data-settings-form] input[name=name]').fill('Robin');
  await expect(page.locator('.settings-savebar')).toBeVisible();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.settings-savebar')).not.toBeVisible();

  await page.goto(`${origin}/preview.html?screen=projects`);
  await expect(page.locator('#screens .product-heading')).toContainText('Work in good company');
  await page.locator('#screens [data-create-record]').click();
  await page.locator('#starter-dialog input[name=name]').fill('New test project');
  await page.locator('#starter-dialog input[name=detail]').fill('Test description');
  await page.locator('#starter-dialog [type=submit]').click();
  await expect(page.locator('#starter-dialog')).not.toBeVisible();
  await page.locator('#screens .table-search input').fill('New test');
  await expect(page.locator('#screens .record-name')).toContainText('New test project');

  await page.goto(`${origin}/preview.html?screen=onboarding`);
  await page.locator('[data-auth-form] input[type=email]').fill('robin@example.com');
  await page.locator('[data-auth-form] input[type=password]').fill('syntari1234');
  await page.locator('[data-auth-form] [type=submit]').click();
  await page.locator('[data-onboard-workspace] input[name=workspace]').fill('Test Studio');
  await page.locator('[data-onboard-workspace] [type=submit]').click();
  await page.locator('[data-onboard-purpose] [type=submit]').click();
  await expect(page.locator('.auth-card')).toContainText('Test Studio');

  await page.goto(`${origin}/preview.html?screen=projects`);
  /* The shortcut is listened for once the workspace has initialized, which sets the title: on a slow runner the load event comes first. */
  await expect(page).toHaveTitle('Projects — Syntari workspace');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Search commands' }).fill('Account settings');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-settings-form]')).toBeVisible();

  for (const theme of ['Light theme', 'Dark theme']) {
    await setTheme(page, theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => fitsViewport(page)).toBeTruthy();
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  expect(errors).toEqual([]);
});

test('agent workflows', async ({ page }) => {
  const errors = watchErrors(page);
  let c = await component(page, 'Agent todo list');
  await c.getByRole('button', { name: 'Run plan' }).click();
  await expect(c.locator('[data-todo-count]')).toHaveText('4 of 4 completed', { timeout: 6000 });
  await c.getByRole('button', { name: 'Replay' }).click(); await c.getByRole('button', { name: 'Stop plan' }).click();
  await expect(c.locator('[data-run-status]')).toContainText('stopped');

  c = await component(page, 'Approval card');
  await c.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(c.locator('.agent-decision')).toContainText('Approved');
  await c.getByRole('button', { name: 'Reset preview' }).click(); await c.getByRole('button', { name: 'Decline' }).click();
  await expect(c.locator('.agent-decision')).toContainText('Declined');

  c = await component(page, 'Streaming response');
  await c.getByRole('button', { name: 'Generate response' }).click();
  await expect(c.locator('[data-stream-status]')).toHaveText('Response complete.');
  await c.getByRole('button', { name: 'Regenerate' }).click(); await c.getByRole('button', { name: 'Stop' }).click();
  await expect(c.locator('[data-stream-status]')).toHaveText('Response stopped.');

  c = await component(page, 'Chat workspace');
  await c.getByRole('textbox').fill('<script>local text</script>'); await c.getByRole('button', { name: 'Send message' }).click();
  await expect(c.locator('.user-message')).toHaveText('<script>local text</script>');
  await c.getByRole('button', { name: 'New chat' }).click();
  await expect(c.locator('.user-message')).toHaveCount(0);

  c = await component(page, 'Agent questions');
  await c.getByRole('radio', { name: 'Accessibility', exact: true }).check();
  await c.getByRole('button', { name: 'Review response' }).click();
  await expect(c.getByRole('status')).toContainText('accessibility');
  await c.getByRole('button', { name: 'Confirm response' }).click();
  await expect(c.getByRole('status')).toContainText('saved');

  c = await component(page, 'Prompt input');
  await c.getByLabel('Attach a file').setInputFiles({ name: 'sample.txt', mimeType: 'text/plain', buffer: Buffer.from('local preview') });
  await expect(c.locator('[data-attachment-name]')).toHaveText('sample.txt');

  c = await component(page, 'Streaming response');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => fitsViewport(page)).toBeTruthy();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await c.getByRole('button', { name: 'Generate response' }).click();
  await expect(c.locator('[data-stream-status]')).toHaveText('Response complete.');
  expect(errors).toEqual([]);
});

test('remaining catalog patterns behave on their System routes', async ({ page }) => {
  const errors = watchErrors(page);
  let c = await component(page, 'Data table');
  await c.getByRole('button', { name: 'All statuses', exact: true }).click();
  await c.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(c.locator('tbody tr')).toHaveCount(2);

  const otp = await component(page, 'OTP input');
  const fillOtp = async value => { const digits = otp.locator('.otp-digit'); for (let i = 0; i < value.length; i++) await digits.nth(i).fill(value[i]); };
  await expect(otp.locator('.otp-submit')).toHaveCount(0);
  await fillOtp('111111');
  await expect(otp.getByRole('status')).toContainText('did not match');
  await expect.poll(() => otp.locator('[data-otp-form]').getAttribute('data-otp-state')).toBe('error');
  await expect.poll(() => otp.locator('.otp-digit').evaluateAll(inputs => inputs.every(input => !input.value))).toBe(true);
  await fillOtp('123456');
  await expect.poll(() => otp.locator('[data-otp-form]').getAttribute('data-otp-state')).toBe('success');
  await expect(otp.locator('[data-otp-status]')).toHaveClass(/sr-only/);

  c = await component(page, 'Range slider');
  await c.getByRole('slider', { name: 'Minimum budget' }).fill('900');
  await expect(c.getByRole('slider', { name: 'Maximum budget' })).toHaveValue('900');

  c = await component(page, 'Availability scheduler');
  await c.getByRole('button', { name: 'Tue', exact: true }).click();
  await c.getByRole('button', { name: '14:00' }).click();
  await c.getByRole('button', { name: 'Confirm time' }).click();
  await expect(c.getByRole('status')).toContainText('Tuesday at 14:00');

  c = await component(page, 'Context menu');
  await c.getByRole('button', { name: 'Actions', exact: true }).click();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(c.getByRole('status')).toContainText('Rename');

  c = await component(page, 'Swipeable list');
  await c.getByRole('button', { name: 'Archive', exact: true }).first().click();
  await expect(c.locator('.swipe-item')).toHaveCount(2);
  await c.getByRole('button', { name: 'Undo' }).click();
  await expect(c.locator('.swipe-item')).toHaveCount(3);

  c = await component(page, 'Masonry grid');
  await c.getByRole('button', { name: 'Load more' }).click();
  await expect(c.locator('.masonry-grid>div')).toHaveCount(7);

  c = await component(page, 'Wallet card');
  await c.getByRole('button', { name: 'Hide balance' }).click();
  await expect(c.locator('[data-wallet-balance]')).toHaveText('••••••');
  await c.getByRole('button', { name: 'Show balance' }).click();
  await expect(c.locator('[data-wallet-balance]')).toHaveText('$1,250.00');
  expect(errors).toEqual([]);
});
