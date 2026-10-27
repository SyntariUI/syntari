/**
 * Syntari composition: whether a valid screen is also a good one. Valid components do not make a good interface on their
 * own: a chart can match its contract and still be the wrong chart for its data, or the third copy of the same numbers.
 *
 * The rules live in the registry (composition-policy.json): which visualization fits which kind of data, how each kind of
 * screen is ordered, and which visualizations Syntari does not have. Two strengths of finding come out of it:
 *   - checkSemantics() runs inside validate(). It reports what is wrong for certain: a chart that misrepresents its data,
 *     a part titled as risk that shows allocation weights, the same numbers shown under two different meanings.
 *   - assessComposition() reports advice: hierarchy, redundancy, density, readability. It is a judgment, not a
 *     measurement, and never stops anything from painting.
 */
import { buildDataModel, parseFigure, normalLabel, isBinding, parseRef, dayRange } from './ir-data.js';
import { lintComposition, qualityGate, repairChange } from './ir-lint.js';

const slugOf = component => String(component ?? '').replace(/^syntari\./, '');
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const VISUAL_LISTS = { 'area-chart': 'points', 'line-chart': 'points', 'chart-bars': 'columns', breakdown: 'segments', 'chart-donut': 'segments', treemap: 'tiles', heatmap: 'rows', 'metric-and-sparkline': 'series' };
/* Visualizations of parts of one whole: a split of shares reads as a composition whatever its labels look like. */
const PARTS = ['breakdown', 'chart-donut'];
const TEXT_PROPS = ['title', 'chartLabel', 'caption', 'note', 'seriesA', 'seriesB', 'total'];
const MONTHS = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ene|abr|ago|dic|sept?|q[1-4]|t[1-4]|h[12]|s[12]|w\d+|week|sem|day|dia|d\d+$|mon|tue|wed|thu|fri|sat|sun|lun|mie|jue|vie|sab|dom|20\d\d|19\d\d|'\d\d|\d{4}-\d\d|\d{1,2}\/\d{1,2}|\d{1,2}:\d\d)/;

/** Visit every node with its path, its depth, its parent section heading, and its top-level index. */
function nodesOf(screen) {
  const out = [];
  const go = (list, path, depth, top, heading) => (Array.isArray(list) ? list : []).forEach((node, i) => {
    const at = `${path ? `${path}.` : ''}children[${i}]`;
    const topIndex = depth === 0 ? i : top;
    if (!isObject(node)) return;
    out.push({ node, path: at, depth, top: topIndex, heading });
    if (Array.isArray(node.children)) go(node.children, at, depth + 1, topIndex, node.type === 'section' ? node.heading : node.type === 'region' ? node.label : heading);
  });
  go(screen?.children, '', 0, 0, null);
  return out;
}
const atPath = (screen, path) => { let node = screen; for (const step of path.matchAll(/children\[(\d+)\]/g)) node = node?.children?.[Number(step[1])]; return node; };
/** The words a part is about: its title, its caption, its series names, and the heading it sits under. */
function wordsOf(node, heading) {
  const props = isObject(node.props) ? node.props : {};
  return normalLabel([heading, ...TEXT_PROPS.map(key => typeof props[key] === 'string' ? props[key] : '')].join(' '));
}
export function conceptOf(text, policy) {
  const words = ` ${normalLabel(text)} `;
  for (const concept of policy?.concepts ?? []) if (concept.words.some(word => words.includes(normalLabel(word)) || words.includes(` ${normalLabel(word)}`))) return concept.id;
  return null;
}
const looksTemporal = labels => labels.length >= 2 && labels.filter(label => MONTHS.test(normalLabel(label))).length >= Math.ceil(labels.length * 0.6);
/* Buckets name ranges: "D1–D7", "0-30 días", ">D90". A run of single days, "D1", "D2", is a time axis instead. */
const RANGE = /\d\s?[-–—]\s?d?\s?\d|^\s?[<>≤≥]|\b(to|a|hasta|more than|mas de)\b.*\d/i;
const looksBucketed = labels => labels.length >= 2 && labels.some(label => RANGE.test(String(label))) && labels.filter(label => dayRange(label) || RANGE.test(String(label))).length >= Math.ceil(labels.length * 0.6);

/**
 * The kind of data one part shows, read from what it is bound to when it is bound (certain), or from its labels when its
 * figures are written by hand (inferred). Returns null for parts that show no data.
 */
export function roleOf(entry, resolved, model, policy) {
  const node = entry.node, slug = slugOf(node.component);
  if (!slug) return null;
  const roles = policy?.components?.[slug];
  if (!roles) return null;
  const props = isObject(node.props) ? node.props : {};
  const shown = isObject(resolved?.props) ? resolved.props : props;
  const listKey = VISUAL_LISTS[slug];
  const concept = conceptOf(wordsOf(node, entry.heading), policy);
  const base = { slug, concept, certain: false, ref: null, fields: [] };
  if (!listKey) return { ...base, role: roles[0], certain: true };
  /* A heatmap is a matrix by its shape; a treemap is a hierarchy once its tiles are grouped, and parts of a whole before. */
  if (slug === 'heatmap') return { ...base, role: 'matrix', certain: true };
  if (slug === 'treemap') return { ...base, role: (Array.isArray(shown.tiles) ? shown.tiles : []).some(tile => typeof tile?.group === 'string' && tile.group.trim()) ? 'hierarchy' : 'composition', certain: true };
  const bound = isBinding(props[listKey]) ? props[listKey] : null;
  const items = Array.isArray(shown[listKey]) ? shown[listKey] : [];
  const labels = items.map(item => item?.label).filter(label => typeof label === 'string');
  if (bound && model) {
    const ref = parseRef(bound.$data);
    const fields = isObject(bound.map) ? Object.values(bound.map).map(source => typeof source === 'string' ? source : source?.field).filter(Boolean) : [];
    const valueFields = isObject(bound.map) ? Object.entries(bound.map).filter(([target]) => !['label'].includes(target)).map(([, source]) => typeof source === 'string' ? source : source?.field) : [];
    const out = { ...base, certain: true, ref: bound.$data, fields: valueFields };
    if (ref?.kind === 'groups') {
      const group = model.groups.get(ref.name);
      if (!group) return { ...out, role: roles[0] };
      out.valueRoles = valueFields.map(field => model.tables.get(group.table)?.fields[field === 'value' || field === 'share' ? group.values[0] : field]?.role).filter(Boolean);
      const total = model.tables.get(group.table)?.fields[group.values[0]]?.total;
      const fieldsOf = valueFields.filter(field => !['share', 'count', 'label'].includes(field)).map(field => field === 'value' ? group.values[0] : field);
      const firstType = model.tables.get(group.table)?.fields[group.values[0]]?.type;
      const peers = fieldsOf.filter(field => model.tables.get(group.table)?.fields[field]?.type === firstType).length;
      const role = group.bucketed ? 'ordered-distribution' : peers >= 2 && !valueFields.includes('share') ? 'category-comparison' : total !== undefined || valueFields.includes('share') ? 'composition' : 'ranking';
      return { ...out, role };
    }
    if (ref?.kind === 'tables') {
      const table = model.tables.get(ref.name);
      const labelField = isObject(bound.map) ? (typeof bound.map.label === 'string' ? bound.map.label : bound.map.label?.field) : null;
      const temporal = table && ['period', 'date'].includes(table.fields[labelField]?.type);
      out.valueRoles = valueFields.map(field => table?.fields[field]?.role).filter(Boolean);
      if (temporal) return { ...out, role: valueFields.length >= 2 || isObject(bound.map) && bound.map.compare !== undefined ? 'time-series-comparison' : 'time-series' };
      return { ...out, role: PARTS.includes(slug) ? 'composition' : 'ranking' };
    }
  }
  /* Written by hand: the labels say what the axis is. */
  const twoSeries = items.some(item => item?.b !== undefined || item?.compare !== undefined);
  if (PARTS.includes(slug)) return { ...base, role: looksTemporal(labels) ? 'time-series' : looksBucketed(labels) ? 'ordered-distribution' : 'composition' };
  if (looksTemporal(labels)) return { ...base, role: twoSeries ? 'time-series-comparison' : 'time-series' };
  if (looksBucketed(labels)) return { ...base, role: 'ordered-distribution' };
  if (slug === 'chart-bars') return { ...base, role: twoSeries ? 'category-comparison' : 'ranking' };
  return { ...base, role: roles[0] };
}
/** How a component fits a role under the policy: recommended, acceptable, avoid, or misleading, with the policy's reason. */
export function fitOf(slug, role, policy) {
  const rule = policy?.roles?.[role];
  if (!rule) return { fit: 'unrated', reason: '' };
  if (rule.recommended?.includes(slug)) return { fit: 'recommended', reason: rule.rule ?? '' };
  if (rule.misleading?.[slug]) return { fit: 'misleading', reason: rule.misleading[slug] };
  if (rule.avoid?.[slug]) return { fit: 'avoid', reason: rule.avoid[slug] };
  if (rule.acceptable?.includes(slug)) return { fit: 'acceptable', reason: rule.rule ?? '' };
  return { fit: 'unrated', reason: '' };
}
/** The label→value pairs a visualization shows, for telling one set of numbers from another. */
function seriesOf(resolvedNode) {
  const slug = slugOf(resolvedNode?.component), key = VISUAL_LISTS[slug];
  const items = Array.isArray(resolvedNode?.props?.[key]) ? resolvedNode.props[key] : [];
  /* Every series counts: bars of weight against risk are not the weight bars again. */
  const fields = PARTS.includes(slug) ? ['share'] : slug === 'chart-bars' ? ['a', 'b'] : ['value', 'compare'];
  const read = item => fields.map(field => parseFigure(item?.[field])?.value).filter(Number.isFinite).map(value => Math.round(value * 10) / 10).join('/');
  const pairs = items.map(item => [normalLabel(item?.label), read(item)]).filter(([label, value]) => label && value !== '');
  return pairs.length >= 3 ? pairs.map(([label, value]) => `${label}=${value}`).sort().join('|') : null;
}

/**
 * Checks that are certain enough to refuse a part: called by validate(). A misleading visualization or a relabeled series
 * is an error when the part is bound to data, because the data says what it is; when the figures are written by hand, the
 * runtime infers the kind of data from the labels and reports a warning.
 */
export function checkSemantics(spec, resolved, { model, policy, report }) {
  if (!policy) return;
  const entries = nodesOf(spec).filter(entry => typeof entry.node.component === 'string');
  const seen = [];
  for (const entry of entries) {
    const role = roleOf(entry, atPath(resolved, entry.path), model, policy);
    if (!role) continue;
    const { fit, reason } = fitOf(role.slug, role.role, policy);
    const severity = role.certain ? 'error' : 'warning';
    if (fit === 'misleading') report(severity, 'misleading-visualization', entry.path, `${policy.roles[role.role]?.label ?? role.role} shown with ${role.slug}: ${reason}${role.certain ? '' : ' (inferred from its labels)'}`);
    /* A part about risk must show a risk measure, not allocation weights under a risk title. */
    const expected = role.concept ? policy.conceptRoles?.[role.concept] : null;
    if (role.certain && expected && role.valueRoles?.length && !role.valueRoles.some(value => expected.includes(value))) report('error', 'role-mismatch', entry.path, `This part is about ${policy.concepts.find(c => c.id === role.concept)?.label ?? role.concept}, but it shows ${role.valueRoles.join(' and ')} data. Bind it to a ${expected.join(' or ')} field, or retitle it.`);
    const series = VISUAL_LISTS[role.slug] ? seriesOf(atPath(resolved, entry.path)) : null;
    if (series) {
      const twin = seen.find(other => other.series === series && other.concept !== role.concept && (other.concept || role.concept));
      if (twin) report(role.certain && twin.certain ? 'error' : 'warning', 'relabeled-data', entry.path, `This part shows exactly the same numbers as ${twin.name} at ${twin.path}, under a different meaning (${role.concept ?? 'unnamed'} instead of ${twin.concept ?? 'unnamed'}). Show the ${role.concept ?? 'intended'} data, or remove one of them.`);
      seen.push({ series, concept: role.concept, path: entry.path, name: typeof entry.node.props?.title === 'string' ? `“${entry.node.props.title}”` : role.slug, certain: role.certain });
    }
  }
}

/** A request that asks for a visualization Syntari does not have, such as a scatter plot: named, with the closest that exists. */
export function unsupportedRequest(text, policy) {
  const words = ` ${normalLabel(text)} `;
  for (const request of policy?.requests ?? []) {
    const word = request.words.find(item => words.includes(normalLabel(item)));
    if (!word) continue;
    const rule = policy.roles[request.role] ?? {};
    /* A request can name its own missing visualization, such as a sunburst where a treemap exists. */
    return { role: request.role, label: rule.label ?? request.role, missing: request.missing ?? rule.missing ?? request.role, closest: request.closest ?? rule.closest ?? [], matched: word };
  }
  return null;
}

/**
 * What a screen's data is, for a planner: each table, measure, and group with the kind of data it holds and the
 * visualizations that fit it in this registry. A model reads it before composing; a host shows it in an inspector.
 */
export function profileData(data, policy, renderable = null) {
  /* A computed model, or a data block to compute one from. */
  const model = data?.tables instanceof Map ? data : isObject(data?.tables) ? buildDataModel(data) : null;
  if (!model) return [];
  const available = slug => !renderable || renderable.has(slug);
  const advice = role => {
    const rule = policy?.roles?.[role] ?? {};
    return { role, label: rule.label ?? role, use: (rule.recommended ?? []).filter(available), also: (rule.acceptable ?? []).filter(available), avoid: Object.keys({ ...(rule.avoid ?? {}), ...(rule.misleading ?? {}) }), missing: rule.missing ?? null };
  };
  const out = [];
  for (const table of model.tables.values()) {
    const fields = Object.entries(table.fields);
    const time = fields.find(([, spec]) => ['period', 'date'].includes(spec.type));
    const numeric = fields.filter(([, spec]) => ['number', 'percent', 'currency', 'days'].includes(spec.type));
    if (time) out.push({ ref: `tables.${table.name}`, label: table.label, rows: table.rows.length, ...advice(numeric.length >= 2 ? 'time-series-comparison' : 'time-series'), detail: `${time[0]} by ${numeric.map(([name]) => name).join(', ')}` });
    out.push({ ref: `tables.${table.name}`, label: table.label, rows: table.rows.length, ...advice('records'), detail: `${table.rows.length} rows: ${fields.map(([name]) => name).join(', ')}` });
  }
  for (const group of model.groups.values()) {
    /* Shares of a whole stay a composition even when the group also carries their amounts. */
    const whole = model.tables.get(group.table)?.fields[group.values[0]]?.total !== undefined;
    const peers = group.values.filter(field => model.tables.get(group.table)?.fields[field]?.type === model.tables.get(group.table)?.fields[group.values[0]]?.type).length;
    const role = group.bucketed ? 'ordered-distribution' : peers >= 2 ? 'category-comparison' : whole ? 'composition' : 'ranking';
    out.push({ ref: `groups.${group.name}`, label: group.label, items: group.items.length, ...advice(role), detail: `${group.values.join(' and ') || 'count'} by ${group.by}${group.bucketed ? ' in ordered buckets' : ''}`, concept: conceptOf(`${group.label} ${group.values.join(' ')}`, policy) });
  }
  const kpis = [...model.measures.values()];
  if (kpis.length) out.push({ ref: 'measures', label: kpis.map(m => m.label).slice(0, 6).join(', '), items: kpis.length, ...advice('kpi'), detail: `${kpis.length} measures` });
  return out;
}

const overlap = (a, b) => { const x = new Set(normalLabel(a).split(' ').filter(w => w.length > 3)), y = new Set(normalLabel(b).split(' ').filter(w => w.length > 3)); if (!x.size || !y.size) return 0; let n = 0; for (const w of x) if (y.has(w)) n += 1; return n / Math.min(x.size, y.size); };
const kpiItems = node => { const props = isObject(node.props) ? node.props : {}; return (props.stats ?? props.metrics ?? props.items ?? props.values ?? []).filter(isObject); };

/**
 * Advice on how well a screen is composed, as a person reviewing it would give it. Each criterion reads "meets", "review",
 * or "concern" with the signals behind it. These are judgments under the registry's policy, not measurements; only
 * validation decides what renders.
 *   assessComposition(spec, { policy, resolved?, model?, diagnostics?, plan?, base? })
 * It also returns the composition findings of lintComposition() against the screen's plan (meta.plan, or options.plan for
 * a screen without one), the quality gate they add up to, and the safe repairs as one change against options.base.
 */
export function assessComposition(spec, { policy, resolved = null, model = undefined, diagnostics = [], plan: given = null, base = null } = {}) {
  const data = model === undefined ? buildDataModel(spec?.data) : model;
  const shown = resolved ?? spec;
  const entries = nodesOf(spec);
  const components = entries.filter(entry => typeof entry.node.component === 'string');
  const parts = components.map(entry => {
    const role = roleOf(entry, atPath(shown, entry.path), data, policy);
    const fit = role ? fitOf(role.slug, role.role, policy) : { fit: 'unrated', reason: '' };
    return { id: entry.node.id ?? null, path: entry.path, top: entry.top, depth: entry.depth, slug: slugOf(entry.node.component), role: role?.role ?? null, concept: role?.concept ?? null, certain: role?.certain ?? false, ref: role?.ref ?? null, fields: role?.fields ?? [], ...fit, title: typeof entry.node.props?.title === 'string' ? entry.node.props.title : typeof entry.node.props?.caption === 'string' ? entry.node.props.caption : null, heading: entry.heading, node: entry.node };
  });
  const signals = [];
  const signal = (criterion, severity, code, message, ids = []) => signals.push({ criterion, severity, code, message, ids: ids.filter(Boolean) });
  const named = part => part.title ? `“${part.title}”` : part.heading ? `${part.slug} under “${part.heading}”` : part.slug;
  const visual = parts.filter(part => VISUAL_LISTS[part.slug] && part.slug !== 'metric-and-sparkline');

  /* Semantic fit: every visualization against the policy for its kind of data. */
  for (const part of parts) {
    if (part.fit === 'misleading') signal('fit', 'error', 'misleading-visualization', `${named(part)} shows ${policy?.roles?.[part.role]?.label?.toLowerCase() ?? part.role} with ${part.slug}. ${part.reason}`, [part.id]);
    else if (part.fit === 'avoid') signal('fit', 'advice', 'weak-visualization', `${named(part)}: ${part.reason} ${policy?.roles?.[part.role]?.recommended?.length ? `Prefer ${policy.roles[part.role].recommended.join(' or ')}.` : ''}`.trim(), [part.id]);
  }
  /* Redundancy: the same information twice, not the same component twice. */
  const byRef = new Map();
  for (const part of visual) if (part.ref) { const key = `${part.ref}|${part.role}|${part.fields.join(',')}`; byRef.set(key, [...(byRef.get(key) ?? []), part]); }
  for (const group of byRef.values()) if (group.length > 1) signal('redundancy', 'advice', 'redundant-visualization', `${group.map(named).join(' and ')} show the same data the same way. Keep one, or give the other a different question to answer.`, group.map(part => part.id));
  const bySeries = new Map();
  for (const part of visual) {
    const series = seriesOf(atPath(shown, part.path));
    if (!series) continue;
    bySeries.set(series, [...(bySeries.get(series) ?? []), part]);
  }
  for (const group of bySeries.values()) {
    if (group.length < 2) continue;
    const concepts = new Set(group.map(part => part.concept));
    if (concepts.size > 1) signal('redundancy', 'error', 'relabeled-data', `${group.map(named).join(' and ')} show identical numbers under different meanings (${[...concepts].map(c => c ?? 'unnamed').join(', ')}). One of them is not showing what its title says.`, group.map(part => part.id));
    else if (!group.every(part => part.ref) || new Set(group.map(part => part.ref)).size > 1) signal('redundancy', 'advice', 'redundant-visualization', `${group.map(named).join(' and ')} show the same numbers.`, group.map(part => part.id));
  }
  const metrics = new Map();
  for (const part of parts.filter(part => part.role === 'kpi')) for (const item of kpiItems(atPath(shown, part.path) ?? part.node)) {
    const key = normalLabel(item.label ?? item.metric ?? '');
    if (key) metrics.set(key, [...(metrics.get(key) ?? []), part]);
  }
  for (const [label, group] of metrics) if (new Set(group).size > 1) signal('redundancy', 'advice', 'repeated-metric', `“${label}” appears in ${group.length} blocks of numbers. Show each measure once.`, [...new Set(group)].map(part => part.id));
  const texts = parts.filter(part => part.slug === 'text-block');
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i].node.props?.body ?? '', b = texts[j].node.props?.body ?? '';
    if (overlap(a, b) >= 0.6) signal('redundancy', 'advice', 'repeated-summary', `Two text blocks say much the same thing. Merge them, or let each explain a different part.`, [texts[i].id, texts[j].id]);
  }
  /* A screen that answers every question with the same visualization: a repeated role is fine, a repeated stand-in is not. */
  const bySlug = new Map();
  for (const part of visual) bySlug.set(part.slug, [...(bySlug.get(part.slug) ?? []), part]);
  for (const [slug, group] of bySlug) {
    const roles = new Set(group.map(part => part.role));
    if (group.length >= 3 && roles.size >= 2 && group.some(part => part.fit !== 'recommended')) signal('fit', 'advice', 'monotone-composition', `${group.length} parts use ${slug} for different kinds of data (${[...roles].join(', ')}). Each kind has a better fit in the registry.`, group.map(part => part.id));
  }

  /* Hierarchy: the pattern's order, from the summary to the details. */
  const declared = spec?.meta?.plan?.pattern;
  const inferred = parts.some(part => part.role === 'decision' && ['tool-approval', 'approval-card'].includes(part.slug)) ? 'transaction'
    : parts.some(part => part.slug === 'live-readout') ? 'monitoring'
    : visual.length >= 2 || (visual.length && parts.some(part => part.role === 'kpi')) ? 'dashboard'
    : parts.filter(part => part.role === 'records').length >= 1 && parts.some(part => part.slug === 'filter-bar') ? 'workspace'
    : 'report';
  const pattern = policy?.patterns?.[declared] ? declared : inferred;
  const top = [...new Set(parts.map(part => part.top))].sort((a, b) => a - b);
  const firstOf = predicate => parts.filter(predicate).reduce((min, part) => Math.min(min, part.top), Infinity);
  if (['report', 'dashboard'].includes(pattern)) {
    const summary = firstOf(part => part.role === 'kpi' || part.role === 'text');
    const analysis = firstOf(part => VISUAL_LISTS[part.slug] && part.slug !== 'metric-and-sparkline');
    const details = firstOf(part => part.role === 'records');
    if (pattern === 'dashboard' && summary > (top[0] ?? 0)) signal('hierarchy', 'advice', 'summary-not-first', 'A dashboard opens with its headline measures; here something else comes first.', []);
    if (pattern === 'dashboard' && analysis === Infinity) signal('hierarchy', 'advice', 'no-primary-analysis', 'There is no principal visualization: the numbers have nothing that shows how they move or split.', []);
    if (details < analysis && analysis !== Infinity) signal('hierarchy', 'advice', 'details-before-analysis', 'Detailed records come before the analysis that explains them. Put the table after the charts.', parts.filter(part => part.role === 'records' && part.top === details).map(part => part.id));
  }
  if (pattern === 'transaction') {
    const decision = firstOf(part => part.role === 'decision' && part.slug !== 'selectable-cards');
    if (decision !== Infinity && top.length && decision < top.at(-1) && parts.some(part => part.top > decision && !['text'].includes(part.role))) signal('hierarchy', 'advice', 'decision-not-last', 'The decision comes before evidence that informs it. Put the approval last.', []);
  }
  const kpiBlocks = parts.filter(part => part.role === 'kpi');
  if (kpiBlocks.length > 2) signal('hierarchy', 'advice', 'too-many-metric-blocks', `${kpiBlocks.length} blocks of headline numbers compete for attention. Keep one summary block.`, kpiBlocks.map(part => part.id));

  /* Density: space that holds little, and screens that scroll for too long. */
  for (const entry of entries.filter(entry => entry.node.type === 'section')) {
    const kids = Array.isArray(entry.node.children) ? entry.node.children : [];
    if (entry.node.layout === 'two-column' && kids.length === 1) signal('density', 'advice', 'half-empty-row', `“${entry.node.heading}” is laid out in two columns with one part, so half the row is empty.`, [entry.node.id]);
    if (kids.length === 1 && typeof kids[0]?.props?.title === 'string' && normalLabel(kids[0].props.title) === normalLabel(entry.node.heading)) signal('density', 'advice', 'redundant-heading', `“${entry.node.heading}” repeats the title of the only part under it.`, [entry.node.id]);
  }
  if (components.length > 12) signal('density', 'advice', 'long-scroll', `${components.length} parts make a long screen. Put secondary detail in closed regions.`, []);
  const records = parts.filter(part => part.slug === 'table');
  for (const part of records) {
    const rows = atPath(shown, part.path)?.props?.rows;
    if (Array.isArray(rows) && rows.length > 6 && !atPath(shown, part.path)?.props?.sortable) signal('readability', 'advice', 'unsortable-table', `${named(part)} has ${rows.length} rows; let people sort it ("sortable": true).`, [part.id]);
  }

  /* Readability: figures need units and context. */
  for (const part of kpiBlocks) for (const item of kpiItems(atPath(shown, part.path) ?? part.node)) {
    const value = item.value;
    const figure = parseFigure(value);
    if (typeof value === 'string' && figure && /^[\s\d.,+-]+$/.test(value) && !item.total && !item.note && !item.badge && !item.meaning && !item.delta) signal('readability', 'advice', 'missing-unit', `“${item.label}” reads ${value} with no unit or context. Say what it counts or what it is out of.`, [part.id]);
  }

  /* Data integrity: figures written by hand on a screen that has data, and every data finding from validation. */
  if (data) {
    let literal = 0;
    for (const part of parts) for (const leaf of Object.values(isObject(part.node.props) ? part.node.props : {})) if (Array.isArray(leaf)) for (const item of leaf) if (isObject(item)) for (const field of ['value', 'share', 'a', 'b']) if (item[field] !== undefined && !isBinding(item[field]) && parseFigure(item[field])) literal += 1;
    if (literal) signal('data', 'advice', 'unbound-figure', `${literal} ${literal === 1 ? 'figure is' : 'figures are'} written by hand instead of bound to the screen data, so ${literal === 1 ? 'it does' : 'they do'} not follow the rows.`, []);
  }
  for (const d of diagnostics) if (/^(data-|bucket-|role-mismatch|relabeled-data|misleading-visualization)/.test(d.code)) signal('data', d.severity === 'error' ? 'error' : 'warning', d.code, d.message, []);
  const errors = diagnostics.filter(d => d.severity === 'error').length;
  if (errors) signal('validity', 'error', 'invalid-parts', `${errors} ${errors === 1 ? 'problem stops' : 'problems stop'} parts from painting.`, []);

  const CRITERIA = [
    ['validity', 'Valid parts', 'Every part matches its contract.'],
    ['data', 'Data integrity', 'Figures agree with the screen data and say where they come from.'],
    ['fit', 'Semantic fit', 'Each visualization suits the kind of data it shows.'],
    ['redundancy', 'No repeated information', 'Each fact appears once; a repeated component is fine, a repeated message is not.'],
    ['hierarchy', 'Information hierarchy', `The order a ${policy?.patterns?.[pattern]?.label?.toLowerCase() ?? pattern} reads in: ${(policy?.patterns?.[pattern]?.zones ?? []).join(', ')}.`],
    ['density', 'Density', 'Space holds content; detail does not push the analysis off screen.'],
    ['readability', 'Readability', 'Figures carry units and context; long tables can be sorted.']
  ];
  const criteria = CRITERIA.map(([id, label, means]) => {
    const own = signals.filter(item => item.criterion === id);
    const verdict = own.some(item => item.severity === 'error') ? 'concern' : own.length ? 'review' : 'meets';
    return { id, label, means, verdict, signals: own };
  });
  /* Composition findings: the plan's information architecture, surfaces, actions, and content, plus the redundancy advice above. */
  const findings = lintComposition(spec, { policy, plan: given });
  const REDUNDANCY = ['redundant-visualization', 'repeated-metric', 'repeated-summary', 'monotone-composition', 'too-many-metric-blocks'];
  for (const item of signals.filter(signal => REDUNDANCY.includes(signal.code))) findings.push({ rule: item.code, severity: 'warning', category: 'content-economy', node: item.ids[0] ?? null, path: '', message: item.message, fix: 'Keep one presentation of each fact, or give each a different question to answer.', autofix: false, nodes: item.ids });
  const quality = qualityGate(findings, diagnostics, policy);
  return {
    pattern, declared: declared ?? null, inferred,
    plan: isObject(spec?.meta?.plan) ? spec.meta.plan : null,
    findings, quality,
    repair: base ? repairChange(findings, base) : null,
    parts: parts.map(({ node, ...part }) => part),
    criteria, signals,
    summary: { parts: components.length, visualizations: visual.length, concerns: criteria.filter(c => c.verdict === 'concern').length, reviews: criteria.filter(c => c.verdict === 'review').length }
  };
}
