import { test, expect } from '@playwright/test';
const origin = 'http://127.0.0.1:4398';

/** mode, screen title, and the components the mode draws. */
const modes = [
  ['static', 'Release 4281 is ready to review', 5],
  ['interactive', 'Product overview', 7]
];

test('the renderer draws a report from a spec', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/generative-ui.html`);
  const output = page.locator('[data-ir-output]');
  await output.locator('.ir-screen').waitFor();
  await expect(output.locator('.ir-screen-title')).toHaveText('Release 4281 is ready to review');
  await expect(output.locator('[data-ir-component]')).toHaveCount(5);
  await expect(output.locator('.ir-fallback')).toHaveCount(0);
  await expect(output.locator('.stat-card')).toHaveCount(4);
  await expect(output.locator('.chart-column')).toHaveCount(6);
  await expect(output.locator('.chart-legend li')).toHaveCount(2);
  await expect(output.locator('.comparison-table tbody tr')).toHaveCount(4);
  await expect(output.locator('.comparison-table tbody tr').first()).toContainText('Rollback time');
  await expect(output.locator('.process-ledger li')).toHaveCount(3);
  await expect(output.locator('.ledger-total')).toContainText('2.4ms');
  const region = output.locator('.ir-region');
  await expect(region.locator('summary')).toHaveText('Evidence · 3 stages');
  await expect(output.locator('.ir-region-body .process-ledger li').first()).toBeHidden();
  await region.locator('summary').click();
  await expect(output.locator('.ir-region-body .process-ledger li').first()).toBeVisible();
  await expect(page.locator('[data-ir-intent]')).toContainText('trust');
  await expect(page.locator('[data-ir-diagnostics] .ir-clean')).toBeVisible();
  expect(errors).toEqual([]);
});

test('both render modes work from the registry, and the catalogue matches it', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  const output = page.locator('[data-ir-output]');
  await output.locator('.ir-screen').waitFor();
  const supported = await page.evaluate(async () => (await (await import('/ir.js')).renderableSlugs()).length);
  await expect(page.locator('.ir-catalog-card')).toHaveCount(supported);
  await expect(page.locator('[data-ir-count=renderable]')).toHaveText(String(supported));
  for (const [mode, title] of modes) {
    await page.locator(`[data-ir-mode=${mode}]`).click();
    await expect(page.locator(`[data-ir-mode=${mode}]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(output.locator('.ir-screen-title')).toHaveText(title);
    await expect(output.locator('.ir-fallback')).toHaveCount(0);
    await expect(page.locator('[data-ir-intent]')).not.toBeEmpty();
    await expect(page.locator('[data-ir-diagnostics] .ir-clean')).toBeVisible();
  }
  expect(supported).toBe(22);
});

test('the interactive mode responds to its own controls', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  await page.locator('[data-ir-mode=interactive]').click();
  const stage = page.locator('[data-ir-output]');
  await expect(stage.locator('.headline-metric')).toHaveCount(2);
  await expect(stage.locator('.headline-total').nth(1)).toHaveText('/ 12');
  await expect(stage.locator('.metric-item')).toHaveCount(4);
  await expect(stage.locator('.metric-item').first()).toHaveClass(/active/);
  await stage.locator('.metric-item').nth(1).click();
  await expect(stage.locator('.metric-item').nth(1)).toHaveClass(/active/);
  await expect(stage.locator('.metric-item').first()).not.toHaveClass(/active/);
  await expect(stage.locator('[data-chart-view]')).toHaveAttribute('aria-pressed', 'false');
  await stage.locator('[data-chart-view]').click();
  await expect(stage.locator('[data-chart-view]')).toHaveAttribute('aria-pressed', 'true');
  await expect(stage.locator('[data-chart-view]')).toHaveText('View weekly totals');
  await expect(stage.locator('.area-line')).toHaveAttribute('d', /^M\d/);
  await stage.locator('[data-select-toggle]').click();
  await stage.locator('[data-option="Last 90 days"]').click();
  await expect(stage.locator('[data-select-label]')).toHaveText('Last 90 days');
  await expect(stage.locator('.rank-list li')).toHaveCount(5);
});

test('every component with a prop contract renders its props into the real markup', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  const cases = [
    ['banner', { message: 'Build passed', detail: 'Detail line', tone: 'info', icon: 'info' }, ['Build passed', 'Detail line']],
    ['card', { title: 'Card title', body: 'Card body', badge: 'Review', badgeTone: 'danger', action: 'Open it' }, ['Card title', 'Card body', 'Review', 'Open it']],
    ['empty-state', { title: 'Nothing here', body: 'Add one', action: 'Create', icon: 'plus' }, ['Nothing here', 'Add one', 'Create']],
    ['metadata-list', { items: [{ label: 'Owner', value: 'Ada' }] }, ['Owner', 'Ada']],
    ['activity-list', { items: [{ icon: 'plus', title: 'Run started', detail: 'Queue empty', time: '1m ago' }] }, ['Run started', 'Queue empty', '1m ago']],
    ['table', { caption: 'Caption here', columns: [{ label: 'Tool' }, { label: 'Runs' }], rows: [['read_files', '412']] }, ['Caption here', 'Tool', 'read_files', '412']],
    ['metric-and-sparkline', { chartLabel: 'Runs by day', stats: [{ label: 'Runs', value: '1,284', badge: '+18.6%', tone: 'danger' }], series: [{ label: 'Mon', value: 33 }, { label: 'Tue', value: 61 }] }, ['Runs', '1,284', '+18.6%', 'Mon', 'Tue']],
    ['tool-approval', { title: 'Run it?', question: 'Apply migrations', scope: 'billing · write' }, ['Run it?', 'Apply migrations', 'billing · write', 'Approve', 'Decline']],
    ['approval-card', { title: 'Review', summary: 'Summary line', detail: 'Detail scope' }, ['Review', 'Summary line', 'Detail scope']],
    ['streaming-response', { author: 'Agent', text: 'Streamed body', status: 'Idle' }, ['Agent', 'Streamed body', 'Idle', 'Generate response']],
    ['chart-bars', { title: 'Runs by period', note: 'Indexed', seriesA: 'This week', seriesB: 'Last', chartLabel: 'Two series', columns: [{ label: 'Mon', a: 41, b: 30 }] }, ['Runs by period', 'Indexed', 'This week', 'Last', 'Mon']],
    ['comparison-table', { caption: 'Plans compared', optionA: 'Free', optionB: 'Growth', rows: [{ metric: 'Projects', a: '1', b: 'Unlimited', advantage: 'Growth' }] }, ['Plans compared', 'Free', 'Growth', 'Projects', 'Unlimited']],
    ['stat-row', { stats: [{ label: 'Runs', value: '1,284', badge: '+18.6%', note: 'this week' }] }, ['Runs', '1,284', '+18.6%', 'this week']],
    ['process-ledger', { total: '3.1ms', budget: 'under budget', stages: [{ title: 'Resolve', detail: 'Match the intent', time: '0.3ms', mark: 'check', state: 'done' }] }, ['Resolve', 'Match the intent', '0.3ms', '3.1ms', 'under budget']],
    ['transport-controls', { speed: 12, steps: 60 }, []],
    ['live-readout', { title: 'Render run', state: 'Running', values: [{ label: 'Generation', value: '27' }] }, ['Render run', 'Running', 'Generation', '27']],
    ['area-chart', { title: 'Mention rate', note: 'Last 30 days', chartLabel: 'Mention rate', points: [{ label: 'D1', value: 40 }, { label: 'D2', value: 55 }] }, ['Mention rate', 'Last 30 days']],
    ['chart-toolbar', { compareLabel: 'Compare with the prior period', compare: false, viewLabel: 'View numbers', legend: 'Mention rate' }, ['Compare with the prior period', 'View numbers', 'Mention rate']],
    ['metric-strip', { items: [{ label: 'Mention rate', icon: 'eye', value: '45.4%', delta: '3.3 pp', direction: 'up', meaning: 'of answers' }, { label: 'Leads', icon: 'star', value: '2', direction: 'down' }] }, ['Mention rate', '45.4%', '3.3 pp', 'Leads']],
    ['headline-metric', { metrics: [{ label: 'Lost questions', value: '12', total: '/ 12', delta: '50.0%', direction: 'down' }] }, ['Lost questions', '12', '/ 12', '50.0%']],
    ['filter-bar', { period: 'Last 90 days', periods: [{ label: 'Last 7 days', value: 'Last 7 days' }, { label: 'Last 90 days', value: 'Last 90 days' }], filtersLabel: 'Filters' }, ['Last 90 days', 'Last 7 days']],
    ['source-list', { sources: [{ name: 'ChatGPT', share: 42 }, { name: 'Perplexity', share: 26 }] }, ['ChatGPT', '42', 'Perplexity']]
  ];
  const results = await page.evaluate(async list => {
    const { render } = await import('/ir.js');
    const stage = document.querySelector('[data-ir-output]');
    const rows = [];
    for (const [slug, props, expected] of list) {
      const spec = { type: 'screen', layout: 'stack', children: [{ component: `syntari.${slug}`, props }] };
      const result = await render(spec, stage);
      const text = result.element.textContent.replace(/\s+/g, ' ');
      rows.push({
        slug,
        missing: expected.filter(value => !text.includes(value)),
        diagnostics: result.diagnostics.filter(diagnostic => diagnostic.severity === 'error').map(diagnostic => diagnostic.code),
        bars: result.element.querySelectorAll('.bar-chart .bar').length,
        columns: result.element.querySelectorAll('.chart-column').length,
        speed: result.element.querySelector('[data-transport-speed]')?.value
      });
      result.destroy();
    }
    return rows;
  }, cases);
  for (const row of results) {
    expect(row.missing, `${row.slug} did not receive its props`).toEqual([]);
    expect(row.diagnostics, `${row.slug} raised errors`).toEqual([]);
  }
  expect(results.find(row => row.slug === 'chart-bars').columns).toBe(1);
  expect(results.find(row => row.slug === 'metric-and-sparkline').bars).toBe(2);
  expect(results.find(row => row.slug === 'transport-controls').speed).toBe('12');
});

test('validation refuses invented components, missing props, and values outside the contract', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  const report = await page.evaluate(async () => {
    const { validate } = await import('/ir.js');
    const screen = child => ({ type: 'screen', children: [child] });
    const codesFor = async spec => (await validate(spec)).diagnostics.map(diagnostic => `${diagnostic.severity}:${diagnostic.code}`);
    return {
      unknown: await codesFor(screen({ component: 'syntari.wizard-hat', props: {} })),
      unrenderable: await codesFor(screen({ component: 'syntari.button', props: {} })),
      prefix: await codesFor(screen({ component: 'banner', props: { message: 'ok' } })),
      missing: await codesFor(screen({ component: 'syntari.tool-approval', props: { title: 'Run it?' } })),
      wrongType: await codesFor(screen({ component: 'syntari.banner', props: { message: 42 } })),
      outside: await codesFor(screen({ component: 'syntari.banner', props: { message: 'ok', tone: 'danger' } })),
      overBudget: await codesFor(screen({ component: 'syntari.table', props: { columns: [{ label: 'A' }], rows: Array.from({ length: 20 }, () => ['x']) } })),
      repaired: await codesFor(screen({ component: 'syntari.banner', props: { message: 'ok', dismissible: true } })),
      layout: await codesFor({ type: 'screen', layout: 'carousel', children: [{ component: 'syntari.banner', props: { message: 'ok' } }] }),
      regionNoLabel: await codesFor(screen({ type: 'region', children: [{ component: 'syntari.banner', props: { message: 'ok' } }] })),
      regionBadOpen: await codesFor(screen({ type: 'region', label: 'Evidence', open: 'yes', children: [] })),
      regionNests: await codesFor(screen({ type: 'region', label: 'Evidence', children: [{ type: 'region', label: 'Deeper', children: [{ component: 'syntari.card', props: { title: 'Nested card' } }] }] })),
      badColumns: await codesFor(screen({ component: 'syntari.chart-bars', props: { title: 'Runs', columns: [{ label: 'Mon', a: 140, b: 10 }] } }))
    };
  });
  expect(report.unknown).toContain('error:unknown-component');
  expect(report.unrenderable).toContain('error:unsupported-component');
  expect(report.prefix).toContain('error:invalid-component-id');
  expect(report.missing.filter(code => code === 'error:missing-required')).toHaveLength(2);
  expect(report.wrongType).toContain('error:wrong-type');
  expect(report.outside).toContain('error:enum-outside-values');
  expect(report.overBudget).toContain('error:over-item-budget');
  expect(report.repaired).toContain('warning:unknown-prop');
  expect(report.repaired.some(code => code.startsWith('error'))).toBe(false);
  expect(report.layout).toContain('warning:unknown-layout');
  expect(report.layout.some(code => code.startsWith('error'))).toBe(false);
  expect(report.regionNoLabel).toContain('error:invalid-region');
  expect(report.regionBadOpen).toContain('error:wrong-type');
  expect(report.regionNests.some(code => code.startsWith('error'))).toBe(false);
  expect(report.badColumns).toContain('error:above-maximum');
});

test('the guide links to the live registry-backed renderer catalogue', async ({ page }) => {
  await page.goto(`${origin}/guides/generative-ui/`);
  await expect(page.getByRole('link', { name: 'live renderer' })).toBeVisible();
  await expect(page.locator('#docs-main')).toContainText('syntari info <id> --json');
  const supported = await page.evaluate(async () => (await (await import('/ir.js')).renderableSlugs()).sort());
  expect(supported).toHaveLength(22);
  await expect(page.getByRole('heading', { name: 'Agents can render, too.' })).toBeVisible();
});

test('leaving an optional prop out never writes "undefined" into the screen', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  const report = await page.evaluate(async () => {
    const { render } = await import('/ir.js');
    const stage = document.querySelector('[data-ir-output]');
    const rows = [];
    const cases = [
      ['card', { title: 'Only a title' }],
      ['banner', { message: 'Only a message' }],
      ['approval-card', { title: 'Review', summary: 'Summary only', detail: 'One place' }],
      ['streaming-response', { author: 'Agent', text: 'Body only' }],
      ['chart-bars', { title: 'Bars', columns: [{ label: 'Mon', a: 10, b: 5 }] }],
      ['stat-row', { stats: [{ label: 'Runs', value: '12' }] }]
    ];
    for (const [slug, props] of cases) {
      const spec = { type: 'screen', layout: 'stack', children: [{ component: `syntari.${slug}`, props }] };
      const result = await render(spec, stage);
      rows.push({
        slug,
        text: result.element.textContent.replace(/\s+/g, ' '),
        diagnostics: result.diagnostics.map(diagnostic => `${diagnostic.severity}:${diagnostic.code}`)
      });
      result.destroy();
    }
    return rows;
  });
  for (const row of report) {
    expect(row.text, `${row.slug} printed an empty prop`).not.toContain('undefined');
    expect(row.diagnostics, `${row.slug} reported a problem`).toEqual([]);
  }
});

test('a mounted component keeps the internal rhythm it was authored for', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  await page.waitForTimeout(1200);
  const report = await page.evaluate(() => {
    const chart = document.querySelector('[data-ir-output] .chart-figure');
    const columns = chart.querySelector('.chart-columns').getBoundingClientRect();
    const legend = chart.querySelector('.chart-legend').getBoundingClientRect();
    const value = chart.querySelector('.column-value').getBoundingClientRect();
    const pair = chart.querySelector('.column-pair').getBoundingClientRect();
    const fills = [...chart.querySelectorAll('.column-fill')].map(fill => fill.getBoundingClientRect().height);
    return {
      legendGap: Math.round(legend.top - columns.bottom),
      valueGap: Math.round(pair.left - value.right),
      tallest: Math.round(Math.max(...fills)),
      pairHeight: Math.round(pair.height),
      pairWidth: Math.round(pair.width)
    };
  });
  expect(report.legendGap).toBeGreaterThan(0);
  expect(report.valueGap).toBeGreaterThanOrEqual(0);
  expect(report.pairWidth).toBeGreaterThan(120);
  expect(report.tallest).toBeLessThanOrEqual(report.pairHeight);
});
