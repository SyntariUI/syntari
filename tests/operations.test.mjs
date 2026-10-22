import test from 'node:test';
import assert from 'node:assert/strict';
import { applyScreenOperations, assignIds, diffScreens, findNode, validateScreen, versionOf } from '../agent.mjs';

/* An absence report: a headline number, a trend with its explanation, and where the absence comes from. */
const report = () => assignIds({
  version: 'syntari-ir-1', type: 'screen', layout: 'stack',
  title: 'Absenteeism at Acme SL rose to 4.8% in the last 3 months, up from 3.6%',
  meta: { data: { mode: 'demo' } },
  children: [
    { component: 'syntari.headline-metric', props: { metrics: [{ label: 'Absence rate, latest month', value: '4.8%', total: 'of days', delta: '+1.2 pts', direction: 'up' }] } },
    { type: 'section', heading: 'How absence moved month by month', children: [
      { component: 'syntari.area-chart', props: { title: 'Weekly absence rate, last 13 weeks', chartLabel: 'Absence rose from 3.6% to 4.8%', points: [{ label: 'W1', value: 3.6 }, { label: 'W7', value: 4.1 }, { label: 'W13', value: 4.8 }] } },
      { component: 'syntari.text-block', props: { body: 'Absence was flat for six weeks, then climbed in Customer Support and Operations.' } }
    ] },
    { type: 'section', heading: 'Where absence comes from', children: [
      { component: 'syntari.breakdown', props: { title: 'Absent days by reason', total: '1,240 days', segments: [{ label: 'Short sick leave', value: '620 days', share: 50 }, { label: 'Long-term leave', value: '400 days', share: 32 }, { label: 'Other', value: '220 days', share: 18 }] } },
      { component: 'syntari.table', props: { caption: 'Absence by department', columns: [{ label: 'Department' }, { label: 'Absence rate' }], rows: [['Customer Support', '7.1%'], ['Operations', '5.9%']] } }
    ] }
  ]
});
const employees = { component: 'syntari.table', id: 'employee-absence', props: { caption: 'Absence by employee', columns: [{ label: 'Employee' }, { label: 'Absence days' }], rows: [['Marta Keller', '9'], ['Daniel Osei', '8']] } };
const change = (screen, operations, extra = {}) => ({ version: 'syntari-ops-1', base: versionOf(screen), operations, ...extra });
const errors = result => result.diagnostics.filter(d => d.severity === 'error').map(d => d.code);
/* Everything except the named nodes is identical, value for value. */
function unchangedExcept(before, after, ids) {
  for (const item of diffScreens(before, after)) assert.ok(ids.includes(item.id), `${item.id} ${item.change} unexpectedly`);
}

test('assignIds gives every node a readable, unique id and keeps the ones it has', () => {
  const screen = report();
  const ids = [];
  const visit = list => list.forEach(node => { ids.push(node.id); if (node.children) visit(node.children); });
  visit(screen.children);
  assert.deepEqual(ids, ['headline-metric', 'section-how-absence-moved-month', 'area-chart', 'text-block', 'section-where-absence-comes-from', 'breakdown', 'table']);
  const again = assignIds({ ...screen, children: [...screen.children, { component: 'syntari.table', props: {} }, { id: 'kept', component: 'syntari.table', props: {} }] });
  assert.equal(again.children[3].id, 'table-2');
  assert.equal(again.children[4].id, 'kept');
  assert.equal(versionOf(screen), versionOf(JSON.parse(JSON.stringify(screen))));
  assert.equal(versionOf({ b: 1, a: 2 }), versionOf({ a: 2, b: 1 }));
  assert.notEqual(versionOf(screen), versionOf({ ...screen, title: 'Another title' }));
});

test('sections, regions, and blocks validate their ids like components do', async () => {
  const screen = report();
  assert.equal((await validateScreen(screen)).ok, true);
  const clash = structuredClone(screen);
  clash.children[1].id = 'table';
  assert.ok((await validateScreen(clash)).diagnostics.some(d => d.code === 'duplicate-node-id'));
});

test('insert adds one node at the named place and leaves everything else identical', async () => {
  const screen = report();
  const result = await applyScreenOperations(screen, change(screen, [{ op: 'insert', parent: 'section-how-absence-moved-month', after: 'area-chart', node: employees, reason: 'The person asked for employees under the chart.' }]), { data: 'demo' });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.changes.map(item => [item.change, item.id]), [['added', 'employee-absence']]);
  assert.deepEqual(result.spec.children[1].children.map(node => node.id), ['area-chart', 'employee-absence', 'text-block']);
  unchangedExcept(screen, result.spec, ['employee-absence']);
  assert.deepEqual(result.spec.children[0], screen.children[0]);
  assert.equal(result.base, versionOf(screen));
  assert.equal(result.version, versionOf(result.spec));
  assert.notEqual(result.version, result.base);
  /* The original is never modified. */
  assert.equal(findNode(screen, 'employee-absence'), null);
});

test('an insert may name only its anchor; its parent follows from it', async () => {
  const screen = report();
  const result = await applyScreenOperations(screen, change(screen, [{ op: 'insert', before: 'breakdown', node: employees }]), { data: 'demo' });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(findNode(result.spec, 'employee-absence').parentId, 'section-where-absence-comes-from');
  assert.equal(findNode(result.spec, 'employee-absence').index, 0);
});

test('replace with set changes only the fields it names', async () => {
  const screen = (await applyScreenOperations(report(), change(report(), [{ op: 'insert', after: 'area-chart', node: employees }]), { data: 'demo' })).spec;
  const result = await applyScreenOperations(screen, change(screen, [{ op: 'replace', target: 'employee-absence', set: { 'props.caption': 'Employees with the most absence days' } }]), { data: 'demo' });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.changes, [{ change: 'changed', id: 'employee-absence', kind: 'component', path: 'children[1].children[1]', fields: ['props.caption'] }]);
  assert.deepEqual(findNode(result.spec, 'employee-absence').node.props.rows, employees.props.rows);
});

test('remove takes out one node and nothing else', async () => {
  const screen = (await applyScreenOperations(report(), change(report(), [{ op: 'insert', after: 'area-chart', node: employees }]), { data: 'demo' })).spec;
  const result = await applyScreenOperations(screen, change(screen, [{ op: 'remove', target: 'employee-absence' }]));
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.changes.map(item => [item.change, item.id]), [['removed', 'employee-absence']]);
  assert.deepEqual(result.spec, report());
});

test('the screen title is changed with set on "screen"', async () => {
  const screen = report();
  const result = await applyScreenOperations(screen, change(screen, [{ op: 'replace', target: 'screen', set: { title: 'Absenteeism at Acme SL: 4.8% in the last 3 months' } }]));
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.changes, [{ change: 'changed', id: 'screen', kind: 'screen', path: '', fields: ['title'] }]);
});

test('a change written against an older version is refused whole', async () => {
  const screen = report();
  const stale = change(screen, [{ op: 'remove', target: 'table' }]);
  const newer = (await applyScreenOperations(screen, change(screen, [{ op: 'replace', target: 'screen', set: { title: 'Absence at Acme SL' } }]))).spec;
  const result = await applyScreenOperations(newer, stale);
  assert.equal(result.ok, false);
  assert.equal(result.spec, null);
  assert.deepEqual(errors(result), ['stale-base']);
  assert.ok(findNode(newer, 'table'));
});

test('operations must name nodes that exist, in the place they say', async () => {
  const screen = report();
  assert.deepEqual(errors(await applyScreenOperations(screen, change(screen, [{ op: 'remove', target: 'nothing' }]))), ['unknown-target']);
  assert.deepEqual(errors(await applyScreenOperations(screen, change(screen, [{ op: 'insert', parent: 'section-where-absence-comes-from', after: 'area-chart', node: employees }]), { data: 'demo' })), ['unknown-anchor']);
  assert.deepEqual(errors(await applyScreenOperations(screen, change(screen, [{ op: 'insert', parent: 'table', node: employees }]), { data: 'demo' })), ['invalid-parent']);
  assert.deepEqual(errors(await applyScreenOperations(screen, change(screen, [{ op: 'insert', node: { ...employees, id: 'table' } }]), { data: 'demo' })), ['duplicate-node-id']);
  assert.deepEqual(errors(await applyScreenOperations(screen, change(screen, [{ op: 'move', target: 'table' }]))), ['invalid-operation']);
  assert.deepEqual(errors(await applyScreenOperations(screen, change(screen, [{ op: 'remove', target: 'table', node: employees }]))), ['unknown-key']);
});

test('replace cannot reach outside its node: no new kind, no new id, no structural fields', async () => {
  const screen = report();
  const swap = await applyScreenOperations(screen, change(screen, [{ op: 'replace', target: 'table', node: { component: 'syntari.text-block', props: { body: 'No table.' } } }]));
  assert.deepEqual(errors(swap), ['scope-violation']);
  const rename = await applyScreenOperations(screen, change(screen, [{ op: 'replace', target: 'table', node: { ...findNode(screen, 'table').node, id: 'other' } }]));
  assert.deepEqual(errors(rename), ['scope-violation']);
  for (const field of ['id', 'component', 'children', 'props', '__proto__.polluted', 'props.__proto__']) {
    const result = await applyScreenOperations(screen, change(screen, [{ op: 'replace', target: 'table', set: { [field]: 'x' } }]));
    assert.deepEqual(errors(result), ['invalid-field'], field);
  }
  assert.equal({}.polluted, undefined);
});

test('existing data is protected: changing it needs a person to allow it', async () => {
  const screen = report();
  const edit = change(screen, [{ op: 'replace', target: 'headline-metric', set: { 'props.metrics': [{ label: 'Absence rate, latest month', value: '5.1%', total: 'of days', delta: '+1.5 pts', direction: 'up' }] } }]);
  const refused = await applyScreenOperations(screen, edit, { data: 'demo' });
  assert.equal(refused.ok, false);
  assert.ok(errors(refused).includes('protected-data'));
  assert.deepEqual(refused.authorization[0].fields, ['props.metrics[0].value', 'props.metrics[0].delta']);
  assert.deepEqual(refused.authorization[0].before, ['4.8%', '+1.2 pts']);
  const allowed = await applyScreenOperations(screen, edit, { data: 'demo', allowDataChanges: true });
  assert.equal(allowed.ok, true, JSON.stringify(allowed.diagnostics));
  /* Rewording copy is not a data change. */
  const reworded = await applyScreenOperations(screen, change(screen, [{ op: 'replace', target: 'area-chart', set: { 'props.title': 'Weekly absence rate' } }]));
  assert.equal(reworded.ok, true, JSON.stringify(reworded.diagnostics));
});

test('new figures need a source; demonstration screens label them instead', async () => {
  const screen = report();
  const insert = change(screen, [{ op: 'insert', after: 'area-chart', node: employees }]);
  const strict = await applyScreenOperations(screen, insert);
  assert.deepEqual(errors(strict), ['unsourced-data']);
  assert.deepEqual(strict.diagnostics[0].values, ['9', '8']);
  const provided = await applyScreenOperations(screen, insert, { sources: [{ employee: 'Marta Keller', days: 9 }, { employee: 'Daniel Osei', days: 8 }] });
  assert.equal(provided.ok, true, JSON.stringify(provided.diagnostics));
  const demo = await applyScreenOperations(screen, insert, { data: 'demo' });
  assert.equal(demo.ok, true);
  assert.equal(demo.effects[0].demo, true);
  assert.ok(demo.diagnostics.some(d => d.code === 'demo-data' && d.severity === 'warning'));
  /* A figure already on the screen is sourced: 7.1% and 1,240 days. */
  const repeat = await applyScreenOperations(screen, change(screen, [{ op: 'insert', node: { component: 'syntari.text-block', props: { body: 'Customer Support reached 7.1%, part of 1240 days lost.' } } }]));
  assert.equal(repeat.ok, true, JSON.stringify(repeat.diagnostics));
});

test('the whole result is validated; a new error refuses the change, an old one does not', async () => {
  const screen = report();
  const tooLong = await applyScreenOperations(screen, change(screen, [{ op: 'replace', target: 'table', set: { 'props.caption': 'x'.repeat(91) } }]));
  assert.equal(tooLong.ok, false);
  assert.deepEqual(errors(tooLong), ['over-length']);
  assert.equal(tooLong.spec, null);
  const broken = structuredClone(screen);
  broken.children[2].children[0].props.segments[0].share = 70;
  assert.equal((await validateScreen(broken)).ok, false);
  const unrelated = await applyScreenOperations(broken, change(broken, [{ op: 'replace', target: 'table', set: { 'props.caption': 'Absence rate by department' } }]));
  assert.equal(unrelated.ok, true, JSON.stringify(unrelated.diagnostics));
});

test('a change can ask instead of acting, and a screen without ids cannot be changed', async () => {
  const screen = report();
  const asked = await applyScreenOperations(screen, change(screen, [], { clarify: { kind: 'new-screen', message: 'This asks for a turnover report, not a change to this one.' } }));
  assert.equal(asked.ok, false);
  assert.equal(asked.clarify.kind, 'new-screen');
  assert.deepEqual(errors(asked), []);
  const needs = await applyScreenOperations(screen, change(screen, [], { needs: [{ data: 'Absence days per employee', reason: 'The table lists each employee.' }] }));
  assert.equal(needs.needs.length, 1);
  assert.deepEqual(errors(await applyScreenOperations(screen, change(screen, []))), ['empty-change']);
  const bare = { type: 'screen', children: [{ component: 'syntari.text-block', props: { body: 'Hi' } }] };
  assert.deepEqual(errors(await applyScreenOperations(bare, change(bare, [{ op: 'remove', target: 'text-block' }]))), ['missing-node-id']);
});

test('operations apply in order, and a failed one stops the rest', async () => {
  const screen = report();
  const result = await applyScreenOperations(screen, change(screen, [
    { op: 'insert', after: 'area-chart', node: employees },
    { op: 'replace', target: 'employee-absence', set: { 'props.caption': 'Employees' } },
    { op: 'remove', target: 'missing' },
    { op: 'remove', target: 'table' }
  ]), { data: 'demo' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.effects.map(effect => effect.op), ['insert', 'replace']);
  assert.equal(result.diagnostics.find(d => d.severity === 'error').operation, 2);
});
