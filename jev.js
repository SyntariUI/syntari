/*
 * Jev: the decisions about a screen that need no model. It reads a request the way a person types it, finds the part it
 * names, and writes the change as syntari-ops-1 operations in a few milliseconds. What it cannot decide with certainty,
 * such as new content, copy without quotes, or a part two names could mean, it hands to Claude with what it found.
 * Every change it writes goes through applyOperations like Claude's: scoped, data-protected, and validated whole.
 */

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const fold = text => String(text ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[‐-―−]/g, '-').replace(/\s+/g, ' ').trim();
/* Words that say which part without naming it. */
const FILLER = new Set(['el', 'la', 'los', 'las', 'lo', 'un', 'una', 'de', 'del', 'al', 'a', 'en', 'con', 'y', 'que', 'the', 'a', 'an', 'of', 'to', 'in', 'on', 'and', 'this', 'that', 'este', 'esta', 'ese', 'esa', 'parte', 'part', 'componente', 'component', 'bloque', 'block']);
/* Words that name a kind of part, and the components or node types they mean. */
const KINDS = [
  [/^(tabla|table|tablas|tables|listado|detalle)$/, ['table', 'comparison-table', 'data-table', 'simple-data-table']],
  [/^(grafico|grafica|graficos|chart|charts|graph)$/, ['chart-bars', 'line-chart', 'area-chart', 'chart-donut', 'metric-and-sparkline']],
  [/^(barras|bars|columnas|columns|escalera|ladder)$/, ['chart-bars']],
  [/^(linea|lineas|line|evolucion|tendencia|trend)$/, ['line-chart', 'area-chart']],
  [/^(kpi|kpis|metricas|metrica|indicadores|stats|metrics|cifras|resumen)$/, ['stat-row', 'headline-metric', 'metric-strip']],
  [/^(desglose|breakdown|reparto|asignacion|allocation|composicion)$/, ['breakdown']],
  [/^(texto|parrafo|text|nota|explicacion|summary)$/, ['text-block', 'banner']],
  [/^(seccion|section|apartado)$/, ['section']],
  [/^(aprobacion|approval|decision|confirmacion)$/, ['tool-approval', 'approval-card']],
  [/^(calculadora|calculator|simulador)$/, ['calculator']],
  [/^(checklist|tareas|pasos)$/, ['checklist']]
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
  const kinds = new Set(asked.flatMap(word => KINDS.filter(([pattern]) => pattern.test(word)).flatMap(([, slugs]) => slugs)));
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
  /* Two parts a phrase could equally mean: Jev does not guess. */
  if (next && best.score - next.score < 0.2 && !(best.part.kind !== 'component' && next.part.parent === best.part.id)) return { part: null, reason: `“${phrase}” could mean ${describe(best.part)} or ${describe(next.part)}.`, candidates: ranked.slice(0, 3) };
  return { part: best.part, score: best.score, candidates: ranked.slice(0, 3) };
}
const describe = part => `${part.title ? `“${part.title}”` : part.name} (#${part.id})`;

const QUOTED = /["“”«»'‘’]([^"“”«»'‘’]{1,160})["“”«»'‘’]\s*\.?\s*$/;
const PATTERNS = [
  /* remove X */
  { intent: 'remove', re: /^(?:por favor,?\s*)?(?:elimina|quita|borra|suprime|saca|remove|delete|drop)\s+(.+?)\s*\.?$/i },
  /* move X to the top / to the end */
  { intent: 'move-edge', re: /^(?:mueve|pon|coloca|lleva|sube|baja|move|put|place)\s+(.+?)\s+(?:al principio|al inicio|arriba del todo|en primer lugar|primero|to the top|at the top|first|al final|abajo del todo|en ultimo lugar|el ultimo|to the bottom|at the bottom|to the end|last)\s*\.?$/i },
  /* move X before / after Y */
  { intent: 'move', re: /^(?:mueve|pon|coloca|lleva|sube|baja|move|put|place)\s+(.+?)\s+(antes de|antes del|delante de|delante del|encima de|encima del|por encima de|above|before|despues de|despues del|detras de|detras del|debajo de|debajo del|por debajo de|tras|after|below|under)\s+(.+?)\s*\.?$/i },
  /* rename X to "Y" */
  { intent: 'rename', re: /^(?:cambia|renombra|pon|titula|change|rename|set|call)\s+(?:el\s+|the\s+)?(?:titulo|nombre|encabezado|heading|title|name)?\s*(?:de|del|de la|of)?\s*(.+?)\s+(?:a|por|como|to|as)\s+["“”«»'‘’]/i }
];
const AFTER = /^(despues de|despues del|detras de|detras del|debajo de|debajo del|por debajo de|tras|after|below|under)$/;
const TOP = /(principio|inicio|arriba del todo|primer lugar|primero|top|first)/;

/**
 * Decide a request without a model when it can be decided with certainty. Returns { route: 'jev', change, decisions } with
 * a syntari-ops-1 change against `base`, or { route: 'claude', reason, decisions, hint } with what Jev found.
 */
export function routeRequest(request, spec, { base, names = {} } = {}) {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const elapsed = () => Math.max(0, Math.round(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - started) * 10) / 10);
  const decisions = [];
  const decide = (name, value, certainty) => decisions.push({ name, value, certainty });
  const text = fold(request).replace(/\s+/g, ' ');
  const claude = (reason, hint = {}) => ({ route: 'claude', reason, decisions, hint, ms: elapsed() });
  const match = PATTERNS.map(pattern => ({ pattern, found: text.match(pattern.re) })).find(entry => entry.found);
  if (!match) { decide('intent', 'needs writing', 0.9); return claude('This request needs new content or wording, which Claude writes.'); }
  const { intent } = match.pattern, found = match.found;
  decide('intent', intent === 'move-edge' ? 'move' : intent, 0.95);
  const change = (summary, operations) => ({ version: 'syntari-ops-1', base, summary, operations });
  const target = phrase => {
    if (/^(la pantalla|el titulo de la pantalla|the screen|screen)$/.test(phrase.trim())) return { part: { id: 'screen', kind: 'screen', title: spec?.title ?? null } };
    return resolvePart(phrase, spec, names);
  };

  if (intent === 'remove') {
    const { part, reason, score: s } = target(found[1]);
    if (!part || part.id === 'screen') return claude(reason ?? 'The whole screen cannot be removed.');
    decide('target', `#${part.id}`, s);
    return { route: 'jev', change: change(`Remove ${describe(part)}`, [{ op: 'remove', target: part.id, reason: request }]), decisions, ms: elapsed() };
  }
  if (intent === 'move-edge') {
    const { part, reason, score: s } = target(found[1]);
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
    if (!moving.part || moving.part.id === 'screen') return claude(moving.reason ?? 'The screen itself does not move.');
    if (!anchor.part || anchor.part.id === 'screen') return claude(anchor.reason ?? 'Name the part it goes next to.', { targets: [moving.part.id] });
    if (anchor.part.id === moving.part.id) return claude('A part cannot move next to itself.');
    decide('target', `#${moving.part.id}`, moving.score);
    const after = AFTER.test(found[2]);
    decide('place', `${after ? 'after' : 'before'} #${anchor.part.id}`, anchor.score);
    return { route: 'jev', change: change(`Move ${describe(moving.part)} ${after ? 'after' : 'before'} ${describe(anchor.part)}`, [{ op: 'move', target: moving.part.id, [after ? 'after' : 'before']: anchor.part.id, reason: request }]), decisions, ms: elapsed() };
  }
  /* rename: only with the new words in quotes, so nothing has to be written for the person. */
  const quoted = String(request).match(QUOTED);
  if (!quoted) return claude('New wording without quotes is Claude’s to write.');
  const { part, reason, score: s } = target(found[1]);
  if (!part) return claude(reason);
  decide('target', part.id === 'screen' ? 'screen' : `#${part.id}`, s ?? 1);
  const value = quoted[1].trim();
  if (part.id === 'screen') return { route: 'jev', change: change(`Retitle the screen “${value}”`, [{ op: 'replace', target: 'screen', set: { title: value }, reason: request }]), decisions, ms: elapsed() };
  const field = part.kind === 'section' ? 'heading' : part.kind === 'region' ? 'label' : TITLE_FIELDS.map(name => `props.${name}`).find(path => typeof part.node.props?.[path.slice(6)] === 'string');
  if (!field) return claude(`${describe(part)} has no title to rename.`, { targets: [part.id] });
  decide('field', field, 1);
  return { route: 'jev', change: change(`Rename ${describe(part)} to “${value}”`, [{ op: 'replace', target: part.id, set: { [field]: value }, reason: request }]), decisions, ms: elapsed() };
}
