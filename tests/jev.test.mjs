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
  assert.equal(resolvePart('la tabla de posiciones', spec).part.id, 'holdings', 'the table, not the section that holds it');
  assert.equal(resolvePart('el gráfico de riesgo', spec).part.id, 'risk-vs-weight');
  assert.equal(resolvePart('los KPIs', spec).part.id, 'summary-kpis');
  assert.equal(resolvePart('la escalera de liquidez', spec).part.id, 'liquidity-ladder');
  assert.equal(resolvePart('#performance', spec).part.id, 'performance');
  const both = resolvePart('el gráfico de barras', spec);
  assert.equal(both.part, null, 'two bar charts: it asks Claude instead of guessing');
  assert.match(both.reason, /could mean/);
  assert.equal(resolvePart('el mapa de clientes', spec).part, null);
});

test('Jev removes, moves, and renames without a model, through the same validated operations', async () => {
  const removed = await apply('Elimina la tabla de posiciones');
  assert.deepEqual(removed.routed.change.operations.map(op => [op.op, op.target]), [['remove', 'holdings']]);
  assert.ok(removed.routed.ms < 50, `decided in ${removed.routed.ms} ms`);

  const moved = await apply('Mueve el gráfico de riesgo antes de la línea de rentabilidad');
  assert.deepEqual(moved.routed.change.operations[0], { op: 'move', target: 'risk-vs-weight', before: 'performance', reason: 'Mueve el gráfico de riesgo antes de la línea de rentabilidad' });
  assert.deepEqual(moved.result.spec.children.map(node => node.id).slice(0, 3), ['summary-kpis', 'risk-vs-weight', 'performance']);

  const last = await apply('Pon los KPIs al final');
  assert.equal(last.result.spec.children.at(-1).id, 'summary-kpis');

  const renamed = await apply('Cambia el título del gráfico de riesgo a "El riesgo viene de la renta variable"');
  assert.equal(renamed.result.spec.children.find(node => node.id === 'risk-vs-weight').props.title, 'El riesgo viene de la renta variable');
  assert.deepEqual(renamed.changes.map(change => change.id), ['risk-vs-weight'], 'only that part changed');

  const section = await apply('Renombra la sección de posiciones a «Todas las posiciones»');
  assert.equal(section.result.spec.children.find(node => node.id === 'section-positions').heading, 'Todas las posiciones');
});

test('what needs writing, or a part Jev cannot pin down, goes to Claude with what Jev found', () => {
  assert.equal(decide('Añade una tabla con los 5 productos más devueltos').routed.route, 'claude');
  assert.equal(decide('Cambia el título del gráfico de riesgo para que diga de dónde viene el riesgo').routed.route, 'claude', 'no quotes: the words are Claude’s to write');
  assert.equal(decide('Elimina el gráfico de barras').routed.route, 'claude', 'two bar charts');
  const anchorless = decide('Mueve la tabla de posiciones antes del mapa').routed;
  assert.equal(anchorless.route, 'claude');
  assert.deepEqual(anchorless.hint.targets, ['holdings']);
  assert.equal(decide('mejora la visualización y la jerarquía de toda la data').routed.route, 'claude');
});
