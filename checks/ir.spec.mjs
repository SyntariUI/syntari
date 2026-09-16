import { test, expect } from '@playwright/test';
const origin = 'http://127.0.0.1:4318';

test('an agent-authored screen renders with the published contracts', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/generative-ui.html`);
  const output = page.locator('[data-ir-output]');
  await output.locator('.ir-screen').waitFor();
  await expect(output.locator('[data-ir-component]')).toHaveCount(3);
  await expect(output.locator('.ir-fallback')).toHaveCount(0);
  await expect(output.locator('.banner > div')).toContainText('Build 4281 passed');
  await expect(output.locator('.agent-surface > p').first()).toContainText('Apply three schema changes');
  await expect(output.locator('.agent-footer [data-agent-action=approve]')).toContainText('Run migration');
  await expect(output.locator('.activity-item')).toHaveCount(3);
  await expect(output.locator('.activity-item time').first()).toHaveText('2m ago');
  await expect(page.locator('[data-ir-diagnostics] .ir-clean')).toBeVisible();
  expect(errors).toEqual([]);
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

test('an unsupported or invalid node keeps its place as a labelled fallback', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  await page.getByRole('button', { name: 'Unsupported input' }).click();
  const output = page.locator('[data-ir-output]');
  await expect(output.locator('.ir-fallback')).toHaveCount(2);
  await expect(output.locator('.ir-fallback').first()).toContainText('syntari.wizard-hat');
  await expect(output.locator('.ir-fallback').first()).toContainText('not in the Syntari registry');
  await expect(output.locator('[data-ir-component=card]')).toHaveCount(1);
  await expect(page.locator('[data-ir-summary]')).toContainText('replaced by a fallback');
  const codes = await page.locator('[data-ir-diagnostics] code').allTextContents();
  expect(codes).toEqual(expect.arrayContaining(['unknown-component', 'enum-outside-values', 'unknown-prop']));
  const severities = await page.locator('[data-ir-diagnostics] li').evaluateAll(rows => rows.map(row => row.dataset.severity));
  expect(severities).toContain('error');
  expect(severities).toContain('warning');
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
      layout: await codesFor({ type: 'screen', layout: 'carousel', children: [{ component: 'syntari.banner', props: { message: 'ok' } }] })
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
