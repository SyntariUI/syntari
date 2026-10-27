import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { validateScreen, assessScreen, planScreen, repairScreen, applyScreenOperations, getPattern, listPatterns, getCompositionGuidance, lintMarkup, getCompositionRules, assessRenderedScreen, assignIds, versionOf, diffScreens, findNode } from '../agent.mjs';
import { scenarios, planFor, screenFor } from '../benchmarks/index.js';
import { checkCompositionPolicy } from '../registry-validator.mjs';
import { listComponents } from '../agent.mjs';

const policy = JSON.parse(await readFile(new URL('../kit/runtime/registry/composition-policy.json', import.meta.url), 'utf8'));
const clone = value => structuredClone(value);
const scenario = id => scenarios.find(item => item.id === id);
const intent = id => screenFor(scenario(id), 'intent', policy);
const rules = result => result.assessment.findings.map(item => item.rule);
const finding = (result, rule) => result.assessment.findings.find(item => item.rule === rule);
/** Every node of a screen by id, for perturbing composed screens in place. */
const nodeOf = (spec, id) => findNode(spec, id)?.node;

/* The archetype each brief should lead to, written here, not in the planner: the planner reads only the brief and the policy. */
const EXPECTED = {
  'advisor-overview': 'task-triage', 'work-queue': 'task-triage', 'household-overview': 'record-workspace', 'plan-approval': 'comparison-workspace',
  'portfolio-review': 'analytical-report', 'statement-reconciliation': 'evidence-review', 'firm-settings': 'configuration-workspace',
  'support-queue': 'task-triage', 'support-settings': 'configuration-workspace', 'shipment-record': 'record-workspace', 'freight-invoice': 'evidence-review', 'carrier-quotes': 'comparison-workspace'
};

test('the composition policy is consistent with itself and the registry', async () => {
  const ids = new Set((await listComponents()).map(item => item.id));
  assert.deepEqual(checkCompositionPolicy(policy, ids), []);
  for (const [id, rule] of Object.entries(policy.lint.rules)) assert.ok(policy.lint.criteria.some(criterion => criterion.id === rule.category) || ['contract'].includes(rule.category), `${id} belongs to a criterion`);
});

test('each brief leads to the archetype that serves its job, across three unrelated products', async () => {
  assert.deepEqual(Object.keys(EXPECTED).sort(), scenarios.map(item => item.id).sort());
  for (const item of scenarios) {
    const { plan, status, problems } = await planScreen(item.brief);
    assert.equal(status, 'ready', item.id);
    assert.equal(plan.archetype, EXPECTED[item.id], `${item.id} plans as ${plan.archetype}`);
    assert.deepEqual(problems, [], `${item.id}: the plan matches plan.schema.json`);
    assert.ok(plan.alternativesConsidered.length >= 2 && plan.alternativesConsidered.every(alt => alt.reason), `${item.id} says why the others lost`);
    assert.deepEqual((await planScreen(item.brief)).plan, plan, `${item.id}: the same brief always gives the same plan`);
  }
});

test('“dashboard” names a place: the job decides between a dashboard and a work queue', async () => {
  const base = { request: 'Build a financial advisor dashboard', user: { role: 'Advisor' }, decisions: ['Which item first'] };
  const resolve = (await planScreen({ ...base, job: { primary: 'clear pending client items', mode: 'resolve' }, information: [{ label: 'Pending items', kind: 'pending-item', neededFor: ['which item first'] }, { label: 'Assets under management', kind: 'aggregate-metric' }] })).plan;
  assert.equal(resolve.archetype, 'task-triage');
  assert.match(resolve.terminology[0], /names a place/);
  assert.ok(resolve.avoid.some(item => item.id === 'kpi-grid'), 'a work queue avoids headline measures no decision depends on');
  const monitor = (await planScreen({ ...base, job: { primary: 'see how the book is doing', mode: 'monitor' }, information: [{ label: 'Assets under management', kind: 'aggregate-metric', neededFor: ['spot a change'] }, { label: 'Assets over time', kind: 'trend' }] })).plan;
  assert.equal(monitor.archetype, 'monitoring-dashboard');
  assert.equal(monitor.terminology, undefined, 'a dashboard that monitors is called one');
  assert.ok(!monitor.avoid.some(item => item.id === 'kpi-grid'));
});

test('words in a request raise questions; they do not stand in for the job', async () => {
  const bare = await planScreen({ request: 'Build a customer support dashboard for our agents.' });
  assert.equal(bare.status, 'needs-context');
  assert.ok(bare.plan.openQuestions.some(question => /come to this screen to do/.test(question)));
  assert.equal(bare.cues.basis, 'words in the request');
  /* Once the brief states the job, the request's words carry no weight: the same brief with another request plans the same. */
  const brief = scenario('support-queue').brief;
  const other = (await planScreen({ ...brief, request: 'customer account household client profile record' })).plan;
  assert.equal(other.archetype, (await planScreen(brief)).plan.archetype);
});

test('information priority and disclosure follow decisions, exceptions, and frequency', async () => {
  const { plan } = await planScreen({ user: { role: 'Coordinator' }, job: { primary: 'clear holds', mode: 'resolve' }, decisions: ['which hold first'], information: [
    { id: 'holds', label: 'Holds', kind: 'pending-item', neededFor: ['which hold first'] },
    { id: 'outage', label: 'Carrier outage', kind: 'exception', exception: true },
    { id: 'quiet', label: 'Customs strike', kind: 'exception', exception: false },
    { id: 'history', label: 'Event log', kind: 'history', frequency: 'rare' },
    { id: 'forced', label: 'Lane totals', kind: 'aggregate-metric', priority: 'primary', disclosure: 'collapsed' }
  ] });
  const by = id => plan.informationPriority.find(item => item.id === id);
  assert.deepEqual([by('holds').priority, by('holds').disclosure], ['primary', 'visible']);
  assert.deepEqual([by('outage').disclosure, by('outage').exception], ['on-exception', true]);
  assert.deepEqual([by('quiet').disclosure, by('quiet').exception], ['on-exception', false]);
  assert.deepEqual([by('history').priority, by('history').disclosure], ['reference', 'on-selection'], 'rare history in a triage is reference, shown for the selected item');
  assert.equal(by('forced').priority, 'primary');
  assert.equal(by('forced').disclosure, 'visible', 'primary information is never collapsed, even when the brief asks');
});

test('screens without new planning metadata validate and assess exactly as before', async () => {
  for (const pattern of (await listPatterns()).filter(item => item.screenMode && !item.archetype)) {
    const { screen } = await getPattern(pattern.id);
    assert.deepEqual((await validateScreen(screen)).diagnostics, [], pattern.id);
    const assessed = await assessScreen(screen);
    assert.equal(assessed.ok, true);
    assert.ok(assessed.assessment.criteria.length && assessed.assessment.signals, 'the earlier assessment fields remain');
    assert.ok(!assessed.assessment.findings.some(item => item.severity === 'error'), `${pattern.id}: no errors without a plan`);
  }
  /* A legacy plan is read as before: no version, no plan contract. */
  const legacy = { type: 'screen', meta: { plan: { pattern: 'report', purpose: 'p', questions: ['q'], rationale: 'r' } }, children: [{ component: 'syntari.text-block', props: { body: 'Hello.' } }] };
  assert.deepEqual((await validateScreen(legacy)).diagnostics, []);
});

test('a versioned plan is a contract: invalid fields and unknown nodes are errors', async () => {
  const spec = intent('statement-reconciliation');
  assert.deepEqual((await validateScreen(spec)).diagnostics, []);
  const unknown = clone(spec);
  unknown.meta.plan.informationPriority[0].nodes = ['nowhere'];
  unknown.meta.plan.actions.primary.node = 'missing-button';
  const codes = (await validateScreen(unknown)).diagnostics.map(item => item.code);
  assert.deepEqual(codes, ['plan-unknown-node', 'plan-unknown-node']);
  const invalid = clone(spec);
  invalid.meta.plan.mode = 'browse';
  invalid.meta.plan.archetype = 'kanban-board';
  invalid.meta.plan.informationPriority[1].priority = 'urgent';
  const result = await validateScreen(invalid);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.filter(item => item.code === 'plan-invalid').length >= 3);
  assert.ok(result.diagnostics.some(item => /kanban-board/.test(item.message)));
});

test('split layouts, emphasis, and surfaces are optional Screen IR, checked like layouts', async () => {
  const base = { type: 'screen', layout: 'split', children: [{ type: 'section', heading: 'Main', emphasis: 'primary', children: [] }, { type: 'section', heading: 'Aside', surface: 'panel', children: [] }] };
  assert.deepEqual((await validateScreen(base)).diagnostics, []);
  const odd = clone(base);
  odd.children.push({ type: 'section', heading: 'Third', emphasis: 'loud', surface: 'shadow', children: [] });
  assert.deepEqual((await validateScreen(odd)).diagnostics.map(item => `${item.severity}:${item.code}`).sort(), ['warning:split-shape', 'warning:unknown-emphasis', 'warning:unknown-surface']);
});

test('intent-aware screens pass the quality gate; every baseline is reviewed with named rules', async () => {
  for (const item of scenarios) {
    const composed = await assessScreen(screenFor(item, 'intent', policy));
    assert.equal(composed.ok, true, item.id);
    assert.equal(composed.assessment.quality.gate, 'pass', `${item.id}: ${rules(composed).join(', ')}`);
    const baseline = await assessScreen(screenFor(item, 'baseline', policy), { plan: planFor(item, policy, { nodes: 'baseline' }).plan });
    assert.equal(baseline.ok, true, `${item.id} baseline is valid Screen IR: the baseline is not broken on purpose`);
    assert.ok(baseline.assessment.findings.some(found => found.severity === 'warning'), `${item.id} baseline has at least one warning`);
    for (const found of [...composed.assessment.findings, ...baseline.assessment.findings]) assert.equal(found.severity, policy.lint.rules[found.rule]?.severity ?? 'warning', `${found.rule} keeps the policy's severity`);
  }
});

test('hiding what a decision needs is an error, with a repair that only opens the region', async () => {
  const spec = assignIds(intent('statement-reconciliation'));
  const review = nodeOf(spec, 'review');
  const index = review.children.findIndex(child => child.id === 'differences');
  review.children[index] = { id: 'hidden-differences', type: 'region', label: 'Differences', children: [review.children[index]] };
  const assessed = await assessScreen(spec);
  const hidden = finding(assessed, 'hidden-decision-input');
  assert.equal(hidden.severity, 'error');
  assert.equal(hidden.node, 'differences');
  assert.deepEqual(hidden.repair, { op: 'replace', target: 'hidden-differences', set: { open: true }, reason: 'Show values that differ from the record by default.' });
  assert.equal(assessed.assessment.quality.gate, 'fail');
  const repaired = await repairScreen(spec);
  assert.equal(repaired.ok, true, JSON.stringify(repaired.diagnostics));
  assert.equal(nodeOf(repaired.spec, 'hidden-differences').open, true);
  /* Nothing but the region's disclosure changed: every record, figure, and other node is as it was. */
  assert.deepEqual(diffScreens(spec, repaired.spec).map(item => [item.id, item.fields]), [['hidden-differences', ['open']]]);
  assert.equal((await assessScreen(repaired.spec)).assessment.quality.gate, 'pass');
});

test('an exception that is present is never collapsed; reference that is open can be closed safely', async () => {
  const spec = assignIds(intent('support-queue'));
  const queue = nodeOf(spec, 'queue');
  queue.children[0] = { id: 'alerts', type: 'region', label: 'Alerts', children: [queue.children[0]] };
  nodeOf(spec, 'team').open = true;
  const assessed = await assessScreen(spec);
  assert.equal(finding(assessed, 'hidden-exception').node, 'breach-banner');
  const open = finding(assessed, 'supporting-expanded');
  assert.deepEqual([open.severity, open.repair.target, open.repair.set], ['suggestion', 'team', { open: false }]);
  assert.deepEqual(assessed.assessment.repair.operations.map(item => [item.target, item.set.open]).sort(), [['alerts', true], ['team', false]]);
});

test('measures on a task screen are flagged unless a decision depends on them', async () => {
  const spec = intent('advisor-overview');
  const kpi = { id: 'kpis', component: 'syntari.stat-row', props: { stats: [{ label: 'Assets', value: '€184.2M', note: 'this quarter' }, { label: 'Households', value: '42', note: 'active' }] } };
  nodeOf(spec, 'work').children.unshift(kpi);
  assert.equal(finding(await assessScreen(spec), 'kpi-grid-on-task-screen').node, 'kpis');
  /* When the plan says a decision depends on the measure, it belongs. */
  spec.meta.plan.informationPriority.push({ id: 'capacity', label: 'Capacity', kind: 'aggregate-metric', priority: 'primary', disclosure: 'visible', neededFor: ['take on a new household'], nodes: ['kpis'] });
  assert.equal(finding(await assessScreen(spec), 'kpi-grid-on-task-screen'), undefined);
});

test('surfaces need a reason: cards in panels, cards for lists, and cards for settings', async () => {
  const spec = intent('advisor-overview');
  const card = id => ({ id, component: 'syntari.card', props: { title: `Item ${id}`, body: 'One task.', action: 'Open' } });
  nodeOf(spec, 'selected').children.push(card('nested'));
  nodeOf(spec, 'work').children.push({ id: 'cards', type: 'section', heading: 'Tasks as cards', children: [card('a'), card('b'), card('c')] });
  const assessed = await assessScreen(spec);
  assert.equal(finding(assessed, 'nested-surface').node, 'nested');
  assert.ok(rules(assessed).includes('card-as-grouping'));
  assert.ok(rules(assessed).includes('action-per-card'));
  const settings = await assessScreen(screenFor(scenario('firm-settings'), 'baseline', policy), { plan: planFor(scenario('firm-settings'), policy, { nodes: 'baseline' }).plan });
  assert.ok(rules(settings).includes('card-per-item') && rules(settings).includes('everything-at-once'));
});

test('one decision per part: approvals compete, separate settings forms do not', async () => {
  const forms = await assessScreen(intent('firm-settings'));
  assert.ok(!rules(forms).includes('competing-primary-actions'), 'each settings group saves on its own');
  const spec = intent('statement-reconciliation');
  nodeOf(spec, 'review').children.push({ id: 'second', component: 'syntari.approval-card', props: { title: 'Also approve', summary: 'Another decision.' } });
  assert.ok(rules(await assessScreen(spec)).includes('competing-primary-actions'));
});

test('content economy: restated figures, vague summaries of change, and queues without an order', async () => {
  const spec = intent('plan-approval');
  nodeOf(spec, 'why').props.body = 'Retirement moves from 62 to 64, saving falls from €2,400 to €1,850, and the chance of meeting goals rises from 71% to 88%.';
  assert.ok(rules(await assessScreen(spec)).includes('restated-content'));
  const vague = intent('plan-approval');
  nodeOf(vague, 'why').props.body = 'Several values in the plan change if it is approved.';
  assert.ok(rules(await assessScreen(vague)).includes('vague-change-summary'));
  const queue = intent('work-queue');
  const table = nodeOf(queue, 'task-table');
  table.props.columns = table.props.columns.slice(1);
  table.props.rows = table.props.rows.map(row => row.slice(1));
  assert.equal(finding(await assessScreen(queue), 'unranked-queue').node, 'task-table');
});

test('evidence reviews show consequences before a decision', async () => {
  const spec = intent('freight-invoice');
  const audit = nodeOf(spec, 'audit');
  audit.children = audit.children.filter(child => child.id !== 'payment-section');
  spec.meta.plan.informationPriority = spec.meta.plan.informationPriority.map(item => item.kind === 'impact' ? { ...item, nodes: undefined } : item).map(({ nodes, ...item }) => nodes ? { ...item, nodes } : item);
  assert.equal(finding(await assessScreen(spec), 'decision-without-impact').node, 'approve');
});

test('a baseline that hides its source is repaired by opening the region, against the plan for the same brief', async () => {
  const item = scenario('statement-reconciliation');
  const plan = planFor(item, policy, { nodes: 'baseline' }).plan;
  const spec = screenFor(item, 'baseline', policy);
  assert.equal((await assessScreen(spec, { plan })).assessment.quality.gate, 'fail');
  const repaired = await repairScreen(spec, { plan });
  assert.equal(repaired.ok, true);
  assert.deepEqual(repaired.change.operations.map(op => [op.target, op.set]), [['source', { open: true }]]);
  assert.equal((await assessScreen(repaired.spec, { plan })).assessment.quality.gate, 'review', 'the rest of the baseline is left for a person or a model to recompose');
});

test('repairs never change data: a change that edits records is still refused', async () => {
  const spec = assignIds(intent('work-queue'));
  const refused = await applyScreenOperations(spec, { version: 'syntari-ops-1', base: versionOf(spec), summary: 'Tidy the queue', operations: [{ op: 'replace', target: 'task-table', set: { 'props.rows': [['Today', 'Okoro', 'Approve plan update', 'You']] } }] });
  assert.equal(refused.ok, false);
  assert.ok(refused.diagnostics.some(item => item.code === 'protected-data'));
  const nothing = await repairScreen(intent('work-queue'));
  assert.equal(nothing.unchanged, true, 'a screen with nothing safe to repair is returned as it was');
});

test('archetype patterns carry an example, its anti-pattern, the differences, and the archetype guidance', async () => {
  for (const pattern of (await listPatterns()).filter(item => item.archetype)) {
    const full = await getPattern(pattern.id);
    assert.deepEqual((await validateScreen(full.screen)).diagnostics, [], `${pattern.id} example`);
    assert.equal((await assessScreen(full.screen)).assessment.quality.gate, 'pass');
    assert.equal((await validateScreen(full.antiExampleScreen)).ok, true, `${pattern.id} anti-pattern is valid IR`);
    assert.ok(full.differences.length && full.guidance.hierarchy.length && full.guidance.contraindications.length && full.guidance.layouts.length && full.guidance.states.length);
  }
  const guidance = await getCompositionGuidance({ archetype: 'evidence-review', components: ['value-diff', 'card'] });
  assert.equal(guidance.archetypes['evidence-review'].zones[0].id, 'source');
  assert.equal(guidance.components.card.composition.surface, 'card');
  assert.equal(guidance.patterns[0].antiExample, 'freight-invoice-baseline');
  assert.equal(await getCompositionGuidance({ archetype: 'kanban' }), null);
});

test('hand-written markup is checked as text, and says what it cannot see', async () => {
  const html = `<main><div class="banner info"><div>Welcome back</div></div>
  <div class="stat-row"><div class="stat-card">AUM</div><div class="stat-card">Households</div></div>
  <section class="panel"><div class="mini-card"><button class="button primary">Open</button></div><div class="mini-card"><button class="button primary">Open</button></div><div class="mini-card"></div></section>
  <hr><hr><div class="divider"></div></main>`;
  const { plan } = await planScreen(scenario('advisor-overview').brief);
  const result = await lintMarkup(html, { plan, file: 'overview.html' });
  const found = result.findings.map(item => item.rule);
  for (const rule of ['nested-surface', 'card-as-grouping', 'competing-primary-actions', 'divider-as-spacing', 'banner-without-exception', 'kpi-grid-on-task-screen']) assert.ok(found.includes(rule), rule);
  assert.ok(!result.findings.some(item => item.rule === 'nested-surface' && /stat-card/.test(item.message)), 'a component’s own parts are not a second surface');
  assert.equal(result.mode, 'source');
  assert.match(result.limits, /not seen/);
  assert.deepEqual(result.components, ['banner', 'card', 'stat-row']);
  const jsx = await lintMarkup('<Card className="card"><Card className="card"><Button variant="primary">A</Button><Button variant="primary">B</Button></Card></Card>');
  assert.ok(jsx.findings.some(item => item.rule === 'nested-surface') && jsx.findings.some(item => item.rule === 'competing-primary-actions') && jsx.findings.some(item => item.rule === 'missing-plan'));
});

test('installed projects carry composition rules generated from the policy', async () => {
  const rules = await getCompositionRules();
  for (const archetype of Object.values(policy.archetypes)) assert.ok(rules.includes(`### ${archetype.label}`), archetype.label);
  for (const id of Object.keys(policy.lint.rules)) assert.ok(rules.includes(`\`${id}\``), id);
  assert.equal(`${rules}\n`, await readFile(new URL('../kit/runtime/COMPOSITION.md', import.meta.url), 'utf8'));
});

test('a rendered review is an optional adapter, labelled a judgment and never merged into validation', async () => {
  const spec = intent('statement-reconciliation');
  assert.equal((await assessRenderedScreen({ spec })).available, false);
  const malformed = await assessRenderedScreen({ spec }, { adapter: async () => ({ verdict: 'beautiful', score: 9 }) });
  assert.equal(malformed.ok, false);
  let received;
  const review = await assessRenderedScreen({ spec, screenshot: 'png-bytes', viewport: { width: 390, height: 844 } }, { adapter: async input => { received = input; return { source: 'test reviewer', observations: [{ criterion: 'responsive', kind: 'concern', observation: 'The decision is below the fold on a phone.', node: 'save' }] }; } });
  assert.equal(received.plan.archetype, 'evidence-review', 'the adapter sees the plan');
  assert.deepEqual([review.deterministic, review.source, review.observations.length], [false, 'test reviewer', 1]);
  assert.match(review.note, /not validation/);
  assert.deepEqual((await validateScreen(spec)).diagnostics, [], 'validation is unaffected');
});

test('agents reach planning, guidance, and markup checks through MCP', async () => {
  const client = new Client({ name: 'syntari-test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['cli.mjs', 'mcp'], stderr: 'pipe' }));
  try {
    assert.match(client.getInstructions(), /plan_screen/);
    const planned = (await client.callTool({ name: 'plan_screen', arguments: { brief: scenario('freight-invoice').brief } })).structuredContent;
    assert.equal(planned.plan.archetype, 'evidence-review');
    const guidance = (await client.callTool({ name: 'get_composition_guidance', arguments: { archetype: 'task-triage', components: ['stat-row'] } })).structuredContent;
    assert.ok(guidance.components['stat-row'].composition.archetypes.avoid.includes('task-triage'));
    assert.equal((await client.callTool({ name: 'get_composition_guidance', arguments: { archetype: 'kanban' } })).isError, true);
    const baseline = screenFor(scenario('freight-invoice'), 'baseline', policy);
    const assessed = (await client.callTool({ name: 'assess_composition', arguments: { screen: baseline, plan: planned.plan } })).structuredContent;
    assert.ok(assessed.assessment.findings.some(item => item.rule === 'decision-without-impact'));
    const markup = (await client.callTool({ name: 'lint_markup', arguments: { markup: '<hr><hr><hr>', file: 'a.html' } })).structuredContent;
    assert.ok(markup.findings.some(item => item.rule === 'divider-as-spacing'));
    const pattern = (await client.callTool({ name: 'get_pattern', arguments: { id: 'evidence-review' } })).structuredContent;
    assert.ok(pattern.screen && pattern.antiExampleScreen && pattern.guidance);
  } finally { await client.close(); }
});
