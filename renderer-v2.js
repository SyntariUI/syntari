/**
 * Syntari composition lab (/renderer/v2/). The same request, data, and tasks under two conditions: the baseline,
 * composed by following the guidance that existed before intent-aware planning, and the screen composed from
 * plan_screen's plan. The canvas shows the screens; the inspector shows why: the plan, deterministic findings, what
 * differs, and the Screen IR. Nothing here calls a model; every finding is a named rule.
 */
import { validate, applyOperations, assignIds, versionOf, diffScreens } from './ir.js';
import { assessComposition } from './ir-compose.js';
import { scenarios, products, planFor, screenFor } from './benchmarks/index.js';

const $ = selector => document.querySelector(selector);
const h = (tag, attributes = {}, ...children) => {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') element.className = value;
    else if (key === 'text') element.textContent = value;
    else if (key.startsWith('on')) element.addEventListener(key.slice(2), value);
    else element.setAttribute(key, value === true ? '' : value);
  }
  element.append(...children.flat().filter(child => child !== null && child !== undefined && child !== false).map(child => typeof child === 'string' ? document.createTextNode(child) : child));
  return element;
};
const CONDITIONS = { baseline: 'Baseline', intent: 'Intent-aware' };
const params = new URLSearchParams(location.search);
const state = {
  scenario: scenarios.some(item => item.id === params.get('scenario')) ? params.get('scenario') : scenarios[0].id,
  condition: ['baseline', 'intent', 'compare'].includes(params.get('condition')) ? params.get('condition') : 'intent',
  viewport: params.get('viewport') === 'mobile' ? 'mobile' : 'desktop',
  tab: ['plan', 'findings', 'changes', 'ir'].includes(params.get('tab')) ? params.get('tab') : 'plan'
};
/** Each condition's screen and the repairs applied to it in this visit, newest last. */
const iterations = new Map();
const actions = [];
let policy;
let generation = 0;

const scenario = () => scenarios.find(item => item.id === state.scenario);
const key = condition => `${state.scenario}:${condition}`;
function stepsOf(condition) {
  if (!iterations.has(key(condition))) iterations.set(key(condition), [{ spec: assignIds(screenFor(scenario(), condition, policy)), label: condition === 'baseline' ? 'As composed under the earlier guidance' : 'As composed from the plan' }]);
  return iterations.get(key(condition));
}
const current = condition => stepsOf(condition).at(-1).spec;

/** Validation and the composition assessment for one condition. The baseline has no plan of its own: it is read against the plan for the same brief. */
async function evaluate(condition) {
  const spec = current(condition);
  const checked = await validate(spec);
  const plan = condition === 'baseline' ? planFor(scenario(), policy, { nodes: false }).plan : null;
  const assessment = assessComposition(spec, { policy, resolved: checked.screen, model: checked.data, diagnostics: checked.diagnostics, plan, base: versionOf(spec) });
  return { condition, spec, checked, assessment };
}

/* ---------- Frames: each screen renders in its own document, at its own width ---------- */
const waiting = new Map();
window.addEventListener('message', event => {
  if (event.origin !== location.origin) return;
  const { type } = event.data ?? {};
  if (type === 'syntari-lab:ready') waiting.get(event.source)?.();
  if (type === 'syntari-lab:action') {
    const { detail } = event.data;
    actions.unshift({ at: new Date(), detail });
    announce(`${detail.component} asked to ${detail.action}${detail.index !== undefined ? ` on row ${detail.index + 1}` : ''}. The lab performs nothing; a host would decide.`);
    if (state.tab === 'changes') paintChanges(lastResults);
  }
});
function frameFor(condition, result) {
  const iframe = h('iframe', { src: '/renderer/v2/frame.html', title: `${CONDITIONS[condition]} screen: ${scenario().title}`, loading: 'eager' });
  const ready = new Promise(resolve => iframe.addEventListener('load', () => { waiting.set(iframe.contentWindow, resolve); }, { once: true }));
  const gate = result.assessment.quality;
  const figure = h('figure', { class: 'lab-frame', 'data-condition': condition },
    h('figcaption', {}, h('strong', { text: CONDITIONS[condition] }), h('span', { class: `lab-gate is-${gate.gate}`, text: gateLabel(gate) })),
    h('div', { class: 'lab-viewport', 'data-viewport': state.viewport }, iframe));
  return { figure, render: async token => { await ready; iframe.contentWindow.postMessage({ type: 'syntari-lab:render', spec: result.spec, theme: document.documentElement.dataset.theme, token }, location.origin); } };
}
const gateLabel = gate => `${gate.gate === 'pass' ? 'Passes' : gate.gate === 'review' ? 'Review' : 'Fails'} · ${gate.counts.errors + gate.counts.validationErrors} errors, ${gate.counts.warnings} warnings, ${gate.counts.suggestions} suggestions`;

/* ---------- The inspector ---------- */
const term = (label, ...value) => h('div', { class: 'lab-term' }, h('dt', { text: label }), h('dd', {}, ...value));
const chip = (text, tone = '') => h('span', { class: `lab-chip ${tone}`, text });
const heading = text => h('h2', { class: 'lab-heading', text });

function paintPlan() {
  const s = scenario();
  const { plan, cues } = planFor(s, policy);
  const archetype = policy.archetypes[plan.archetype];
  const panel = $('[data-panel="plan"]');
  panel.replaceChildren(
    h('p', { class: 'lab-note' }, 'A plan is the public summary of a design decision, produced from the brief by the composition policy’s rules. It is not model reasoning. Both conditions serve this plan’s job; only the intent-aware screen was composed from it.'),
    heading('Recognized intent'),
    h('dl', { class: 'lab-terms' },
      term('Person', plan.userRole),
      term('Job', plan.primaryJob),
      term('Mode', `${policy.jobs[plan.mode]?.label ?? plan.mode}: ${policy.jobs[plan.mode]?.means ?? ''}`),
      plan.userDecisions?.length ? term('Decisions', h('ul', {}, plan.userDecisions.map(item => h('li', { text: item })))) : null,
      term('Status', plan.status === 'ready' ? 'Ready: the brief states the job and the information.' : 'Needs context')),
    ...(plan.terminology ?? []).map(note => h('p', { class: 'lab-callout', text: note })),
    heading('Archetype'),
    h('p', { class: 'lab-lead' }, h('strong', { text: archetype.label }), ` · ${archetype.goal}`),
    h('details', { class: 'lab-details' }, h('summary', { text: `Alternatives considered · ${plan.alternativesConsidered.length}` }),
      h('ul', { class: 'lab-list' }, plan.alternativesConsidered.map(item => h('li', {}, h('strong', { text: policy.archetypes[item.archetype]?.label ?? item.archetype }), ` · ${item.reason}`)))),
    heading('Information priority'),
    h('table', { class: 'lab-table' },
      h('caption', { class: 'sr-only', text: 'Each piece of information with its priority, disclosure, and the nodes that show it' }),
      h('thead', {}, h('tr', {}, ['Information', 'Priority', 'Disclosure', 'Shown by'].map(text => h('th', { scope: 'col', text })))),
      h('tbody', {}, plan.informationPriority.map(item => h('tr', {},
        h('th', { scope: 'row' }, item.label, item.reason ? h('small', { text: item.reason }) : null),
        h('td', {}, chip(item.priority, `is-${item.priority}`)),
        h('td', { text: item.disclosure + (item.exception !== undefined ? (item.exception ? ', present' : ', absent') : '') }),
        h('td', { class: 'lab-mono', text: (item.nodes ?? []).join(', ') || '—' }))))),
    heading('Layout and disclosure'),
    h('dl', { class: 'lab-terms' },
      term('Layout', `${plan.layoutStrategy.layout} · ${plan.layoutStrategy.reason}`),
      term('On a narrow screen', plan.layoutStrategy.mobile),
      term('Disclosure', plan.disclosureStrategy),
      plan.interactionRequirements.length ? term('Interactions', h('ul', {}, plan.interactionRequirements.map(item => h('li', { text: item })))) : null),
    heading('Components'),
    h('ul', { class: 'lab-list' }, plan.componentCandidates.map(item => h('li', {}, h('code', { text: item.component }), ` for ${plan.informationPriority.find(info => info.id === item.for)?.label.toLowerCase() ?? item.for}. ${item.reason}`))),
    h('details', { class: 'lab-details', open: true }, h('summary', { text: `Avoid · ${plan.avoid.length}` }),
      h('ul', { class: 'lab-list' }, plan.avoid.map(item => h('li', {}, h('code', { text: item.id }), ` · ${item.reason}`)))),
    heading('Rationale'),
    h('p', { class: 'lab-body', text: plan.designRationale }),
    cues.modes.length || cues.subjects.length ? h('p', { class: 'lab-note' }, `Words in the request, read as cues only: ${[...cues.modes, ...cues.subjects].map(item => `${item.id} (“${item.words.join('”, “')}”)`).join(', ')}. They do not decide the archetype when the brief states the job.`) : null
  );
}

function findingItem(finding, condition) {
  return h('li', { class: `lab-finding is-${finding.severity}` },
    h('div', { class: 'lab-finding-head' }, chip(finding.severity, `is-${finding.severity}`), h('code', { text: finding.rule }), finding.node ? h('span', { class: 'lab-mono', text: finding.node }) : null, finding.autofix ? chip('safe repair', 'is-repair') : null),
    h('p', { text: finding.message }),
    h('p', { class: 'lab-fix', text: finding.fix }));
}
function findingsFor(result, compact = false) {
  const { assessment, checked } = result;
  const errors = checked.diagnostics.filter(item => item.severity === 'error');
  const warnings = checked.diagnostics.filter(item => item.severity === 'warning');
  const order = { error: 0, warning: 1, suggestion: 2 };
  const findings = [...assessment.findings].sort((a, b) => order[a.severity] - order[b.severity]);
  const repairs = assessment.repair?.operations.length ?? 0;
  return h('div', { class: 'lab-findings', 'data-findings': result.condition },
    h('h2', { class: 'lab-heading' }, `${CONDITIONS[result.condition]} `, h('span', { class: `lab-gate is-${assessment.quality.gate}`, text: gateLabel(assessment.quality) })),
    h('p', { class: 'lab-subheading', text: 'Validation' }),
    h('p', { class: 'lab-body', text: errors.length || warnings.length ? `${errors.length} errors and ${warnings.length} warnings stop or change what renders.` : `Valid: every node matches its contract${result.spec.meta?.plan?.version === 'syntari-plan-1' ? ', and the plan names nodes that exist' : ''}.` }),
    errors.length || warnings.length ? h('ul', { class: 'lab-list' }, [...errors, ...warnings].map(item => h('li', {}, h('code', { text: item.code }), ` ${item.path} · ${item.message}`))) : null,
    h('p', { class: 'lab-subheading', text: `Composition findings · ${findings.length}` }),
    findings.length ? h('ul', { class: 'lab-findings-list' }, findings.map(item => findingItem(item, result.condition))) : h('p', { class: 'lab-body', text: 'No findings.' }),
    repairs ? h('button', { type: 'button', class: 'lab-button', 'data-repair': result.condition, onclick: () => repair(result) }, `Apply ${repairs} safe ${repairs === 1 ? 'repair' : 'repairs'}`) : null,
    compact ? null : h('details', { class: 'lab-details' }, h('summary', { text: 'Criteria' }),
      h('ul', { class: 'lab-criteria' }, assessment.quality.criteria.map(item => h('li', {}, h('span', { text: item.label }), chip(item.verdict.replace(/-/g, ' '), `is-${item.verdict}`))))));
}
function paintFindings(results) {
  $('[data-panel="findings"]').replaceChildren(
    h('p', { class: 'lab-note' }, 'Every finding is a deterministic rule over the screen, its plan, and the registry (lint.rules in the composition policy). Errors are unsafe or invalid; warnings are probable problems; suggestions are one good answer among several. Responsive layout and contrast need a rendered review and are not judged here.'),
    ...results.map(result => findingsFor(result, results.length > 1)));
}
function paintChanges(results) {
  const s = scenario();
  const count = (result, severity) => result.assessment.findings.filter(item => item.severity === severity).length;
  const both = state.condition === 'compare' ? results : ['baseline', 'intent'].map(condition => lastAll?.find(item => item.condition === condition)).filter(Boolean);
  $('[data-panel="changes"]').replaceChildren(
    heading('Rule-based difference'),
    h('table', { class: 'lab-table' }, h('caption', { class: 'sr-only', text: 'Findings for each condition' }),
      h('thead', {}, h('tr', {}, ['', 'Errors', 'Warnings', 'Suggestions', 'Gate'].map(text => h('th', { scope: 'col', text })))),
      h('tbody', {}, both.map(result => h('tr', {}, h('th', { scope: 'row', text: CONDITIONS[result.condition] }), h('td', { text: String(count(result, 'error') + result.checked.diagnostics.filter(item => item.severity === 'error').length) }), h('td', { text: String(count(result, 'warning')) }), h('td', { text: String(count(result, 'suggestion')) }), h('td', {}, h('span', { class: `lab-gate is-${result.assessment.quality.gate}`, text: result.assessment.quality.gate })))))),
    h('p', { class: 'lab-note', text: 'Counts of named rules, not a quality score. The baseline is read against the plan for the same brief, without node ids, so rules that need them do not apply to it.' }),
    heading('How the baseline was composed'),
    h('p', { class: 'lab-body', text: s.baseline.derivation }),
    heading('What differs'),
    h('p', { class: 'lab-note', text: 'Authored observations about these two screens. They are a reading, not a measurement.' }),
    h('ul', { class: 'lab-list' }, s.observations.map(item => h('li', { text: item }))),
    heading('Iterations'),
    ...['baseline', 'intent'].map(condition => {
      const steps = stepsOf(condition);
      return h('div', { class: 'lab-iterations' }, h('p', { class: 'lab-subheading', text: CONDITIONS[condition] }),
        h('ol', { class: 'lab-list' }, steps.map((step, i) => h('li', {}, h('strong', { text: i === 0 ? 'Composed' : `Repair ${i}` }), ` · ${step.label}`, step.diff?.length ? h('ul', {}, step.diff.map(item => h('li', { class: 'lab-mono', text: `${item.kind} ${item.id ?? item.path ?? ''}${item.fields ? ` (${item.fields.join(', ')})` : ''}` }))) : null))));
    }),
    heading('Actions requested'),
    actions.length ? h('ul', { class: 'lab-list' }, actions.slice(0, 8).map(item => h('li', { class: 'lab-mono', text: `${item.detail.component} · ${item.detail.action}${item.detail.index !== undefined ? ` · row ${item.detail.index + 1}` : ''}${item.detail.values ? ` · ${JSON.stringify(item.detail.values)}` : ''}` }))) : h('p', { class: 'lab-body', text: 'None yet. Requests from the screen are listed here; the lab performs none of them.' })
  );
}
function paintIr(results) {
  $('[data-panel="ir"]').replaceChildren(...results.map(result => {
    const text = JSON.stringify(result.spec, null, 2);
    const status = h('span', { class: 'lab-note', role: 'status' });
    return h('div', { class: 'lab-ir' },
      h('div', { class: 'lab-ir-head' }, h('h2', { class: 'lab-heading', text: `${CONDITIONS[result.condition]} Screen IR` }),
        h('button', { type: 'button', class: 'lab-button is-quiet', onclick: async () => { try { await navigator.clipboard.writeText(text); status.textContent = 'Copied.'; } catch { status.textContent = 'Copy is not available here.'; } } }, 'Copy')), status,
      h('pre', { class: 'lab-code', tabindex: '0' }, h('code', { text })));
  }));
}

/* ---------- Repair: only disclosure and emphasis change, through the same operations a model would propose ---------- */
async function repair(result) {
  const change = result.assessment.repair;
  if (!change) return;
  const applied = await applyOperations(result.spec, change, { data: 'strict' });
  if (!applied.ok) { announce(`The repair was refused: ${applied.diagnostics.map(item => item.message).join(' ')}`); return; }
  stepsOf(result.condition).push({ spec: applied.spec, label: change.operations.map(operation => operation.reason ?? `${operation.op} ${operation.target}`).join(' '), diff: diffScreens(result.spec, applied.spec) });
  announce(`Applied ${change.operations.length} safe ${change.operations.length === 1 ? 'repair' : 'repairs'} to the ${CONDITIONS[result.condition].toLowerCase()} screen.`);
  await paint();
}

/* ---------- Painting ---------- */
let lastResults = [], lastAll = [];
async function paint() {
  const token = ++generation;
  const s = scenario();
  $('[data-lab-request]').textContent = s.request;
  const conditions = state.condition === 'compare' ? ['baseline', 'intent'] : [state.condition];
  const all = await Promise.all(['baseline', 'intent'].map(evaluate));
  if (token !== generation) return;
  lastAll = all;
  const results = all.filter(result => conditions.includes(result.condition));
  lastResults = results;
  const frames = results.map(result => frameFor(result.condition, result));
  const container = $('[data-lab-frames]');
  container.dataset.count = String(frames.length);
  container.dataset.viewport = state.viewport;
  container.replaceChildren(...frames.map(frame => frame.figure));
  await Promise.all(frames.map(frame => frame.render(token)));
  paintPlan();
  paintFindings(results);
  paintChanges(results);
  paintIr(results);
  syncControls();
  announce(`${s.title}: ${results.map(result => `${CONDITIONS[result.condition]}, ${gateLabel(result.assessment.quality)}`).join('; ')}.`);
}
function announce(text) { $('[data-lab-status]').textContent = text; }
function syncControls() {
  for (const group of ['condition', 'viewport']) for (const button of document.querySelectorAll(`[data-lab-${group}] button`)) button.setAttribute('aria-pressed', String(button.value === state[group]));
  for (const tab of document.querySelectorAll('[role=tab]')) {
    const on = tab.dataset.tab === state.tab;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    document.querySelector(`[data-panel="${tab.dataset.tab}"]`).hidden = !on;
  }
  const url = new URL(location.href);
  for (const [name, value] of Object.entries(state)) url.searchParams.set(name, value);
  window.history.replaceState(null, '', url);
}

async function start() {
  policy = await (await fetch('/registry/composition-policy.json')).json();
  const select = $('[data-lab-scenario]');
  select.replaceChildren(...products.map(product => h('optgroup', { label: product }, scenarios.filter(item => item.product === product).map(item => h('option', { value: item.id, text: item.title })))));
  select.value = state.scenario;
  select.addEventListener('change', () => { state.scenario = select.value; paint(); });
  for (const group of ['condition', 'viewport']) $(`[data-lab-${group}]`).addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || state[group] === button.value) return;
    state[group] = button.value;
    paint();
  });
  const tabs = [...document.querySelectorAll('[role=tab]')];
  const choose = tab => { state.tab = tab.dataset.tab; syncControls(); if (state.tab === 'changes') paintChanges(lastResults); tab.focus(); };
  for (const tab of tabs) {
    tab.addEventListener('click', () => choose(tab));
    tab.addEventListener('keydown', event => {
      const step = { ArrowRight: 1, ArrowLeft: -1, Home: -tabs.indexOf(tab), End: tabs.length - 1 - tabs.indexOf(tab) }[event.key];
      if (step === undefined) return;
      event.preventDefault();
      choose(tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length]);
    });
  }
  $('[data-lab-theme]').addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('syntari-theme', theme); } catch {}
    paint();
  });
  const inspect = $('[data-lab-inspect]');
  const narrow = matchMedia('(max-width: 900px)');
  const setInspector = open => { $('[data-lab-shell]').dataset.inspector = open ? 'open' : 'closed'; inspect.setAttribute('aria-expanded', String(open)); $('[data-lab-inspector]').inert = !open; };
  setInspector(!narrow.matches);
  inspect.addEventListener('click', () => setInspector(inspect.getAttribute('aria-expanded') !== 'true'));
  await paint();
}
start().catch(error => announce(`The lab could not start: ${error.message}`));
