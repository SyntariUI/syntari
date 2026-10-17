import { test, expect } from '@playwright/test';
import { component, fitsViewport } from './component.mjs';
import { setTheme } from './theme.mjs';

/* Component behaviour that the retired gallery checks used to cover, now exercised on each System route. */
const watchErrors = page => { const errors = []; page.on('pageerror', e => errors.push(e.message)); return errors; };
const settled = page => page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity));

test('select, calendar and slider keep their keyboard contracts', async ({ page }) => {
  const errors = watchErrors(page);
  const select = await component(page, 'Select & date');
  await select.getByRole('button', { name: 'Workspace', exact: true }).click();
  await expect(page.getByRole('listbox', { name: 'Workspaces' })).toBeVisible();
  await page.getByRole('option', { name: 'Product team' }).click();
  await expect(select.getByRole('button', { name: 'Workspace', exact: true })).toContainText('Product team');

  const trigger = select.getByRole('button', { name: 'Start date', exact: true });
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Choose start date' })).toBeVisible();
  await page.getByRole('button', { name: 'Sep 10, 2026', exact: true }).press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(trigger).toContainText('Sep 11, 2026');
  await trigger.click();
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible();
  await page.getByRole('button', { name: 'Oct 31, 2026', exact: true }).focus();
  await page.keyboard.press('PageDown');
  await expect(page.getByRole('heading', { name: 'November 2026' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(trigger).toContainText('Nov 30, 2026');
  await trigger.click(); await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Choose start date' })).toBeHidden();
  await expect(trigger).toBeFocused();
  for (const theme of ['Dark theme', 'Light theme']) {
    await setTheme(page, theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await trigger.click();
    const box = await page.locator('.calendar-panel:not([hidden])').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
    await page.keyboard.press('Escape');
    await expect.poll(() => fitsViewport(page)).toBeTruthy();
    await page.setViewportSize({ width: 1440, height: 1000 });
  }

  const slider = (await component(page, 'Slider')).getByRole('slider', { name: 'Monthly events' });
  await slider.focus(); await page.keyboard.press('End');
  await expect(slider).toHaveValue('50000');
  expect(await slider.evaluate(el => el.style.getPropertyValue('--range-fill'))).toBe('100%');
  await page.keyboard.press('Home');
  await expect(slider).toHaveValue('1000');
  expect(errors).toEqual([]);
});

test('checkbox, switch, segmented control, tabs and dropdown keep native behaviour', async ({ page }) => {
  const errors = watchErrors(page);
  const checkboxes = await component(page, 'Checkbox');
  const checkbox = checkboxes.getByRole('checkbox', { name: 'Include all team members' });
  const was = await checkbox.isChecked();
  await checkbox.focus(); await page.keyboard.press('Space');
  await expect(checkbox).toBeChecked({ checked: !was });

  const toggle = (await component(page, 'Switch')).getByRole('switch', { name: 'Weekly digest', exact: true });
  await toggle.check();
  await expect(toggle).toBeChecked();

  const segmented = await component(page, 'Segmented control');
  await segmented.getByRole('button', { name: 'List', exact: true }).click();
  await expect(segmented.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await segmented.getByRole('button', { name: 'List', exact: true }).press('ArrowRight');
  await expect(segmented.getByRole('button', { name: 'Board', exact: true })).toHaveAttribute('aria-pressed', 'true');

  const tabs = await component(page, 'Tabs');
  await tabs.getByRole('tab', { name: 'Activity' }).click();
  await expect(tabs.getByRole('tabpanel')).toContainText('Jamie');

  const menu = await component(page, 'Dropdown menu');
  await menu.getByRole('button', { name: 'Project actions' }).click();
  await expect(menu.locator('.dropdown-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu.locator('.dropdown-panel')).toBeHidden();
  expect(errors).toEqual([]);
});

test('dialog, pagination, chat composer and toast work from System', async ({ page }) => {
  const errors = watchErrors(page);
  const dialogCard = await component(page, 'Dialog');
  await dialogCard.locator('[data-open-project]').click();
  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill('A considered product');
  await page.locator('#sample-dialog').getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.locator('#sample-dialog')).toBeHidden();
  await expect(page.locator('#toast')).toContainText('A considered product');

  const pagination = await component(page, 'Pagination');
  await pagination.getByRole('button', { name: 'Next page' }).click();
  await expect(pagination.locator('.page-range')).toContainText('11–20');

  const chat = await component(page, 'Chat composer');
  await chat.getByRole('textbox').fill('Hello Syntari');
  await chat.getByRole('button', { name: 'Send message' }).click();
  await expect(chat.locator('[data-messages]')).toContainText('Hello Syntari');

  const toast = await component(page, 'Toast');
  for (const theme of ['Light theme', 'Dark theme']) {
    await setTheme(page, theme);
    await toast.getByRole('button', { name: 'Show toast', exact: true }).click();
    expect(await page.locator('#toast').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(20, 20, 31)');
    expect(await toast.locator('.toast-preview').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(20, 20, 31)');
  }
  expect(errors).toEqual([]);
});

test('file input accepts click, keyboard and drop without exposing the native button', async ({ page }) => {
  const errors = watchErrors(page);
  const zone = (await component(page, 'File input')).locator('[data-drop-zone]');
  await expect(zone.getByRole('button', { name: 'Select assets', exact: true })).toBeVisible();
  await zone.locator('input').setInputFiles({ name: 'syntari-attachment.txt', mimeType: 'text/plain', buffer: Buffer.from('Syntari test attachment') });
  await expect(zone).toContainText('syntari-attachment.txt');
  await zone.evaluate(el => { const input = el.querySelector('input'); input.click = () => { el.dataset.pickerRequests = Number(el.dataset.pickerRequests || 0) + 1; }; });
  await zone.click();
  await zone.getByRole('button', { name: 'Replace asset', exact: true }).focus();
  await page.keyboard.press('Enter'); await page.keyboard.press('Space');
  await expect(zone).toHaveAttribute('data-picker-requests', '3');
  await zone.evaluate(el => { const data = new DataTransfer(); data.items.add(new File(['drop'], 'dropped.txt', { type: 'text/plain' })); el.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: data })); el.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: data })); });
  await expect(zone).toContainText('dropped.txt');
  await expect(zone.locator('input')).toBeHidden();
  expect(errors).toEqual([]);
});

test('motion patterns settle after interruption and respect reduced motion', async ({ page }) => {
  const errors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const dock = await component(page, 'Expandable dock');
  await dock.getByRole('button', { name: 'Realtime', exact: true }).click();
  await expect(dock.locator('.expanded-dock')).toHaveClass(/is-expanded/);
  await expect(dock.locator('.dock-content')).toHaveAttribute('aria-hidden', 'false');
  await dock.getByRole('button', { name: 'People', exact: true }).click();
  await expect(dock.locator('.dock-content')).toHaveAttribute('aria-hidden', 'true');

  const session = await component(page, 'Session card');
  const details = session.locator('details');
  await details.locator('summary').click();
  await expect(details).toHaveAttribute('open', '');
  await page.waitForFunction(() => !document.querySelector('.syntari-component details').dataset.motionTarget);
  await details.locator('summary').click();
  await expect(details).not.toHaveAttribute('open', '');
  await details.locator('summary').evaluate(el => { el.click(); el.click(); el.click(); });
  await page.waitForFunction(() => !document.querySelector('.syntari-component details').dataset.motionTarget);
  expect(await details.evaluate(el => el.open && el.style.overflow === '')).toBe(true);

  const toolbar = await component(page, 'Selection toolbar');
  await toolbar.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(toolbar.locator('.toolbar-count')).toHaveText('0 selected');
  await expect(toolbar.getByRole('button', { name: 'Archive', exact: true })).toBeDisabled();
  await toolbar.getByRole('checkbox', { name: 'Brand assets', exact: true }).check();
  await expect(toolbar.locator('.toolbar-count')).toHaveText('1 selected');

  const dialogCard = await component(page, 'Dialog');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.getAnimations().filter(a => a.playState === 'running').length === 0, {}, { timeout: 1500 });
  await dialogCard.locator('[data-open-project]').click();
  await expect(page.locator('#sample-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#sample-dialog')).toBeHidden();
  expect(errors).toEqual([]);
});

test('rolling numbers and the attribution table update exactly and pause for reduced motion', async ({ page }) => {
  const errors = watchErrors(page);
  const table = (await component(page, 'Attribution table')).locator('[data-attribution]');
  await table.getByRole('button', { name: 'Automatic table updates' }).click();
  await expect(table.locator('tbody tr')).toHaveCount(7);
  const first = table.locator('tbody tr').first(), number = first.locator('[data-row-value]');
  await page.mouse.move(0, 0); await first.getByRole('button').hover();
  await expect(number).toHaveAttribute('aria-label', /^\$/);
  await page.mouse.move(0, 0); await first.getByRole('button').focus();
  await expect(number).toHaveAttribute('aria-label', /^\$/);
  const before = Number(await first.getAttribute('data-people'));
  await table.getByRole('button', { name: 'Update', exact: true }).click();
  expect(Number(await first.getAttribute('data-people'))).toBeGreaterThan(before);
  expect(await number.locator('.number-digit').count()).toBeGreaterThan(0);
  await table.getByRole('button', { name: 'Show revenue', exact: true }).click();
  await expect(table.locator('tbody tr').nth(2).locator('[data-row-value]')).toHaveAttribute('aria-label', /^\$/);
  await table.getByRole('button', { name: 'Sources', exact: true }).click();
  await expect(first).toContainText('Search');

  const demo = (await component(page, 'Rolling number')).locator('[data-number-demo]');
  const counter = demo.locator('[data-number]');
  await demo.getByRole('button', { name: '+127', exact: true }).click();
  await expect(counter).toHaveAttribute('aria-label', '2,496');
  await demo.getByRole('button', { name: '−89', exact: true }).click();
  await expect(counter).toHaveAttribute('aria-label', '2,407');
  await counter.evaluate(el => { SyntariNumbers.set(el, 999); SyntariNumbers.set(el, 1000); SyntariNumbers.set(el, 9); });
  await expect(counter).toHaveAttribute('aria-label', '9');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.getAnimations().filter(a => a.playState === 'running').length === 0, {}, { timeout: 1500 });
  await demo.getByRole('button', { name: '+127', exact: true }).click();
  await expect(counter).toHaveAttribute('aria-label', '136');
  await expect(counter.locator('.number-track')).toHaveCount(0);

  /* A fresh mount starts with automatic updates on; reduced motion must hold them until motion is allowed. */
  const live = (await component(page, 'Attribution table')).locator('[data-attribution]');
  await expect(live.getByRole('button', { name: 'Automatic table updates' })).toHaveAttribute('aria-pressed', 'true');
  const row = live.locator('tbody tr').first();
  const value = await row.getAttribute('data-people');
  await page.waitForTimeout(3200);
  await expect(row).toHaveAttribute('data-people', value);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => row.getAttribute('data-people'), { timeout: 4500 }).not.toBe(value);
  for (const theme of ['Dark theme', 'Light theme']) {
    await setTheme(page, theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => fitsViewport(page)).toBeTruthy();
  }
  await settled(page);
  expect(errors).toEqual([]);
});
