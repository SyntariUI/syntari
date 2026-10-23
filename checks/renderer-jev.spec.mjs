import { test, expect } from '@playwright/test';
import { serveRenderer, openRenderer, script, prompts, ask, settled, screenIR, openExample, nodesById } from './renderer-harness.mjs';

/*
 * Jev and Claude on one request: what needs no model is decided by Jev and applied in milliseconds, through the same validated
 * operations; what needs writing goes to Claude as a brief, with the part, the field, the place, and the data Jev decided, and
 * a prompt cut to that task. A part two names could mean is the person's choice.
 */
serveRenderer(test);

test('Jev removes, moves, and renames a part without calling Claude, and Undo brings it back', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await openExample(p, 'wealth');
  const before = await screenIR(p);
  await ask(p, 'Remove the positions table');
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v2 .*Jev · change, no model call/);
  await expect(p.locator('.canvas [data-ir-id=holdings]')).toHaveCount(0);
  await expect(p.locator('[data-changes] .change-card').first()).toContainText(/Applied · v1 → v2 · Jev, no model call, [\d.]+ ms/);
  await p.locator('[data-tab=activity]').click();
  await expect(p.locator('[data-activity]')).toContainText('Jev decided this without a model');

  await ask(p, 'Move the risk chart before the return line');
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v3 /);
  const order = await p.$$eval('.canvas > .ir-screen > [data-ir-id]', nodes => nodes.map(node => node.dataset.irId));
  expect(order.indexOf('risk-vs-weight')).toBe(order.indexOf('performance') - 1);

  await ask(p, 'Rename the risk chart to "Risk comes from equities"');
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v4 /);
  await expect(p.locator('.canvas [data-ir-id=risk-vs-weight]')).toContainText('Risk comes from equities');

  expect(await prompts(p)).toEqual([]);
  for (let i = 0; i < 3; i++) await p.locator('[data-undo]').click();
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v1 /);
  expect(await screenIR(p)).toEqual(before);
  expect(errors).toEqual([]);
});

test('a part two names could mean is the person’s choice; Jev changes the one they choose, with no model call', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await openExample(p, 'wealth');
  await ask(p, 'Remove the bar chart');
  await expect(p.locator('[data-confirm]')).toBeVisible();
  await expect(p.locator('[data-confirm-text]')).toHaveText('Which part did you mean by “the bar chart”?');
  await expect(p.locator('[data-confirm-actions] button')).toHaveText(['Liquidity ladder', 'Weight against risk contribution', 'Rewrite my request']);
  await p.locator('[data-confirm-actions] button', { hasText: 'Weight against risk contribution' }).click();
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v2 .*Jev · change, no model call/);
  await expect(p.locator('.canvas [data-ir-id=risk-vs-weight]')).toHaveCount(0);
  await expect(p.locator('.canvas [data-ir-id=liquidity-ladder]')).toHaveCount(1);
  expect(await prompts(p)).toEqual([]);
  /* With no part to find, Claude takes the request, and Jev names the part it did find. */
  await script(p, JSON.stringify({ version: 'syntari-ops-1', base: '{{BASE}}', summary: 'Move the table', operations: [{ op: 'move', target: 'section-positions', before: 'performance' }] }));
  await ask(p, 'Move the positions table before the customer map');
  await settled(p);
  const sent = await prompts(p);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toContain('Jev found the part this request is about: #holdings');
  expect(errors).toEqual([]);
});

test('new words for a title: Jev finds the part and the field, and Claude is asked for the words alone', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await openExample(p, 'wealth');
  const before = nodesById(await screenIR(p));
  await script(p, '“Equities bring most of the risk”');
  await ask(p, 'Change the title of the risk chart so it says where the risk comes from');
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v2 .*Claude · Balanced · change, briefed by Jev/);
  const [prompt] = await prompts(p);
  expect(prompt).toContain('Answer with the new text only');
  expect(prompt).toContain('NOW: “Weight against risk contribution”');
  expect(prompt).not.toContain('COMPONENTS');
  expect(prompt.length).toBeLessThan(2500);
  const after = nodesById(await screenIR(p));
  expect(after['risk-vs-weight'].props.title).toBe('Equities bring most of the risk');
  for (const id of Object.keys(before)) if (id !== 'risk-vs-weight') expect(after[id]).toEqual(before[id]);
  await expect(p.locator('[data-changes] .change-card').first()).toContainText('Applied · v1 → v2 · Claude, briefed by Jev');
  await p.locator('[data-tab=activity]').click();
  await expect(p.locator('[data-activity]')).toContainText('Jev briefed Claude: new words for props.title of #risk-vs-weight');
  expect(errors).toEqual([]);
});

test('a change inside one part goes to Claude with that part only, and an operation outside it is refused and corrected', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await openExample(p, 'wealth');
  const before = await screenIR(p);
  const holdings = nodesById(before).holdings;
  const columns = holdings.props.columns.filter(column => column.label !== 'Risk');
  const cells = holdings.props.rows.cells.filter(cell => cell?.field !== 'risk');
  const dropRisk = { op: 'replace', target: 'holdings', set: { 'props.columns': columns, 'props.rows': { ...holdings.props.rows, cells } }, reason: 'Asked for: no risk column' };
  /* The first answer also retitles another part: outside the brief, so it is refused whole and Claude corrects it once. */
  await script(p,
    JSON.stringify({ version: 'syntari-ops-1', base: '{{BASE}}', summary: 'Drop the risk column', operations: [dropRisk, { op: 'replace', target: 'risk-vs-weight', set: { 'props.title': 'Risk' } }] }),
    JSON.stringify({ version: 'syntari-ops-1', base: '{{BASE}}', summary: 'Drop the risk column', operations: [dropRisk] }));
  await ask(p, 'Remove the risk column from the positions table');
  await settled(p);
  /* Inside the brief, the column still shows figures already on the screen: the person approves taking them away. */
  await expect(p.locator('[data-alert]')).toContainText('would modify data already on the screen');
  await p.locator('[data-alert] button', { hasText: 'Apply the data change' }).click();
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v2 /);
  const sent = await prompts(p);
  expect(sent).toHaveLength(2);
  expect(sent[0]).toContain('THE PART: #holdings');
  expect(sent[0]).toContain('syntari.table —');
  expect(sent[0]).not.toContain('syntari.line-chart —');
  expect(sent[0].length).toBeLessThan(9000);
  expect(sent[1]).toContain('outside-brief');
  const after = nodesById(await screenIR(p));
  expect(after.holdings.props.columns.map(column => column.label)).toEqual(['Asset', 'Class', 'Weight', 'Value', 'Liquidity']);
  for (const id of Object.keys(nodesById(before))) if (id !== 'holdings') expect(after[id]).toEqual(nodesById(before)[id]);
  await expect(p.locator('.canvas [data-ir-id=holdings] th')).toHaveCount(5);
  await expect(p.locator('[data-changes] .change-card').first()).toContainText('Applied · v1 → v2 · Claude, briefed by Jev');
  expect(errors).toEqual([]);
});

test('several asks in one request: Jev does its share at once, and Claude adds the new part where Jev placed it', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await openExample(p, 'wealth');
  const table = { id: 'returns-by-month', type: 'section', heading: 'Return by month', children: [{ id: 'returns-by-month-table', component: 'syntari.table', props: { caption: 'Cumulative return by month', columns: [{ label: 'Month' }, { label: 'Portfolio' }, { label: 'Benchmark' }], rows: { $data: 'tables.performance', cells: ['month', { field: 'portfolio', format: 'signed-percent' }, { field: 'benchmark', format: 'signed-percent' }] } }, provenance: { reason: 'Asked for: monthly returns' } }] };
  await script(p, JSON.stringify({ version: 'syntari-ops-1', base: '{{BASE}}', summary: 'Add the monthly returns', operations: [{ op: 'insert', parent: 'screen', after: 'performance', node: table, reason: 'Asked for: monthly returns' }] }));
  await ask(p, 'Remove the positions table and add a table of monthly returns under the return chart');
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v3 .*briefed by Jev/, { timeout: 15000 });
  const sent = await prompts(p);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatch(/^You add one new part/);
  expect(sent[0]).toContain('after #performance in the screen');
  expect(sent[0]).toContain('The data it shows: tables.performance');
  expect(sent[0], 'the table Jev removed is no longer in the outline Claude gets').not.toContain('- #section-positions');
  const after = await screenIR(p);
  expect(after.children.map(node => node.id)).toEqual(['summary-kpis', 'performance', 'returns-by-month', 'section-structure', 'risk-vs-weight']);
  await expect(p.locator('.canvas [data-ir-id=returns-by-month-table] tbody tr')).toHaveCount(9);
  await p.locator('[data-tab=activity]').click();
  await expect(p.locator('[data-activity]')).toContainText('Jev did its share of the request without a model');
  await expect(p.locator('[data-activity]')).toContainText('Claude takes the rest of the request');
  /* Each share is its own version: Undo takes back Claude's part first, then Jev's. */
  await p.locator('[data-undo]').click();
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v2 /);
  expect((await screenIR(p)).children.map(node => node.id)).not.toContain('section-positions');
  expect(errors).toEqual([]);
});
