import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
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
  expect(supported).toBe(59);
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
  await expect(stage.locator('[data-chart-view]')).toHaveText('View daily numbers');
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
      unrenderable: await codesFor(screen({ component: 'syntari.password-field', props: {} })),
      prefix: await codesFor(screen({ component: 'banner', props: { message: 'ok' } })),
      missing: await codesFor(screen({ component: 'syntari.tool-approval', props: { title: 'Run it?' } })),
      wrongType: await codesFor(screen({ component: 'syntari.banner', props: { message: 42 } })),
      outside: await codesFor(screen({ component: 'syntari.banner', props: { message: 'ok', tone: 'danger' } })),
      overBudget: await codesFor(screen({ component: 'syntari.table', props: { columns: [{ label: 'A' }], rows: Array.from({ length: 21 }, () => ['x']) } })),
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

test('the generative UI guide explains how to inspect the registry-backed catalogue', async ({ page }) => {
  await page.goto(`${origin}/guides/generative-ui/`);
  await expect(page.locator('[data-guide-content]')).toContainText('syntari info <id> --json');
  const supported = await page.evaluate(async () => (await (await import('/ir.js')).renderableSlugs()).sort());
  expect(supported).toHaveLength(59);
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
      ['chart-bars', { title: 'Bars', chartLabel: 'Bars: Mon 10 vs 5', columns: [{ label: 'Mon', a: 10, b: 5 }] }],
      ['stat-row', { stats: [{ label: 'Runs', value: '12' }] }]
    ];
    for (const [slug, props] of cases) {
      const spec = { type: 'screen', layout: 'stack', children: [{ id: slug, component: `syntari.${slug}`, props }] };
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

test('a two-column screen keeps its title above both columns', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  const layout = await page.evaluate(async () => {
    const { render } = await import('/ir.js');
    const stage = document.querySelector('[data-ir-output]');
    const spec = { type: 'screen', layout: 'two-column', title: 'Two columns', children: [
      { component: 'syntari.card', props: { title: 'Left' } },
      { component: 'syntari.card', props: { title: 'Right' } }
    ] };
    const result = await render(spec, stage);
    const box = element => element.getBoundingClientRect();
    const [left, right] = [...result.element.querySelectorAll('.ir-node')].map(box);
    return { screen: box(result.element), title: box(result.element.querySelector('.ir-screen-title')), left, right };
  });
  expect(layout.title.width).toBeCloseTo(layout.screen.width, 0);
  expect(layout.left.top).toBeCloseTo(layout.right.top, 0);
  expect(layout.left.top).toBeGreaterThan(layout.title.bottom);
});

test('a section groups nodes under a heading in its own layout', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  const layout = await page.evaluate(async () => {
    const { render } = await import('/ir.js');
    const spec = { type: 'screen', children: [{ type: 'section', heading: '1. What changed', layout: 'two-column', children: [
      { id: 'left', component: 'syntari.card', props: { title: 'Left' } },
      { id: 'right', component: 'syntari.card', props: { title: 'Right' } }
    ] }] };
    const result = await render(spec, document.querySelector('[data-ir-output]'));
    const section = result.element.querySelector('.ir-section');
    const [left, right] = [...section.querySelectorAll('.ir-node')].map(node => node.getBoundingClientRect());
    return { heading: section.querySelector('h3').textContent, collapsible: Boolean(section.closest('details')), diagnostics: result.diagnostics, left, right };
  });
  expect(layout.heading).toBe('1. What changed');
  expect(layout.collapsible).toBe(false);
  expect(layout.diagnostics).toEqual([]);
  expect(layout.left.top).toBeCloseTo(layout.right.top, 0);
  expect(layout.right.left).toBeGreaterThan(layout.left.right);
});

test('an unfinished stage never shows a check, and a live status dot follows its tone', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  const shown = await page.evaluate(async () => {
    const { render } = await import('/ir.js');
    const readout = tone => ({ component: 'syntari.live-readout', props: { title: 'Checkout API', state: tone === 'danger' ? 'Degraded' : 'Healthy', tone, values: [{ label: 'p95', value: '840 ms' }] } });
    const spec = { type: 'screen', children: [
      { component: 'syntari.process-ledger', props: { stages: [
        { title: 'Deploy', state: 'done' },
        { title: 'Verify', state: 'current' },
        { title: 'Announce' },
        { title: 'Retire the old build', state: 'pending', mark: 'minus' }
      ] } },
      readout('success'),
      readout('danger')
    ] };
    const result = await render(spec, document.querySelector('[data-ir-output]'));
    const marks = [...result.element.querySelectorAll('.process-ledger .stage-mark')];
    return {
      diagnostics: result.diagnostics,
      icons: marks.map(mark => mark.dataset.irIcon ?? null),
      fills: marks.map(mark => getComputedStyle(mark).backgroundColor),
      dots: [...result.element.querySelectorAll('.live-readout .status-dot')].map(dot => getComputedStyle(dot).backgroundColor)
    };
  });
  expect(shown.diagnostics).toEqual([]);
  /* Left out, a mark follows the stage's state; given, it wins. */
  expect(shown.icons).toEqual(['check', 'clock', 'circle', 'minus']);
  expect(shown.fills[2]).not.toBe(shown.fills[0]);
  expect(shown.dots).toHaveLength(2);
  expect(shown.dots[1]).not.toBe(shown.dots[0]);
});

test('an unverified block is refused unless the host allows it, and is isolated when it is', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  const report = await page.evaluate(async () => {
    const { render } = await import('/ir.js');
    const stage = document.querySelector('[data-ir-output]');
    window.ranInside = false;
    const html = '<meta http-equiv="refresh" content="0;url=https://example.com"><h1>Doors</h1><a href="https://example.com">Open</a><img src="x" onerror="parent.ranInside = true"><script>parent.ranInside = true</script><form action="https://example.com"><button>Send</button></form>';
    const spec = { type: 'screen', children: [{ type: 'sandbox', label: 'Three doors', html, height: 160 }] };
    const refused = await render(spec, stage);
    const refusedFallback = Boolean(refused.element.querySelector('.ir-fallback')), refusedFrame = Boolean(refused.element.querySelector('iframe'));
    const refusedCodes = refused.diagnostics.map(d => `${d.severity}:${d.code}`);
    const allowed = await render(spec, stage, { sandbox: true });
    const frame = allowed.element.querySelector('.ir-sandbox iframe');
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      refusedFallback, refusedFrame, refusedCodes,
      allowedCodes: allowed.diagnostics.map(d => `${d.severity}:${d.code}`),
      sandbox: frame.getAttribute('sandbox'), height: frame.style.height, label: allowed.element.querySelector('.ir-sandbox figcaption').textContent,
      srcdoc: frame.srcdoc, readable: (() => { try { return Boolean(frame.contentDocument); } catch { return false; } })(), ranInside: window.ranInside
    };
  });
  expect(report.refusedFallback).toBe(true);
  expect(report.refusedFrame).toBe(false);
  expect(report.refusedCodes).toContain('error:sandbox-not-allowed');
  expect(report.allowedCodes).toEqual(['warning:unverified-block']);
  expect(report.sandbox).toBe('');
  expect(report.height).toBe('160px');
  expect(report.label).toContain('Unverified');
  expect(report.srcdoc).toContain("default-src 'none'");
  expect(report.srcdoc).toContain('<h1>Doors</h1>');
  for (const removed of ['refresh', 'https://example.com', '<script', 'onerror', '<form']) expect(report.srcdoc).not.toContain(removed);
  expect(report.readable).toBe(false);
  expect(report.ranInside).toBe(false);
});

test('a calculator recomputes its results from declared formulas as a person moves an input', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  await page.evaluate(async () => {
    const { render } = await import('/ir.js');
    const spec = { type: 'screen', children: [{ id: 'savings', component: 'syntari.calculator', props: {
      title: 'Illustrative retirement savings',
      inputs: [{ name: 'monthly', label: 'Monthly contribution', min: 0, max: 1000, step: 25, value: 500, format: 'currency' }, { name: 'years', label: 'Years invested', min: 5, max: 45, step: 1, value: 30, unit: 'years' }, { name: 'rate', label: 'Annual return', min: 0, max: 12, step: 0.5, value: 5, format: 'percent' }],
      outputs: [{ name: 'balance', label: 'Balance', formula: 'fv(rate / 1200, years * 12, monthly)', format: 'currency' }, { name: 'paid', label: 'You paid in', formula: 'monthly * 12 * years', format: 'currency' }],
      parts: [{ label: 'Contributions', formula: 'paid' }, { label: 'Growth', formula: 'balance - paid' }]
    } }] };
    window.requests = [];
    window.result = await render(spec, document.querySelector('[data-ir-output]'), { onActionRequest: request => window.requests.push(request) });
  });
  const output = page.locator('[data-ir-output]');
  await expect(output.locator('.calculator-result-value')).toHaveText(['$416,129', '$180,000']);
  await expect(output.locator('.calculator-parts .breakdown-share')).toHaveText(['43', '57']);
  await expect(output.locator('.calculator-input-value').nth(1)).toHaveText('30 years');
  const years = output.locator('.calculator-input input[type=range]').nth(1);
  await years.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(output.locator('.calculator-input-value').nth(1)).toHaveText('29 years');
  await expect(output.locator('.calculator-result-value').nth(1)).toHaveText('$174,000');
  expect(await page.evaluate(() => window.result.diagnostics)).toEqual([]);
  expect(await page.evaluate(() => window.requests.at(-1))).toMatchObject({ component: 'calculator', action: 'adjust', id: 'savings', index: 1, values: { value: 29 }, consequential: false });
});

test('checklists and selectable cards report what a person chose, and media cards load only host images', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  const diagnostics = await page.evaluate(async () => {
    const { render } = await import('/ir.js');
    window.requests = [];
    const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const spec = { type: 'screen', children: [
      { id: 'launch', component: 'syntari.checklist', props: { title: 'Launch', items: [{ title: 'Freeze', done: true }, { title: 'Migrate' }] } },
      { id: 'plan', component: 'syntari.selectable-cards', props: { question: 'Which plan?', options: [{ title: 'Business', selected: true }, { title: 'Enterprise' }] } },
      { component: 'syntari.media-cards', props: { items: [{ title: 'Hosted', image: 'hosted', alt: 'A server rack' }, { title: 'Invented', image: 'https://example.com/x.png' }, { title: 'Unsafe', image: 'unsafe' }] } }
    ] };
    const result = await render(spec, document.querySelector('[data-ir-output]'), { assets: { hosted: pixel, unsafe: 'javascript:alert(1)' }, onActionRequest: request => window.requests.push(request) });
    return result.diagnostics.map(d => `${d.severity}:${d.code}@${d.path}`);
  });
  const output = page.locator('[data-ir-output]');
  expect(await output.locator('.checklist-item input').evaluateAll(boxes => boxes.map(box => box.checked))).toEqual([true, false]);
  await output.locator('.checklist-item').nth(1).click();
  await output.locator('.selectable-cards label').nth(1).click();
  await expect.poll(() => page.evaluate(() => window.requests.length)).toBe(2);
  const requests = await page.evaluate(() => window.requests);
  expect(requests[0]).toMatchObject({ component: 'checklist', action: 'check', id: 'launch', index: 1, values: { checked: true }, consequential: false });
  expect(requests[1]).toMatchObject({ component: 'selectable-cards', action: 'select', id: 'plan', index: 1, values: { checked: true } });
  const images = await output.locator('.media-card-image').evaluateAll(nodes => nodes.map(node => ({ hidden: node.hidden, src: node.getAttribute('src'), alt: node.alt })));
  expect(images[0]).toMatchObject({ hidden: false, alt: 'A server rack' });
  expect(images[0].src).toMatch(/^data:image\/png/);
  expect(images.slice(1).every(image => image.hidden && !image.src)).toBe(true);
  expect(diagnostics.filter(code => code.startsWith('warning:unknown-asset'))).toHaveLength(2);
});

test('validation explains broken sections, formulas, shares, and ranges', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  const report = await page.evaluate(async () => {
    const { validate } = await import('/ir.js');
    const codesFor = async (child, options) => (await validate({ type: 'screen', children: [child] }, options)).diagnostics.map(d => `${d.severity}:${d.code}`);
    const calculator = (inputs, outputs) => ({ id: 'cost', component: 'syntari.calculator', props: { title: 'Cost', inputs, outputs } });
    const seats = { name: 'seats', label: 'Seats', min: 1, max: 100, step: 1, value: 10 };
    return {
      sectionNoHeading: await codesFor({ type: 'section', children: [] }),
      sectionLayout: await codesFor({ type: 'section', heading: 'Plan', layout: 'carousel', children: [] }),
      shares: await codesFor({ component: 'syntari.breakdown', props: { title: 'Invoice', segments: [{ label: 'Seats', share: 70 }, { label: 'API', share: 20 }] } }),
      code: await codesFor(calculator([seats], [{ name: 'cost', label: 'Cost', formula: 'seats * fetch(1)' }])),
      unknownName: await codesFor(calculator([seats], [{ name: 'cost', label: 'Cost', formula: 'seats * price' }])),
      laterName: await codesFor(calculator([seats], [{ name: 'cost', label: 'Cost', formula: 'total / 2' }, { name: 'total', label: 'Total', formula: 'seats * 4' }])),
      range: await codesFor(calculator([{ ...seats, value: 200 }], [{ name: 'cost', label: 'Cost', formula: 'seats' }])),
      offStep: await codesFor(calculator([{ ...seats, step: 5, value: 12 }], [{ name: 'cost', label: 'Cost', formula: 'seats' }])),
      sandboxBounds: await codesFor({ type: 'sandbox', label: 'Doors', html: '<p>x</p>', height: 4000 }, { sandbox: true })
    };
  });
  expect(report.sectionNoHeading).toContain('error:invalid-section');
  expect(report.sectionLayout).toEqual(['warning:unknown-layout']);
  expect(report.shares).toContain('error:wrong-sum');
  expect(report.code).toContain('error:invalid-formula');
  expect(report.unknownName).toContain('error:unknown-name');
  expect(report.laterName).toContain('error:unknown-name');
  expect(report.range).toContain('error:invalid-range');
  expect(report.offStep).toEqual(['warning:off-step']);
  expect(report.sandboxBounds).toContain('error:above-maximum');
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

test('every render contract sample paints without errors, fallbacks, or demo copy', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  const rows = await page.evaluate(async () => {
    const { render, renderableSlugs, registry } = await import('/ir.js');
    const reg = await registry();
    const stage = document.querySelector('[data-ir-output]');
    const out = [];
    for (const slug of await renderableSlugs()) {
      const manifest = await reg.manifest(slug);
      /* The full sample, then only its required props: optional props left out must not reveal demo copy. */
      const required = Object.fromEntries(Object.entries(manifest.sample.props).filter(([key]) => manifest.props[key]?.required));
      for (const props of [manifest.sample.props, required]) {
        const result = await render({ type: 'screen', children: [{ component: `syntari.${slug}`, props }] }, stage);
        const text = result.element.textContent;
        const errors = result.diagnostics.filter(d => d.severity === 'error').map(d => `${d.severity}:${d.code}`);
        out.push({ slug, errors, fallback: result.element.querySelectorAll('.ir-fallback').length, undefinedText: text.includes('undefined'), demoCopy: /Local (preview|demonstration|sample)|nothing is sent|in this preview/i.test(text) });
        result.destroy();
      }
    }
    return out;
  });
  expect(rows).toHaveLength(118);
  for (const row of rows) expect(row, row.slug).toEqual({ slug: row.slug, errors: [], fallback: 0, undefinedText: false, demoCopy: false });
});

/* What a person sees when an agent sends only the required props. Any template copy that surfaces shows up as a diff
   against this reviewed record. After an intended change, regenerate it with UPDATE_FIXTURES=1 and review the diff. */
test('required-only renders show the props and the component chrome, nothing else', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  const texts = await page.evaluate(async () => {
    const { render, renderableSlugs, registry } = await import('/ir.js');
    const reg = await registry();
    const stage = document.querySelector('[data-ir-output]');
    const out = {};
    for (const slug of await renderableSlugs()) {
      const manifest = await reg.manifest(slug);
      const required = Object.fromEntries(Object.entries(manifest.sample.props).filter(([key]) => manifest.props[key]?.required));
      const result = await render({ type: 'screen', children: [{ component: `syntari.${slug}`, props: required }] }, stage);
      out[slug] = result.element.querySelector('[data-syntari-contract]').innerText.replace(/\s+/g, ' ').trim();
      result.destroy();
    }
    return out;
  });
  const fixture = new URL('./fixtures/required-only-text.json', import.meta.url);
  if (process.env.UPDATE_FIXTURES) await writeFile(fixture, `${JSON.stringify(texts, null, 2)}\n`);
  expect(texts).toEqual(JSON.parse(await readFile(fixture, 'utf8')));
});

test('a row of equal cards never leaves one card alone at any width', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  const stat = n => Array.from({ length: n }, (_, i) => ({ label: `Measure ${i + 1}`, value: String(i + 1) }));
  const rows = await page.evaluate(async ({ stats }) => {
    const { render } = await import('/ir.js');
    const target = document.querySelector('[data-ir-output]');
    const found = [];
    for (const width of [330, 420, 560, 616, 680, 760, 900, 1000]) {
      for (const n of [3, 4, 5, 6]) {
        target.style.width = `${width}px`;
        await render({ type: 'screen', children: [{ component: 'syntari.stat-row', props: { stats: stats[n] } }, { component: 'syntari.selectable-cards', props: { question: 'Pick one', options: stats[3].map(s => ({ title: s.label })) } }] }, target, {});
        for (const [grid, item] of [['.stat-row', '.stat-card'], ['.selectable-cards', 'label']]) {
          const box = target.querySelector(grid);
          const cards = [...box.querySelectorAll(`:scope > ${item}`)];
          const tops = [...new Set(cards.map(card => Math.round(card.getBoundingClientRect().top)))];
          const last = cards.filter(card => Math.round(card.getBoundingClientRect().top) === tops.at(-1));
          if (tops.length > 1 && last.length === 1 && last[0].getBoundingClientRect().width < box.clientWidth * 0.75) found.push(`${grid} ${cards.length} at ${width}px`);
        }
      }
    }
    target.style.width = '';
    return found;
  }, { stats: { 3: stat(3), 4: stat(4), 5: stat(5), 6: stat(6) } });
  expect(rows).toEqual([]);
});
