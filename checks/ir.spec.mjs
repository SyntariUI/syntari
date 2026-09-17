import { test, expect } from '@playwright/test';
const origin = 'http://127.0.0.1:4318';

/** label, screen title, and how many nodes the registry cannot draw for this situation. */
const situations = [
  ['Production migration', 'A migration needs your decision', 0],
  ['Review finished work', 'Three pages are ready for review', 0],
  ['Incident in progress', 'Checkout is slow for some users', 0],
  ['Weekly report', 'What changed this week', 0],
  ['A choice, not a yes/no', 'Choose how this account is billed', 0],
  ['Nothing found', 'No invoices matched those filters', 0],
  ['Unsupported request', 'Repair, do not guess', 2]
];

test('a situation renders as a screen, not a paragraph of chat', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/generative-ui.html`);
  const output = page.locator('[data-ir-output]');
  await output.locator('.ir-screen').waitFor();
  await expect(output.locator('.ir-screen-title')).toHaveText('A migration needs your decision');
  await expect(output.locator('[data-ir-component]')).toHaveCount(4);
  await expect(output.locator('.ir-fallback')).toHaveCount(0);
  await expect(output.locator('.banner > div')).toContainText('All checks passed');
  await expect(output.locator('.agent-surface > p').first()).toContainText('Apply three schema changes');
  await expect(output.locator('.agent-footer [data-agent-action=approve]')).toContainText('Run migration');
  await expect(output.locator('.metadata-list > div')).toHaveCount(3);
  await expect(output.locator('.activity-item')).toHaveCount(4);
  await expect(output.locator('.activity-item time').first()).toHaveText('2m ago');
  const region = output.locator('.ir-region');
  await expect(region).toHaveCount(1);
  await expect(region.locator('summary')).toHaveText('Evidence · 4 checks');
  await expect(output.locator('.ir-region-body .activity-item').first()).toBeHidden();
  await region.locator('summary').click();
  await expect(output.locator('.ir-region-body .activity-item').first()).toBeVisible();
  await expect(page.locator('[data-ir-intent]')).toContainText('cannot be undone');
  await expect(page.locator('[data-ir-does]')).toContainText('blast radius');
  await expect(page.locator('[data-ir-diagnostics] .ir-clean')).toBeVisible();
  expect(errors).toEqual([]);
});

test('every situation explains itself and only the invented component is refused', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  const output = page.locator('[data-ir-output]');
  await output.locator('.ir-screen').waitFor();
  for (const [label, title, fallbacks] of situations) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(output.locator('.ir-screen-title')).toHaveText(title);
    await expect(page.locator('[data-ir-intent]')).not.toBeEmpty();
    await expect(page.locator('[data-ir-does]')).not.toBeEmpty();
    await expect(output.locator('.ir-fallback')).toHaveCount(fallbacks);
    expect(await page.locator('[data-ir-diagnostics] li[data-severity=error]').count(), `${label} raised errors`).toBe(fallbacks);
  }
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
    ['streaming-response', { author: 'Agent', text: 'Streamed body', status: 'Idle' }, ['Agent', 'Streamed body', 'Idle', 'Generate response']]
  ];
  const results = await page.evaluate(async list => {
    const { render } = await import('/ir.js');
    const stage = document.querySelector('[data-ir-output]');
    const rows = [];
    for (const [slug, props, expected] of list) {
      const spec = { type: 'screen', layout: 'stack', children: [{ component: `syntari.${slug}`, props }] };
      const result = await render(spec, stage);
      const text = result.element.textContent.replace(/\s+/g, ' ');
      const row = {
        slug,
        missing: expected.filter(value => !text.includes(value)),
        diagnostics: result.diagnostics.filter(diagnostic => diagnostic.severity === 'error').map(diagnostic => diagnostic.code),
        bars: result.element.querySelectorAll('.bar-chart .bar').length,
        rows: result.element.querySelectorAll('tbody tr').length
      };
      result.destroy();
      rows.push(row);
    }
    return rows;
  }, cases);
  for (const row of results) {
    expect(row.missing, `${row.slug} did not receive its props`).toEqual([]);
    expect(row.diagnostics, `${row.slug} raised errors`).toEqual([]);
  }
  expect(results.find(row => row.slug === 'metric-and-sparkline').bars).toBe(2);
  expect(results.find(row => row.slug === 'table').rows).toBe(1);
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
      regionNests: await codesFor(screen({ type: 'region', label: 'Evidence', children: [{ type: 'region', label: 'Deeper', children: [{ component: 'syntari.card', props: { title: 'Nested card' } }] }] }))
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
});

test('the guide documents exactly the components that carry a prop contract', async ({ page }) => {
  await page.goto(`${origin}/guides/generative-ui/`);
  const list = page.locator('.docs-guide-list a');
  await expect(list.first()).toBeVisible();
  const documented = await list.evaluateAll(links => links.map(link => link.getAttribute('href').replace(/^components\//, '').replace(/\/$/, '')).sort());
  const supported = await page.evaluate(async () => (await (await import('/ir.js')).renderableSlugs()).sort());
  expect(documented).toEqual(supported);
  expect(supported).toHaveLength(10);
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
      ['streaming-response', { author: 'Agent', text: 'Body only' }]
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
  await page.getByRole('button', { name: 'Weekly report', exact: true }).click();
  await page.waitForTimeout(1800);
  const report = await page.evaluate(() => {
    const stage = document.querySelector('[data-ir-output] [data-ir-component=metric-and-sparkline]');
    const rect = selector => stage.querySelector(selector).getBoundingClientRect();
    const chart = rect('.bar-chart');
    const labels = rect('.chart-labels');
    const stats = rect('.mini-stats');
    const bars = [...stage.querySelectorAll('.bar-chart .bar-fill')].map(bar => bar.getBoundingClientRect().height);
    return {
      labelGap: Math.round(labels.top - chart.bottom),
      chartGap: Math.round(chart.top - stats.bottom),
      tallestBar: Math.round(Math.max(...bars)),
      chartHeight: Math.round(chart.height),
      statLabels: [...stage.querySelectorAll('.stat > span')].map(span => span.textContent.trim()).join(' ')
    };
  });
  expect(report.chartGap).toBeGreaterThan(0);
  expect(report.labelGap).toBeGreaterThanOrEqual(0);
  expect(report.tallestBar).toBeLessThanOrEqual(report.chartHeight);
  expect(report.statLabels).toContain('Agent runs');
});
