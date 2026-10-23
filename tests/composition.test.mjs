import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateScreen, applyScreenOperations, assignIds, versionOf, diffScreens } from '../agent.mjs';
import { buildDataModel, formatData, parseFigure } from '../kit/runtime/ir.js';
import { assessComposition, unsupportedRequest, profileData } from '../kit/runtime/ir-compose.js';
import { FLAWED, CANONICAL, DATA } from './fixtures/portfolio.mjs';

const policy = JSON.parse(await readFile(new URL('../kit/runtime/registry/composition-policy.json', import.meta.url), 'utf8'));
const codes = result => result.diagnostics.filter(d => d.severity === 'error').map(d => d.code);
const findings = (result, code) => result.diagnostics.filter(d => d.code === code);
const change = (spec, operations, extra = {}) => ({ version: 'syntari-ops-1', base: versionOf(spec), summary: 'test', operations, ...extra });
const clone = value => structuredClone(value);

test('screen data computes measures, buckets with inclusive bounds, and groups from the same rows', () => {
  const model = buildDataModel(DATA);
  assert.equal(model.measures.get('liquid30').value, 48, 'D0–D30 adds every row up to and including day 30');
  assert.equal(model.measures.get('totalValue').value, 10000000);
  assert.equal(model.measures.get('excess').value, 0.9);
  const ladder = model.groups.get('liquidity').items.map(item => [item.label, item.value]);
  assert.deepEqual(ladder, [['D0', 6], ['D1–7', 30], ['D8–30', 12], ['D31–90', 31], ['>D90', 21]], 'day 30 is in D8–30 and day 90 in D31–90');
  assert.deepEqual(model.groups.get('allocation').items.map(item => item.weight), [15, 29, 27, 29]);
  assert.deepEqual(model.groups.get('riskVsWeight').items.map(item => item.risk), [0.5, 14.5, 52, 33]);
  /* A table field called "value" keeps its own sums: the primary measure's alias never overwrites it. */
  assert.deepEqual(model.groups.get('allocation').items.map(item => [item.weight, item.value, item.share]), [[15, 1500000, 15], [29, 2900000, 29], [27, 2700000, 27], [29, 2900000, 29]]);
  /* ICU versions differ on the space before € in compact Spanish currency, so spaces are not part of what is checked. */
  assert.equal(formatData(10000000, 'compact-currency', { locale: 'es-ES', currency: 'EUR', digits: 0 }).replace(/\s/g, ''), '10M€');
  assert.deepEqual(parseFigure('1.250.000 €'), { value: 1250000, unit: 'currency' });
  assert.deepEqual(parseFigure('38,5 %'), { value: 38.5, unit: 'percent' });
  assert.equal(parseFigure('12 of 40'), null);
});

test('screen data refuses totals that do not add up, rows in the wrong bucket, and unknown references', async () => {
  const data = clone(DATA);
  data.tables.holdings.rows[0].weight = 10;
  data.tables.holdings.fields.bucket = { type: 'category' };
  data.tables.holdings.rows.forEach(row => { row.bucket = row.liquidityDays === 30 ? 'D31–90' : row.liquidityDays === 0 ? 'D0' : row.liquidityDays <= 7 ? 'D1–7' : row.liquidityDays <= 90 ? 'D31–90' : '>D90'; });
  data.groups.liquidity.labelField = 'bucket';
  data.measures.broken = { label: 'Broken', sum: 'holdings.nothing' };
  const result = await validateScreen({ ...clone(CANONICAL), data });
  assert.ok(findings(result, 'data-total').some(d => /add up to 104/.test(d.message)), 'weights must add up to 100');
  const mismatch = findings(result, 'bucket-mismatch');
  assert.equal(mismatch.length, 1);
  assert.match(mismatch[0].message, /IG corporate bond 2029: liquidityDays 30 belongs in “D8–30”/);
  assert.ok(findings(result, 'unknown-data-ref').length);
});

test('bound props render computed figures, and the contract checks the resolved values', async () => {
  const result = await validateScreen(CANONICAL);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics.filter(d => d.severity === 'error')));
  const bad = clone(CANONICAL);
  bad.children[0].props.stats[0].value = { $data: 'groups.allocation' };
  bad.children[1].props.points = { $data: 'tables.performance', map: { label: 'month', value: 'nothing' } };
  const checked = await validateScreen(bad);
  assert.ok(findings(checked, 'data-shape').length, 'a text value takes one measure, not a list');
  assert.ok(findings(checked, 'unknown-data-field').length);
});

/* Test D: a numerical contradiction between asset-level data, the headline, and the bucket chart. */
test('a headline or bucket chart that contradicts the rows fails semantic validation', async () => {
  const broken = clone(CANONICAL);
  broken.children[0].props.stats[2].value = '38%';
  broken.children[2].children[1].props.columns = [{ label: 'D0', a: 6 }, { label: 'D1–7', a: 30 }, { label: 'D8–30', a: 2 }, { label: 'D31–90', a: 41 }, { label: '>D90', a: 21 }];
  const result = await validateScreen(broken);
  assert.equal(result.ok, false, 'a structurally valid screen fails on its data');
  const conflicts = findings(result, 'data-conflict');
  assert.deepEqual(conflicts.map(d => d.path), ['children[0].props.stats[2].value', 'children[2].children[1].props.columns[2].a', 'children[2].children[1].props.columns[3].a']);
  assert.match(conflicts[0].message, /shows 38%, but the screen data gives 48%/);
  /* Without screen data, the same contradiction is inferred from the table on the screen, as a warning. */
  const legacy = await validateScreen(FLAWED);
  const inferred = findings(legacy, 'data-conflict');
  assert.ok(inferred.every(d => d.severity === 'warning'));
  assert.ok(inferred.some(d => /Liquidity D0–D30” shows 38%.*adds up to 48%/.test(d.message)));
  assert.ok(inferred.some(d => /D8–30” shows 2%.*adds up to 12%/.test(d.message)), 'the day-30 bond is counted where its bound says');
});

test('a part titled as risk that shows allocation weights is refused', async () => {
  const broken = clone(CANONICAL);
  broken.children[3].props.title = 'Risk contribution';
  broken.children[3].props.columns = { $data: 'groups.allocation', map: { label: 'label', a: 'weight' } };
  delete broken.children[3].props.seriesB;
  const result = await validateScreen(broken);
  assert.ok(codes(result).includes('role-mismatch'));
  assert.ok(codes(result).includes('relabeled-data'));
});

/* Test C: the same information in several semantically redundant charts. */
test('the composition planner detects redundant and relabeled visualizations, not repeated components', () => {
  const flawed = assessComposition(FLAWED, { policy });
  const signal = code => flawed.signals.filter(item => item.code === code);
  assert.ok(signal('relabeled-data').some(item => item.ids.includes('risk')), 'the risk chart repeats the allocation numbers');
  assert.ok(signal('monotone-composition').length, 'three single bars stand in for three different analyses');
  assert.ok(signal('repeated-metric').some(item => /total assets/i.test(item.message)));
  assert.equal(flawed.criteria.find(c => c.id === 'redundancy').verdict, 'concern');
  /* Two bar charts with distinct information roles are not redundant. */
  const good = assessComposition(CANONICAL, { policy });
  assert.deepEqual(good.signals.map(item => item.code), []);
  assert.deepEqual(good.parts.filter(part => part.slug === 'chart-bars').map(part => part.role), ['ordered-distribution', 'category-comparison']);
  const twice = clone(CANONICAL);
  twice.children.splice(2, 0, { id: 'allocation-again', component: 'syntari.breakdown', props: clone(CANONICAL.children[2].children[0].props) });
  assert.ok(assessComposition(twice, { policy }).signals.some(item => item.code === 'redundant-visualization'));
});

test('the visualization policy matches the meaning of the data', async () => {
  const bars = clone(CANONICAL);
  bars.children[1] = { id: 'performance', component: 'syntari.breakdown', props: { title: 'Rentabilidad', segments: { $data: 'tables.performance', map: { label: 'month', share: 'portfolio' } } } };
  const result = await validateScreen(bars);
  assert.ok(findings(result, 'misleading-visualization').length, 'a single bar cannot show change over time');
  const profile = profileData(DATA, policy);
  const roleOf = ref => profile.filter(item => item.ref === ref).map(item => item.role);
  assert.deepEqual(roleOf('tables.performance'), ['time-series-comparison', 'records']);
  assert.deepEqual(roleOf('groups.liquidity'), ['ordered-distribution']);
  assert.deepEqual(roleOf('groups.allocation'), ['composition']);
  assert.deepEqual(roleOf('groups.riskVsWeight'), ['category-comparison']);
  assert.deepEqual(profile.find(item => item.ref === 'tables.performance').use, ['line-chart']);
});

/* Test G: a visualization the registry cannot draw is named, never substituted. */
test('a request for a visualization Syntari does not have is reported with the closest that exists', () => {
  const scatter = unsupportedRequest('Añade un gráfico de dispersión de riesgo frente a rentabilidad', policy);
  assert.equal(scatter.role, 'correlation');
  assert.equal(scatter.missing, 'scatter-plot');
  assert.deepEqual(scatter.closest, ['table', 'chart-bars']);
  /* A treemap and a heatmap exist now; a sunburst is still missing, and the treemap is the closest. */
  assert.equal(unsupportedRequest('Add a treemap of the holdings', policy), null);
  assert.equal(unsupportedRequest('Add a heatmap of runs by hour', policy), null);
  assert.deepEqual(unsupportedRequest('Show the holdings as a sunburst', policy), { role: 'hierarchy', label: 'Nested parts of a whole', missing: 'sunburst', closest: ['treemap', 'breakdown'], matched: 'sunburst' });
  assert.equal(unsupportedRequest('Añade una tabla de empleados debajo del gráfico', policy), null);
});

test('a change may report a visualization it cannot draw instead of misusing another', async () => {
  const screen = assignIds(CANONICAL);
  const result = await applyScreenOperations(screen, { version: 'syntari-ops-1', base: versionOf(screen), unsupported: [{ visualization: 'scatter-plot', reason: 'No registered component plots risk against return.', closest: ['table'] }] });
  assert.equal(result.ok, false);
  assert.equal(result.spec, null);
  assert.equal(result.unsupported[0].visualization, 'scatter-plot');
});

/* Test F: a small scoped edit leaves every unrelated node, figure, and id as it was. */
test('a table inserted under a chart changes nothing else', async () => {
  const screen = assignIds(CANONICAL);
  const table = { id: 'performance-table', component: 'syntari.table', props: { caption: 'Rentabilidad por mes', columns: [{ label: 'Mes' }, { label: 'Cartera' }, { label: 'Benchmark' }], rows: { $data: 'tables.performance', cells: ['month', { field: 'portfolio', format: 'signed-percent' }, { field: 'benchmark', format: 'signed-percent' }] } } };
  const result = await applyScreenOperations(screen, change(screen, [{ op: 'insert', after: 'performance', node: table }]), { data: 'strict' });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.changes.map(item => `${item.change}:${item.id}`), ['added:performance-table']);
  const ids = spec => { const out = []; const go = list => list.forEach(node => { out.push(node.id); go(node.children ?? []); }); go(spec.children); return out; };
  assert.deepEqual(ids(result.spec).filter(id => id !== 'performance-table'), ids(screen));
  assert.deepEqual(result.spec.data, screen.data, 'the canonical data is untouched');
  for (const id of ids(screen)) assert.deepEqual(JSON.stringify(findIn(result.spec, id)), JSON.stringify(findIn(screen, id)));
});
const findIn = (spec, id) => { let found = null; const go = list => list.forEach(node => { if (node.id === id) found = node; go(node.children ?? []); }); go(spec.children); return found; };

test('move places a node elsewhere without changing it, and only declared moves are allowed', async () => {
  const screen = assignIds(CANONICAL);
  const moved = await applyScreenOperations(screen, change(screen, [{ op: 'move', target: 'risk-vs-weight', parent: 'section-positions', before: 'holdings' }]));
  assert.equal(moved.ok, true, JSON.stringify(moved.diagnostics));
  assert.deepEqual(moved.changes.filter(item => item.change !== 'moved'), []);
  assert.ok(moved.changes.some(item => item.change === 'moved' && item.id === 'risk-vs-weight' && item.parent === 'section-positions'));
  const reorder = await applyScreenOperations(screen, change(screen, [{ op: 'move', target: 'performance', before: 'summary-kpis' }]));
  assert.equal(reorder.ok, true, JSON.stringify(reorder.diagnostics));
  assert.deepEqual(reorder.spec.children.map(node => node.id).slice(0, 2), ['performance', 'summary-kpis']);
  assert.deepEqual(codes(await applyScreenOperations(screen, change(screen, [{ op: 'move', target: 'section-positions', parent: 'section-positions' }]))), ['invalid-operation']);
  const swapped = clone(screen);
  swapped.children.splice(0, 2, swapped.children[1], swapped.children[0]);
  assert.ok(diffScreens(screen, swapped).some(item => item.change === 'moved'), 'a reorder is a difference too');
});

test('measures and groups may be added to screen data; rows are protected data', async () => {
  const screen = assignIds(CANONICAL);
  const group = await applyScreenOperations(screen, change(screen, [{ op: 'replace', target: 'data', set: { 'groups.byValue': { label: 'Valor por clase', table: 'holdings', by: 'assetClass', value: 'value' } } }]));
  assert.equal(group.ok, true, JSON.stringify(group.diagnostics));
  assert.deepEqual(group.changes.map(item => `${item.id}:${item.fields}`), ['data:groups.byValue']);
  const rows = await applyScreenOperations(screen, change(screen, [{ op: 'replace', target: 'data', set: { 'tables.holdings.rows[0].liquidityDays': 1 } }]));
  assert.deepEqual(codes(rows), ['protected-data']);
  assert.equal(rows.authorization[0].id, 'data');
  assert.deepEqual(rows.authorization[0].fields, ['tables.holdings.rows[0].liquidityDays']);
  const allowed = await applyScreenOperations(screen, change(screen, [{ op: 'replace', target: 'data', set: { 'tables.holdings.rows[0].liquidityDays': 1 } }]), { allowDataChanges: true });
  assert.equal(allowed.ok, true, 'a person may authorize a data change');
});

/* Test E, in the runtime: a global improvement is a recomposition that keeps every fact of the canonical data. */
test('a recomposition keeps the data, every record, and every figure, and validates whole', async () => {
  const screen = assignIds(CANONICAL);
  const better = { title: CANONICAL.title, layout: 'stack', meta: { plan: { pattern: 'dashboard' } }, data: { groups: { byValue: { label: 'Valor por clase', table: 'holdings', by: 'assetClass', value: 'value' } } }, children: clone(CANONICAL.children).reverse() };
  const result = await applyScreenOperations(screen, change(screen, [{ op: 'recompose', screen: better }]));
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.spec.data.tables, screen.data.tables, 'rows are carried over unchanged');
  assert.ok(result.spec.data.groups.byValue && result.spec.data.groups.liquidity, 'new groups are added, existing ones kept');
  assert.equal(result.effects[0].op, 'recompose');
  const changedRows = clone(better);
  changedRows.data = { tables: { holdings: { ...clone(DATA.tables.holdings), rows: DATA.tables.holdings.rows.slice(1) } } };
  assert.ok(codes(await applyScreenOperations(screen, change(screen, [{ op: 'recompose', screen: changedRows }]))).includes('data-changed'));
  const invented = clone(better);
  invented.children[0] = { id: 'new-kpi', component: 'syntari.stat-row', props: { stats: [{ label: 'Volatilidad', value: '7,3 %' }] } };
  assert.ok(codes(await applyScreenOperations(screen, change(screen, [{ op: 'recompose', screen: invented }]))).includes('unsourced-data'));
  const alone = await applyScreenOperations(screen, change(screen, [{ op: 'recompose', screen: better }, { op: 'remove', target: 'holdings' }]));
  assert.deepEqual(codes(alone), ['invalid-operation']);
});

test('recomposing a screen without data states its rows in data, using only figures it already showed', async () => {
  const screen = assignIds(FLAWED);
  const data = { mode: 'demo', tables: { holdings: clone(DATA.tables.holdings) }, measures: { liquid30: clone(DATA.measures.liquid30) }, groups: { liquidity: clone(DATA.groups.liquidity), allocation: { label: 'Allocation', table: 'holdings', by: 'assetClass', value: 'weight' } } };
  data.tables.holdings.rows = data.tables.holdings.rows.map(({ value, ...row }) => row);
  delete data.tables.holdings.fields.value;
  const children = [
    { id: 'kpis', component: 'syntari.stat-row', props: { stats: [{ label: 'Liquidity D0–D30', value: { $data: 'measures.liquid30' }, note: 'Computed from the positions' }] } },
    { id: 'ladder', component: 'syntari.chart-bars', props: { title: 'Liquidity ladder', orientation: 'vertical', unit: '%', chartLabel: 'Weight by liquidity horizon.', columns: { $data: 'groups.liquidity', map: { label: 'label', a: 'value' } } } },
    { id: 'holdings', component: 'syntari.table', props: { caption: 'Positions', sortable: true, columns: [{ label: 'Asset' }, { label: 'Weight' }], rows: { $data: 'tables.holdings', cells: ['asset', { field: 'weight', format: 'percent' }] } } }
  ];
  const ok = await applyScreenOperations(screen, change(screen, [{ op: 'recompose', screen: { title: FLAWED.title, data, children } }]));
  assert.equal(ok.ok, true, JSON.stringify(ok.diagnostics.filter(d => d.severity === 'error')));
  assert.equal(ok.recomposed.records, 10);
  const short = clone(data);
  short.tables.holdings.rows = short.tables.holdings.rows.slice(0, 9);
  short.tables.holdings.fields.weight = { type: 'percent', label: 'Peso', role: 'allocation' };
  const dropped = await applyScreenOperations(screen, change(screen, [{ op: 'recompose', screen: { title: FLAWED.title, data: short, children } }]));
  assert.ok(codes(dropped).includes('dropped-records'), 'every record the table showed is still there');
  const made = clone(data);
  made.tables.holdings.rows[0].weight = 6.5;
  made.tables.holdings.rows[1].weight = 8.5;
  const madeUp = await applyScreenOperations(screen, change(screen, [{ op: 'recompose', screen: { title: FLAWED.title, data: made, children } }]));
  assert.ok(codes(madeUp).includes('unsourced-data'), 'a recomposition never adds figures');
  /* The screen wrote "$10M": stating it as 10000000 in the data is the same figure, not a new one. 12000000 is new. */
  const total = clone(data);
  total.measures.totalValue = { label: 'Total assets', value: 10000000, format: 'compact-currency' };
  const scaled = await applyScreenOperations(screen, change(screen, [{ op: 'recompose', screen: { title: FLAWED.title, data: total, children } }]));
  assert.equal(scaled.ok, true, JSON.stringify(scaled.diagnostics.filter(d => d.severity === 'error')));
  total.measures.totalValue.value = 12000000;
  assert.ok(codes(await applyScreenOperations(screen, change(screen, [{ op: 'recompose', screen: { title: FLAWED.title, data: total, children } }]))).includes('unsourced-data'));
});
