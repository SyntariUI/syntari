/**
 * Syntari planning: what belongs on a screen before which components draw it.
 *
 * A model knows the context a request comes from: who is asking, what they are trying to get done, which decisions they
 * face. Syntari knows how screens for each kind of job are organised. The two meet in a brief:
 *   - the model writes the brief (user, job, decisions, information, actions): semantic judgment, in structured form;
 *   - planScreen() turns it into a composition plan by rules in composition-policy.json: the archetype, the priority and
 *     disclosure of every piece of information, the layout, the candidate components, and what to avoid. Deterministic:
 *     the same brief always gives the same plan, and every choice carries its reason.
 * Words in a free-text request are only cues. They raise questions and order a provisional plan, flagged as such; they
 * never stand in for the job a person is doing.
 */
import { normalLabel } from './ir-data.js';

export const PLAN_VERSION = 'syntari-plan-1';
export const PLAN_MODES = ['resolve', 'decide', 'review', 'investigate', 'monitor', 'create', 'configure'];
export const PRIORITIES = ['primary', 'supporting', 'reference'];
export const DISCLOSURES = ['visible', 'collapsed', 'on-selection', 'on-exception', 'elsewhere'];

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const list = value => Array.isArray(value) ? value : [];
const slug = value => normalLabel(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'item';
const sentence = value => value.endsWith('.') ? value : `${value}.`;

/** Words in a request that hint at a job, a subject, or a term such as "dashboard". Each cue names the word it rests on. */
export function requestCues(request, policy) {
  const words = ` ${normalLabel(request)} `;
  const found = (vocabulary = {}) => Object.entries(vocabulary).flatMap(([id, terms]) => terms.filter(term => words.includes(` ${normalLabel(term)}`)).map(word => ({ id, word })));
  const modes = found(policy?.cues?.modes), subjects = found(policy?.cues?.subjects);
  const count = items => [...items.reduce((map, item) => map.set(item.id, [...(map.get(item.id) ?? []), item.word]), new Map())].map(([id, matched]) => ({ id, words: matched })).sort((a, b) => b.words.length - a.words.length);
  const terms = Object.entries(policy?.cues?.terms ?? {}).filter(([term]) => words.includes(` ${term}`)).map(([term, note]) => ({ term, note }));
  return { basis: 'words in the request', modes: count(modes), subjects: count(subjects), terms };
}

/** The brief, read defensively: what the model said, trimmed to the contract, with every information item given an id. */
export function normalizeBrief(brief) {
  const b = isObject(brief) ? brief : {};
  const ids = new Set();
  const information = list(b.information).filter(isObject).map((item, i) => {
    let id = typeof item.id === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.id) ? item.id : slug(item.label ?? `information ${i + 1}`);
    while (ids.has(id)) id = `${id}-${i + 1}`;
    ids.add(id);
    return {
      id, label: text(item.label, 80) || id, kind: typeof item.kind === 'string' ? item.kind : null,
      neededFor: list(item.neededFor).filter(value => typeof value === 'string').map(value => text(value, 160)),
      frequency: ['always', 'often', 'rare'].includes(item.frequency) ? item.frequency : null,
      exception: typeof item.exception === 'boolean' ? item.exception : null,
      priority: PRIORITIES.includes(item.priority) ? item.priority : null,
      disclosure: DISCLOSURES.includes(item.disclosure) ? item.disclosure : null,
      volume: Number.isFinite(item.volume) ? item.volume : null
    };
  });
  return {
    request: text(b.request, 1200),
    user: { role: text(b.user?.role, 80), expertise: text(b.user?.expertise, 40), frequency: text(b.user?.frequency, 40) },
    job: { primary: text(b.job?.primary, 200), mode: PLAN_MODES.includes(b.job?.mode) ? b.job.mode : null },
    decisions: list(b.decisions).filter(value => typeof value === 'string').map(value => text(value, 160)).slice(0, 8),
    subject: typeof b.subject === 'string' ? b.subject : null,
    information,
    actions: list(b.actions).filter(isObject).map(action => ({ label: text(action.label, 60), kind: ['primary', 'secondary', 'destructive'].includes(action.kind) ? action.kind : 'secondary', consequential: action.consequential === true })).filter(action => action.label),
    constraints: { layout: typeof b.constraints?.layout === 'string' ? b.constraints.layout : null, density: text(b.constraints?.density, 20) }
  };
}

/**
 * Rank every archetype for a job and the information present, with the reason each scored as it did. The job counts most;
 * then whether the archetype leads with the information decisions depend on (decisive: kinds needed for a decision or
 * present as an exception); then the subject; then how many of its signals are present at all.
 */
export function rankArchetypes({ mode, subject, kinds, decisive = new Set() }, policy) {
  const archetypes = Object.entries(policy?.archetypes ?? {});
  const kindLabel = kind => policy?.information?.kinds?.[kind]?.label?.toLowerCase() ?? kind;
  return archetypes.map(([id, archetype], order) => {
    const missing = (archetype.requires ?? []).filter(kind => !kinds.has(kind));
    const serves = mode ? archetype.jobs.indexOf(mode) : -1;
    const signals = (archetype.signals ?? []).filter(kind => kinds.has(kind));
    const leads = [...decisive].filter(kind => (archetype.zones ?? []).some(zone => zone.priority === 'primary' && zone.kinds.includes(kind))).length;
    const score = missing.length ? 0 : (serves === 0 ? 4 : serves > 0 ? 2 : 0) + Math.min(leads * 2, 6) + (subject && archetype.subjects?.includes(subject) ? 2 : 0) + Math.min(signals.length, 2);
    const reason = missing.length ? `Needs ${missing.map(kindLabel).join(' and ')}, which the brief does not have.`
      : mode && serves < 0 ? `Serves ${archetype.jobs.join(', ')}; the job is to ${mode}.`
      : `${serves > 0 ? `Serves ${mode} as a secondary job (its first is ${archetype.jobs[0]})` : `Serves ${mode ?? 'an unstated job'}`}${subject && archetype.subjects?.includes(subject) ? ` on a ${subject}` : ''}${leads ? `; leads with ${leads} of the decisive kinds of information` : '; leads with none of the decisive information'}.`;
    return { id, label: archetype.label, score, order, eligible: !missing.length && (serves >= 0 || !mode), reason };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.order - b.order);
}

/** The priority and disclosure of one piece of information inside an archetype, and why. */
function placeInformation(item, archetype, policy) {
  const zone = (archetype.zones ?? []).find(candidate => candidate.kinds.includes(item.kind));
  const kind = policy?.information?.kinds?.[item.kind];
  let priority = zone?.priority ?? 'supporting', disclosure = zone?.disclosure ?? 'visible', reason;
  if (item.exception !== null || item.kind === 'exception') {
    priority = 'primary'; disclosure = 'on-exception';
    reason = item.exception === false ? 'An exception that is not present now: shown only when it is.' : 'An exception that is present: it leads the screen until it is resolved.';
  } else if (item.neededFor.length) {
    priority = 'primary'; disclosure = 'visible';
    reason = `Needed to ${item.neededFor[0].replace(/^to\s+/i, '')}${item.neededFor.length > 1 ? ` and ${item.neededFor.length - 1} more decision${item.neededFor.length > 2 ? 's' : ''}` : ''}, so it is never hidden.`;
  } else if (item.frequency === 'rare') {
    priority = 'reference'; disclosure = disclosure === 'visible' ? 'collapsed' : disclosure;
    reason = 'Looked up occasionally: one step away.';
  } else if (zone) reason = `${zone.label}: ${zone.holds}`;
  else reason = kind ? `${kind.label}, which this archetype does not lead with.` : 'Not a known kind of information; placed as supporting.';
  /* A primary item in a zone that reveals on selection stays revealed on selection: it is primary for the selected item. */
  if (item.priority) { priority = item.priority; reason = `Set in the brief. ${reason}`; }
  if (item.disclosure) disclosure = item.disclosure;
  if (priority === 'primary' && ['collapsed', 'elsewhere'].includes(disclosure)) disclosure = 'visible';
  return { priority, disclosure, zone: zone?.id ?? null, reason };
}

/** Components for one kind of information, recommended first, limited to those the host can render when it says which. */
function componentsFor(kind, policy, renderable) {
  const known = policy?.information?.kinds?.[kind] ?? {};
  const rule = known.role ? policy?.roles?.[known.role] ?? {} : known;
  const usable = id => !renderable || renderable.has(id);
  return { recommended: list(rule.recommended).filter(usable), acceptable: list(rule.acceptable).filter(usable), avoid: Object.entries(known.avoid ?? rule.avoid ?? {}).map(([component, reason]) => ({ component, reason })) };
}

/**
 * A composition plan from a brief. Returns { plan, status, cues, problems }: plan follows plan.schema.json; status is
 * "ready" when the brief states the job and the information, "needs-context" otherwise, with openQuestions saying what
 * to ask. Pass renderable (a Set of component ids) to limit candidates to what the host renders.
 */
export function planScreen(brief, policy, { renderable = null } = {}) {
  const b = normalizeBrief(brief);
  const cues = requestCues(b.request, policy);
  const questions = [];
  if (!b.user.role) questions.push('Who uses this screen, and how often?');
  if (!b.job.mode) questions.push(`What does the person come to this screen to do: ${PLAN_MODES.join(', ')}?`);
  if (!b.information.length) questions.push('What information does the person need, and which decisions does each piece inform?');
  if (b.job.mode && ['resolve', 'decide', 'review'].includes(b.job.mode) && !b.decisions.length) questions.push('Which decisions does the person make on this screen?');
  const status = b.job.mode && b.information.length ? 'ready' : 'needs-context';
  const mode = b.job.mode ?? cues.modes[0]?.id ?? 'review';
  /* A cue orders a provisional plan only: once the brief states the job, words in the request carry no weight. */
  const subject = b.subject ?? (status === 'ready' ? null : cues.subjects[0]?.id ?? null);
  const kinds = new Set(b.information.map(item => item.kind).filter(Boolean));
  const decisive = new Set(b.information.filter(item => item.kind && (item.neededFor.length || item.exception === true || item.priority === 'primary')).map(item => item.kind));
  const ranking = rankArchetypes({ mode, subject, kinds, decisive }, policy);
  const chosen = ranking.find(item => item.eligible) ?? ranking[0];
  const archetype = policy.archetypes[chosen.id];

  const informationPriority = b.information.map(item => {
    const place = placeInformation(item, archetype, policy);
    return { id: item.id, label: item.label, ...(item.kind ? { kind: item.kind } : {}), priority: place.priority, disclosure: place.disclosure, ...(place.disclosure === 'on-exception' && item.exception !== null ? { exception: item.exception } : {}), ...(item.neededFor.length ? { neededFor: item.neededFor } : {}), ...(place.zone ? { zone: place.zone } : {}), reason: place.reason.slice(0, 240) };
  });
  const zones = archetype.zones.map(zone => {
    const held = informationPriority.filter(item => item.zone === zone.id);
    const components = [...new Set(held.flatMap(item => componentsFor(item.kind, policy, renderable).recommended.slice(0, 1)))];
    return { id: zone.id, label: zone.label, priority: zone.priority, disclosure: zone.disclosure, information: held.map(item => item.id), components, holds: zone.holds };
  }).filter(zone => zone.information.length || zone.priority === 'primary');

  const componentCandidates = [];
  const avoid = [...(archetype.avoid ?? [])];
  for (const item of informationPriority) {
    const options = componentsFor(item.kind, policy, renderable);
    const pick = options.recommended[0] ?? options.acceptable[0];
    if (pick) componentCandidates.push({ component: pick, for: item.id, fit: options.recommended[0] ? 'recommended' : 'acceptable', reason: `${policy.information.kinds[item.kind]?.means ?? item.label} ${item.priority === 'reference' ? 'Reference: in a closed region.' : item.disclosure === 'on-selection' ? 'Shown for the selected item.' : ''}`.trim().slice(0, 240) });
    for (const { component, reason } of options.avoid) if (!avoid.some(entry => entry.id === component)) avoid.push({ id: component, reason: `For ${item.label.toLowerCase()}: ${reason}`.slice(0, 240) });
  }
  /* A screen that does not monitor measures does not lead with them unless a decision depends on one. */
  const primaryAggregate = informationPriority.some(item => item.kind === 'aggregate-metric' && item.priority === 'primary');
  if (mode !== 'monitor' && !primaryAggregate && !avoid.some(entry => entry.id === 'kpi-grid')) avoid.push({ id: 'kpi-grid', reason: 'No decision on this screen depends on an aggregate measure.' });

  /* The split layouts need something for their aside; without it, the stacked layout serves the same archetype. */
  const layouts = archetype.layouts ?? [{ id: 'stack', layout: 'stack', when: '' }];
  const fills = layout => !layout.aside || informationPriority.some(item => item.zone === layout.aside);
  const layout = layouts.find(candidate => candidate.layout === b.constraints.layout) ?? layouts.find(fills) ?? layouts.at(-1);

  const primary = b.actions.find(action => action.kind === 'primary');
  const actions = {
    ...(primary ? { primary: { label: primary.label, consequential: primary.consequential } } : {}),
    secondary: b.actions.filter(action => action !== primary).slice(0, 6).map(action => ({ label: action.label, consequential: action.consequential }))
  };
  const interactionRequirements = [
    ...(informationPriority.some(item => item.disclosure === 'on-selection') ? ['Selecting an item shows its context beside it, without leaving the list.'] : []),
    ...informationPriority.filter(item => item.disclosure === 'on-exception').map(item => `${item.label} appears only while it is present${item.exception ? ', and it is present now' : ''}.`),
    ...(kinds.has('source-document') ? ['Each extracted value names its place in the source, and pointing at one marks the other.'] : []),
    ...(primary?.consequential ? [`${primary.label} names exactly what it changes and is confirmed by the host.`] : []),
    ...(informationPriority.some(item => item.priority === 'reference') ? ['Reference information opens in place, labelled with what it holds.'] : [])
  ].map(item => item.slice(0, 200)).slice(0, 10);

  const terminology = cues.terms.filter(({ term }) => term !== 'dashboard' || chosen.id !== 'monitoring-dashboard').map(({ term, note }) => `${note} Here it is a ${archetype.label.toLowerCase()}.`.slice(0, 240));
  const alternativesConsidered = ranking.filter(item => item.id !== chosen.id).slice(0, 4).map(item => ({ archetype: item.id, reason: item.reason.slice(0, 240) }));
  const primaryLabels = informationPriority.filter(item => item.priority === 'primary').map(item => item.label.toLowerCase());
  const referenceLabels = informationPriority.filter(item => item.priority === 'reference').map(item => item.label.toLowerCase());
  const role = b.user.role || 'The person';
  const designRationale = [
    sentence(`${role} opens this screen to ${b.job.primary ? b.job.primary.replace(/^to\s+/i, '') : policy.jobs?.[mode]?.means?.toLowerCase() ?? mode}`),
    `The job is to ${mode}, so it is a ${archetype.label.toLowerCase()}: ${archetype.goal.charAt(0).toLowerCase()}${archetype.goal.slice(1)}`,
    primaryLabels.length ? sentence(`First and strongest: ${primaryLabels.slice(0, 4).join(', ')}`) : '',
    referenceLabels.length ? sentence(`One step away: ${referenceLabels.slice(0, 4).join(', ')}`) : ''
  ].filter(Boolean).join(' ').slice(0, 600);
  const disclosureStrategy = [
    informationPriority.some(item => item.disclosure === 'visible') ? 'Primary information is visible and first.' : '',
    informationPriority.some(item => item.disclosure === 'on-selection') ? 'Context follows the selected item.' : '',
    informationPriority.some(item => item.disclosure === 'on-exception') ? 'Exceptions appear only while present, and then lead.' : '',
    informationPriority.some(item => item.disclosure === 'collapsed') ? 'Reference sits in closed regions labelled with what they hold.' : '',
    informationPriority.some(item => item.disclosure === 'elsewhere') ? 'Rarely needed detail is one navigation step away.' : ''
  ].filter(Boolean).join(' ').slice(0, 400);

  const plan = {
    version: PLAN_VERSION, status,
    userRole: b.user.role || 'Not stated',
    primaryJob: b.job.primary || (policy.jobs?.[mode]?.label ?? mode),
    mode,
    userDecisions: b.decisions,
    archetype: chosen.id,
    informationPriority: informationPriority.length ? informationPriority : [{ id: 'unstated', label: 'Information not stated in the brief', priority: 'primary', disclosure: 'visible', reason: 'Ask what the person needs before composing.' }],
    zones,
    disclosureStrategy: disclosureStrategy || 'Not decided: the brief states no information.',
    layoutStrategy: { id: layout.id, layout: layout.layout, reason: layout.when.slice(0, 240), mobile: (archetype.responsive ?? '').slice(0, 240) },
    interactionRequirements,
    actions,
    componentCandidates: componentCandidates.slice(0, 24),
    avoid: avoid.slice(0, 12),
    alternativesConsidered,
    designRationale,
    ...(terminology.length ? { terminology } : {}),
    ...(questions.length ? { openQuestions: questions } : {}),
    pattern: archetype.legacyPattern,
    purpose: b.job.primary || undefined,
    rationale: designRationale
  };
  if (plan.purpose === undefined) delete plan.purpose;
  return { plan, status, cues, problems: planProblems(plan, policy) };
}

/**
 * Structural checks a browser can run without a schema validator: the plan contract's required fields and enumerations,
 * and archetypes the policy knows. Node also checks plan.schema.json in full.
 */
export function planProblems(plan, policy) {
  const problems = [];
  const at = (path, message) => problems.push({ path: `meta.plan${path ? `.${path}` : ''}`, message });
  if (!isObject(plan)) { at('', 'A composition plan is an object.'); return problems; }
  if (plan.version !== PLAN_VERSION) return problems;
  for (const key of ['userRole', 'primaryJob']) if (typeof plan[key] !== 'string' || !plan[key].trim()) at(key, `${key} is required text.`);
  if (!PLAN_MODES.includes(plan.mode)) at('mode', `mode is one of ${PLAN_MODES.join(', ')}.`);
  if (typeof plan.archetype !== 'string') at('archetype', 'archetype is required.');
  else if (policy?.archetypes && !policy.archetypes[plan.archetype]) at('archetype', `“${plan.archetype}” is not an archetype in the composition policy: ${Object.keys(policy.archetypes).join(', ')}.`);
  if (!Array.isArray(plan.informationPriority) || !plan.informationPriority.length) at('informationPriority', 'informationPriority lists at least one piece of information.');
  else plan.informationPriority.forEach((item, i) => {
    if (!isObject(item)) { at(`informationPriority[${i}]`, 'Each item is an object.'); return; }
    if (!PRIORITIES.includes(item.priority)) at(`informationPriority[${i}].priority`, `priority is one of ${PRIORITIES.join(', ')}.`);
    if (!DISCLOSURES.includes(item.disclosure)) at(`informationPriority[${i}].disclosure`, `disclosure is one of ${DISCLOSURES.join(', ')}.`);
    if (item.nodes !== undefined && (!Array.isArray(item.nodes) || item.nodes.some(node => typeof node !== 'string'))) at(`informationPriority[${i}].nodes`, 'nodes is a list of node ids.');
  });
  return problems;
}
