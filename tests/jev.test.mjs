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
  assert.deepEqual(removed.routed.change.operations.map(op => [op.op, op.target]), [['remove', 'holdings']]);
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

test('what needs writing, or a part Jev cannot pin down, goes to Claude with what Jev found', () => {
  assert.equal(decide('Add a table of the 5 most returned products').routed.route, 'claude');
  assert.equal(decide('Change the title of the risk chart so it says where the risk comes from').routed.route, 'claude', 'no quotes: the words are Claude’s to write');
  assert.equal(decide('Remove the bar chart').routed.route, 'claude', 'two bar charts');
  const anchorless = decide('Move the positions table before the map').routed;
  assert.equal(anchorless.route, 'claude');
  assert.deepEqual(anchorless.hint.targets, ['holdings']);
  assert.equal(decide('improve the visualization and hierarchy of all the data').routed.route, 'claude');
  /* Jev matches the words of a part's title: a Spanish request on an English screen finds no part, so Claude takes it. */
  assert.equal(decide('Elimina el gráfico de riesgo').routed.route, 'claude');
});
