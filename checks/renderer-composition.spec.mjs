import { test, expect } from '@playwright/test';
import { serveRenderer, openRenderer, openExample, script, prompts, ask, settled, screenIR, nodesById, shown } from './renderer-harness.mjs';
import { HOLDINGS } from '../tests/fixtures/portfolio.mjs';

/*
 * Regression scenarios A–G for the Renderer: reliable edits, malformed answers, redundant and contradictory compositions,
 * a global recomposition that keeps every fact, a small scoped edit, and a visualization the registry does not have.
 * The portfolio screens are the bundled "Portfolio review" (the screen that failed review) and "Portfolio dashboard".
 */
serveRenderer(test);

const ops = (operations, extra = {}) => JSON.stringify({ version: 'syntari-ops-1', base: '{{BASE}}', ...extra, operations });
const perfTable = { id: 'performance-table', type: 'section', heading: 'Rentabilidad por mes', children: [{ id: 'performance-by-month', component: 'syntari.table', props: { caption: 'Rentabilidad acumulada por mes', columns: [{ label: 'Mes' }, { label: 'Cartera' }, { label: 'Benchmark' }], rows: { $data: 'tables.performance', cells: ['month', { field: 'portfolio', format: 'signed-percent' }, { field: 'benchmark', format: 'signed-percent' }] } }, provenance: { reason: 'Pedido: una tabla debajo del gráfico.' } }] };
const addPerfTable = ops([{ op: 'insert', parent: 'screen', after: 'performance', node: perfTable, reason: 'Pedido: una tabla debajo del gráfico' }], { summary: 'Añade la rentabilidad por mes bajo el gráfico' });
const riskTable = { id: 'risk-return-table', type: 'section', heading: 'Riesgo y peso por posición', children: [{ id: 'risk-by-position', component: 'syntari.table', props: { caption: 'Contribución al riesgo frente al peso, por posición', sortable: true, columns: [{ label: 'Activo' }, { label: 'Peso' }, { label: 'Riesgo' }], rows: { $data: 'tables.holdings', sort: { by: 'risk', dir: 'desc' }, cells: ['asset', { field: 'weight', format: 'percent' }, { field: 'risk', format: 'percent' }] } }, provenance: { reason: 'Sustituye al gráfico de dispersión que no existe.' } }] };
const holdingsRows = HOLDINGS.map(({ value, ...row }) => row);
/* The recomposition of the failed portfolio screen: its rows move into screen data, and every figure is bound to them. */
const recomposed = (rows = holdingsRows) => JSON.stringify({
  version: 'syntari-ir-1', type: 'screen',
  meta: { job: 'Revisar la cartera del trimestre', audience: 'Gestor patrimonial', decision: 'none',
    outline: [{ node: 'stat-row' }, { section: 'Dónde está el dinero y cuándo se puede mover', layout: 'two-column', nodes: ['breakdown', 'chart-bars'] }, { node: 'chart-bars' }, { section: 'Posiciones', layout: 'stack', nodes: ['table'] }],
    plan: { pattern: 'dashboard', purpose: 'Saber cuánto se puede mover y de dónde viene el riesgo.', questions: ['¿Cuánto es líquido a 30 días?', '¿De dónde viene el riesgo?'],
      groups: [{ zone: 'summary', answers: [0], data: 'measures.liquid30', role: 'kpi', component: 'stat-row', why: 'Tres medidas con su contexto.' }, { zone: 'primary', answers: [0], data: 'groups.liquidity', role: 'ordered-distribution', component: 'chart-bars', why: 'Buckets ordenados por plazo.' }, { zone: 'supporting', answers: [1], data: 'groups.riskVsWeight', role: 'category-comparison', component: 'chart-bars', why: 'Peso frente a riesgo en una escala.' }, { zone: 'details', answers: [0, 1], data: 'tables.holdings', role: 'records', component: 'table', why: 'Cada posición, ordenable.' }],
      alternatives: [{ option: 'breakdown para la liquidez', rejected: 'Una sola barra pierde el orden de los plazos.' }],
      rationale: 'Corrige la liquidez D0–D30: las posiciones suman 48 %, no 38 %; el riesgo se compara con el peso.' } },
  data: { mode: 'demo', currency: 'EUR', locale: 'es-ES',
    tables: { holdings: { label: 'Posiciones', key: 'asset', fields: { asset: { type: 'text', label: 'Activo' }, assetClass: { type: 'category', label: 'Clase', order: ['Liquidez', 'Renta fija', 'Renta variable', 'Alternativos'] }, weight: { type: 'percent', label: 'Peso', total: 100, role: 'allocation' }, liquidityDays: { type: 'days', label: 'Liquidez', role: 'liquidity' }, risk: { type: 'percent', label: 'Riesgo', total: 100, role: 'risk-contribution' } }, rows } },
    measures: { liquid30: { label: 'Liquidez D0–D30', sum: 'holdings.weight', where: { liquidityDays: { max: 30 } }, format: 'percent', digits: 0 } },
    groups: { allocation: { label: 'Asignación', table: 'holdings', by: 'assetClass', value: 'weight' }, liquidity: { label: 'Escalera de liquidez', table: 'holdings', by: 'liquidityDays', value: 'weight', buckets: [{ label: 'D0', max: 0 }, { label: 'D1–7', max: 7 }, { label: 'D8–30', max: 30 }, { label: 'D31–90', max: 90 }, { label: '>D90' }] }, riskVsWeight: { label: 'Peso frente a riesgo', table: 'holdings', by: 'assetClass', values: ['weight', 'risk'] } } },
  title: 'La cartera Ortega tiene un 48 % disponible a 30 días, y la renta variable concentra el riesgo', layout: 'stack',
  children: [
    { id: 'summary-kpis', component: 'syntari.stat-row', props: { stats: [{ label: 'Patrimonio', value: '10 M€', note: 'A 30 de septiembre', tone: 'neutral' }, { label: 'Rentabilidad YTD', value: '+3,6 %', badge: '+0,9 pp', note: 'Frente al benchmark' }, { label: 'Liquidez D0–D30', value: { $data: 'measures.liquid30' }, note: 'Calculada de las posiciones', tone: 'neutral' }] }, provenance: { reason: 'El resumen.' } },
    { id: 'section-structure', type: 'section', heading: 'Dónde está el dinero y cuándo se puede mover', layout: 'two-column', children: [
      { id: 'allocation', component: 'syntari.breakdown', props: { title: 'Asignación por clase de activo', segments: { $data: 'groups.allocation', map: { label: 'label', share: 'share', value: { field: 'value', format: 'percent', digits: 0 } } } }, provenance: { reason: 'Partes de un todo.' } },
      { id: 'liquidity-ladder', component: 'syntari.chart-bars', props: { title: 'Escalera de liquidez', orientation: 'vertical', unit: '%', seriesA: 'Peso', chartLabel: 'Peso por plazo: D0 6 %, D1–7 30 %, D8–30 12 %, D31–90 31 %, más de 90 días 21 %.', columns: { $data: 'groups.liquidity', map: { label: 'label', a: 'value' } } }, provenance: { reason: 'Buckets en su orden.' } }
    ] },
    { id: 'risk-vs-weight', component: 'syntari.chart-bars', props: { title: 'Peso frente a contribución al riesgo', unit: '%', seriesA: 'Peso', seriesB: 'Riesgo', chartLabel: 'La renta variable pesa un 27 % y aporta el 52 % del riesgo.', columns: { $data: 'groups.riskVsWeight', map: { label: 'label', a: 'weight', b: 'risk' } } }, provenance: { reason: 'El riesgo frente al peso.' } },
    { id: 'section-positions', type: 'section', heading: 'Posiciones', children: [
      { id: 'holdings', component: 'syntari.table', props: { caption: 'Posiciones de la cartera', sortable: true, columns: [{ label: 'Activo' }, { label: 'Clase' }, { label: 'Peso' }, { label: 'Liquidez' }, { label: 'Riesgo' }], rows: { $data: 'tables.holdings', sort: { by: 'weight', dir: 'desc' }, cells: ['asset', 'assetClass', { field: 'weight', format: 'percent' }, { field: 'liquidityDays', format: 'days' }, { field: 'risk', format: 'percent' }] } }, provenance: { reason: 'El detalle.' } }
    ] }
  ]
});
const screensCount = p => p.evaluate(() => document.querySelectorAll('[data-screens] button[data-screen]').length);
const activeTitle = p => p.locator('[data-context-title]').textContent();
async function rawLog(p) {
  await p.locator('[data-tab=activity]').click();
  await p.locator('[data-raw-panel] > summary').click();
  return p.locator('[data-raw-log] > li').allInnerTexts();
}

/* A — a valid edit to an existing dashboard is a new version of the same screen, never a new artifact. */
test('A. an edit applies to the active dashboard through the submit_change tool, corrected once when it is refused', async ({ page: p }) => {
  const errors = await openRenderer(p, { tools: true });
  await openExample(p, 'wealth');
  const title = await activeTitle(p), screens = await screensCount(p), before = await screenIR(p);
  /* First submission names an older version; Syntari hands back the problem, and the second one is accepted. */
  await script(p, { text: addPerfTable, base: 'sv-00000000' }, addPerfTable);
  await ask(p, 'Añade una tabla de rentabilidad mensual debajo del gráfico');
  await settled(p);
  expect((await prompts(p)).at(-1)).toContain('submit_change');
  const calls = await p.evaluate(() => ({ calls: window.__claude.toolCalls.length, first: window.__claude.toolResults[0] }));
  expect(calls.calls).toBe(2);
  expect(calls.first.accepted).toBe(false);
  expect(calls.first.problems.map(item => item.code)).toContain('stale-base');
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v2 /);
  expect(await activeTitle(p)).toBe(title);
  expect(await screensCount(p)).toBe(screens);
  const after = await screenIR(p);
  expect(after.data).toEqual(before.data);
  await expect(p.locator('.canvas [data-ir-id=performance-by-month] tbody tr')).toHaveCount(9);
  await expect(p.locator('[data-changes] .change-card').first()).toContainText('Applied · v1 → v2 · after one correction');
  expect((await rawLog(p)).join('\n')).toMatch(/Change · corrected tool call[\s\S]*valid|valid[\s\S]*Change · corrected tool call/);
  expect(errors).toEqual([]);
});

/* B — the failure that started this: a valid JSON object followed by more. Recovered once, never half applied. */
test('B. an answer with a second JSON value is corrected once; a second bad answer leaves the screen exactly as it was', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await openExample(p, 'wealth');
  const before = await screenIR(p), html = await p.locator('.canvas').innerHTML();
  /* The shape of the original error: one object, a blank line, then a second value at line 3, column 1. */
  const twice = `${addPerfTable}\n\n${JSON.stringify({ version: 'syntari-ops-1', base: '{{BASE}}', summary: 'Otra propuesta', operations: [{ op: 'remove', target: 'holdings' }] })}`;
  await script(p, twice, twice);
  await ask(p, 'Añade una tabla de rentabilidad mensual debajo del gráfico');
  await settled(p);
  const sent = await prompts(p);
  expect(sent.at(-1)).toContain('COULD NOT BE READ AS ONE CHANGE');
  expect(sent.at(-1)).toContain('second JSON value');
  expect(await screenIR(p)).toEqual(before);
  expect(await p.locator('.canvas').innerHTML()).toBe(html);
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v1 /);
  await expect(p.locator('[data-alert]')).toContainText('Syntari couldn’t apply this change. Your screen is unchanged (v1).');
  await expect(p.locator('[data-alert]')).toContainText('wasn’t a single readable change');
  await expect(p.locator('[data-alert]')).not.toContainText(/JSON|Screen IR/);
  const raw = await rawLog(p);
  expect(raw.length).toBe(2);
  expect(raw.join('\n')).toContain('second value, unreadable');
  /* The same answer once, then a readable one: the correction applies. */
  await script(p, twice, addPerfTable);
  await p.locator('[data-alert] button', { hasText: 'Try again' }).click();
  await settled(p);
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v2 /);
  await expect(p.locator('[data-changes] .change-card').first()).toContainText('after one correction');
  /* Prose after one complete change is not ambiguous: it is read, noted, and applied without another call. */
  const calls = (await prompts(p)).length;
  await script(p, `${ops([{ op: 'replace', target: 'performance-table', set: { heading: 'Rentabilidad mes a mes' } }])}\n\nHe cambiado el título de la tabla.`);
  await ask(p, 'Cambia el título de la nueva tabla');
  await settled(p);
  expect((await prompts(p)).length).toBe(calls + 1);
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v3 /);
  await p.locator('[data-tab=activity]').click();
  await expect(p.locator('[data-activity]')).toContainText('Claude wrote text after the JSON; Syntari ignored it.');
  expect(errors).toEqual([]);
});

/* C — the same information in several charts that only look different. */
test('C. the composition review finds relabeled, repeated, and monotone visualizations on the failed portfolio', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await openExample(p, 'portfolio');
  await p.locator('[data-tab=plan]').click();
  const plan = p.locator('[data-plan]');
  await expect(plan).toContainText('Dashboard');
  await expect(plan).toContainText('No repeated information: concern');
  await expect(plan).toContainText('identical numbers under different meanings');
  await expect(plan).toContainText('parts use breakdown for different kinds of data');
  await expect(plan).toContainText('appears in 2 blocks of numbers');
  await expect(plan).toContainText('Weak fit for its data');
  await p.locator('[data-tab=validation]').click();
  await expect(p.locator('[data-issues]')).toContainText('Visualization semantics');
  await expect(p.locator('[data-issues]')).toContainText('relabeled-data');
  /* The bound dashboard shows the same portfolio with distinct questions for each chart: nothing to flag. */
  await openExample(p, 'wealth');
  await p.locator('[data-tab=plan]').click();
  await expect(plan).toContainText('No repeated information: meets');
  await expect(plan).toContainText('Semantic fit: meets');
  expect(errors).toEqual([]);
});

/* D — asset-level liquidity that does not match the headline or the bucket chart. */
test('D. figures that contradict the holdings are caught: inferred on a written screen, refused on a bound one', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await openExample(p, 'portfolio');
  await p.locator('[data-tab=validation]').click();
  const issues = p.locator('[data-issues]');
  await expect(issues).toContainText('Data integrity');
  await expect(issues).toContainText('“Liquidez D0–D30” shows 38%, but the Peso column of the table on this screen adds up to 48%');
  await expect(issues).toContainText('“D8–30” shows 2%, but the Peso column of the table on this screen adds up to 12%');
  /* On the bound dashboard, writing the old 38% by hand is a hard error: the part is not painted. */
  await openExample(p, 'wealth');
  const ir = await screenIR(p);
  ir.children.find(node => node.id === 'summary-kpis').props.stats[2].value = '38 %';
  await p.locator('[data-tab=ir]').click();
  await p.locator('[data-ir-text]').fill(JSON.stringify(ir));
  await p.locator('[data-apply]').click();
  await expect(p.locator('.canvas [data-ir-status=fallback]')).toHaveCount(1);
  await expect(p.locator('.canvas .ir-fallback')).toContainText('couldn’t be shown');
  await p.locator('[data-tab=validation]').click();
  await expect(issues).toContainText('shows 38%, but the screen data gives 48%');
  expect(errors).toEqual([]);
});

/* E — "mejora la visualización y la jerarquía de toda la data": a real recomposition that keeps every fact. */
test('E. a global improvement recomposes the screen from its own data, resolves its contradictions, and can be undone', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await openExample(p, 'portfolio');
  const before = await screenIR(p);
  await p.locator('[data-trigger]').click();
  await p.locator('[data-prompt]').fill('mejora la visualización y la jerarquía de toda la data');
  await expect(p.locator('[data-composer-context] .mode-chip')).toHaveText(/^Recompose · .* · data kept$/);
  await script(p, { text: recomposed(), chunk: 400 });
  await p.locator('[data-generate]').click();
  await settled(p);
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v2 /);
  const after = await screenIR(p);
  expect(after.data.tables.holdings.rows).toHaveLength(10);
  expect(after.data.tables.holdings.rows.map(row => row.asset)).toEqual(before.children.find(n => n.id === 'section-posiciones').children[0].props.rows.map(row => row[0]));
  expect(Object.keys(nodesById(after))).not.toEqual(Object.keys(nodesById(before)));
  await expect(p.locator('.canvas [data-ir-id=summary-kpis]')).toContainText('48 %');
  await expect(p.locator('.canvas [data-ir-id=liquidity-ladder] .chart-column')).toHaveCount(5);
  await expect(p.locator('.canvas [data-ir-component=breakdown]')).toHaveCount(1);
  const card = p.locator('[data-changes] .change-card').first();
  await expect(card).toContainText('Recomposed · v1 → v2');
  await expect(card).toContainText('All 10 records kept');
  await expect(card).toContainText('No new figures');
  await expect(card).toContainText('resolved');
  await expect(card).toContainText('Semantic fit');
  /* Compare shows v1 in place, then returns; Undo restores v1 exactly. */
  await card.locator('button', { hasText: 'Compare with v1' }).click();
  await expect(p.locator('[data-compare]')).toBeVisible();
  await expect(p.locator('[data-compare-text]')).toContainText('Showing v1');
  expect(await screenIR(p)).toEqual(before);
  await p.locator('[data-compare-back]').click();
  await expect(p.locator('[data-compare]')).toBeHidden();
  await expect(p.locator('.canvas [data-ir-id=summary-kpis]')).toContainText('48 %');
  await p.locator('[data-undo]').click();
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v1 /);
  expect(await screenIR(p)).toEqual(before);
  expect(errors).toEqual([]);
});

test('E. a recomposition that drops a record is refused, corrected once, and the screen comes back exactly', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await openExample(p, 'portfolio');
  const before = await screenIR(p), html = await p.locator('.canvas').innerHTML();
  /* Nine rows instead of ten, so the weights no longer add up either: refused twice. */
  const short = holdingsRows.slice(0, 9);
  await script(p, { text: recomposed(short), chunk: 600 }, { text: recomposed(short), chunk: 600 });
  await ask(p, 'Rediseña la jerarquía de toda la pantalla');
  await settled(p);
  expect((await prompts(p)).at(-1)).toContain('YOUR PREVIOUS RECOMPOSITION WAS REFUSED');
  expect(await screenIR(p)).toEqual(before);
  expect(await p.locator('.canvas').innerHTML()).toBe(html);
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v1 /);
  await expect(p.locator('[data-alert]')).toContainText('Syntari couldn’t apply the recomposition. Your screen is unchanged (v1).');
  await expect(p.locator('[data-changes] .change-card').first()).toContainText('dropped-records');
  expect(errors).toEqual([]);
});

/* F — a table under a chart: nothing else moves, no figure changes, no id changes. */
test('F. a small scoped edit leaves every other part, figure, and id exactly as it was', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await openExample(p, 'wealth');
  const before = await screenIR(p), shownBefore = await shown(p);
  await script(p, addPerfTable);
  await ask(p, 'Añade una tabla de rentabilidad mensual debajo del gráfico');
  await settled(p);
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v2 /);
  const after = await screenIR(p), shownAfter = await shown(p);
  const old = nodesById(before), now = nodesById(after);
  expect(Object.keys(now).filter(id => !old[id])).toEqual(['performance-table', 'performance-by-month']);
  for (const id of Object.keys(old)) expect(now[id]).toEqual(old[id]);
  expect(after.data).toEqual(before.data);
  for (const [id, text] of Object.entries(shownBefore)) expect(shownAfter[id]).toBe(text);
  const order = await p.$$eval('.canvas > .ir-screen > [data-ir-id]', nodes => nodes.map(node => node.dataset.irId));
  expect(order.indexOf('performance-table')).toBe(order.indexOf('performance') + 1);
  await expect(p.locator('[data-changes] .proof')).toContainText('Everything else identical');
  expect(errors).toEqual([]);
});

/* G — a visualization Syntari does not have is named, never imitated with another component. */
test('G. a scatter plot is reported as missing, and the person chooses what to show instead', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await openExample(p, 'wealth');
  const before = await screenIR(p), calls = (await prompts(p)).length;
  await ask(p, 'Añade un gráfico de dispersión de riesgo frente a rentabilidad');
  await expect(p.locator('[data-confirm]')).toBeVisible();
  await expect(p.locator('[data-confirm-text]')).toContainText('Syntari has no scatter plot');
  await expect(p.locator('[data-confirm-text]')).toContainText('won’t draw one with another chart');
  expect((await prompts(p)).length).toBe(calls);
  expect(await screenIR(p)).toEqual(before);
  await script(p, ops([{ op: 'insert', parent: 'screen', after: 'risk-vs-weight', node: riskTable }], { summary: 'Tabla de riesgo y peso en lugar del gráfico de dispersión' }));
  await p.locator('[data-confirm-actions] button', { hasText: 'Use table instead' }).click();
  await settled(p);
  const last = (await prompts(p)).at(-1);
  expect(last).toContain('CONSTRAINT FROM SYNTARI');
  expect(last).toContain('Syntari has no scatter-plot');
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v2 /);
  await expect(p.locator('.canvas [data-ir-id=risk-by-position] th button')).toHaveCount(3);
  /* A request the phrases miss reaches Claude, which may only report the gap, never substitute. */
  await script(p, JSON.stringify({ version: 'syntari-ops-1', base: '{{BASE}}', unsupported: [{ visualization: 'chord diagram', reason: 'Ningún componente dibuja flujos entre clases.', closest: ['table', 'chart-bars'] }] }));
  await ask(p, 'Añade un diagrama de cuerdas de los flujos entre clases');
  await settled(p);
  await expect(p.locator('[data-confirm-text]')).toContainText('Syntari has no chord diagram');
  await expect(p.locator('[data-confirm-actions] button', { hasText: 'Use chart bars instead' })).toBeVisible();
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v2 /);
  expect(errors).toEqual([]);
});

test('the Plan tab exposes the decision trace and the data the runtime computed', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await openExample(p, 'wealth');
  await p.locator('[data-tab=plan]').click();
  const plan = p.locator('[data-plan]');
  await expect(plan).toContainText('Questions it answers');
  await expect(plan).toContainText('¿Cuánto es líquido a 30 días?');
  await expect(plan).toContainText('Line chart');
  await expect(plan).toContainText('Actual against a benchmark over time');
  await expect(plan).toContainText('measures.liquid30');
  await expect(plan).toContainText('48 %');
  /* The sortable table sorts by a column of figures, largest first, and back. */
  const firstCell = () => p.locator('.canvas [data-ir-id=holdings] tbody tr:first-child td:first-child').textContent();
  expect(await firstCell()).toBe('ETF MSCI World');
  await p.locator('.canvas [data-ir-id=holdings] th button', { hasText: 'Liquidez' }).click();
  expect(await firstCell()).toBe('Private equity Fund III');
  await expect(p.locator('.canvas [data-ir-id=holdings] th[aria-sort=descending]')).toHaveCount(1);
  expect(errors).toEqual([]);
});
