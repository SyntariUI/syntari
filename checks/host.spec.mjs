import { test, expect } from '@playwright/test';
import { origin } from './component.mjs';

/* A blank page that is not the Syntari site: what a team gets after `npm install syntari-ui`. */
const host = async page => {
  await page.route(`${origin}/__host.html`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Host</title></head><body><main id="app"></main></body></html>' }));
  await page.goto(`${origin}/__host.html`);
};

test('importing the runtime leaves the host page alone', async ({ page }) => {
  await host(page);
  await page.evaluate(async () => {
    document.body.insertAdjacentHTML('beforeend', '<div id="hist"></div><form class="composer" id="hostform"><input name="q" value="hello"><button id="go">Go</button></form><button id="notify" data-notify="Saved">Host save</button><button id="elsewhere">Elsewhere</button><dialog id="hostdialog"><p>Host dialog</p></dialog>');
    window.seen = [];
    window.addEventListener('submit', event => { window.seen.push(`submit:${event.defaultPrevented}`); event.preventDefault(); });
    window.addEventListener('click', event => { if (event.target.id === 'notify') window.seen.push(`notify:${event.defaultPrevented}`); });
    const { mount } = await import('/syntari.js');
    await mount('filter-bar', document.querySelector('#app'), { props: { period: 'Last 7 days', periods: [{ label: 'Last 7 days', value: '7d' }, { label: 'Last 30 days', value: '30d' }] } });
  });
  await page.click('#go');
  await page.click('#notify');
  expect(await page.evaluate(() => window.seen)).toEqual(['submit:false', 'notify:false']);
  expect(await page.evaluate(() => ({ hist: document.querySelector('#hist').innerHTML, input: document.querySelector('#hostform input').value }))).toEqual({ hist: '', input: 'hello' });
  await expect(page.locator('#toast')).toBeHidden();
  /* Syntari's own menu still closes when the person clicks the host page. */
  await page.locator('[data-select-toggle]').click();
  await expect(page.locator('#app .control-panel')).toBeVisible();
  await page.click('#elsewhere');
  await expect(page.locator('#app .control-panel')).toBeHidden();
  await page.evaluate(() => document.querySelector('#hostdialog').showModal());
  await page.keyboard.press('Escape');
  await expect(page.locator('#hostdialog')).not.toHaveAttribute('open');
  /* Contract styles load with the runtime: a screen keeps its layout without extra stylesheets. */
  expect(await page.evaluate(() => [...document.styleSheets].some(sheet => sheet.href?.endsWith('/ir.css')))).toBe(true);
});

test('charts, figures, and tables show the agent data in a host page', async ({ page }) => {
  await host(page);
  const result = await page.evaluate(async () => {
    const { render } = await import('/ir.js');
    const target = document.querySelector('#app');
    const points = [3.0, 3.1, 3.4, 3.2, 3.5, 3.3, 3.0].map((value, i) => ({ label: `W${i + 1}`, value }));
    const rendered = await render({ type: 'screen', children: [
      { component: 'syntari.area-chart', props: { title: 'Conversion', points } },
      { component: 'syntari.metric-and-sparkline', props: { stats: [{ label: 'Orders', value: '512' }], series: [{ label: 'Mon', value: 30 }, { label: 'Tue', value: 60 }] } },
      { component: 'syntari.chart-bars', props: { title: 'Runs', chartLabel: 'Runs: Mon 40 vs 30', columns: [{ label: 'Mon', a: 40, b: 30 }] } },
      { component: 'syntari.table', props: { columns: ['Tool', 'Calls', 'Owner', 'Region', 'Cost', 'Status'].map(label => ({ label })), rows: [['read', '4', 'Ada', 'EU', '$1', 'Failed']] } }
    ] }, target);
    await new Promise(resolve => setTimeout(resolve, 1600));
    const area = target.querySelector('.area-figure');
    const stat = target.querySelector('.mini-stats .stat strong');
    return {
      errors: rendered.diagnostics.filter(item => item.severity === 'error'),
      axis: [...area.querySelectorAll('.plot-axis span')].map(span => span.textContent),
      points: [...area.querySelectorAll('.area-point')].map(point => point.getAttribute('aria-label')),
      ticks: [...area.querySelectorAll('.plot-labels span')].map(span => span.textContent),
      stat: { text: stat.textContent.trim(), label: stat.getAttribute('aria-label') },
      bars: target.querySelector('.chart-bars-modern .column-fill')?.getBoundingClientRect().width ?? target.querySelector('.column-fill').getBoundingClientRect().width,
      barsLabel: target.querySelector('.chart-columns').getAttribute('aria-label'),
      sparkNames: [...target.querySelectorAll('.bar-chart .bar')].map(bar => bar.textContent.replace(/\s+/g, ' ').trim()),
      cells: [...target.querySelectorAll('.table tbody td')].map(cell => cell.textContent)
    };
  });
  expect(result.errors).toEqual([]);
  expect(result.axis).toEqual(['3.6%', '3.4%', '3.2%', '3%']);
  expect(result.points).toEqual(['W1: 3%', 'W2: 3.1%', 'W3: 3.4%', 'W4: 3.2%', 'W5: 3.5%', 'W6: 3.3%', 'W7: 3%']);
  expect(result.ticks).toEqual(['W1', 'W3', 'W5', 'W7']);
  expect(result.stat).toEqual({ text: '512', label: null });
  expect(result.bars).toBeGreaterThan(50);
  expect(result.barsLabel).toBe('Runs: Mon 40 vs 30');
  expect(result.sparkNames).toEqual(['Mon: 30', 'Tue: 60']);
  expect(result.cells).toEqual(['read', '4', 'Ada', 'EU', '$1', 'Failed']);
});

test('a host page keeps its markup, styles, shortcuts, dialogs, and menus', async ({ page }) => {
  await host(page);
  await page.evaluate(() => {
    document.querySelector('#app').insertAdjacentHTML('beforebegin', `<section id="hostside"><h1>Host title</h1><p>Host text <a href="#">link</a></p><button id="plain">Plain</button>
      <div class="selectable-cards"><input type="radio" name="plan" value="a"><input type="radio" name="plan" value="b"></div>
      <div class="dropdown"><button id="menu" data-menu-toggle aria-expanded="true">Menu</button><div class="dropdown-panel">Open</div></div>
      <span class="sidebar">Host sidebar</span><textarea id="editor"></textarea><dialog id="hostdialog"><p>Host dialog</p></dialog>
      <style>:root{--accent:rgb(200,0,0);--text:rgb(0,90,0)}#plain{color:var(--accent);border:1px solid var(--text)}</style></section>`);
    window.snapshot = () => ({
      markup: document.querySelector('#hostside').outerHTML,
      styles: ['h1', 'p', 'a', '#plain', '.sidebar', 'body'].map(selector => { const style = getComputedStyle(document.querySelector(selector)); return [selector, style.fontFamily, style.fontSize, style.margin, style.color, style.position, style.border].join('|'); })
    });
    window.before = window.snapshot();
  });
  await page.evaluate(async () => {
    const { mount } = await import('/syntari.js');
    await mount('tool-approval', '#app', { props: { title: 'Run it?', question: 'Apply the change.', scope: 'billing' } });
    await mount('prompt-input', '#app', { props: { label: 'Ask' } });
  });
  /* The command palette belongs to Syntari's own pages and screens, not to a component in someone else's app. */
  await page.locator('#app textarea').first().press('Control+k');
  expect(await page.evaluate(() => document.querySelector('#starter-dialog')?.open ?? false)).toBe(false);
  await page.click('#plain');
  await page.locator('#editor').press('Control+k');
  expect(await page.evaluate(() => document.querySelector('#starter-dialog')?.open ?? false)).toBe(false);
  await page.evaluate(() => document.querySelector('#hostdialog').showModal());
  await page.mouse.click(5, 5);
  await expect(page.locator('#hostdialog')).toHaveAttribute('open');
  await page.evaluate(() => document.querySelector('#hostdialog').close());
  expect(await page.evaluate(() => window.snapshot())).toEqual(await page.evaluate(() => window.before));
});

test('in a host page the dark theme paints its own canvas', async ({ page }) => {
  await host(page);
  const colors = await page.evaluate(async () => {
    const { setTheme } = await import('/syntari.js');
    const { render } = await import('/ir.js');
    setTheme('dark');
    await render({ type: 'screen', children: [{ component: 'syntari.metadata-list', props: { items: [{ label: 'Owner', value: 'Ada' }] } }] }, '#app');
    const root = document.querySelector('#app .ir-screen');
    return { background: getComputedStyle(root).backgroundColor, text: getComputedStyle(root.querySelector('dd') ?? root).color, body: getComputedStyle(document.body).backgroundColor };
  });
  expect(colors.background).toBe('rgb(20, 20, 31)');
  expect(colors.body).toBe('rgba(0, 0, 0, 0)');
  expect(colors.text).not.toBe(colors.background);
});
