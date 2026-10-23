/*
 * Jev: the decisions about a screen that need no model. It reads a request the way a person types it, finds the part it
 * names, and writes the change as syntari-ops-1 operations in a few milliseconds. What needs writing it does not hand over
 * whole: it briefs Claude with the part, the field, the place, and the data it already decided, so Claude writes only the
 * words or the one part, against a prompt cut to that task. A part two names could mean is the person's choice, not a guess.
 * Every change, Jev's or Claude's, goes through applyOperations: scoped, data-protected, and validated whole.
 */

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const fold = text => String(text ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[‐-―−]/g, '-').replace(/\s+/g, ' ').trim();
/* Words that say which part without naming it. */
const FILLER = new Set(['el', 'la', 'los', 'las', 'lo', 'un', 'una', 'de', 'del', 'al', 'a', 'en', 'con', 'y', 'que', 'the', 'a', 'an', 'of', 'to', 'in', 'on', 'and', 'this', 'that', 'este', 'esta', 'ese', 'esa', 'parte', 'part', 'componente', 'component', 'bloque', 'block']);
/* Words that name a kind of part, and the components or node types they mean. */
const KINDS = [
  [/^(tabla|table|tablas|tables|listado|detalle)$/, ['table', 'comparison-table', 'data-table', 'simple-data-table']],
  [/^(grafico|grafica|graficos|chart|charts|graph)$/, ['chart-bars', 'line-chart', 'area-chart', 'chart-donut', 'heatmap', 'treemap', 'metric-and-sparkline']],
  [/^(donut|dona|rosco|pie|tarta|quesito)$/, ['chart-donut']],
  [/^(anillo|ring)$/, ['chart-donut', 'score']],
  [/^(heatmap|calor|matriz|matrix)$/, ['heatmap']],
  [/^(treemap|mosaico|tiles|teselas)$/, ['treemap']],
  [/^(progreso|progress|avance|puntuacion|score)$/, ['progress', 'score']],
  [/^(barras|barra|bars|bar|columnas|columns|escalera|ladder)$/, ['chart-bars']],
  [/^(linea|lineas|line|evolucion|tendencia|trend)$/, ['line-chart', 'area-chart']],
  [/^(kpi|kpis|metricas|metrica|indicadores|stats|metrics|cifras|resumen)$/, ['stat-row', 'headline-metric', 'metric-strip']],
  [/^(desglose|breakdown|reparto|asignacion|allocation|composicion)$/, ['breakdown']],
  [/^(texto|parrafo|text|nota|explicacion|summary)$/, ['text-block', 'banner']],
  [/^(badge|badges|etiqueta|etiquetas|insignia|insignias)$/, ['badge-and-status']],
  [/^(avatar|avatares|avatars|personas|people|equipo|team|revisores|reviewers)$/, ['avatar-and-group']],
  [/^(error|fallo|reintentar|retry)$/, ['error-and-retry']],
  [/^(codigo|code|comando|command|snippet)$/, ['code-block']],
  [/^(seccion|section|apartado)$/, ['section']],
  [/^(aprobacion|approval|decision|confirmacion)$/, ['tool-approval', 'approval-card']],
  [/^(calculadora|calculator|simulador)$/, ['calculator']],
  [/^(checklist|pasos)$/, ['checklist']],
  [/^(tareas|tasks|todo|plan)$/, ['checklist', 'agent-todo-list']]
];
const TITLE_FIELDS = ['title', 'caption', 'heading', 'question', 'label', 'message'];
const slugOf = node => typeof node?.component === 'string' ? node.component.replace(/^syntari\./, '') : node?.type ?? null;

/** Every node a request can name, with the words it is known by. */
export function partsOf(spec, names = {}) {
  const parts = [];
  const visit = (list, parent, depth) => (Array.isArray(list) ? list : []).forEach((node, index) => {
    if (!isObject(node)) return;
    const slug = slugOf(node);
    const title = node.type === 'section' ? node.heading : node.type === 'region' ? node.label : TITLE_FIELDS.map(field => node.props?.[field]).find(value => typeof value === 'string' && value.trim());
    if (typeof node.id === 'string') parts.push({ id: node.id, slug, kind: node.type === 'section' || node.type === 'region' ? node.type : 'component', title: typeof title === 'string' ? title : null, name: names[slug] ?? slug, parent, index, depth, node });
    visit(node.children, typeof node.id === 'string' ? node.id : parent, depth + 1);
  });
  visit(spec?.children, 'screen', 1);
  return parts;
}
const words = text => fold(text).replace(/[^a-z0-9#\s-]/g, ' ').split(/[\s-]+/).filter(word => word && !FILLER.has(word));
/** How well a phrase names a part, from 0 to 1: its title words, its kind, its id. */
function score(phrase, part) {
  const asked = words(phrase);
  if (!asked.length) return 0;
  if (asked.some(word => word === `#${fold(part.id)}`) || fold(phrase).replace(/^#/, '') === fold(part.id)) return 1;
  /* Each kind word narrows the kinds: "bar chart" means bar charts, not every chart. */
  const kinds = asked.map(word => new Set(KINDS.filter(([pattern]) => pattern.test(word)).flatMap(([, slugs]) => slugs))).filter(set => set.size)
    .reduce((acc, set) => acc ? new Set([...acc].filter(slug => set.has(slug))) : set, null) ?? new Set();
  const own = new Set([...words(part.title ?? ''), ...words(part.id), ...words(part.name ?? '')]);
  const named = asked.filter(word => !KINDS.some(([pattern]) => pattern.test(word)));
  const hits = named.filter(word => own.has(word) || [...own].some(other => other.length > 4 && word.length > 4 && (other.startsWith(word) || word.startsWith(other)))).length;
  const kindFits = kinds.size ? kinds.has(part.slug) : null;
  if (kindFits === false && hits === 0) return 0;
  const byWords = named.length ? hits / named.length : 0;
  /* A part of another kind than the one named only counts at half: "the table of positions" is the table, not its section. */
  if (kindFits === false) return byWords * 0.45;
  return Math.min(1, (kindFits ? (named.length ? 0.35 : 0.7) : 0) + byWords * (kindFits ? 0.65 : 0.9));
}
/** The one part a phrase names, or why there is not one. */
export function resolvePart(phrase, spec, names = {}) {
  const ranked = partsOf(spec, names).map(part => ({ part, score: score(phrase, part) })).filter(entry => entry.score > 0).sort((a, b) => b.score - a.score);
  const [best, next] = ranked;
  if (!best || best.score < 0.5) return { part: null, reason: `No part of the screen matches “${phrase}”.`, candidates: ranked.slice(0, 3) };
  /* Two parts a phrase could equally mean: Jev does not guess, and says which ones they are. */
  if (next && best.score - next.score < 0.2 && !(best.part.kind !== 'component' && next.part.parent === best.part.id)) {
    const close = ranked.filter(entry => best.score - entry.score < 0.2 && !(entry.part.kind !== 'component' && ranked.some(other => other.part.parent === entry.part.id && best.score - other.score < 0.2)));
    return { part: null, ambiguous: close.map(entry => entry.part), reason: `“${phrase}” could mean ${describe(best.part)} or ${describe(next.part)}.`, candidates: ranked.slice(0, 3) };
  }
  return { part: best.part, score: best.score, candidates: ranked.slice(0, 3) };
}
const describe = part => `${part.title ? `“${part.title}”` : part.name} (#${part.id})`;

const QUOTED = /["“”«»'‘’]([^"“”«»'‘’]{1,160})["“”«»'‘’]\s*\.?\s*$/;
const PATTERNS = [
  /* rename X to "Y" */
  { intent: 'rename', re: /^(?:cambia|renombra|pon|titula|change|rename|set|call)\s+(?:el\s+|the\s+)?(?:titulo|nombre|encabezado|heading|title|name)?\s*(?:de|del|de la|of)?\s*(.+?)\s+(?:a|por|como|to|as)\s+["“”«»'‘’]/i },
  /* remove X */
  { intent: 'remove', re: /^(?:elimina|quita|borra|suprime|saca|remove|delete|drop|get rid of)\s+(.+?)\s*\.?$/i },
  /* move X to the top / to the end */
  { intent: 'move-edge', re: /^(?:mueve|pon|coloca|lleva|sube|baja|move|put|place)\s+(.+?)\s+(?:al principio|al inicio|arriba del todo|en primer lugar|primero|to the top|at the top|to the start|at the start|at the beginning|first|al final|abajo del todo|en ultimo lugar|el ultimo|to the bottom|at the bottom|to the end|at the end|last)\s*\.?$/i },
  /* move X before / after Y */
  { intent: 'move', re: /^(?:mueve|pon|coloca|lleva|sube|baja|move|put|place)\s+(.+?)\s+(antes de|antes del|delante de|delante del|encima de|encima del|por encima de|above|before|despues de|despues del|detras de|detras del|debajo de|debajo del|por debajo de|tras|after|below|under)\s+(.+?)\s*\.?$/i },
  /* new words for a title, without quotes: Claude writes them, Jev knows where they go */
  { intent: 'retitle', re: /^(?:cambia|renombra|retitula|titula|reescribe|mejora|acorta|change|rename|retitle|rewrite|reword|update|improve|shorten|fix)\s+(?:el\s+|la\s+|the\s+)?(?:(?:titulo|nombre|encabezado|title|heading|name|caption)\s+(?:de la|del|de|of)\s+)(.+?)(?:\s+(?:so that|so it|so|to say|to read|to reflect|to|para que|para|que)\b.*)?\s*\.?$/i },
  { intent: 'retitle', re: /^(?:renombra|retitula|titula|rename|retitle)\s+(.+?)(?:\s+(?:so that|so it|so|to say|to read|to reflect|to|as|para que|para|como|a)\b.*)?\s*\.?$/i },
  /* add something, optionally next to a part */
  { intent: 'add', re: /^(?:anade|agrega|incluye|inserta|muestra|add|insert|include|show)\s+(.+?)(?:\s+(above|below|under|underneath|beneath|before|after|next to|beside|debajo de|debajo del|encima de|encima del|antes de|antes del|despues de|despues del|junto a|junto al|bajo|tras)\s+(.+?))?\s*\.?$/i },
  /* change one part: what changes inside it needs writing, the part does not */
  { intent: 'change', re: /^(?:cambia|edita|actualiza|haz|convierte|ajusta|modifica|simplifica|change|edit|update|make|turn|modify|adjust|tweak|simplify|sort|order|ordena|resalta|highlight)\s+(.+?)(?:\s+(?:so|to|into|more|less|bigger|smaller|shorter|longer|clearer|simpler|by|show|shows|showing|with|without|as|for|en|mas|menos|que|con|sin|por|para|como)\b.*)?\s*\.?$/i }
];
const AFTER = /^(despues de|despues del|detras de|detras del|debajo de|debajo del|por debajo de|tras|after|below|under|underneath|beneath|next to|beside|junto a|junto al|bajo)$/;
const TOP = /(principio|inicio|arriba del todo|primer lugar|primero|top|start|beginning|first)/;
/* A request that names something inside a part, such as a column, a row, a series, or one metric, is about that part: the
   part is Jev's to find, what changes inside it is Claude's to write. Removing the whole part would answer another request. */
const INSIDE = /\b(columns?|rows?|lines?|series|legend|labels?|values?|cells?|items?|entries|entry|points?|segments?|slices?|bars?|notes?|badges?|columnas?|filas?|lineas?|leyenda|etiquetas?|valores?|celdas?|elementos?|puntos?|segmentos?|barras?|notas?)\b/;
const WITHIN = /^(.+?)\s+(?:from|in|inside|within|of|on|de la|de los|de las|del|de|en el|en la|en los|en las|en|dentro de)\s+(.+)$/;
const ORDINALS = [[/\b(first|primer|primera|primero)\b/, 0], [/\b(second|segundo|segunda)\b/, 1], [/\b(third|tercer|tercera|tercero)\b/, 2], [/\b(last|ultimo|ultima)\b/, -1]];
const POLITE = /^(?:(?:please|pls|kindly|por favor)[,\s]+|(?:can|could|would|will) you\s+(?:please\s+)?|(?:puedes|podrias|podras)\s+(?:por favor\s+)?)/;
const POLITE_END = /(?:[,\s]+(?:please|por favor))?\s*[?.!]*$/;
/* A request with several asks is split where a new verb starts, never inside quoted words. */
const VERBS = '(?:remove|delete|drop|move|put|place|rename|retitle|change|add|insert|include|make|set|show|elimina|quita|borra|suprime|saca|mueve|pon|coloca|lleva|renombra|cambia|titula|añade|anade|agrega|incluye|haz|muestra)';
const SPLIT = new RegExp(`\\s*,?\\s+(?:and then|then|and also|and|y luego|y después|y despues|y además|y ademas|y|e)\\s+(?=${VERBS}\\b)`, 'i');
const masked = text => String(text).replace(/["“«][^"”»]*["”»]/g, quoted => '\u0001'.repeat(quoted.length));
function clauses(request) {
  const text = String(request), mask = masked(text), parts = [];
  let rest = mask, offset = 0;
  for (let found = rest.match(SPLIT); found; found = rest.match(SPLIT)) {
    parts.push(text.slice(offset, offset + found.index));
    offset += found.index + found[0].length;
    rest = mask.slice(offset);
  }
  parts.push(text.slice(offset));
  return parts.map(part => part.trim()).filter(Boolean);
}
/* The structure a screen has after Jev's own operations, enough to plan the next ask; applyOperations still validates the whole. */
function simulate(spec, operations) {
  const copy = structuredClone(spec);
  const locate = (list, id) => {
    for (const [index, node] of (Array.isArray(list) ? list : []).entries()) {
      if (node?.id === id) return { list, index, node };
      const deeper = locate(node?.children, id);
      if (deeper) return deeper;
    }
    return null;
  };
  for (const op of operations) {
    const found = locate(copy.children, op.target);
    if (op.op === 'remove' && found) found.list.splice(found.index, 1);
    else if (op.op === 'move' && found) {
      found.list.splice(found.index, 1);
      const anchor = op.before ?? op.after ? locate(copy.children, op.before ?? op.after) : null;
      const into = anchor ? anchor.list : op.parent && op.parent !== 'screen' ? (locate(copy.children, op.parent)?.node.children ?? copy.children) : copy.children;
      into.splice(anchor ? anchor.index + (op.after ? 1 : 0) : into.length, 0, found.node);
    } else if (op.op === 'replace' && isObject(op.set)) {
      const node = op.target === 'screen' ? copy : found?.node;
      for (const [path, value] of Object.entries(op.set)) if (node) path.startsWith('props.') ? (node.props ??= {})[path.slice(6)] = value : node[path] = value;
    }
  }
  return copy;
}
const kindsIn = phrase => [...new Set(words(phrase).flatMap(word => KINDS.filter(([pattern]) => pattern.test(word)).flatMap(([, slugs]) => slugs)))];
/** The screen data a phrase is about: tables, groups, and measures whose names share its words. */
export function dataFor(phrase, spec) {
  const asked = words(phrase).filter(word => !KINDS.some(([pattern]) => pattern.test(word)) && !/^(new|nueva?|another|otra?|add|anade|table|chart|by|por|per)$/.test(word));
  if (!asked.length || !isObject(spec?.data)) return [];
  const near = (a, b) => a === b || (a.length > 4 && b.length > 4 && (a.startsWith(b) || b.startsWith(a)));
  const refs = [];
  for (const kind of ['tables', 'groups', 'measures']) for (const [name, entry] of Object.entries(spec.data[kind] ?? {})) {
    const own = new Set([...words(name.replace(/([a-z])([A-Z])/g, '$1 $2')), ...words(entry?.label ?? ''), ...Object.entries(entry?.fields ?? {}).flatMap(([field, info]) => [...words(field), ...words(info?.label ?? '')])]);
    const hits = asked.filter(word => [...own].some(other => near(word, other))).length;
    if (hits) refs.push({ ref: `${kind}.${name}`, score: hits / asked.length });
  }
  const best = Math.max(0, ...refs.map(entry => entry.score));
  return refs.filter(entry => entry.score >= best * 0.75).sort((a, b) => b.score - a.score).slice(0, 3).map(entry => entry.ref);
}

/**
 * Plan a request against a screen. Returns one of:
 * - { route: 'jev', change }: decided with certainty, as syntari-ops-1 operations against `base`.
 * - { route: 'claude', brief }: what needs writing, with what Jev decided. brief.task is 'words' (new words for one field of
 *   one part), 'part' (a change inside one part), 'add' (one new part, with its place and data when named), or 'screen'.
 * - { route: 'split', change, rest }: Jev's share of a request with several asks, and the rest, for Claude.
 * - { route: 'ask', question, choices }: the request names a part two parts could be; the person chooses.
 * Every result carries Jev's decisions and the milliseconds it took.
 */
export function routeRequest(request, spec, { base, names = {}, split = true, chosen = {} } = {}) {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const elapsed = () => Math.max(0, Math.round(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - started) * 10) / 10);
  if (split) {
    const asks = clauses(request);
    if (asks.length > 1) {
      /* Each ask is planned against the screen as Jev's earlier asks leave it: "remove the KPIs and move the chart to the top". */
      let current = spec;
      const planned = asks.map(text => {
        const plan = routeRequest(text, current, { base, names, split: false, chosen });
        if (plan.route === 'jev' && plan.change) current = simulate(current, plan.change.operations);
        return { text, plan };
      });
      const decisions = [{ name: 'asks', value: asks.length, certainty: 0.9 }, ...planned.flatMap(entry => entry.plan.decisions)];
      const asking = planned.find(entry => entry.plan.route === 'ask');
      if (asking) return { ...asking.plan, decisions, ms: elapsed() };
      const mine = planned.filter(entry => entry.plan.route === 'jev' && entry.plan.change);
      const theirs = planned.filter(entry => entry.plan.route === 'claude');
      const change = mine.length ? { version: 'syntari-ops-1', base, summary: mine.map(entry => entry.plan.change.summary).join('; '), operations: mine.flatMap(entry => entry.plan.change.operations) } : null;
      if (!theirs.length) return change ? { route: 'jev', change, decisions, ms: elapsed() } : { ...planned[0].plan, decisions, ms: elapsed() };
      if (change) return { route: 'split', change, rest: theirs.map(entry => entry.text).join(' and '), decisions, ms: elapsed() };
      const targets = [...new Set(theirs.flatMap(entry => entry.plan.hint?.targets ?? []))];
      return { route: 'claude', reason: 'Several asks that each need writing.', brief: { task: 'screen' }, hint: { targets }, decisions, ms: elapsed() };
    }
  }
  const decisions = [];
  const decide = (name, value, certainty) => decisions.push({ name, value, certainty });
  const text = fold(request).replace(/\s+/g, ' ').replace(POLITE, '').replace(POLITE_END, '').trim();
  const claude = (reason, brief = { task: 'screen' }, hint = {}) => ({ route: 'claude', reason, brief, decisions, hint: { ...hint, targets: hint.targets ?? (brief.target ? [brief.target] : []) }, ms: elapsed() });
  const ask = (phrase, found) => ({ route: 'ask', phrase: phrase.trim(), question: `Which part did you mean by “${phrase}”?`, choices: found.ambiguous.map(part => ({ id: part.id, label: part.title ?? part.name })), reason: found.reason, decisions, ms: elapsed() });
  const match = PATTERNS.map(pattern => ({ pattern, found: text.match(pattern.re) })).find(entry => entry.found);
  if (!match) { decide('intent', 'needs writing', 0.9); return claude('This request needs new content or wording, which Claude writes.'); }
  const { intent } = match.pattern, found = match.found;
  decide('intent', intent === 'move-edge' ? 'move' : intent, 0.95);
  const change = (summary, operations) => ({ version: 'syntari-ops-1', base, summary, operations });
  const target = phrase => {
    if (/^(la pantalla|el titulo de la pantalla|the screen|screen|the screen title|el titulo)$/.test(phrase.trim())) return { part: { id: 'screen', kind: 'screen', title: spec?.title ?? null } };
    /* The person already chose which part these words mean. */
    const picked = chosen[phrase.trim()] && partsOf(spec, names).find(part => part.id === chosen[phrase.trim()]);
    if (picked) return { part: picked, score: 1 };
    return resolvePart(phrase, spec, names);
  };
  const titleField = part => part.id === 'screen' ? 'title' : part.kind === 'section' ? 'heading' : part.kind === 'region' ? 'label' : TITLE_FIELDS.map(name => `props.${name}`).find(path => typeof part.node.props?.[path.slice(6)] === 'string');
  /* "the risk column from the positions table", "the first KPI": a change inside a part, not the part itself. */
  const inside = phrase => {
    const within = phrase.match(WITHIN);
    if (within && INSIDE.test(within[1])) {
      const holder = target(within[2]);
      if (holder.ambiguous) return { ask: ask(within[2], holder) };
      if (holder.part && holder.part.id !== 'screen') return { part: holder.part, what: within[1] };
    }
    const ordinal = ORDINALS.find(([pattern]) => pattern.test(phrase));
    if (!ordinal) return null;
    const kinds = kindsIn(phrase);
    if (!kinds.length) return null;
    const ofKind = partsOf(spec, names).filter(part => kinds.includes(part.slug));
    /* Two charts or more: "the first chart" is one of them, in reading order. One stat row: "the first KPI" is inside it. */
    if (ofKind.length > 1) return { pick: ofKind.at(ordinal[1]) ?? null };
    if (ofKind.length === 1) return { part: ofKind[0], what: phrase };
    return null;
  };

  if (intent === 'remove') {
    const within = inside(found[1]);
    if (within?.ask) return within.ask;
    if (within?.part) { decide('target', `#${within.part.id}`, 0.9); decide('inside', within.what, 0.8); return claude(`“${within.what}” is inside ${describe(within.part)}: Claude changes that part only.`, { task: 'part', target: within.part.id }); }
    const found1 = within?.pick ? { part: within.pick, score: 0.9 } : target(found[1]);
    if (found1.ambiguous) return ask(found[1], found1);
    const { reason, score: s } = found1;
    let { part } = found1;
    if (!part || part.id === 'screen') return claude(reason ?? 'The whole screen cannot be removed.');
    /* A section that only gives this part its visible title goes with it: a heading over nothing is not what was asked. */
    const holder = part.parent !== 'screen' ? partsOf(spec, names).find(entry => entry.id === part.parent) : null;
    if (holder?.kind === 'section' && holder.node.children?.length === 1) { decide('with', `#${holder.id}, which only holds it`, 1); part = holder; }
    decide('target', `#${part.id}`, s);
    return { route: 'jev', change: change(`Remove ${describe(part)}`, [{ op: 'remove', target: part.id, reason: request }]), decisions, ms: elapsed() };
  }
  if (intent === 'move-edge') {
    const moving = target(found[1]);
    if (moving.ambiguous) return ask(found[1], moving);
    const { part, reason, score: s } = moving;
    if (!part || part.id === 'screen') return claude(reason ?? 'The screen itself does not move.');
    decide('target', `#${part.id}`, s);
    const top = partsOf(spec, names).filter(entry => entry.parent === 'screen');
    const first = TOP.test(text.slice(text.indexOf(found[1]) + found[1].length));
    const anchor = first ? top[0] : top.at(-1);
    if (!anchor || anchor.id === part.id) return { route: 'jev', change: null, unchanged: `${describe(part)} is already ${first ? 'first' : 'last'}.`, decisions, ms: elapsed() };
    decide('place', first ? `before #${anchor.id}` : `after #${anchor.id}`, 1);
    return { route: 'jev', change: change(`Move ${describe(part)} ${first ? 'to the top' : 'to the end'}`, [{ op: 'move', target: part.id, parent: 'screen', [first ? 'before' : 'after']: anchor.id, reason: request }]), decisions, ms: elapsed() };
  }
  if (intent === 'move') {
    const moving = target(found[1]), anchor = target(found[3]);
    if (moving.ambiguous) return ask(found[1], moving);
    if (anchor.ambiguous) return ask(found[3], anchor);
    if (!moving.part || moving.part.id === 'screen') return claude(moving.reason ?? 'The screen itself does not move.');
    if (!anchor.part || anchor.part.id === 'screen') return claude(anchor.reason ?? 'Name the part it goes next to.', { task: 'screen' }, { targets: [moving.part.id] });
    if (anchor.part.id === moving.part.id) return claude('A part cannot move next to itself.');
    decide('target', `#${moving.part.id}`, moving.score);
    const after = AFTER.test(found[2]);
    decide('place', `${after ? 'after' : 'before'} #${anchor.part.id}`, anchor.score);
    return { route: 'jev', change: change(`Move ${describe(moving.part)} ${after ? 'after' : 'before'} ${describe(anchor.part)}`, [{ op: 'move', target: moving.part.id, [after ? 'after' : 'before']: anchor.part.id, reason: request }]), decisions, ms: elapsed() };
  }
  if (intent === 'rename') {
    /* the new words in quotes: nothing has to be written for the person */
    const quoted = String(request).match(QUOTED);
    const named = target(found[1]);
    if (named.ambiguous) return ask(found[1], named);
    const { part, reason, score: s } = named;
    if (!part) return claude(reason);
    decide('target', part.id === 'screen' ? 'screen' : `#${part.id}`, s ?? 1);
    if (!quoted) return claude('New wording without quotes is Claude’s to write.');
    const value = quoted[1].trim();
    if (part.id === 'screen') return { route: 'jev', change: change(`Retitle the screen “${value}”`, [{ op: 'replace', target: 'screen', set: { title: value }, reason: request }]), decisions, ms: elapsed() };
    const field = titleField(part);
    if (!field) return claude(`${describe(part)} has no title to rename.`, { task: 'part', target: part.id });
    decide('field', field, 1);
    return { route: 'jev', change: change(`Rename ${describe(part)} to “${value}”`, [{ op: 'replace', target: part.id, set: { [field]: value }, reason: request }]), decisions, ms: elapsed() };
  }
  if (intent === 'retitle') {
    const named = target(found[1]);
    if (named.ambiguous) return ask(found[1], named);
    if (!named.part) return claude(named.reason);
    const field = titleField(named.part);
    decide('target', named.part.id === 'screen' ? 'screen' : `#${named.part.id}`, named.score ?? 1);
    if (!field) return claude(`${describe(named.part)} has no title to rename.`, { task: 'part', target: named.part.id });
    decide('field', field, 1);
    const current = named.part.id === 'screen' ? spec?.title : field.startsWith('props.') ? named.part.node.props[field.slice(6)] : named.part.node[field];
    return claude('The new words are Claude’s to write; Jev knows where they go.', { task: 'words', target: named.part.id, field, current: typeof current === 'string' ? current : null });
  }
  if (intent === 'add') {
    const kinds = kindsIn(found[1]), data = dataFor(found[1], spec);
    if (kinds.length) decide('kind', kinds[0], 0.8);
    if (data.length) decide('data', data.join(', '), 0.7);
    let position = null;
    if (found[3]) {
      const anchor = target(found[3]);
      if (anchor.part && anchor.part.id !== 'screen') {
        const after = AFTER.test(found[2]);
        position = { parent: anchor.part.parent, [after ? 'after' : 'before']: anchor.part.id };
        decide('place', `${after ? 'after' : 'before'} #${anchor.part.id}`, anchor.score);
      }
    }
    return claude('A new part is Claude’s to write; Jev decided its place and its data.', { task: 'add', position, kinds, data });
  }
  /* change one part */
  const within = inside(found[1]);
  if (within?.ask) return within.ask;
  const named = within?.part ? { part: within.part, score: 0.9 } : within?.pick ? { part: within.pick, score: 0.9 } : target(found[1]);
  if (named.ambiguous) return ask(found[1], named);
  if (!named.part || named.part.id === 'screen') return claude(named.reason ?? 'This request changes the screen as a whole.');
  decide('target', `#${named.part.id}`, named.score ?? 0.9);
  return claude(`What changes inside ${describe(named.part)} is Claude’s to write; the part is Jev’s to find.`, { task: 'part', target: named.part.id });
}
