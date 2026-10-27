/**
 * Syntari composition linting: whether a valid screen serves the job it was made for.
 *
 * Validation decides what can render. Linting reads the rendered structure against the composition plan (meta.plan,
 * syntari-plan-1) and the registry's policy, and reports what a design review would: information hidden from a decision,
 * reference before the task, boxes inside boxes, paragraphs that restate the figures beside them, a queue with no order.
 * Every rule is deterministic and names itself; nothing here is a model's opinion. Findings carry:
 *   { rule, severity: error | warning | suggestion, category, node, path, message, fix, autofix, repair? }
 * A repair is a syntari-ops-1 operation that only changes disclosure or emphasis, never data, so a host can apply it
 * with applyOperations() and the runtime's own protections.
 */
import { normalLabel } from './ir-data.js';
import { PLAN_VERSION } from './ir-plan.js';

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const slugOf = component => String(component ?? '').replace(/^syntari\./, '');
const KPI = ['stat-row', 'metric-strip', 'headline-metric'];
const DECISIONS = ['tool-approval', 'approval-card'];
const TASK_MODES = ['resolve', 'review', 'configure', 'create'];
const TASK_ARCHETYPES = ['task-triage', 'record-workspace', 'evidence-review', 'configuration-workspace'];
const ORDER_WORDS = /\b(due|deadline|priority|urgency|urgent|age|aged|waiting|overdue|sla|since|by|when|status|stage|next)\b/;

/** Every node in reading order, with its ancestors, so disclosure and containment can be read from the structure alone. */
export function structureOf(spec) {
  const out = [];
  const go = (children, path, ancestors) => (Array.isArray(children) ? children : []).forEach((node, i) => {
    if (!isObject(node)) return;
    const at = `${path ? `${path}.` : ''}children[${i}]`;
    const entry = { node, path: at, index: i, ancestors, order: out.length, siblings: children };
    out.push(entry);
    if (Array.isArray(node.children)) go(node.children, at, [...ancestors, entry]);
  });
  go(spec?.children, '', []);
  return out;
}
const closedRegion = entry => entry.ancestors.find(parent => parent.node.type === 'region' && parent.node.open !== true) ?? null;
const openRegion = entry => entry.ancestors.findLast(parent => parent.node.type === 'region' && parent.node.open === true) ?? null;
const ownRegion = entry => entry.node.type === 'region' ? entry : null;
const nameOf = entry => {
  const node = entry.node;
  if (node.type === 'section') return `“${node.heading}”`;
  if (node.type === 'region') return `the region “${node.label}”`;
  const title = node.props?.title ?? node.props?.caption ?? node.props?.message;
  return typeof title === 'string' ? `${slugOf(node.component)} “${title}”` : slugOf(node.component) || 'this part';
};
/** The figures written in a piece of text: 1,284 · 45.4% · €1.2M · −4.1 %. */
const figuresIn = value => (String(value ?? '').match(/[−+-]?[€$£]?\s?\d[\d.,]*\s?(%|pp|k|m|bn|€)?/gi) ?? []).map(figure => figure.replace(/\s/g, '').replace('−', '-').toLowerCase()).filter(figure => /\d/.test(figure) && figure.replace(/\D/g, '').length >= 2);
const stringsOf = (value, out = []) => { if (typeof value === 'string') out.push(value); else if (Array.isArray(value)) value.forEach(item => stringsOf(item, out)); else if (isObject(value)) Object.values(value).forEach(item => stringsOf(item, out)); return out; };

/** The boundary a component draws, from the policy's surfaces. */
export function surfaceOf(component, policy) {
  const slug = slugOf(component);
  for (const [kind, ids] of Object.entries(policy?.surfaces?.components ?? {})) if (ids.includes(slug)) return kind;
  return 'none';
}
/** The boundaries around an entry: sections with a surface, and regions, which draw a box unless inside a surface. */
function boundariesAround(entry) {
  const out = [];
  for (const parent of entry.ancestors) {
    if (parent.node.type === 'section' && ['inset', 'panel'].includes(parent.node.surface)) out.push({ kind: parent.node.surface, entry: parent });
    if (parent.node.type === 'region' && !out.length) out.push({ kind: 'disclosure', entry: parent });
  }
  return out;
}

/**
 * Lint a screen against its plan and the policy. options.plan supplies a plan for a screen that has none, such as the
 * plan for the same brief when comparing two screens for one job; nodes are then read from the screen itself.
 */
export function lintComposition(spec, { policy, plan: given = null } = {}) {
  const findings = [];
  const rules = policy?.lint?.rules ?? {};
  const add = (rule, entry, message, fix, extra = {}) => findings.push({
    rule, severity: rules[rule]?.severity ?? 'warning', category: rules[rule]?.category ?? 'composition',
    node: typeof entry?.node?.id === 'string' ? entry.node.id : null, path: entry?.path ?? '', message, fix, autofix: Boolean(extra.repair), ...extra
  });
  const entries = structureOf(spec);
  const byId = new Map(entries.filter(entry => typeof entry.node.id === 'string').map(entry => [entry.node.id, entry]));
  const components = entries.filter(entry => typeof entry.node.component === 'string');
  const own = isObject(spec?.meta?.plan) && spec.meta.plan.version === PLAN_VERSION ? spec.meta.plan : null;
  const plan = own ?? (isObject(given) && given.version === PLAN_VERSION ? given : null);
  const archetype = plan ? policy?.archetypes?.[plan.archetype] : null;

  /* ---------- The plan as a contract: valid, and naming nodes that exist ---------- */
  /* The plan's own contract (valid, naming nodes that exist) is checked by validate(): plan-invalid and plan-unknown-node. */
  if (!plan) add('missing-plan', null, 'This screen has no composition plan, so it cannot be checked against the job it serves.', 'Call plan_screen with a brief, compose from its zones, and put the plan in meta.plan with the node ids that show each piece of information.');
  const items = Array.isArray(plan?.informationPriority) ? plan.informationPriority.filter(isObject) : [];
  const nodesOf = item => (Array.isArray(item.nodes) ? item.nodes : []).map(id => byId.get(id)).filter(Boolean);
  if (plan && archetype && !archetype.jobs.includes(plan.mode)) add('archetype-mismatch', null, `The plan's job is to ${plan.mode}, but a ${archetype.label.toLowerCase()} serves ${archetype.jobs.join(', ')}.`, `Choose an archetype that serves ${plan.mode}; plan_screen ranks them for the brief.`);

  /* ---------- Disclosure: what a decision needs is never hidden; reference waits one step away ---------- */
  for (const item of items) for (const entry of nodesOf(item)) {
    const closed = closedRegion(entry) ?? (entry.node.type === 'region' && entry.node.open !== true ? entry : null);
    const repair = region => typeof region.node.id === 'string' ? { op: 'replace', target: region.node.id, set: { open: true }, reason: `Show ${item.label.toLowerCase()} by default.` } : undefined;
    if (closed && item.disclosure === 'on-exception' && item.exception === true) add('hidden-exception', entry, `${item.label} is present now, but it sits in ${nameOf(closed)}, which starts closed.`, 'Open the region, or move the exception out of it so it leads the screen.', { repair: repair(closed) });
    else if (closed && item.disclosure !== 'on-exception' && (item.priority === 'primary' || (Array.isArray(item.neededFor) && item.neededFor.length))) add('hidden-decision-input', entry, `${item.label} is ${item.priority === 'primary' ? 'primary' : 'needed for a decision'}, but it sits in ${nameOf(closed)}, which starts closed.`, 'Show it by default: open the region, or move it into the section that holds the decision.', { repair: repair(closed) });
    const open = openRegion(entry) ?? (entry.node.type === 'region' && entry.node.open === true ? entry : null);
    if (item.priority === 'reference' && ['collapsed', 'elsewhere'].includes(item.disclosure)) {
      if (open) add('supporting-expanded', entry, `${item.label} is reference, but ${nameOf(open)} starts open.`, 'Close the region; its label says what it holds.', { repair: typeof open.node.id === 'string' ? { op: 'replace', target: open.node.id, set: { open: false }, reason: `${item.label} is reference.` } : undefined });
      else if (!closedRegion(entry) && entry.node.type !== 'region') add('supporting-expanded', entry, `${item.label} is reference, but it is drawn in full by default.`, 'Put it in a closed region labelled with what it holds, or link to where it lives.');
    }
  }
  /* Reading order: nothing the plan calls reference comes before what it calls primary. */
  const firstOf = priority => Math.min(...items.filter(item => item.priority === priority).flatMap(item => nodesOf(item).map(entry => entry.order)), Infinity);
  const firstPrimary = firstOf('primary'), firstReference = firstOf('reference');
  if (firstReference < firstPrimary && firstPrimary !== Infinity) {
    const entry = entries[firstReference];
    add('priority-order', entry, `${nameOf(entry)} is reference, but it comes before the primary information.`, 'Move it after the primary parts, or into a closed region at the end.');
  }

  /* ---------- Task prominence and fit: the job decides the components, not their availability ---------- */
  const taskScreen = plan ? TASK_MODES.includes(plan.mode) || TASK_ARCHETYPES.includes(plan.archetype) : false;
  const decisiveKpi = new Set(items.filter(item => item.kind === 'aggregate-metric' && (item.priority === 'primary' || (Array.isArray(item.neededFor) && item.neededFor.length))).flatMap(item => Array.isArray(item.nodes) ? item.nodes : []));
  const kpis = components.filter(entry => KPI.includes(slugOf(entry.node.component)) && !closedRegion(entry));
  if (taskScreen) for (const entry of kpis) if (!decisiveKpi.has(entry.node.id)) add('kpi-grid-on-task-screen', entry, `${nameOf(entry)} puts headline measures on a screen whose job is to ${plan.mode}${archetype ? ` (${archetype.label.toLowerCase()})` : ''}; no decision here depends on them.`, 'Remove the block, or move the measures to a closed region of totals; if a decision depends on one, name it in the plan.');
  if (!plan && kpis.length && kpis[0].order === 0 && components.some(entry => DECISIONS.includes(slugOf(entry.node.component)))) add('kpi-grid-on-task-screen', kpis[0], `${nameOf(kpis[0])} opens a screen that asks for a decision, so measures come before the work.`, 'Lead with the decision and what it depends on; declare a plan to check this against the job.', { severity: 'suggestion' });

  /* A queue a person works through needs an order to act on: a due date, an age, a priority. */
  const queueNodes = new Set(items.filter(item => item.kind === 'pending-item').flatMap(item => Array.isArray(item.nodes) ? item.nodes : []));
  for (const entry of components) {
    const slug = slugOf(entry.node.component), props = isObject(entry.node.props) ? entry.node.props : {};
    const queue = queueNodes.has(entry.node.id) || (slug === 'table' && /\b(pending|queue|approvals|tasks|tickets|exceptions|inbox)\b/.test(normalLabel(props.caption)));
    if (!queue) continue;
    const ordered = slug === 'table' ? (Array.isArray(props.columns) ? props.columns : []).some(column => ORDER_WORDS.test(normalLabel(column?.label)))
      : slug === 'checklist' || slug === 'activity-list' ? (Array.isArray(props.items) ? props.items : []).some(item => typeof item?.time === 'string' && item.time.trim())
      : true;
    if (!ordered) add('unranked-queue', entry, `${nameOf(entry)} lists pending work with no due date, age, priority, or status to act on.`, 'Add the column a person orders their work by, and put the most urgent first.');
  }

  /* ---------- Actions: one primary decision per part, with its consequences in view ---------- */
  const parents = new Map();
  for (const entry of entries) {
    const decision = DECISIONS.includes(slugOf(entry.node.component)) || (entry.node.type === 'section' && typeof entry.node.submit === 'string');
    if (!decision) continue;
    const scope = entry.ancestors.at(-1)?.path ?? 'screen';
    parents.set(scope, [...(parents.get(scope) ?? []), entry]);
  }
  for (const group of parents.values()) if (group.length >= 2) add('competing-primary-actions', group[1], `${group.map(nameOf).join(' and ')} each ask for a decision in the same part of the screen, so neither leads.`, 'Keep one decision per part; put the others in the rows they belong to, or in their own parts.', { nodes: group.map(entry => entry.node.id).filter(Boolean) });
  const cardsWithAction = new Map();
  for (const entry of components) if (['card', 'approval-card'].includes(slugOf(entry.node.component)) && (entry.node.props?.action || slugOf(entry.node.component) === 'approval-card')) {
    const scope = entry.ancestors.at(-1)?.path ?? 'screen';
    cardsWithAction.set(scope, [...(cardsWithAction.get(scope) ?? []), entry]);
  }
  for (const group of cardsWithAction.values()) if (group.length >= 3) add('action-per-card', group[0], `${group.length} cards side by side each carry their own action, so no action leads and each label repeats.`, 'Show the items as rows with one action each, or one action for the selected item.', { nodes: group.map(entry => entry.node.id).filter(Boolean) });
  if (plan?.archetype === 'evidence-review') {
    const impact = items.filter(item => item.kind === 'impact').flatMap(nodesOf);
    const decision = components.find(entry => DECISIONS.includes(slugOf(entry.node.component))) ?? entries.find(entry => entry.node.type === 'section' && entry.node.submit);
    if (decision && !impact.length) add('decision-without-impact', decision, 'The decision to save asks for confirmation without showing what saving changes downstream.', 'Show each consequence with its value before and after (value-diff), next to the decision.');
  }

  /* ---------- Surfaces and dividers: every boundary has a reason ---------- */
  for (const entry of components) {
    const surface = surfaceOf(entry.node.component, policy);
    if (surface !== 'card') continue;
    const around = boundariesAround(entry);
    if (around.length) add('nested-surface', entry, `${nameOf(entry)} draws a card inside ${around[0].kind === 'disclosure' ? nameOf(around[0].entry) : `the ${around[0].kind} ${nameOf(around[0].entry)}`}: two boundaries around one piece of content.`, 'Show the content as plain content or a record inside the surface, or drop the outer boundary.');
  }
  const siblingsOf = new Map();
  for (const entry of components) if (slugOf(entry.node.component) === 'card') { const scope = entry.ancestors.at(-1)?.path ?? 'screen'; siblingsOf.set(scope, [...(siblingsOf.get(scope) ?? []), entry]); }
  for (const group of siblingsOf.values()) if (group.length >= 3) add('card-as-grouping', group[0], `${group.length} cards each hold one item of the same kind; boxes stand in for a list.`, 'Group them as rows of a table, a checklist, or a metadata list; keep a card for an object a person acts on alone.', { nodes: group.map(entry => entry.node.id).filter(Boolean) });
  for (const entry of entries) {
    if (entry.node.type !== 'region' || entry.index === 0) continue;
    const run = [];
    for (let i = entry.index; i >= 0 && entry.siblings[i]?.type === 'region'; i -= 1) run.push(i);
    if (run.length === 3 && entry.siblings[entry.index + 1]?.type !== 'region') add('stacked-disclosures', entry, `${run.length} closed regions in a row each draw their own boundary.`, 'Group what they hold into one region with sections inside it, or show what people always need in a section.');
    else if (run.length > 3 && entry.siblings[entry.index + 1]?.type !== 'region') add('stacked-disclosures', entry, `${run.length} regions in a row each draw their own boundary.`, 'Group what they hold into one region with sections inside it.');
  }

  /* ---------- Content economy: each fact once; text explains instead of restating ---------- */
  for (const entry of components) {
    const slug = slugOf(entry.node.component), props = isObject(entry.node.props) ? entry.node.props : {};
    if (slug === 'text-block' && typeof props.body === 'string') {
      const figures = new Set(figuresIn(props.body));
      const near = entry.siblings.filter(node => node !== entry.node && isObject(node));
      const shown = new Set(near.flatMap(node => stringsOf(node.props ?? {}).concat(stringsOf(node.children ?? [])).flatMap(figuresIn)));
      const repeated = [...figures].filter(figure => shown.has(figure));
      const labels = near.flatMap(node => stringsOf(node.props ?? {})).filter(value => value.length >= 6 && value.length <= 40).map(normalLabel);
      const body = normalLabel(props.body);
      const named = [...new Set(labels.filter(label => label.split(' ').length >= 2 && body.includes(label)))];
      if (repeated.length >= 2 || named.length >= 3) add('restated-content', entry, `This text repeats ${repeated.length >= 2 ? `${repeated.length} figures (${repeated.slice(0, 3).join(', ')})` : `${named.length} labels`} already shown beside it.`, 'Say what the figures mean or what to do about them, or remove the text.');
    }
    if (slug === 'banner' && ['info', 'success', 'neutral', undefined].includes(props.tone) && entry.order <= 1) {
      const exception = items.some(item => item.disclosure === 'on-exception' && (item.nodes ?? []).includes(entry.node.id));
      if (!exception) add('banner-without-exception', entry, `${nameOf(entry)} leads the screen with a message that is not an exception.`, 'Put the status in the heading or a badge; keep banners for what is wrong or about to be.');
    }
    if (slug === 'metadata-list' && Array.isArray(props.items) && props.items.length > 6 && !closedRegion(entry)) add('dense-record', entry, `${nameOf(entry)} shows ${props.items.length} attributes at once.`, 'Keep the few that orient a person; put the rest in a closed region or a detail view.');
    if (slug === 'table' && Array.isArray(props.columns) && props.columns.length > 4 && entry.ancestors.some(parent => parent.node.surface === 'panel')) add('dense-record', entry, `${nameOf(entry)} has ${props.columns.length} columns in a side panel.`, 'Keep two or three columns beside the main content; open the full record elsewhere.');
  }
  for (const entry of entries) {
    const kids = Array.isArray(entry.node.children) ? entry.node.children : [];
    const heading = entry.node.type === 'section' ? entry.node.heading : entry.node.type === 'region' ? entry.node.label : null;
    const title = kids.length === 1 ? kids[0]?.props?.title ?? kids[0]?.props?.caption ?? kids[0]?.heading : null;
    if (heading && typeof title === 'string' && normalLabel(title) === normalLabel(heading)) add('repeated-label', entry, `${nameOf(entry)} repeats the title of the only part under it.`, 'Keep one of them: the heading, or the part’s own title.');
  }
  /* Emphasis: two parts can lead a screen; more and none does. */
  const primarySections = entries.filter(entry => entry.node.type === 'section' && entry.node.emphasis === 'primary');
  if (primarySections.length > 2) add('competing-emphasis', primarySections[2], `${primarySections.length} sections claim primary emphasis.`, 'Keep primary emphasis for the task itself; make the others supporting.');
  return findings;
}

/** The safe repairs among findings, as one change a host applies with applyOperations(). */
export function repairChange(findings, base, summary = 'Apply safe composition repairs') {
  const seen = new Set();
  const operations = [];
  for (const finding of findings) {
    if (!finding.autofix || !finding.repair) continue;
    const key = `${finding.repair.target}:${JSON.stringify(finding.repair.set)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    operations.push(finding.repair);
  }
  return operations.length ? { version: 'syntari-ops-1', base, summary, operations: operations.slice(0, 20) } : null;
}

/**
 * The quality gate: a verdict per criterion from deterministic findings and validation, never a score. Criteria that need
 * a rendered review (responsive behaviour, contrast) say so instead of passing. fail: an error; review: a warning;
 * pass: only suggestions or nothing.
 */
export function qualityGate(findings, diagnostics, policy) {
  const errors = diagnostics.filter(item => item.severity === 'error');
  const criteria = (policy?.lint?.criteria ?? []).map(criterion => {
    /* The plan contract is validation's to decide: its errors count here as well as in the diagnostics. */
    const own = criterion.id === 'contract' ? diagnostics.filter(item => /^plan-/.test(item.code)).map(item => ({ rule: item.code, severity: 'error' })) : findings.filter(finding => finding.category === criterion.id);
    const verdict = criterion.rendered ? 'not-checked' : own.some(item => item.severity === 'error') ? 'concern' : own.some(item => item.severity === 'warning') ? 'review' : own.length ? 'meets-with-suggestions' : 'meets';
    return { id: criterion.id, label: criterion.label, means: criterion.means, verdict, findings: [...new Set(own.map(item => item.rule))] };
  });
  const gate = errors.length || findings.some(item => item.severity === 'error') ? 'fail' : findings.some(item => item.severity === 'warning') ? 'review' : 'pass';
  return {
    gate, criteria,
    counts: { errors: findings.filter(item => item.severity === 'error').length, warnings: findings.filter(item => item.severity === 'warning').length, suggestions: findings.filter(item => item.severity === 'suggestion').length, validationErrors: errors.length },
    basis: 'Deterministic rules over the screen, its plan, and the registry. Responsive layout and accessibility beyond component contracts need a rendered review.'
  };
}
