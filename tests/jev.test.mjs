import test from 'node:test';
import assert from 'node:assert/strict';
import { applyScreenOperations, assignIds, versionOf, diffScreens } from '../agent.mjs';
import { routeRequest, resolvePart } from '../jev.js';
import { CANONICAL } from './fixtures/portfolio.mjs';

const screen = () => assignIds(structuredClone(CANONICAL));
const decide = (request, spec = screen()) => ({ spec, routed: routeRequest(request, spec, { base: versionOf(spec) }) });
async function apply(request) {
  const { spec, routed } = decide(request);
  assert.equal(routed.route, 'jev', `${request}: ${routed.reason}`);
  const result = await applyScreenOperations(spec, routed.change);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics.filter(d => d.severity === 'error')));
  return { spec, routed, result, changes: diffScreens(spec, result.spec) };
}

test('Jev finds the part a person names by its title and its kind, and does not guess between two', () => {
  const spec = screen();
  assert.equal(resolvePart('the positions table', spec).part.id, 'holdings', 'the table, not the section that holds it');
  assert.equal(resolvePart('the risk chart', spec).part.id, 'risk-vs-weight');
  assert.equal(resolvePart('the KPIs', spec).part.id, 'summary-kpis');
  assert.equal(resolvePart('the liquidity ladder', spec).part.id, 'liquidity-ladder');
  assert.equal(resolvePart('#performance', spec).part.id, 'performance');
  const both = resolvePart('the bar chart', spec);
  assert.equal(both.part, null, 'two bar charts: it asks Claude instead of guessing');
  assert.match(both.reason, /could mean/);
  assert.equal(resolvePart('the customer map', spec).part, null);
});

test('Jev removes, moves, and renames without a model, through the same validated operations', async () => {
  const removed = await apply('Remove the positions table');
  assert.deepEqual(removed.routed.change.operations.map(op => [op.op, op.target]), [['remove', 'section-positions']], 'its section only gave it a title, so it goes too');
  assert.ok(removed.routed.ms < 50, `decided in ${removed.routed.ms} ms`);

  const moved = await apply('Move the risk chart before the return line');
  assert.deepEqual(moved.routed.change.operations[0], { op: 'move', target: 'risk-vs-weight', before: 'performance', reason: 'Move the risk chart before the return line' });
  assert.deepEqual(moved.result.spec.children.map(node => node.id).slice(0, 3), ['summary-kpis', 'risk-vs-weight', 'performance']);

  const last = await apply('Put the KPIs at the end');
  assert.equal(last.result.spec.children.at(-1).id, 'summary-kpis');

  const renamed = await apply('Rename the risk chart to "Risk comes from equities"');
  assert.equal(renamed.result.spec.children.find(node => node.id === 'risk-vs-weight').props.title, 'Risk comes from equities');
  assert.deepEqual(renamed.changes.map(change => change.id), ['risk-vs-weight'], 'only that part changed');

  const section = await apply('Rename the positions section to “All positions”');
  assert.equal(section.result.spec.children.find(node => node.id === 'section-positions').heading, 'All positions');
});

test('what needs writing goes to Claude as a brief: the part, the field, the place, and the data Jev already decided', () => {
  const brief = request => decide(request).routed.brief;
  assert.deepEqual(brief('Change the title of the risk chart so it says where the risk comes from'), { task: 'words', target: 'risk-vs-weight', field: 'props.title', current: 'Weight against risk contribution' }, 'no quotes: Claude writes the words, Jev knows where they go');
  /* Something inside a part is Claude's to change, but only in that part: the whole table or chart is never removed for it. */
  assert.deepEqual(brief('Remove the risk column from the positions table'), { task: 'part', target: 'holdings' });
  assert.deepEqual(brief('Delete the benchmark line from the return chart'), { task: 'part', target: 'performance' });
  assert.deepEqual(brief('Remove the first KPI'), { task: 'part', target: 'summary-kpis' }, 'one stat row: the first KPI is inside it');
  assert.deepEqual(brief('Make the KPIs more prominent'), { task: 'part', target: 'summary-kpis' });
  assert.deepEqual(brief('Add a table of monthly returns under the return chart'), { task: 'add', position: { parent: 'screen', after: 'performance' }, kinds: ['table', 'comparison-table', 'data-table', 'simple-data-table'], data: ['tables.performance'] });
  assert.equal(decide('Remove the customer map').routed.brief.task, 'screen');
  const anchorless = decide('Move the positions table before the map').routed;
  assert.equal(anchorless.route, 'claude');
  assert.deepEqual(anchorless.hint.targets, ['holdings']);
  assert.equal(decide('improve the visualization and hierarchy of all the data').routed.route, 'claude');
  /* Jev matches the words of a part's title: a Spanish request on an English screen finds no part, so Claude takes it. */
  assert.equal(decide('Elimina el gráfico de riesgo').routed.route, 'claude');
});

test('a part two names could mean is the person’s choice, and Jev goes on with the part they chose', async () => {
  const { spec, routed } = decide('Remove the bar chart');
  assert.equal(routed.route, 'ask');
  assert.deepEqual(routed.choices.map(choice => choice.id), ['liquidity-ladder', 'risk-vs-weight']);
  const chosen = routeRequest('Remove the bar chart', spec, { base: versionOf(spec), chosen: { [routed.phrase]: 'risk-vs-weight' } });
  assert.deepEqual(chosen.change.operations.map(op => [op.op, op.target]), [['remove', 'risk-vs-weight']]);
  /* An order picks one of several: "the last bar chart" needs no question. */
  assert.deepEqual(decide('Remove the last bar chart').routed.change.operations.map(op => op.target), ['risk-vs-weight']);
});

test('a request with several asks is split: Jev does its share, planned in order, and leaves the rest to Claude', async () => {
  const both = decide('Remove the KPIs and move the risk chart to the top');
  assert.equal(both.routed.route, 'jev', 'both asks need no model');
  const result = await applyScreenOperations(both.spec, both.routed.change);
  assert.equal(result.ok, true, 'the move is planned on the screen the removal leaves');
  assert.equal(result.spec.children[0].id, 'risk-vs-weight');
  const shared = decide('Please remove the positions table and add a table of monthly returns under the return chart').routed;
  assert.equal(shared.route, 'split');
  assert.deepEqual(shared.change.operations.map(op => [op.op, op.target]), [['remove', 'section-positions']]);
  assert.equal(shared.rest, 'add a table of monthly returns under the return chart');
  /* Quoted words are never split: "and" inside quotes is part of the title. */
  assert.equal(decide('Rename the risk chart to "Risk and remove nothing"').routed.change.operations[0].set['props.title'], 'Risk and remove nothing');
  assert.equal(decide('Can you remove the liquidity ladder?').routed.route, 'jev');
});

test('Jev knows the newer parts by their kind: one word for one kind, and a word two kinds share is the person’s choice', () => {
  const spec = { type: 'screen', children: [
    { id: 'decisions', component: 'syntari.chart-donut', props: { title: 'Decisions this week', segments: [{ label: 'Approved', share: 60 }, { label: 'Waiting', share: 40 }] } },
    { id: 'runs', component: 'syntari.heatmap', props: { title: 'Failed runs by day', columns: ['Night', 'Day'], rows: [{ label: 'Mon', values: [1, 2] }] } },
    { id: 'spend', component: 'syntari.treemap', props: { title: 'Cloud spend', tiles: [{ label: 'EC2', value: 4 }, { label: 'S3', value: 2 }] } },
    { id: 'checks', component: 'syntari.score', props: { title: 'Checks passed', value: 92 } },
    { id: 'plan', component: 'syntari.agent-todo-list', props: { title: 'Migration plan', tasks: [{ label: 'Back up the tables' }] } }
  ] };
  const target = request => { const { routed } = decide(request, spec); return routed.route === 'jev' ? routed.change.operations.map(op => [op.op, op.target]) : routed.route; };
  assert.deepEqual(target('Remove the heatmap'), [['remove', 'runs']]);
  assert.deepEqual(target('Quita el donut'), [['remove', 'decisions']]);
  assert.deepEqual(target('Remove the score'), [['remove', 'checks']]);
  assert.deepEqual(target('Borra el plan'), [['remove', 'plan']]);
  assert.equal(decide('Rename the treemap to "Spend by service"', spec).routed.change.operations[0].set['props.title'], 'Spend by service');
  assert.equal(target('Delete the chart'), 'ask', 'three charts: the person chooses');
  assert.deepEqual(decide('Quita el anillo', spec).routed.choices.map(choice => choice.id), ['decisions', 'checks']);
});
