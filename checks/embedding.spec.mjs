import { test, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:4318';
async function consumer(page, setup = '') {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(`${origin}/consumer.html`, route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Consumer app</title></head><body>
      <main><input id="host-search" aria-label="Search my app"><div id="component"></div><output id="result"></output></main>
      <script type="module">
        import { initialize, prepare, mount } from './orbit.js';
        window.hostKeys = 0;
        document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); window.hostKeys++; } });
        await initialize();
        ${setup}
        window.ready = true;
      </script></body></html>`
  }));
  await page.goto(`${origin}/consumer.html`);
  await page.waitForFunction(() => window.ready);
  return errors;
}

test('prepare enhances copied markup without changing the consumer layout', async ({ page }) => {
  await consumer(page, `
    const root = document.querySelector('#component');
    root.innerHTML = '<button class="button">Save project</button>';
    const layout = () => { const s = getComputedStyle(root); return { padding: s.padding, display: s.display, minHeight: s.minHeight, gap: s.gap }; };
    window.before = layout();
    await prepare(root);
    window.after = layout();
  `);
  expect(await page.evaluate(() => window.after)).toEqual(await page.evaluate(() => window.before));
  await expect(page.getByRole('button', { name: 'Save project' })).toBeVisible();
});

test('installing an unrelated component does not capture the host app command shortcut', async ({ page }) => {
  await consumer(page, `await mount('button', '#component');`);
  await page.getByRole('textbox', { name: 'Search my app' }).press('Control+k');
  await expect.poll(() => page.evaluate(() => window.hostKeys)).toBe(1);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('onAction observes settled select state before a consumer removes the control', async ({ page }) => {
  const errors = await consumer(page, `
    await mount('select-and-date', '#component', {
      onAction(event, root) {
        if (!event.target.closest('[data-option]')) return;
        document.querySelector('#result').textContent = root.querySelector('[data-select-label]').textContent;
        root.querySelector('.ds-select').remove();
      }
    });
  `);
  await page.getByRole('button', { name: 'Workspace', exact: true }).click();
  await page.getByRole('option', { name: 'Design studio', exact: true }).click();
  await expect(page.locator('#result')).toHaveText('Design studio');
  expect(errors).toEqual([]);
});

test('rolling percentages preserve one decimal and the accessible value', async ({ page }) => {
  await consumer(page, `window.OrbitNumbers.set(document.querySelector('#result'), .481, { kind: 'percent' });`);
  await expect(page.locator('#result')).toHaveAttribute('aria-label', '48.1%');
});

test('the embedded command palette retains its shortcut inside its own region', async ({ page }) => {
  await consumer(page, `await mount('command-palette', '#component');`);
  await page.locator('#component [data-open-command]').press('Control+k');
  await expect(page.getByRole('combobox', { name: 'Search commands' })).toBeVisible();
  expect(await page.evaluate(() => window.hostKeys)).toBe(0);
  await page.getByRole('combobox', { name: 'Search commands' }).press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

for (const operation of ['reset', 'destroy']) test(`${operation} cancels queued consumer callbacks from the previous instance`, async ({ page }) => {
  await consumer(page, `window.component = await mount('button', '#component', {
    onAction() { document.querySelector('#result').textContent = 'Stale callback'; }
  });`);
  await page.evaluate(async operation => {
    window.component.element.querySelector('button').click();
    await window.component[operation]();
    await new Promise(resolve => setTimeout(resolve, 30));
  }, operation);
  await expect(page.locator('#result')).toBeEmpty();
});
