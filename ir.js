/** Syntari UI IR: validate an agent-authored screen spec, then render it with Syntari components. */
import { mount } from './syntari.js';
import { buildDataModel, resolveProps as resolveDataProps, hasBindings, checkConsistency, dataFigures, inferTables, normalLabel } from './ir-data.js';
export { buildDataModel, formatData, parseFigure, bucketOf, dayRange, inferTables, isBinding, hasBindings, DATA_LIMITS, FIELD_TYPES, FIELD_ROLES, DATA_FORMATS } from './ir-data.js';
const base = new URL('.', import.meta.url);
export const IR_LAYOUTS = ['stack', 'row', 'grid', 'two-column'];
export const IR_LIMITS = { maxDepth: 8, maxNodes: 120, maxChildren: 40, maxListItems: 40 };
const ID_PATTERN = /^syntari\.[a-z0-9]+(-[a-z0-9]+)*$/;
/** The keys Screen IR defines. Anything else is reported, as the published schema reports it. */
const SCREEN_KEYS = ['version', 'type', 'layout', 'title', 'children', 'meta', 'data'];
const NODE_KEYS = ['id', 'component', 'slot', 'props', 'children', 'provenance'];
const REGION_KEYS = ['id', 'type', 'label', 'open', 'children', 'provenance'];
const SECTION_KEYS = ['id', 'type', 'heading', 'layout', 'children', 'provenance'];
const SANDBOX_KEYS = ['id', 'type', 'label', 'html', 'height', 'provenance'];
/** An unverified block is model-written HTML the host chose to allow. It is never validated, so it is bounded and isolated instead. */
export const SANDBOX_LIMITS = { maxHtml: 20000, minHeight: 80, maxHeight: 1200, defaultHeight: 320 };
/** A node id lets the host match an action to its own state. It never names code to run. */
export const NODE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
/** Icon names reach markup, so they are limited to lowercase words joined by dashes. */
const ICON_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

let registryPromise;
/** Read the published registry: the component index plus one manifest per rendered component. */
export function registry() {
  registryPromise ??= (async () => {
    const response = await fetch(new URL('registry/index.json', base));
    if (!response.ok) throw new Error('Syntari IR could not read registry/index.json.');
    const index = await response.json();
    const entries = new Map(index.components.map(component => [component.id, component]));
    const manifests = new Map();
    async function manifest(slug) {
      if (!manifests.has(slug)) {
        let value = null;
        if (entries.has(slug)) {
          const file = await fetch(new URL(`registry/components/${slug}.json`, base));
          if (file.ok) value = await file.json();
        }
        manifests.set(slug, value);
      }
      return manifests.get(slug);
    }
    /* How data maps to visualizations and screens to patterns: the policy composition checks read. Optional for a host. */
    let policy = null;
    try { const file = await fetch(new URL('registry/composition-policy.json', base)); if (file.ok) policy = await file.json(); } catch {}
    return { index, entries, manifest, policy };
  })();
  return registryPromise;
}
export const componentSlug = component => String(component ?? '').replace(/^syntari\./, '');
/** A component is renderable from IR once its manifest declares both props and slot bindings. */
export const isRenderable = manifest => Boolean(manifest?.props && manifest?.ir);
export const layoutName = layout => IR_LAYOUTS.includes(layout) ? layout : 'stack';
export async function renderableSlugs() {
  const reg = await registry();
  const authored = reg.index.components.filter(entry => entry.status === 'authored');
  /* The index records each component's renderable flag at build time, so no manifest is fetched just to answer this.
     An index without the flag is read the slow way, one manifest at a time. */
  if (authored.every(entry => typeof entry.renderable === 'boolean')) return authored.filter(entry => entry.renderable).map(entry => entry.id);
  const found = [];
  for (const entry of authored) if (isRenderable(await reg.manifest(entry.id))) found.push(entry.id);
  return found;
}

/**
 * Formulas let a contract compute a value from a person's inputs without running model-written code.
 * The grammar is arithmetic only: numbers, names, + - * / ^, parentheses, and the functions below.
 */
const FORMULA_FUNCTIONS = {
  min: { arity: [1, 8], run: (...args) => Math.min(...args) },
  max: { arity: [1, 8], run: (...args) => Math.max(...args) },
  round: { arity: [1, 2], run: (x, digits = 0) => { const scale = 10 ** Math.max(0, Math.min(6, Math.trunc(digits))); return Math.round(x * scale) / scale; } },
  floor: { arity: [1, 1], run: Math.floor },
  ceil: { arity: [1, 1], run: Math.ceil },
  abs: { arity: [1, 1], run: Math.abs },
  /* Future value of a payment made at the end of each period: fv(rate per period, periods, payment). */
  fv: { arity: [3, 3], run: (rate, periods, payment) => rate === 0 ? payment * periods : payment * ((1 + rate) ** periods - 1) / rate }
};
export const FORMULA_NAMES = Object.keys(FORMULA_FUNCTIONS);
const FORMULA_LIMIT = 200;
/** Parse a formula into a tree. Throws a SyntaxError that says what is wrong in words a person can act on. */
export function parseFormula(source) {
  const text = String(source ?? '');
  if (!text.trim()) throw new SyntaxError('A formula cannot be empty.');
  if (text.length > FORMULA_LIMIT) throw new SyntaxError(`A formula has at most ${FORMULA_LIMIT} characters.`);
  const tokens = [];
  const pattern = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|([-+*/^(),]))/y;
  let at = 0;
  while (at < text.length) {
    if (!text.slice(at).trim()) break;
    pattern.lastIndex = at;
    const match = pattern.exec(text);
    if (!match) throw new SyntaxError(`"${text.slice(at).trim()[0]}" is not allowed in a formula. Use numbers, names, + - * / ^, and parentheses.`);
    tokens.push(match[1] !== undefined ? { kind: 'number', value: Number(match[1]) } : match[2] !== undefined ? { kind: 'name', value: match[2] } : { kind: match[3] });
    at = pattern.lastIndex;
  }
  let index = 0, depth = 0;
  const peek = () => tokens[index], take = () => tokens[index++];
  const expect = kind => { if (peek()?.kind !== kind) throw new SyntaxError(`Expected "${kind}" in the formula.`); take(); };
  const nest = parse => { if (++depth > 24) throw new SyntaxError('The formula nests too deeply.'); const node = parse(); depth -= 1; return node; };
  function primary() {
    const token = take();
    if (!token) throw new SyntaxError('The formula ends too early.');
    if (token.kind === 'number') return { kind: 'number', value: token.value };
    if (token.kind === '(') { const inner = nest(expression); expect(')'); return inner; }
    if (token.kind === 'name') {
      if (peek()?.kind !== '(') return { kind: 'name', name: token.value };
      const fn = FORMULA_FUNCTIONS[token.value];
      if (!fn) throw new SyntaxError(`"${token.value}" is not a formula function. Use ${FORMULA_NAMES.join(', ')}.`);
      take();
      const args = [];
      if (peek()?.kind !== ')') { args.push(nest(expression)); while (peek()?.kind === ',') { take(); args.push(nest(expression)); } }
      expect(')');
      if (args.length < fn.arity[0] || args.length > fn.arity[1]) throw new SyntaxError(`${token.value}() takes ${fn.arity[0] === fn.arity[1] ? fn.arity[0] : `${fn.arity[0]} to ${fn.arity[1]}`} values.`);
      return { kind: 'call', name: token.value, args };
    }
    throw new SyntaxError(`"${token.kind}" is out of place in the formula.`);
  }
  /* As in written arithmetic, -2^2 is -(2^2), and 2^3^2 is 2^(3^2). */
  function unary() { if (peek()?.kind === '-') { take(); return { kind: 'negate', value: nest(unary) }; } if (peek()?.kind === '+') { take(); return nest(unary); } return power(); }
  function power() { const base = primary(); if (peek()?.kind === '^') { take(); return { kind: '^', left: base, right: nest(unary) }; } return base; }
  function term() { let node = unary(); while (['*', '/'].includes(peek()?.kind)) { const op = take().kind; node = { kind: op, left: node, right: unary() }; } return node; }
  function expression() { let node = term(); while (['+', '-'].includes(peek()?.kind)) { const op = take().kind; node = { kind: op, left: node, right: term() }; } return node; }
  const tree = expression();
  if (index < tokens.length) throw new SyntaxError(`"${tokens[index].kind === 'name' || tokens[index].kind === 'number' ? tokens[index].value : tokens[index].kind}" is out of place in the formula.`);
  const names = new Set();
  const collect = node => { if (node.kind === 'name') names.add(node.name); for (const child of [node.left, node.right, node.value, ...(node.args ?? [])]) if (child && typeof child === 'object') collect(child); };
  collect(tree);
  return { tree, names: [...names] };
}
/** Evaluate a parsed formula. A result that is not a finite number is null, so it reads as unknown rather than wrong. */
export function evaluateFormula(tree, scope) {
  const run = node => {
    switch (node.kind) {
      case 'number': return node.value;
      case 'name': return Object.hasOwn(scope, node.name) ? Number(scope[node.name]) : NaN;
      case 'negate': return -run(node.value);
      case 'call': return FORMULA_FUNCTIONS[node.name].run(...node.args.map(run));
      case '+': return run(node.left) + run(node.right);
      case '-': return run(node.left) - run(node.right);
      case '*': return run(node.left) * run(node.right);
      case '/': return run(node.left) / run(node.right);
      case '^': return run(node.left) ** run(node.right);
      default: return NaN;
    }
  };
  const result = run(tree);
  return Number.isFinite(result) ? result : null;
}
/** Write a number the way its format reads: currency in the given code, percent as written, everything else grouped. */
export function formatValue(value, format = 'number', currency = 'USD') {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  const number = Number(value);
  /* Cents only where they say something: $2.10, but $40 and $416,129. */
  if (format === 'currency') { const cents = Math.abs(number) < 100 && !Number.isInteger(number) ? 2 : 0; return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: cents, maximumFractionDigits: cents }).format(number); }
  if (format === 'percent') return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(number)}%`;
  if (format === 'integer') return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(number);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(number);
}

const typeOf = value => Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
function checkValue(value, descriptor, path, report) {
  const expected = descriptor.type;
  const actual = typeOf(value);
  if (expected === 'enum') {
    if (!descriptor.values.includes(value)) report('error', 'enum-outside-values', path, `"${value}" is not one of ${descriptor.values.map(v => `"${v}"`).join(', ')}.`);
    return;
  }
  if (expected === 'number' && actual !== 'number') { report('error', 'wrong-type', path, `Expected a number, received ${actual}.`); return; }
  if (expected === 'boolean' && actual !== 'boolean') { report('error', 'wrong-type', path, `Expected true or false, received ${actual}.`); return; }
  if (expected === 'string' && actual !== 'string') { report('error', 'wrong-type', path, `Expected a string, received ${actual}.`); return; }
  if (expected === 'array') {
    if (actual !== 'array') { report('error', 'wrong-type', path, `Expected an array, received ${actual}.`); return; }
    const max = Math.min(descriptor.maxItems ?? IR_LIMITS.maxListItems, IR_LIMITS.maxListItems);
    if (value.length > max) report('error', 'over-item-budget', path, `Received ${value.length} items; the limit for this prop is ${max}.`);
    if (!value.length && descriptor.required) report('error', 'empty-list', path, 'This list is required, so it needs at least one item.');
    /* Parts of one whole must add up to it: a breakdown whose shares do not is wrong, whatever it looks like. */
    if (descriptor.sum && value.length) {
      const total = value.reduce((sum, item) => sum + (typeof item?.[descriptor.sum.field] === 'number' ? item[descriptor.sum.field] : 0), 0);
      if (Math.abs(total - descriptor.sum.total) > (descriptor.sum.tolerance ?? 0)) report('error', 'wrong-sum', path, `The ${descriptor.sum.field} values add up to ${tidy(total)}; they must add up to ${descriptor.sum.total}.`);
    }
    const itemDescriptor = descriptor.items;
    if (itemDescriptor) value.forEach((item, i) => {
      if (itemDescriptor.type === 'object') {
        if (typeOf(item) !== 'object') { report('error', 'wrong-type', `${path}[${i}]`, `Expected an object, received ${typeOf(item)}.`); return; }
        for (const [key, field] of Object.entries(itemDescriptor.fields ?? {})) {
          if (item[key] === undefined) { if (field.required) report('error', 'missing-required', `${path}[${i}].${key}`, 'A required value is missing.'); continue; }
          checkValue(item[key], field, `${path}[${i}].${key}`, report);
        }
        for (const key of Object.keys(item)) if (!itemDescriptor.fields?.[key]) report('warning', 'unknown-prop', `${path}[${i}].${key}`, 'This value is not part of the component contract and was ignored.');
      } else checkValue(item, itemDescriptor, `${path}[${i}]`, report);
    });
    return;
  }
  if (expected === 'object') {
    if (actual !== 'object') { report('error', 'wrong-type', path, `Expected an object, received ${actual}.`); return; }
    for (const [key, field] of Object.entries(descriptor.fields ?? {})) {
      if (value[key] === undefined) { if (field.required) report('error', 'missing-required', `${path}.${key}`, 'A required value is missing.'); continue; }
      checkValue(value[key], field, `${path}.${key}`, report);
    }
    return;
  }
  /* Required text, and text whose default names something, must say something: an empty label leaves a control unnamed. */
  if (typeof value === 'string' && !value.trim() && (descriptor.required || /label$/i.test(path.split('.').pop()))) report('error', 'empty-value', path, 'This text is required or names a control, so it cannot be empty.');
  if (descriptor.maxLength && value.length > descriptor.maxLength) report('error', 'over-length', path, `Received ${value.length} characters; the limit is ${descriptor.maxLength}.`);
  if (descriptor.minimum !== undefined && value < descriptor.minimum) report('error', 'below-minimum', path, `Received ${value}; the minimum is ${descriptor.minimum}.`);
  if (descriptor.maximum !== undefined && value > descriptor.maximum) report('error', 'above-maximum', path, `Received ${value}; the maximum is ${descriptor.maximum}.`);
}

/** Provenance says where a node came from: text fields and a list of rules. */
function checkProvenance(provenance, path, report) {
  if (provenance === undefined) return;
  if (typeOf(provenance) !== 'object') { report('error', 'wrong-type', path, 'Provenance is an object.'); return; }
  for (const [key, value] of Object.entries(provenance)) {
    if (!['component', 'source', 'reason', 'rulesApplied'].includes(key)) report('error', 'unknown-key', `${path}.${key}`, 'Provenance takes component, source, reason, and rulesApplied.');
    else if (key === 'rulesApplied' ? !Array.isArray(value) || value.some(rule => typeof rule !== 'string') : typeof value !== 'string') report('error', 'wrong-type', `${path}.${key}`, key === 'rulesApplied' ? 'rulesApplied is a list of rule names.' : 'This provenance field is text.');
  }
}

/** Any node may carry an id: operations name nodes by it, and action requests carry it back to the host. */
function checkId(node, context, path) {
  if (node.id === undefined) return;
  const { report } = context;
  if (typeof node.id !== 'string' || !NODE_ID_PATTERN.test(node.id)) report('error', 'invalid-node-id', `${path}.id`, 'Node ids use letters, digits, dots, dashes, or underscores, up to 64 characters.');
  else if (context.ids?.has(node.id)) report('error', 'duplicate-node-id', `${path}.id`, `"${node.id}" is already used by another node.`);
  else context.ids?.add(node.id);
}

/** Validate one node against the registry. Returns the diagnostics raised for that node only. */
async function checkNode(node, context, path) {
  const { reg, report } = context;
  if (!node || typeof node !== 'object' || Array.isArray(node)) { report('error', 'invalid-node', path, 'A node must be an object with a component id.'); return null; }
  if (node.type === 'region') {
    for (const key of Object.keys(node)) if (!REGION_KEYS.includes(key)) report('error', 'unknown-key', `${path}.${key}`, `Regions take ${REGION_KEYS.join(', ')}.`);
    checkId(node, context, path);
    if (!Array.isArray(node.children)) report('error', 'missing-required', `${path}.children`, 'A region needs a children array, even an empty one.');
    checkProvenance(node.provenance, `${path}.provenance`, report);
    if (typeof node.label !== 'string' || !node.label.trim()) report('error', 'invalid-region', `${path}.label`, 'A region needs a label; it becomes the summary a person reads.');
    else if (node.label.length > 60) report('error', 'over-length', `${path}.label`, 'Region labels stay under 60 characters.');
    if (node.open !== undefined && typeof node.open !== 'boolean') report('error', 'wrong-type', `${path}.open`, 'A region is either open or closed.');
    return { region: true, group: true };
  }
  if (node.type === 'section') {
    for (const key of Object.keys(node)) if (!SECTION_KEYS.includes(key)) report('error', 'unknown-key', `${path}.${key}`, `Sections take ${SECTION_KEYS.join(', ')}.`);
    checkId(node, context, path);
    if (!Array.isArray(node.children)) report('error', 'missing-required', `${path}.children`, 'A section needs a children array.');
    checkProvenance(node.provenance, `${path}.provenance`, report);
    if (typeof node.heading !== 'string' || !node.heading.trim()) report('error', 'invalid-section', `${path}.heading`, 'A section needs a heading; it is what a person scans for.');
    else if (node.heading.length > 80) report('error', 'over-length', `${path}.heading`, 'Section headings stay under 80 characters.');
    if (node.layout !== undefined && typeof node.layout !== 'string') report('error', 'wrong-type', `${path}.layout`, `Layout is one of ${IR_LAYOUTS.join(', ')}.`);
    else if (node.layout !== undefined && !IR_LAYOUTS.includes(node.layout)) report('warning', 'unknown-layout', `${path}.layout`, `"${node.layout}" is not a reference layout. The section renders as a stack.`);
    return { section: true, group: true };
  }
  if (node.type === 'sandbox') {
    for (const key of Object.keys(node)) if (!SANDBOX_KEYS.includes(key)) report('error', 'unknown-key', `${path}.${key}`, `Unverified blocks take ${SANDBOX_KEYS.join(', ')}.`);
    checkId(node, context, path);
    checkProvenance(node.provenance, `${path}.provenance`, report);
    if (typeof node.label !== 'string' || !node.label.trim()) report('error', 'invalid-sandbox', `${path}.label`, 'An unverified block needs a label that says what it shows.');
    else if (node.label.length > 60) report('error', 'over-length', `${path}.label`, 'Labels stay under 60 characters.');
    if (typeof node.html !== 'string' || !node.html.trim()) report('error', 'invalid-sandbox', `${path}.html`, 'An unverified block needs its HTML as a string.');
    else if (node.html.length > SANDBOX_LIMITS.maxHtml) report('error', 'over-length', `${path}.html`, `Received ${node.html.length} characters; the limit is ${SANDBOX_LIMITS.maxHtml}.`);
    if (node.height !== undefined && typeof node.height !== 'number') report('error', 'wrong-type', `${path}.height`, 'Height is a number of pixels.');
    else if (node.height < SANDBOX_LIMITS.minHeight) report('error', 'below-minimum', `${path}.height`, `Received ${node.height}; the minimum is ${SANDBOX_LIMITS.minHeight}.`);
    else if (node.height > SANDBOX_LIMITS.maxHeight) report('error', 'above-maximum', `${path}.height`, `Received ${node.height}; the maximum is ${SANDBOX_LIMITS.maxHeight}.`);
    if (!context.sandbox) report('error', 'sandbox-not-allowed', path, 'This host does not allow unverified blocks. Compose this part from registry components.');
    else report('warning', 'unverified-block', path, 'Syntari does not validate this block. It shows static HTML in an isolated frame with no scripts, no network, and no actions.');
    return { sandbox: true };
  }
  const { component } = node;
  for (const key of Object.keys(node)) if (!NODE_KEYS.includes(key)) report('error', 'unknown-key', `${path}.${key}`, `Component nodes take ${NODE_KEYS.join(', ')}.`);
  if (node.slot !== undefined && typeof node.slot !== 'string') report('error', 'wrong-type', `${path}.slot`, 'A slot name is text.');
  checkProvenance(node.provenance, `${path}.provenance`, report);
  if (typeof component !== 'string' || !ID_PATTERN.test(component)) {
    report('error', 'invalid-component-id', `${path}.component`, 'Component ids use the form "syntari.component-slug".');
    return null;
  }
  const slug = componentSlug(component);
  if (!reg.entries.has(slug)) { report('error', 'unknown-component', `${path}.component`, `"${component}" is not in the Syntari registry.`); return null; }
  const manifest = await reg.manifest(slug);
  if (!isRenderable(manifest)) { report('error', 'unsupported-component', `${path}.component`, `"${component}" is documented but has no prop contract yet, so it cannot be rendered from IR.`); return null; }
  checkId(node, context, path);
  if (Object.keys(manifest.actions ?? {}).length && node.id === undefined) report('warning', 'missing-node-id', `${path}.id`, `${component} sends action requests. Give it an id so the host can match each request to its own state.`);
  /* A prop bound to screen data is resolved first, so the contract checks the figure the runtime computed. */
  if (context.model || hasBindings(node.props)) node.props = resolveDataProps(node.props ?? {}, manifest, context.model, `${path}.props`, report, binding => context.bindings.push({ ...binding, id: node.id ?? null, node: path }));
  checkProps(manifest, node.props ?? {}, `${path}.props`, report, reg.index?.icons);
  return { slug, manifest };
}

/** Check props against a component contract. Shared by Screen IR nodes and mount({ props }). */
export function checkProps(manifest, props, path, report, icons) {
  const component = `syntari.${manifest.id}`;
  if (typeOf(props) !== 'object') { report('error', 'wrong-type', path, 'Props must be an object.'); return; }
  for (const [key, value] of Object.entries(props)) {
    const descriptor = manifest.props[key];
    if (!descriptor) { report('warning', 'unknown-prop', `${path}.${key}`, `${component} has no "${key}" prop. It was ignored.`); continue; }
    checkValue(value, descriptor, `${path}.${key}`, report);
  }
  for (const [key, descriptor] of Object.entries(manifest.props)) {
    if (descriptor.required && props[key] === undefined && descriptor.default === undefined) report('error', 'missing-required', `${path}.${key}`, `"${key}" is required by ${component}.`);
  }
  const badIcon = (value, at) => {
    if (value === undefined) return;
    if (typeof value !== 'string' || !ICON_NAME.test(value)) report('error', 'invalid-icon', at, 'Icon names use lowercase letters, digits, and dashes, such as "circlecheck" or "arrow-up".');
    else if (icons && !icons.includes(value)) report('warning', 'unknown-icon', at, `"${value}" is not a Syntari icon, so the component keeps its own. The registry index lists every icon name.`);
  };
  for (const key of Object.keys(manifest.ir?.icon ?? {})) badIcon(props[key], `${path}.${key}`);
  for (const [key, parts] of Object.entries(manifest.ir?.list ?? {})) {
    const fields = [].concat(parts).flatMap(part => Object.keys(part.icon ?? {}));
    if (!fields.length || !Array.isArray(props[key])) continue;
    props[key].forEach((item, i) => { for (const field of fields) badIcon(item?.[field], `${path}.${key}[${i}].${field}`); });
  }
  if (manifest.ir?.compute) checkCompute(manifest.ir.compute, props, path, report);
  for (const [key, binding] of Object.entries(manifest.ir?.select ?? {})) {
    const items = props[binding.list];
    if (typeof props[key] === 'string' && Array.isArray(items) && !items.some(item => item?.[binding.field] === props[key])) report('warning', 'no-matching-item', `${path}.${key}`, `"${props[key]}" is not the ${binding.field} of any item in ${binding.list}, so nothing is marked selected.`);
  }
  for (const [key, parts] of Object.entries(manifest.ir?.list ?? {})) for (const part of [].concat(parts)) {
    const columns = part.cellCount && props[part.cellCount];
    if (!part.cells || !Array.isArray(columns) || !Array.isArray(props[key])) continue;
    props[key].forEach((row, i) => { if (Array.isArray(row) && row.length !== columns.length) report('warning', 'row-length', `${path}.${key}[${i}]`, `This row has ${row.length} cells for ${columns.length} columns. Missing cells render empty and extra cells are dropped.`); });
  }
  /* A matrix value sits under its column: a row with too few or too many would shade the wrong cells. */
  for (const [key, binding] of Object.entries(manifest.ir?.matrix ?? {})) {
    const columns = props[binding.columns], field = binding.values ?? 'values';
    if (!Array.isArray(columns) || !Array.isArray(props[key])) continue;
    props[key].forEach((row, i) => { if (Array.isArray(row?.[field]) && row[field].length !== columns.length) report('error', 'row-length', `${path}.${key}[${i}].${field}`, `This row has ${row[field].length} values for ${columns.length} columns. Give one value per column, in column order.`); });
  }
  /* A tile's area is its value, so a value of nothing has no tile to draw. */
  for (const key of Object.keys(manifest.ir?.tiles ?? {})) {
    if (!Array.isArray(props[key])) continue;
    props[key].forEach((tile, i) => { if (typeof tile?.value === 'number' && !(tile.value > 0)) report('error', 'below-minimum', `${path}.${key}[${i}].value`, 'A tile needs a value above 0: its area is its value. Leave out parts that are empty.'); });
    const groups = new Set(props[key].map(tile => tile?.group).filter(group => typeof group === 'string' && group.trim()));
    if (groups.size > 3) report('warning', 'too-many-groups', `${path}.${key}`, `${groups.size} groups were given; three get a colour and the rest are drawn neutral. Merge the smallest groups, or leave them ungrouped.`);
  }
}

const COMPUTE_NAME = /^[a-z][A-Za-z0-9_]{0,23}$/;
/** A computing contract names its inputs and results; every formula may use only names defined before it. */
function checkCompute(binding, props, path, report) {
  const known = new Set();
  const define = (item, at) => {
    const name = item?.name;
    if (typeof name !== 'string') return;
    if (!COMPUTE_NAME.test(name) || FORMULA_NAMES.includes(name)) report('error', 'invalid-name', `${at}.name`, 'Names start with a lowercase letter and use letters, digits, or underscores, and cannot be a formula function.');
    else if (known.has(name)) report('error', 'duplicate-name', `${at}.name`, `"${name}" is already defined.`);
    else known.add(name);
  };
  const formula = (source, at) => {
    if (typeof source !== 'string') return;
    try {
      const { names } = parseFormula(source);
      for (const name of names) if (!known.has(name)) report('error', 'unknown-name', at, `"${name}" is not an input or an earlier result. Use ${[...known].join(', ') || 'the input names'}.`);
    } catch (error) { report('error', 'invalid-formula', at, error.message); }
  };
  (Array.isArray(props[binding.inputs]) ? props[binding.inputs] : []).forEach((input, i) => {
    const at = `${path}.${binding.inputs}[${i}]`;
    define(input, at);
    if ([input?.min, input?.max, input?.value].some(number => typeof number !== 'number')) return;
    if (input.min >= input.max) report('error', 'invalid-range', `${at}.max`, 'max must be greater than min.');
    else if (input.value < input.min || input.value > input.max) report('error', 'invalid-range', `${at}.value`, `The starting value must sit between ${input.min} and ${input.max}.`);
    if (typeof input.step === 'number' && input.step <= 0) report('error', 'invalid-range', `${at}.step`, 'step must be greater than 0.');
    else if (typeof input.step === 'number' && Math.abs((input.value - input.min) / input.step - Math.round((input.value - input.min) / input.step)) > 1e-6) report('warning', 'off-step', `${at}.value`, `${input.value} is not min plus a whole number of steps, so the slider starts at ${tidy(input.min + Math.round((input.value - input.min) / input.step) * input.step)}.`);
  });
  (Array.isArray(props[binding.outputs]) ? props[binding.outputs] : []).forEach((output, i) => {
    const at = `${path}.${binding.outputs}[${i}]`;
    formula(output?.formula, `${at}.formula`);
    define(output, at);
  });
  if (binding.parts) (Array.isArray(props[binding.parts]) ? props[binding.parts] : []).forEach((part, i) => formula(part?.formula, `${path}.${binding.parts}[${i}].formula`));
}

/** Validate props for one component before mount() applies them. */
export async function validateProps(slug, props = {}, options = {}) {
  const reg = options.registry ?? await registry();
  const diagnostics = [];
  const report = (severity, code, path, message) => diagnostics.push({ severity, code, path, message });
  const manifest = reg.entries.has(slug) ? await reg.manifest(slug) : null;
  if (!isRenderable(manifest)) {
    report('error', 'unsupported-component', 'props', `"${slug}" has no prop contract yet. Mount it without props and configure its markup instead.`);
    return { ok: false, diagnostics, manifest, props: {} };
  }
  checkProps(manifest, props, 'props', report, reg.index?.icons);
  const ok = !diagnostics.some(d => d.severity === 'error');
  return { ok, diagnostics, manifest, props: ok ? resolveProps(props, manifest) : {} };
}

/** Merge contract defaults into the values an agent supplied. Unknown props never reach the DOM. */
export function resolveProps(props = {}, contract) {
  const resolved = {};
  for (const [key, descriptor] of Object.entries(contract.props ?? {})) {
    if (props[key] !== undefined) resolved[key] = props[key];
    else if (descriptor.default !== undefined) resolved[key] = descriptor.default;
  }
  return resolved;
}

/**
 * Validate a spec before anything is rendered.
 * Errors stop a node from painting; warnings are reported and repaired.
 */
export async function validate(spec, options = {}) {
  const reg = options.registry ?? await registry();
  const limits = { ...IR_LIMITS, ...options.limits };
  const diagnostics = [];
  const report = (severity, code, path, message) => diagnostics.push({ severity, code, path, message });
  const context = { reg, report, limits, count: 0, ids: new Set(), sandbox: options.sandbox === true, model: null, bindings: [] };
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    report('error', 'invalid-spec', '', 'The spec must be an object describing a screen or a node.');
    return { ok: false, diagnostics, screen: null, data: null, bindings: [] };
  }
  /* The data block is checked and computed once; bound props then read from it. The screen returned is the resolved one,
     so what renders is exactly what was validated. The spec itself keeps its bindings. */
  context.model = spec.type === 'screen' ? buildDataModel(spec.data, report) : null;
  const bound = context.model !== null || hasBindings(spec.type === 'screen' ? spec.children : spec);
  const screen = spec.type === 'screen' ? (bound ? structuredClone(spec) : spec) : { type: 'screen', layout: 'stack', children: [bound ? structuredClone(spec) : spec] };
  if (spec.type === 'screen' && spec.version !== undefined && spec.version !== 'syntari-ir-1') report('error', 'unsupported-version', 'version', 'Screen version must be "syntari-ir-1".');
  if (spec.type === 'screen') for (const key of Object.keys(spec)) if (!SCREEN_KEYS.includes(key)) report('error', 'unknown-key', key, `Screens take ${SCREEN_KEYS.join(', ')}.`);
  if (spec.type === 'screen' && spec.title !== undefined && typeof spec.title !== 'string') report('error', 'wrong-type', 'title', 'A screen title is text.');
  if (spec.type === 'screen' && spec.meta !== undefined && typeOf(spec.meta) !== 'object') report('error', 'wrong-type', 'meta', 'Screen meta is an object.');
  if (spec.type === 'screen' && spec.layout !== undefined && typeof spec.layout !== 'string') report('error', 'wrong-type', 'layout', `Layout is one of ${IR_LAYOUTS.join(', ')}.`);
  else if (spec.type === 'screen' && spec.layout !== undefined && !IR_LAYOUTS.includes(spec.layout)) report('warning', 'unknown-layout', 'layout', `"${spec.layout}" is not a reference layout. The screen renders as a stack.`);
  if (!Array.isArray(screen.children)) report('error', 'wrong-type', 'children', 'Screen children must be an array.');
  const children = Array.isArray(screen.children) ? screen.children : [];
  if (children.length > limits.maxChildren) report('error', 'over-node-budget', 'children', `${children.length} top-level nodes were supplied; the limit is ${limits.maxChildren}.`);

  async function walk(node, path, depth) {
    context.count += 1;
    if (depth > limits.maxDepth) { report('error', 'over-depth-budget', path, `The spec nests deeper than ${limits.maxDepth} levels.`); return; }
    if (context.count > limits.maxNodes) { if (!context.overNodes) report('error', 'over-node-budget', path, `The spec holds more than ${limits.maxNodes} nodes.`); context.overNodes = true; return; }
    const resolved = await checkNode(node, context, path);
    const nested = node?.children;
    /* A node that does not resolve still holds children; they count toward the budget and are checked too. */
    if (!resolved) { if (Array.isArray(nested)) for (const [i, child] of nested.entries()) await walk(child, `${path}.children[${i}]`, depth + 1); return; }
    if (nested === undefined) return;
    if (!Array.isArray(nested)) { report('error', 'wrong-type', `${path}.children`, 'Children must be an array.'); return; }
    if (nested.length && !resolved.group) report('warning', 'nested-children-unsupported', `${path}.children`, 'Components do not take children, so these render as siblings. Group them in a section or a region.');
    for (const [i, child] of nested.entries()) await walk(child, `${path}.children[${i}]`, depth + 1);
  }
  for (const [i, child] of children.entries()) await walk(child, `children[${i}]`, 1);
  /* A structurally valid screen can still contradict its own data: a written figure that names data must agree with it. */
  /* Past the budgets the walk stopped early, so the screen-wide checks would read an unbounded tree: they wait for a valid one. */
  const bounded = !diagnostics.some(d => d.code === 'over-depth-budget' || d.code === 'over-node-budget');
  if (spec.type === 'screen' && bounded) checkConsistency(spec, context.model, report);
  if (spec.type === 'screen' && bounded && options.semantics !== false && reg.policy) {
    const { checkSemantics } = await import('./ir-compose.js');
    checkSemantics(spec, screen, { model: context.model, bindings: context.bindings, policy: reg.policy, report });
  }
  return { ok: !diagnostics.some(d => d.severity === 'error'), diagnostics, screen, data: context.model, bindings: context.bindings };
}

/* ---------- Iteration: a model proposes operations against one version of a screen; the runtime applies them ---------- */
export const OPS_VERSION = 'syntari-ops-1';
export const OPS_LIMITS = { maxOperations: 20 };
const CHANGE_KEYS = ['version', 'base', 'summary', 'operations', 'clarify', 'needs', 'unsupported'];
const OP_KEYS = { insert: ['op', 'parent', 'after', 'before', 'node', 'reason'], replace: ['op', 'target', 'set', 'node', 'reason'], remove: ['op', 'target', 'reason'], move: ['op', 'target', 'parent', 'after', 'before', 'reason'], recompose: ['op', 'screen', 'reason'] };
/** What `set` may change on each kind of node. A component's fields are its props, plus the reason it is on the screen. */
const SETTABLE = { screen: ['title', 'layout'], section: ['heading', 'layout'], region: ['label', 'open'], sandbox: ['label', 'html', 'height'], component: ['props', 'provenance.reason'], data: ['measures', 'groups', 'tables', 'sources', 'mode', 'label', 'currency', 'locale', 'asOf'] };
/* Definitions computed from the rows may be added or changed freely; the rows and where they come from are protected data. */
const DATA_DEFINITIONS = ['measures', 'groups'];
const kindOfNode = node => ['section', 'region', 'sandbox'].includes(node?.type) ? node.type : 'component';
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Visit every node in reading order with its path, its parent's id ("screen" at the top), and the list that holds it. */
function eachNode(screen, visit) {
  const go = (list, path, parentId) => (Array.isArray(list) ? list : []).forEach((node, index) => {
    const at = `${path ? `${path}.` : ''}children[${index}]`;
    visit(node, { path: at, parentId, list, index });
    if (isObject(node) && Array.isArray(node.children)) go(node.children, at, typeof node.id === 'string' ? node.id : at);
  });
  go(screen?.children, '', 'screen');
}
/** JSON with sorted keys, so two specs that are equal as data read the same. */
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : isObject(value) ? `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  : JSON.stringify(value) ?? 'null';
/** A short fingerprint of a screen's content. Operations name the version they were written against, so a change to a newer screen is refused. */
export function versionOf(spec) {
  const text = canonical(spec);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return `sv-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
const wordsOf = text => String(text ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
function uniqueId(stem, used) {
  const base = (stem.slice(0, 48).replace(/-+$/, '') || 'node').replace(/^[^a-z0-9]+/i, '') || 'node';
  let id = base;
  for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
  used.add(id);
  return id;
}
function idStem(node) {
  const kind = kindOfNode(node);
  if (kind === 'component') return componentSlug(node.component).replace(/[^a-z0-9-]/g, '') || 'node';
  return [kind === 'sandbox' ? 'block' : kind, ...wordsOf(kind === 'section' ? node.heading : node.label).slice(0, 4)].join('-');
}
function nameNodes(nodes, used) {
  const go = list => (Array.isArray(list) ? list : []).forEach(node => {
    if (!isObject(node)) return;
    if (node.id === undefined) node.id = uniqueId(idStem(node), used);
    go(node.children);
  });
  go(nodes);
}
/**
 * Give every node an id it keeps from one version to the next: the ids operations name.
 * Ids already written stay as they are; a node without one gets a readable id such as "table-2" or "section-where-absence-comes".
 */
export function assignIds(spec) {
  const screen = structuredClone(spec);
  if (!isObject(screen)) return screen;
  const used = new Set();
  eachNode(screen, node => { if (typeof node?.id === 'string') used.add(node.id); });
  nameNodes(screen.type === 'screen' ? screen.children : [screen], used);
  return screen;
}
/** Find a node by id: the node, its path, its parent's id, and its place in the parent's children. */
export function findNode(spec, id) {
  let found = null;
  eachNode(spec, (node, at) => { if (!found && isObject(node) && node.id === id) found = { node, ...at }; });
  return found;
}

/* Field paths name a field inside a node: "props.caption", "props.metrics[0].value", "heading". */
const FIELD_PATH = /^[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*|\[\d+\])*$/;
const FORBIDDEN_STEPS = new Set(['__proto__', 'constructor', 'prototype']);
const stepsOf = path => [...path.matchAll(/([A-Za-z_]\w*)|\[(\d+)\]/g)].map(m => m[1] ?? Number(m[2]));
function writeAt(target, path, value) {
  const steps = stepsOf(path);
  let at = target;
  for (const [i, step] of steps.slice(0, -1).entries()) {
    if (!at[step] || typeof at[step] !== 'object') at[step] = typeof steps[i + 1] === 'number' ? [] : {};
    at = at[step];
  }
  const last = steps.at(-1);
  /* null removes an optional field, so a model can clear a note without inventing an empty one. */
  if (value === null && !Array.isArray(at)) delete at[last]; else at[last] = value;
}
/** Every primitive inside a value, with its path and the name of the field that holds it. */
function leaves(value, path = '', key = '', out = []) {
  if (Array.isArray(value)) value.forEach((item, i) => leaves(item, `${path}[${i}]`, key, out));
  else if (isObject(value)) for (const [k, v] of Object.entries(value)) leaves(v, path ? `${path}.${k}` : k, k, out);
  else if (value !== undefined) out.push({ path, key, value });
  return out;
}
/** Words a person reads about the data, as opposed to the data. Copy may be reworded on request; data is protected. */
const COPY_KEY = /^(title|subtitle|caption|heading|label|chartlabel|note|description|summary|detail|hint|question|message|body|placeholder|reason|tooltip|eyebrow|.+label|.+title)$/i;
const isCopy = key => COPY_KEY.test(key);
/* Data is a figure, or a record in a list (a row, a point, a metric). A tone, an icon, or a layout is presentation. */
const isData = leaf => !isCopy(leaf.key) && (typeof leaf.value === 'number' || /\d/.test(String(leaf.value)) || leaf.path.includes('['));
const NUMBER = /\d+(?:[.,]\d+)*/g;
/** A figure can be written 1,240 or 1240 or 4,8: each spelling counts as the same number. */
function numberForms(token) {
  const forms = new Set([token, token.replace(/,/g, ''), token.replace(/\./g, '').replace(',', '.')]);
  for (const form of [...forms]) { const n = Number(form); if (Number.isFinite(n)) forms.add(String(n)); }
  return forms;
}
const numbersIn = value => typeof value === 'number' ? [String(value)] : typeof value === 'string' ? value.match(NUMBER) ?? [] : [];
/* "10 M€" on a screen is the figure 10000000 in its data: a written scale counts as the whole number it stands for. */
const SCALED = /(\d+(?:[.,]\d+)*)\s?(mil millones|millones|million|billion|mil|mm|bn|k|m|b)(?![a-z])/gi;
const SCALES = { k: 1e3, mil: 1e3, m: 1e6, mm: 1e6, millones: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9, 'mil millones': 1e9 };
const scaledIn = value => typeof value !== 'string' ? [] : [...value.matchAll(SCALED)].flatMap(([, token, scale]) => [...numberForms(token)].map(Number).filter(Number.isFinite).map(n => String(Number((n * SCALES[scale.toLowerCase()]).toPrecision(12)))));
function numberSet(values) {
  const set = new Set();
  for (const value of values) for (const token of [...numbersIn(value), ...scaledIn(value)]) for (const form of numberForms(token)) set.add(form);
  return set;
}
const sourced = (token, set) => [...numberForms(token)].some(form => set.has(form));
/* In copy, a single digit is usually a count of what is on screen ("Top 5"), not a figure from the data. */
const figuresIn = leaf => numbersIn(leaf.value).filter(token => !(isCopy(leaf.key) && /^\d$/.test(token)));
const propLeaves = node => isObject(node?.props) ? leaves(node.props, 'props') : [];
const ownFields = node => { if (!isObject(node)) return {}; const { children, ...rest } = node; return rest; };
function ownLeaves(node) { return leaves(ownFields(node)); }
const subtreeIds = node => { const ids = []; const go = n => { if (!isObject(n)) return; if (typeof n.id === 'string') ids.push(n.id); (Array.isArray(n.children) ? n.children : []).forEach(go); }; go(node); return ids; };

/** Which parts of a data block differ: one field per measure, group, table row, or setting. */
function dataDiff(before, after) {
  const x = isObject(before) ? before : {}, y = isObject(after) ? after : {};
  const fields = [];
  for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) {
    if (canonical(x[key]) === canonical(y[key])) continue;
    if (DATA_DEFINITIONS.includes(key) && (isObject(x[key]) || isObject(y[key]))) {
      for (const name of new Set([...Object.keys(x[key] ?? {}), ...Object.keys(y[key] ?? {})])) if (canonical(x[key]?.[name]) !== canonical(y[key]?.[name])) fields.push(`${key}.${name}`);
    } else if (key === 'tables' && isObject(x.tables) && isObject(y.tables)) {
      for (const name of new Set([...Object.keys(x.tables), ...Object.keys(y.tables)])) {
        const a = x.tables[name], b = y.tables[name];
        if (canonical(a) === canonical(b)) continue;
        if (!isObject(a) || !isObject(b)) { fields.push(`tables.${name}`); continue; }
        for (const part of new Set([...Object.keys(a), ...Object.keys(b)])) {
          if (canonical(a[part]) === canonical(b[part])) continue;
          if (part === 'rows' && Array.isArray(a.rows) && Array.isArray(b.rows)) { for (let i = 0; i < Math.max(a.rows.length, b.rows.length); i++) if (canonical(a.rows[i]) !== canonical(b.rows[i])) fields.push(`tables.${name}.rows[${i}]`); }
          else fields.push(`tables.${name}.${part}`);
        }
      }
    } else fields.push(key);
  }
  return fields;
}
/** The ids that changed place among siblings that stayed: the ones outside the longest run still in their old order. */
function reordered(beforeIds, afterIds) {
  const common = afterIds.filter(id => beforeIds.includes(id));
  const ranks = common.map(id => beforeIds.indexOf(id));
  const tails = [], prev = new Array(ranks.length).fill(-1), at = [];
  ranks.forEach((rank, i) => {
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (ranks[tails[mid]] < rank) lo = mid + 1; else hi = mid; }
    prev[i] = lo ? tails[lo - 1] : -1;
    tails[lo] = i;
    at[i] = lo;
  });
  const keep = new Set();
  for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = prev[i]) keep.add(common[i]);
  return common.filter(id => !keep.has(id));
}
/**
 * Compare two versions of a screen node by node, by id. Each change names the node and the fields that differ,
 * so a host can show exactly what an edit touched and prove that everything else is identical. The screen's data
 * is compared too, as one entry with the measures, groups, rows, and settings that differ.
 */
export function diffScreens(before, after) {
  const index = spec => { const map = new Map(); eachNode(spec, (node, at) => map.set(typeof node?.id === 'string' ? node.id : `@${at.path}`, { node, ...at })); return map; };
  const differing = (x, y) => {
    const a = new Map(ownLeaves(x).map(leaf => [leaf.path, JSON.stringify(leaf.value)]));
    const b = new Map(ownLeaves(y).map(leaf => [leaf.path, JSON.stringify(leaf.value)]));
    return [...new Set([...a.keys(), ...b.keys()])].filter(path => a.get(path) !== b.get(path)).sort();
  };
  const changes = [];
  const screenFields = ['title', 'layout'].filter(key => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]));
  if (screenFields.length) changes.push({ change: 'changed', id: 'screen', kind: 'screen', path: '', fields: screenFields });
  const dataFields = dataDiff(before?.data, after?.data);
  if (dataFields.length) changes.push({ change: 'changed', id: 'data', kind: 'data', path: 'data', fields: dataFields });
  const a = index(before), b = index(after);
  for (const [id, x] of a) if (!b.has(id)) changes.push({ change: 'removed', id, kind: kindOfNode(x.node), path: x.path, parent: x.parentId });
  const siblings = map => { const out = new Map(); for (const [id, item] of map) { if (!out.has(item.parentId)) out.set(item.parentId, []); out.get(item.parentId).push(id); } return out; };
  const was = siblings(a), now = siblings(b);
  const shifted = new Set();
  for (const [parent, ids] of now) for (const id of reordered(was.get(parent) ?? [], ids)) shifted.add(id);
  for (const [id, y] of b) {
    const x = a.get(id);
    if (!x) { changes.push({ change: 'added', id, kind: kindOfNode(y.node), path: y.path, parent: y.parentId }); continue; }
    const fields = differing(x.node, y.node);
    if (fields.length) changes.push({ change: 'changed', id, kind: kindOfNode(y.node), path: y.path, fields });
    if (x.parentId !== y.parentId || shifted.has(id)) changes.push({ change: 'moved', id, kind: kindOfNode(y.node), path: y.path, parent: y.parentId, from: x.parentId });
  }
  return changes;
}

/* A diagnostic belongs to the deepest node whose path it starts with; its key survives the node moving to another index. */
function diagnosticKeys(spec, diagnostics) {
  const paths = [];
  eachNode(spec, (node, at) => paths.push([at.path, typeof node?.id === 'string' ? node.id : `@${at.path}`]));
  paths.sort((x, y) => y[0].length - x[0].length);
  return diagnostics.map(d => {
    const owner = paths.find(([path]) => d.path === path || d.path.startsWith(`${path}.`));
    return { diagnostic: d, id: owner?.[1] ?? 'screen', key: `${d.code}|${owner?.[1] ?? 'screen'}|${owner ? d.path.slice(owner[0].length) : d.path}` };
  });
}
/** The literal text of every table row on a screen, by its first text cell: the records a recomposition must keep. */
function recordKeys(spec) {
  const keys = [];
  for (const table of inferTables(spec)) {
    const column = table.kinds.indexOf('text');
    if (column < 0) continue;
    for (const row of table.rows) if (typeof row[column] === 'string' && row[column].trim()) keys.push({ key: row[column].trim(), table: table.id ?? table.path });
  }
  if (isObject(spec?.data?.tables)) for (const [name, table] of Object.entries(spec.data.tables)) {
    const keyField = table?.key ?? Object.entries(table?.fields ?? {}).find(([, field]) => ['text', 'category'].includes(field?.type))?.[0];
    if (keyField) for (const row of Array.isArray(table.rows) ? table.rows : []) if (typeof row?.[keyField] === 'string') keys.push({ key: row[keyField], table: `data.tables.${name}` });
  }
  return keys;
}
const textsIn = spec => { const out = new Set(); for (const leaf of leaves({ data: spec?.data, children: spec?.children })) if (typeof leaf.value === 'string') out.add(normalLabel(leaf.value)); return out; };

/**
 * Apply a model's proposed change to one version of a screen. The model proposes; the runtime applies.
 *
 * A change is { version: "syntari-ops-1", base, summary?, operations: [...] }, where base is versionOf() of the screen it
 * was written against. Each operation names its scope by node id:
 *   insert    { op, parent?, after? | before?, node }  adds one node (and what it holds) at that place;
 *   replace   { op, target, set: { field: value } }     changes only those fields of one node ("screen" for the title,
 *                                                      "data" for the screen's measures, groups, or protected rows);
 *   replace   { op, target, node }                      replaces one node, keeping its id and kind;
 *   move      { op, target, parent?, after? | before? } moves one node, unchanged, to another place;
 *   remove    { op, target }                            removes one node and what it holds;
 *   recompose { op, screen }                            alone: a new composition of the same screen and the same data.
 * Nothing outside those scopes can change: the result is compared with the base node by node, and any difference no
 * operation declared is refused. Existing data (values that are not copy, such as a metric, a row, or a chart point)
 * cannot change unless the host passes allowDataChanges after a person confirmed it. With data: "strict" (the default),
 * a number that appears neither on the screen nor in options.sources is refused; with data: "demo" it is reported.
 * A recomposition keeps every row of the screen's data and every record its tables show, and quotes no new figure.
 * The whole result is validated before it is returned. On any error, ok is false and spec is null: keep the last valid screen.
 * A change may instead carry clarify ({ kind, message }), needs ([{ data, reason }]), or unsupported
 * ([{ visualization, reason, closest? }]) and no operations: nothing applies, and the host tells the person.
 */
export async function applyOperations(spec, change, options = {}) {
  const reg = options.registry ?? await registry();
  const validation = { registry: reg, sandbox: options.sandbox === true, limits: options.limits };
  const diagnostics = [];
  const report = (severity, code, path, message, extra = {}) => diagnostics.push({ severity, code, path, message, ...extra });
  const base = versionOf(spec);
  const result = (fields = {}) => {
    const ok = !diagnostics.some(d => d.severity === 'error') && Boolean(fields.spec);
    return { ok, spec: ok ? fields.spec : null, base, version: ok ? versionOf(fields.spec) : null, diagnostics, effects: fields.effects ?? [], changes: fields.changes ?? [], authorization: fields.authorization ?? [], validation: fields.validation ?? null, summary: typeof change?.summary === 'string' ? change.summary : '', clarify: fields.clarify ?? null, needs: fields.needs ?? null, unsupported: fields.unsupported ?? null, recomposed: fields.recomposed ?? null };
  };
  if (!isObject(spec) || spec.type !== 'screen') { report('error', 'invalid-spec', '', 'Operations apply to a screen.'); return result(); }
  if (!isObject(change)) { report('error', 'invalid-change', '', 'A change is an object with version, base, and operations.'); return result(); }
  for (const key of Object.keys(change)) if (!CHANGE_KEYS.includes(key)) report('warning', 'unknown-key', key, `Changes take ${CHANGE_KEYS.join(', ')}. It was ignored.`);
  if (change.version !== OPS_VERSION) report('error', 'unsupported-ops-version', 'version', `Change version must be "${OPS_VERSION}".`);
  if (change.base !== base) report('error', 'stale-base', 'base', typeof change.base === 'string' ? `This change was written against ${change.base}, but the screen is now ${base}. Nothing was applied.` : `A change names the version it was written against: "base": "${base}".`);
  let unnamed = null;
  eachNode(spec, (node, at) => { if (!unnamed && isObject(node) && typeof node.id !== 'string') unnamed = at.path; });
  if (unnamed) report('error', 'missing-node-id', unnamed, 'Every node needs an id before a model can change the screen. Call assignIds() on the screen first.');
  if (diagnostics.some(d => d.severity === 'error')) return result();
  const operations = change.operations ?? [];
  if (!Array.isArray(operations)) { report('error', 'wrong-type', 'operations', 'Operations are a list.'); return result(); }
  if (!operations.length) {
    const unsupported = Array.isArray(change.unsupported) && change.unsupported.length ? change.unsupported.filter(isObject) : null;
    if (isObject(change.clarify) || Array.isArray(change.needs) || unsupported) return result({ clarify: isObject(change.clarify) ? change.clarify : null, needs: Array.isArray(change.needs) ? change.needs : null, unsupported });
    report('error', 'empty-change', 'operations', 'The change holds no operations.');
    return result();
  }
  if (operations.length > OPS_LIMITS.maxOperations) { report('error', 'over-operation-budget', 'operations', `${operations.length} operations were proposed; the limit is ${OPS_LIMITS.maxOperations}.`); return result(); }
  if (operations.some(op => op?.op === 'recompose')) {
    if (operations.length > 1) { report('error', 'invalid-operation', 'operations', 'A recomposition is the only operation in its change.'); return result(); }
    return recompose(spec, operations[0], { validation, report, result, options });
  }

  const working = structuredClone(spec);
  const used = new Set();
  eachNode(working, node => { if (typeof node?.id === 'string') used.add(node.id); });
  const effects = [];
  /* Where a node goes: after or before a sibling, or at the end of a parent. Shared by insert and move. */
  const placeOf = (op, at, fail) => {
    if (op.after !== undefined && op.before !== undefined) { fail('invalid-operation', 'Name one place: after or before, not both.'); return null; }
    const anchorId = op.after ?? op.before;
    const anchor = anchorId === undefined ? null : findNode(working, anchorId);
    if (anchorId !== undefined && !anchor) { fail('unknown-anchor', `No node has the id "${anchorId}".`, `${at}.${op.after !== undefined ? 'after' : 'before'}`); return null; }
    const parentId = op.parent ?? anchor?.parentId ?? 'screen';
    const parent = parentId === 'screen' ? null : findNode(working, parentId);
    if (parentId !== 'screen' && (!parent || !['section', 'region'].includes(kindOfNode(parent.node)))) { fail(parent ? 'invalid-parent' : 'unknown-parent', parent ? `"${parentId}" is not a section or a region, so it holds no nodes.` : `No node has the id "${parentId}".`, `${at}.parent`); return null; }
    const list = parentId === 'screen' ? (working.children ??= []) : (parent.node.children ??= []);
    if (anchor && anchor.parentId !== parentId) { fail('unknown-anchor', `"${anchorId}" is not inside "${parentId}".`, `${at}.${op.after !== undefined ? 'after' : 'before'}`); return null; }
    return { parentId, parent, list, index: anchor ? anchor.index + (op.after !== undefined ? 1 : 0) : list.length };
  };
  for (const [i, op] of operations.entries()) {
    const at = `operations[${i}]`;
    const fail = (code, message, path = at) => { report('error', code, path, message, { operation: i }); };
    if (!isObject(op) || !OP_KEYS[op.op]) { fail('invalid-operation', `Each operation is insert, replace, move, remove, or recompose.`, `${at}.op`); break; }
    const unknown = Object.keys(op).filter(key => !OP_KEYS[op.op].includes(key));
    if (unknown.length) { fail('unknown-key', `${op.op} takes ${OP_KEYS[op.op].join(', ')}; "${unknown[0]}" is not one of them.`, `${at}.${unknown[0]}`); break; }
    const reason = typeof op.reason === 'string' ? op.reason : '';
    if (op.op === 'insert') {
      if (!isObject(op.node) || op.node.type === 'screen') { fail('invalid-node', 'insert needs one node to add.', `${at}.node`); break; }
      const place = placeOf(op, at, fail);
      if (!place) break;
      const node = structuredClone(op.node);
      const collision = subtreeIds(node).find(id => used.has(id));
      if (collision) { fail('duplicate-node-id', `"${collision}" is already used by another node. New nodes need new ids.`, `${at}.node`); break; }
      subtreeIds(node).forEach(id => used.add(id));
      nameNodes([node], used);
      place.list.splice(place.index, 0, node);
      effects.push({ index: i, op: 'insert', id: node.id, parent: place.parentId, after: op.after ?? null, before: op.before ?? null, ids: subtreeIds(node), reason });
    } else if (op.op === 'move') {
      if (op.target === 'screen' || op.target === 'data') { fail('invalid-operation', 'Only a node can move.', `${at}.target`); break; }
      if (op.parent === undefined && op.after === undefined && op.before === undefined) { fail('invalid-operation', 'move names where the node goes: parent, after, or before.'); break; }
      const target = findNode(working, op.target);
      if (!target) { fail('unknown-target', typeof op.target === 'string' ? `No node has the id "${op.target}".` : 'move names its target by id.', `${at}.target`); break; }
      if (op.after === op.target || op.before === op.target || op.parent === op.target || subtreeIds(target.node).slice(1).some(id => [op.after, op.before, op.parent].includes(id))) { fail('invalid-operation', 'A node cannot move inside or next to itself.'); break; }
      const from = target.parentId;
      target.list.splice(target.index, 1);
      const place = placeOf(op, at, fail);
      if (!place) break;
      place.list.splice(place.index, 0, target.node);
      effects.push({ index: i, op: 'move', id: op.target, kind: kindOfNode(target.node), from, parent: place.parentId, after: op.after ?? null, before: op.before ?? null, ids: [op.target], reason });
    } else if (op.op === 'replace') {
      if ((op.set === undefined) === (op.node === undefined)) { fail('invalid-operation', 'replace takes either set (the fields to change) or node (the whole node), not both.'); break; }
      if (op.target === 'data' && op.set === undefined) { fail('invalid-operation', 'Screen data is changed with set, one measure, group, or row at a time.', `${at}.node`); break; }
      const target = op.target === 'screen' ? { node: working, parentId: null } : op.target === 'data' ? { node: (working.data ??= {}), parentId: null } : findNode(working, op.target);
      if (!target) { fail('unknown-target', typeof op.target === 'string' ? `No node has the id "${op.target}".` : 'replace names its target by id.', `${at}.target`); break; }
      const kind = op.target === 'screen' ? 'screen' : op.target === 'data' ? 'data' : kindOfNode(target.node);
      if (op.set !== undefined) {
        if (!isObject(op.set) || !Object.keys(op.set).length) { fail('invalid-operation', 'set lists at least one field and its new value.', `${at}.set`); break; }
        const bad = Object.keys(op.set).find(path => !FIELD_PATH.test(path) || stepsOf(path).some(step => FORBIDDEN_STEPS.has(step)) || !SETTABLE[kind].some(root => path === root || path.startsWith(`${root}.`) || path.startsWith(`${root}[`)) || (kind === 'component' && path === 'props'));
        if (bad !== undefined) { fail('invalid-field', `"${bad}" is not a field replace can set on ${kind === 'data' ? 'the screen data' : `a ${kind}`}. Settable: ${SETTABLE[kind].map(root => root === 'props' ? 'props.<prop>' : root).join(', ')}.`, `${at}.set`); break; }
        for (const [path, value] of Object.entries(op.set)) writeAt(target.node, path, structuredClone(value));
        effects.push({ index: i, op: 'replace', id: op.target, kind, fields: Object.keys(op.set), ids: ['screen', 'data'].includes(op.target) ? [] : [op.target], reason });
      } else {
        if (op.target === 'screen') { fail('invalid-operation', 'The screen itself is changed with set, one field at a time.', `${at}.node`); break; }
        const node = structuredClone(op.node);
        if (!isObject(node) || kindOfNode(node) !== kind || (kind === 'component' && node.component !== target.node.component)) { fail('scope-violation', `replace keeps the node's kind${kind === 'component' ? ` (${target.node.component})` : ''}. To show something else, remove it and insert a new node.`, `${at}.node`); break; }
        if (node.id !== undefined && node.id !== op.target) { fail('scope-violation', `replace keeps the node's id "${op.target}".`, `${at}.node.id`); break; }
        node.id = op.target;
        const old = new Set(subtreeIds(target.node));
        const collision = subtreeIds(node).find(id => used.has(id) && !old.has(id));
        if (collision) { fail('duplicate-node-id', `"${collision}" is used by a node outside "${op.target}".`, `${at}.node`); break; }
        old.forEach(id => used.delete(id));
        subtreeIds(node).forEach(id => used.add(id));
        nameNodes(node.children, used);
        target.list[target.index] = node;
        effects.push({ index: i, op: 'replace', id: op.target, kind, fields: null, ids: [...new Set([...old, ...subtreeIds(node)])], reason });
      }
    } else {
      if (op.target === 'screen' || op.target === 'data') { fail('invalid-operation', op.target === 'screen' ? 'The screen itself cannot be removed.' : 'Screen data is changed with replace and set.', `${at}.target`); break; }
      const target = findNode(working, op.target);
      if (!target) { fail('unknown-target', typeof op.target === 'string' ? `No node has the id "${op.target}".` : 'remove names its target by id.', `${at}.target`); break; }
      const ids = subtreeIds(target.node);
      target.list.splice(target.index, 1);
      ids.forEach(id => used.delete(id));
      effects.push({ index: i, op: 'remove', id: op.target, kind: kindOfNode(target.node), parent: target.parentId, ids, reason });
    }
  }
  if (diagnostics.some(d => d.severity === 'error')) return result({ effects });

  /* Scope: compare the result with the base, node by node. Every difference must belong to an operation that declared it. */
  const changes = diffScreens(spec, working);
  const added = new Set(), removed = new Set(), whole = new Set(), moved = new Set(), fieldsOf = new Map(), screenFields = new Set();
  for (const effect of effects) {
    if (effect.op === 'insert') effect.ids.forEach(id => added.add(id));
    if (effect.op === 'remove') effect.ids.forEach(id => removed.add(id));
    if (effect.op === 'move') moved.add(effect.id);
    if (effect.op === 'replace' && effect.fields === null) effect.ids.forEach(id => whole.add(id));
    if (effect.op === 'replace' && effect.fields && effect.id === 'screen') effect.fields.forEach(field => screenFields.add(field));
    else if (effect.op === 'replace' && effect.fields) fieldsOf.set(effect.id, [...(fieldsOf.get(effect.id) ?? []), ...effect.fields]);
  }
  const within = (field, declared) => declared.some(path => field === path || field.startsWith(`${path}.`) || field.startsWith(`${path}[`) || path.startsWith(`${field}.`) || path.startsWith(`${field}[`));
  for (const item of changes) {
    const allowed = item.change === 'added' ? added.has(item.id) || whole.has(item.id)
      : item.change === 'removed' ? removed.has(item.id) || whole.has(item.id)
      /* A sibling that shifted because another node moved, arrived, or left kept its order: only declared moves count. */
      : item.change === 'moved' ? moved.has(item.id) || whole.has(item.id) || added.has(item.id) || (item.parent === item.from && [...moved].some(id => findNode(working, id)?.parentId === item.parent))
      : item.id === 'screen' ? item.fields.every(field => screenFields.has(field))
      : whole.has(item.id) || added.has(item.id) || (fieldsOf.has(item.id) && item.fields.every(field => within(field, fieldsOf.get(item.id))));
    if (!allowed) report('error', 'scope-violation', item.path, `${item.id === 'screen' ? 'The screen' : item.id === 'data' ? 'The screen data' : `"${item.id}"`} would be ${item.change}${item.fields ? ` (${item.fields.join(', ')})` : ''}, but no operation declared that.`, { id: item.id });
  }

  /* Data: existing values stay as they are unless a person allowed the change; new figures need a source. */
  const before = new Map(), after = new Map();
  eachNode(spec, node => { if (typeof node?.id === 'string') before.set(node.id, node); });
  eachNode(working, node => { if (typeof node?.id === 'string') after.set(node.id, node); });
  const computed = [...dataFigures(buildDataModel(spec.data)), ...dataFigures(buildDataModel(working.data))];
  const sources = numberSet([...leaves({ title: spec.title, children: spec.children, data: spec.data }).filter(leaf => !['id', 'component', 'type', 'layout'].includes(leaf.key)), ...leaves(options.sources ?? [])].map(leaf => leaf.value).concat(computed));
  const strict = (options.data ?? 'strict') !== 'demo';
  const authorization = [];
  const checkFigures = (effect, list, id) => {
    const unsourced = [...new Set(list.flatMap(figuresIn).filter(token => !sourced(token, sources)))];
    if (!unsourced.length) return;
    const shown = unsourced.slice(0, 6).join(', ') + (unsourced.length > 6 ? ` and ${unsourced.length - 6} more` : '');
    if (strict) report('error', 'unsourced-data', `operations[${effect.index}]`, `${shown} ${unsourced.length === 1 ? 'appears' : 'appear'} neither on the screen nor in the data provided. Syntari does not show figures without a source.`, { operation: effect.index, id, values: unsourced });
    else { effect.demo = true; report('warning', 'demo-data', `operations[${effect.index}]`, `${shown} ${unsourced.length === 1 ? 'is a demonstration value' : 'are demonstration values'}, not from a source. The screen is labelled as demonstration data.`, { operation: effect.index, id, values: unsourced }); }
  };
  for (const effect of effects) {
    if (effect.op === 'insert') { const node = after.get(effect.id); const list = []; eachNode({ children: [node] }, n => list.push(...ownLeaves(n).filter(leaf => leaf.path.startsWith('props') || ['heading', 'label'].includes(leaf.path)))); checkFigures(effect, list, effect.id); continue; }
    if (effect.op !== 'replace') continue;
    if (effect.id === 'screen') { checkFigures(effect, effect.fields.includes('title') ? [{ key: 'title', value: working.title }] : [], 'screen'); continue; }
    if (effect.id === 'data') {
      /* Measures and groups are computed from the rows, so defining one adds no figure; the rows themselves are protected. */
      const protectedFields = effect.fields.filter(field => !DATA_DEFINITIONS.some(root => field === root || field.startsWith(`${root}.`)));
      if (protectedFields.length) {
        const item = { operation: effect.index, id: 'data', fields: protectedFields, before: protectedFields.map(field => readAt(spec.data, field)), after: protectedFields.map(field => readAt(working.data, field)) };
        authorization.push(item);
        if (!options.allowDataChanges) report('error', 'protected-data', `operations[${effect.index}]`, `This would change the screen's data (${protectedFields.slice(0, 3).join(', ')}${protectedFields.length > 3 ? ` and ${protectedFields.length - 3} more` : ''}). Data changes need a person's confirmation.`, item);
      }
      const values = effect.fields.filter(field => DATA_DEFINITIONS.some(root => field.startsWith(`${root}.`))).flatMap(field => leaves(readAt(working.data, field))).filter(leaf => leaf.key === 'value');
      checkFigures(effect, values.map(leaf => ({ key: 'value', value: leaf.value, path: leaf.path })), 'data');
      continue;
    }
    for (const id of effect.fields ? [effect.id] : effect.ids) {
      const x = before.get(id), y = after.get(id);
      if (!x || !y) { if (y) checkFigures(effect, propLeaves(y), id); continue; }
      const a = new Map(propLeaves(x).filter(isData).map(leaf => [leaf.path, leaf.value]));
      const b = new Map(propLeaves(y).filter(isData).map(leaf => [leaf.path, leaf.value]));
      const changed = [...new Set([...a.keys(), ...b.keys()])].filter(path => JSON.stringify(a.get(path)) !== JSON.stringify(b.get(path)));
      if (changed.length) {
        const item = { operation: effect.index, id, fields: changed, before: changed.map(path => a.get(path)), after: changed.map(path => b.get(path)) };
        authorization.push(item);
        if (!options.allowDataChanges) report('error', 'protected-data', `operations[${effect.index}]`, `This would change existing data in "${id}" (${changed.slice(0, 3).join(', ')}${changed.length > 3 ? ` and ${changed.length - 3} more` : ''}). Data changes need a person's confirmation.`, item);
      }
      checkFigures(effect, propLeaves(y).filter(leaf => isCopy(leaf.key) || !a.has(leaf.path)), id);
    }
  }

  /* The whole result is validated. Errors the base already had are not this change's; new ones refuse it. */
  const checkedBase = options.baseDiagnostics ?? (await validate(spec, validation)).diagnostics;
  const checked = await validate(working, validation);
  const known = new Set(diagnosticKeys(spec, checkedBase.filter(d => d.severity === 'error')).map(item => item.key));
  const touched = new Set([...added, ...whole, ...moved, ...fieldsOf.keys()]);
  for (const item of diagnosticKeys(working, checked.diagnostics)) {
    const d = item.diagnostic;
    if (d.severity === 'error' && !known.has(item.key)) report('error', d.code, d.path, d.message, { id: item.id, validation: true });
    else if (d.severity !== 'error' && touched.has(item.id)) report(d.severity, d.code, d.path, d.message, { id: item.id, validation: true });
  }
  return result({ spec: working, effects, changes, authorization, validation: checked });
}
const readAt = (target, path) => { let at = target; for (const step of stepsOf(path)) { if (at === null || at === undefined) return undefined; at = at[step]; } return at; };

/**
 * A recomposition: a new arrangement of the same screen. The model proposes the whole composition; the runtime keeps what
 * makes it the same screen. Screen data is carried over unchanged (the model may add measures and groups computed from it);
 * a screen without data must state its rows in data, and every figure there must already be on the screen. Every record the
 * screen's tables show is still there, no part quotes a figure the data does not hold, and the result validates whole.
 */
async function recompose(spec, op, { validation, report, result, options }) {
  const at = 'operations[0]';
  const unknown = Object.keys(op).filter(key => !OP_KEYS.recompose.includes(key));
  if (unknown.length) { report('error', 'unknown-key', `${at}.${unknown[0]}`, `recompose takes ${OP_KEYS.recompose.join(', ')}.`); return result(); }
  const next = op.screen;
  if (!isObject(next) || !Array.isArray(next.children) || !next.children.length) { report('error', 'invalid-node', `${at}.screen`, 'recompose takes the whole new screen: { title, layout, meta, data?, children }.'); return result(); }
  for (const key of Object.keys(next)) if (!SCREEN_KEYS.includes(key)) report('error', 'unknown-key', `${at}.screen.${key}`, `Screens take ${SCREEN_KEYS.join(', ')}.`);
  let data = next.data;
  if (spec.data !== undefined) {
    const own = isObject(next.data) ? next.data : {};
    const changed = Object.keys(own).filter(key => !DATA_DEFINITIONS.includes(key) && canonical(own[key]) !== canonical(spec.data[key]));
    if (changed.length) report('error', 'data-changed', `${at}.screen.data`, `A recomposition keeps the screen's data as it is; it may add measures and groups. ${changed.join(', ')} would change.`);
    data = { ...spec.data, ...Object.fromEntries(DATA_DEFINITIONS.filter(key => own[key] !== undefined || spec.data[key] !== undefined).map(key => [key, { ...(isObject(spec.data[key]) ? spec.data[key] : {}), ...(isObject(own[key]) ? own[key] : {}) }])) };
  } else if (isObject(next.data)) {
    /* The screen had no data block, so the rows come from what it showed: no figure may be new. */
    const shownFigures = numberSet(leaves({ title: spec.title, children: spec.children }).filter(leaf => !['id', 'component', 'type', 'layout'].includes(leaf.key)).map(leaf => leaf.value));
    const stated = [...leaves(next.data.tables ?? {}).filter(leaf => typeof leaf.value === 'number' && leaf.path.includes('rows')), ...leaves(next.data.measures ?? {}).filter(leaf => leaf.key === 'value')];
    const invented = [...new Set(stated.flatMap(leaf => numbersIn(leaf.value)).filter(token => !sourced(token, shownFigures)))];
    if (invented.length) report('error', 'unsourced-data', `${at}.screen.data`, `${invented.slice(0, 6).join(', ')}${invented.length > 6 ? ` and ${invented.length - 6} more` : ''} ${invented.length === 1 ? 'is' : 'are'} not on the screen. A recomposition shows the same data; it never adds figures.`, { values: invented });
  }
  const working = assignIds({ ...(spec.version ? { version: spec.version } : {}), type: 'screen', title: typeof next.title === 'string' ? next.title : spec.title, layout: next.layout ?? spec.layout, ...(isObject(next.meta) || isObject(spec.meta) ? { meta: { ...(isObject(next.meta) ? next.meta : {}), ...(isObject(spec.meta?.data) ? { data: spec.meta.data } : {}) } } : {}), ...(data !== undefined ? { data } : {}), children: structuredClone(next.children) });
  /* Every record the screen showed is still shown: by its name, in a data row or in a table cell. */
  const texts = textsIn(working);
  const dropped = recordKeys(spec).filter(record => !texts.has(normalLabel(record.key)));
  if (dropped.length) report('error', 'dropped-records', `${at}.screen`, `${dropped.slice(0, 4).map(record => `“${record.key}”`).join(', ')}${dropped.length > 4 ? ` and ${dropped.length - 4} more` : ''} ${dropped.length === 1 ? 'is' : 'are'} no longer on the screen. A recomposition keeps every record.`, { values: dropped.map(record => record.key) });
  /* Written figures must come from the screen or from what its data computes: a recomposition reorganizes, it never invents. */
  const model = buildDataModel(working.data);
  const sources = numberSet([...leaves({ title: spec.title, children: spec.children, data: spec.data }).filter(leaf => !['id', 'component', 'type', 'layout'].includes(leaf.key)).map(leaf => leaf.value), ...dataFigures(model), ...leaves(options.sources ?? []).map(leaf => leaf.value)]);
  const written = [];
  eachNode(working, node => { if (isObject(node)) written.push(...ownLeaves(node).filter(leaf => leaf.path.startsWith('props') || ['heading', 'label'].includes(leaf.path))); });
  written.push({ key: 'title', value: working.title });
  const unsourced = [...new Set(written.flatMap(figuresIn).filter(token => !sourced(token, sources)))];
  if (unsourced.length) report('error', 'unsourced-data', `${at}.screen`, `${unsourced.slice(0, 6).join(', ')}${unsourced.length > 6 ? ` and ${unsourced.length - 6} more` : ''} ${unsourced.length === 1 ? 'appears' : 'appear'} neither on the screen nor in its data. A recomposition never adds figures.`, { values: unsourced });
  /* The whole result validates: a recomposition is new throughout, so every error is its own. */
  const checked = await validate(working, validation);
  for (const d of checked.diagnostics) if (d.severity === 'error') report('error', d.code, d.path, d.message, { validation: true });
  const ids = []; eachNode(working, node => { if (typeof node?.id === 'string') ids.push(node.id); });
  const effects = [{ index: 0, op: 'recompose', id: 'screen', ids, reason: typeof op.reason === 'string' ? op.reason : '' }];
  const kept = recordKeys(spec).length;
  return result({ spec: working, effects, changes: diffScreens(spec, working), validation: checked, recomposed: { records: kept, dataKept: spec.data !== undefined, measures: model ? model.measures.size : 0, groups: model ? model.groups.size : 0 } });
}

function setText(target, value) {
  if (target) target.textContent = String(value);
}
/** An empty contract slot takes no space. Table cells keep their place in the grid. */
function markEmpty(target, empty) {
  if (!target || /^(td|th)$/i.test(target.tagName)) return;
  if (empty) target.dataset.syntariEmpty = ''; else delete target.dataset.syntariEmpty;
}
/** A rolling number animates a figure the template chose. A contract writes the agent's text, so the slot becomes plain. */
function settleNumber(target) {
  if (!target.classList.contains('rolling-number') && !target.hasAttribute('data-number')) return;
  target.classList.remove('rolling-number');
  for (const name of ['data-number', 'data-format', 'data-number-kind', 'data-value', 'role', 'aria-label']) target.removeAttribute(name);
  target.dataset.staticNumber = '';
}
function fillText(target, value) {
  if (!target) return;
  settleNumber(target);
  setText(target, value);
  markEmpty(target, String(value) === '');
}
function fillLead(target, value) {
  if (!target) return;
  setLead(target, value);
  /* A label that wraps a field stays; an action or tag without words goes. */
  markEmpty(target, !target.textContent.trim() && !target.querySelector('input, textarea, select'));
}
function setAttributes(target, binding, current) {
  if (!target) return;
  const on = binding.invert ? !current : current;
  /* aria attributes state a value, so false is written; markup flags like checked are removed. */
  if (on === false && !binding.attribute.startsWith('aria-')) target.removeAttribute(binding.attribute);
  else target.setAttribute(binding.attribute, String(on));
}
const tidy = number => Number(Number(number).toPrecision(12));
/** Round steps (1, 2, 2.5, or 5 times a power of ten) from below the smallest value to above the largest. */
function niceScale(values, intervals, bounds = {}) {
  const finite = values.filter(Number.isFinite);
  const lo = finite.length ? Math.min(...finite) : 0, hi = finite.length ? Math.max(...finite) : 1;
  const nice = raw => { const power = 10 ** Math.floor(Math.log10(raw)); return [1, 2, 2.5, 5, 10].map(factor => factor * power).find(step => step >= raw * (1 - 1e-9)); };
  let step = nice(hi > lo ? (hi - lo) / intervals : Math.max(Math.abs(hi), 1) / 10);
  let min = Math.floor(lo / step) * step;
  while (min + intervals * step < hi) { step = nice(step * 1.01); min = Math.floor(lo / step) * step; }
  let max = min + intervals * step;
  /* Round bounds can overshoot what the contract allows, such as 150%; slide the window back inside. */
  if (bounds.max !== undefined && max > bounds.max) { min = Math.max(bounds.min ?? -Infinity, min - (max - bounds.max)); max = bounds.max; }
  if (bounds.min !== undefined && min < bounds.min) min = bounds.min;
  return { min: tidy(min), max: tidy(max) };
}
/** Resolve a contract selector. An empty selector, or one that matches the scope itself, returns the scope. */
function pick(scope, selector) {
  if (!selector) return scope;
  try {
    if (scope.matches?.(selector)) return scope;
    return scope.querySelector(selector);
  } catch { return null; }
}
/** Replace the element's own leading text while keeping the markup around it. */
function setLead(target, value) {
  if (!target) return;
  const text = String(value);
  const node = [...target.childNodes].find(child => child.nodeType === 3 && child.nodeValue.trim());
  if (node) node.nodeValue = text ? ` ${text} ` : '';
  else if (text) target.prepend(document.createTextNode(text));
}
function setIcon(target, value) {
  if (!target) return;
  const name = String(value);
  /* Icon names are interpolated into markup, so only names the runtime ships are written. Validation reports the rest. */
  const markup = ICON_NAME.test(name) && window.SyntariIconNames?.includes(name) ? window.SyntariIcon?.(name) : null;
  if (!markup) return;
  if (target.tagName.toLowerCase() === 'svg') target.outerHTML = markup;
  else {
    target.innerHTML = markup;
    /* Mark the slot so a host can present it as an icon tile rather than a person avatar. */
    target.dataset.irIcon = String(value);
  }
}
function applyVariant(target, values, value, report, path) {
  if (!target) return;
  const chosen = values[value];
  if (chosen === undefined) { report('warning', 'unknown-variant', path, `"${value}" has no class mapping and was ignored.`); return; }
  for (const className of new Set(Object.values(values))) if (className) target.classList.remove(...className.split(/\s+/));
  if (chosen) target.classList.add(...chosen.split(/\s+/));
}
function toggleClass(target, className, value) {
  if (!target || !className) return;
  if (value) target.classList.add(...className.split(/\s+/));
  else target.classList.remove(...className.split(/\s+/));
}

/** An image is the host's: only an id the host mapped to an https, relative, or data:image URL is ever loaded. */
function assetUrl(assets, id) {
  if (typeof id !== 'string' || !assets || !Object.hasOwn(assets, id)) return null;
  const url = String(assets[id]);
  return /^(https:\/\/|data:image\/|\/|\.\/)/i.test(url) ? url : null;
}
/** Results follow their inputs as a person moves them. Formulas were checked by validation; a result that cannot be computed reads as unknown. */
function bindCompute(root, binding, props) {
  const inputs = Array.isArray(props[binding.inputs]) ? props[binding.inputs] : [];
  const outputs = Array.isArray(props[binding.outputs]) ? props[binding.outputs] : [];
  const parts = binding.parts && Array.isArray(props[binding.parts]) ? props[binding.parts] : [];
  const currency = props[binding.currency] ?? 'USD';
  const parse = source => { try { return parseFormula(source).tree; } catch { return null; } };
  const outputTrees = outputs.map(output => parse(output.formula));
  const partTrees = parts.map(part => parse(part.formula));
  const controls = [...root.querySelectorAll(binding.control)];
  const show = (value, format, unit) => `${formatValue(value, format, currency)}${unit && value !== null ? ` ${unit}` : ''}`;
  controls.forEach((control, i) => {
    const input = inputs[i];
    if (!input) return;
    control.min = String(input.min);
    control.max = String(input.max);
    control.step = String(input.step ?? 'any');
    control.value = String(input.value);
    control.setAttribute('aria-label', String(input.label ?? input.name));
    const field = control.closest(binding.input);
    const low = field?.querySelector(binding.min), high = field?.querySelector(binding.max);
    if (low) low.textContent = show(input.min, input.format, input.unit);
    if (high) high.textContent = show(input.max, input.format, input.unit);
  });
  function update() {
    const scope = {};
    controls.forEach((control, i) => {
      const input = inputs[i];
      if (!input?.name) return;
      scope[input.name] = Number(control.value);
      control.style.setProperty('--range-fill', `${((Number(control.value) - input.min) / ((input.max - input.min) || 1)) * 100}%`);
      const readout = control.closest(binding.input)?.querySelector(binding.readout);
      if (readout) readout.textContent = show(Number(control.value), input.format, input.unit);
    });
    const results = [...root.querySelectorAll(binding.result)];
    outputs.forEach((output, i) => {
      const value = outputTrees[i] ? evaluateFormula(outputTrees[i], scope) : null;
      if (output?.name) scope[output.name] = value ?? NaN;
      const slot = results[i]?.querySelector(binding.value);
      if (slot) slot.textContent = show(value, output.format, output.unit);
    });
    const values = partTrees.map(tree => tree ? evaluateFormula(tree, scope) : null);
    const total = values.reduce((sum, value) => sum + Math.max(0, value ?? 0), 0);
    const segments = [...root.querySelectorAll(binding.segment)], rows = [...root.querySelectorAll(binding.part)];
    values.forEach((value, i) => {
      const share = total > 0 ? Math.max(0, value ?? 0) / total * 100 : 0;
      segments[i]?.style.setProperty('--share', `${share}%`);
      const row = rows[i];
      if (!row) return;
      const amount = row.querySelector(binding.partValue), percent = row.querySelector(binding.partShare);
      if (amount) amount.textContent = show(value, parts[i].format ?? outputs[0]?.format, parts[i].unit);
      if (percent) percent.textContent = total > 0 ? String(Math.round(share)) : '';
    });
  }
  root.addEventListener('input', event => { if (controls.includes(event.target)) update(); });
  update();
}

/** A number as a table cell writes it: "12,5 %", "€1.2M", "-3.4", "D30". Text that is not one figure reads as null. */
function cellNumber(text) {
  const raw = String(text ?? '').replace(/[\u00a0\u202f]/g, ' ').trim();
  const m = raw.match(/^[^\d\-−+(]*([-−+(]?)\s*(\d[\d.,\s]*)/);
  if (!m || (raw.match(/\d[\d.,]*/g) ?? []).length > 1 && !/^\D*\d[\d.,\s]*\D*$/.test(raw)) return null;
  let digits = m[2].replace(/\s+/g, '');
  const dots = (digits.match(/\./g) ?? []).length, commas = (digits.match(/,/g) ?? []).length;
  if (dots && commas) digits = digits.lastIndexOf(',') > digits.lastIndexOf('.') ? digits.replace(/\./g, '').replace(',', '.') : digits.replace(/,/g, '');
  else if (commas) digits = commas === 1 && !/,\d{3}$/.test(digits) ? digits.replace(',', '.') : digits.replace(/,/g, '');
  else if (dots > 1 || /\.\d{3}$/.test(digits) && digits.length > 5) digits = digits.replace(/\./g, '');
  let number = Number(digits);
  if (!Number.isFinite(number)) return null;
  const rest = raw.slice((m.index ?? 0) + m[0].length).trim().toLowerCase();
  number *= /^(k\b|mil\b)/.test(rest) ? 1e3 : /^(m\b|mm\b|mill)/.test(rest) ? 1e6 : /^(b\b|bn\b)/.test(rest) ? 1e9 : 1;
  return m[1] && m[1] !== '+' ? -number : number;
}
/**
 * A sortable table: each heading becomes a button that sorts the rows by that column, numbers as numbers and text as
 * text, and says which way in aria-sort. Columns of figures align on the right whether or not the table sorts.
 */
function bindSort(root, binding, props) {
  const table = root.matches('table') ? root : root.querySelector('table');
  const body = table?.querySelector(binding.body ?? 'tbody');
  const headings = table ? [...table.querySelectorAll(binding.header ?? 'thead th')] : [];
  if (!body || !headings.length) return;
  const rows = () => [...body.querySelectorAll(':scope > tr')];
  const cell = (row, i) => row.children[i]?.textContent ?? '';
  const numeric = headings.map((_, i) => { const cells = rows().map(row => cell(row, i)).filter(text => text.trim()); return cells.length > 0 && cells.every(text => cellNumber(text) !== null); });
  headings.forEach((th, i) => { if (numeric[i]) { th.dataset.numeric = ''; rows().forEach(row => { if (row.children[i]) row.children[i].dataset.numeric = ''; }); } });
  if (!props[binding.prop]) return;
  const original = rows();
  headings.forEach((th, i) => {
    const label = th.textContent.trim();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'table-sort';
    button.textContent = label;
    const mark = document.createElement('span');
    mark.className = 'table-sort-mark';
    mark.setAttribute('aria-hidden', 'true');
    button.append(mark);
    th.replaceChildren(button);
    th.setAttribute('aria-sort', 'none');
    button.addEventListener('click', () => {
      /* Figures sort largest first, text A to Z; a third press puts the rows back in their own order. */
      const current = th.getAttribute('aria-sort'), first = numeric[i] ? 'descending' : 'ascending', second = numeric[i] ? 'ascending' : 'descending';
      const next = current === 'none' ? first : current === first ? second : 'none';
      headings.forEach(other => other.setAttribute('aria-sort', 'none'));
      th.setAttribute('aria-sort', next);
      const sorted = next === 'none' ? original : [...original].sort((a, b) => {
        const x = numeric[i] ? cellNumber(cell(a, i)) : cell(a, i), y = numeric[i] ? cellNumber(cell(b, i)) : cell(b, i);
        const order = numeric[i] ? (x ?? -Infinity) - (y ?? -Infinity) : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' });
        return next === 'ascending' ? order : -order;
      });
      body.append(...sorted);
    });
  });
}

/** A figure with its unit: $482 and £12 lead, 14% and 9€ follow it, a word follows a space: 12 runs. Words can be left out. */
function withUnit(text, unit, percent = '%', words = true) {
  if (!unit || (!words && /^\p{L}/u.test(unit))) return text;
  if (['$', '£'].includes(unit)) return text.startsWith('-') ? `-${unit}${text.slice(1)}` : `${unit}${text}`;
  if (unit === '%') return `${text}${percent}`;
  return /^\p{L}/u.test(unit) ? `${text} ${unit}` : `${text}${unit}`;
}

/**
 * A matrix of values as a table whose cells are shaded by value, lightest for the smallest and darkest for the largest.
 * It stays a table, so every value is read with its row and its column, and the numbers can be shown or left to the shade.
 */
function paintMatrix(root, binding, rows, value, { number, percent, report, path }) {
  const host = pick(root, binding.selector);
  if (!host) { report('warning', 'matrix-slot-missing', path, `The contract expects "${binding.selector}" for the matrix.`); return; }
  const list = Array.isArray(rows) ? rows.slice(0, IR_LIMITS.maxListItems) : [];
  const columns = Array.isArray(value(binding.columns)) ? value(binding.columns).slice(0, IR_LIMITS.maxListItems) : [];
  const labelField = binding.label ?? 'label', valuesField = binding.values ?? 'values';
  const unit = binding.unit && value(binding.unit) !== undefined ? String(value(binding.unit)) : '';
  const shown = Boolean(binding.showValues) && value(binding.showValues) === true;
  const levels = binding.levels ?? 5;
  const figureAt = (row, c) => { const raw = Array.isArray(row?.[valuesField]) ? row[valuesField][c] : undefined; return typeof raw === 'number' && Number.isFinite(raw) ? raw : null; };
  const figures = list.flatMap(row => columns.map((_, c) => figureAt(row, c))).filter(figure => figure !== null);
  const min = figures.length ? Math.min(...figures) : 0, max = figures.length ? Math.max(...figures) : 0;
  /* A symbol goes with every figure; a word such as "runs" is said once, on the scale, since the title says what is counted. */
  const reading = (figure, words = false) => withUnit(number(tidy(figure)), unit, percent, words);
  const table = document.createElement('table');
  table.className = binding.table ?? 'heat-table';
  /* The figure's caption shows the title; the table carries it as its name, so it is not read twice. */
  if (binding.caption && value(binding.caption) !== undefined) table.setAttribute('aria-label', String(value(binding.caption)));
  const head = table.createTHead().insertRow();
  head.append(document.createElement('td'));
  for (const column of columns) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = String(column); head.append(th); }
  const body = table.createTBody();
  list.forEach((row, r) => {
    const tr = body.insertRow();
    tr.dataset.syntariIndex = String(r);
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = String(row?.[labelField] ?? '');
    tr.append(heading);
    columns.forEach((column, c) => {
      const cell = document.createElement('td'), text = document.createElement('span');
      const figure = figureAt(row, c);
      text.className = shown ? 'heat-value' : 'heat-value sr-only';
      if (figure === null) { cell.dataset.level = 'none'; text.textContent = 'No value'; }
      else {
        cell.dataset.level = String(max > min ? Math.round((figure - min) / (max - min) * (levels - 1)) : levels - 1);
        text.textContent = reading(figure);
        cell.title = `${heading.textContent} · ${column}: ${reading(figure)}`;
      }
      cell.append(text);
      tr.append(cell);
    });
  });
  host.replaceChildren(table);
  host.removeAttribute('role');
  host.removeAttribute('aria-label');
  host.dataset.matrix = '';
  if (columns.length > 12) host.dataset.dense = ''; else delete host.dataset.dense;
  /* The scale names the real range, so "lightest" and "darkest" mean figures. */
  if (binding.scale && figures.length) { fillText(pick(root, binding.scale.min), reading(min)); fillText(pick(root, binding.scale.max), reading(max, true)); }
}

/**
 * Squarified treemap layout (Bruls, Huizing and van Wijk): rows of rectangles along the shorter side, each row grown while
 * it makes its rectangles squarer. Areas are proportional to the values. Returns each entry's rectangle by its ref.
 */
function squarify(entries, x, y, w, h) {
  const out = new Map();
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  if (!(total > 0) || !(w > 0) || !(h > 0)) return out;
  const rest = entries.map(entry => ({ ...entry, area: entry.value / total * w * h })).sort((a, b) => b.area - a.area);
  const worst = (row, side) => {
    const sum = row.reduce((t, entry) => t + entry.area, 0), big = Math.max(...row.map(entry => entry.area)), small = Math.min(...row.map(entry => entry.area));
    return Math.max(side * side * big / (sum * sum), (sum * sum) / (side * side * small));
  };
  while (rest.length) {
    const side = Math.min(w, h);
    const row = [rest.shift()];
    while (rest.length && worst([...row, rest[0]], side) <= worst(row, side)) row.push(rest.shift());
    const sum = row.reduce((t, entry) => t + entry.area, 0);
    if (w >= h) {
      const thick = sum / h;
      let at = y;
      for (const entry of row) { const length = entry.area / thick; out.set(entry.ref, { x, y: at, w: thick, h: length }); at += length; }
      x += thick; w -= thick;
    } else {
      const thick = sum / w;
      let at = x;
      for (const entry of row) { const length = entry.area / thick; out.set(entry.ref, { x: at, y, w: length, h: thick }); at += length; }
      y += thick; h -= thick;
    }
  }
  return out;
}

/**
 * Tiles whose areas are proportional to their values. Tiles of one group sit together, in the group's colour, and a
 * legend names the groups. A tile too small for its words keeps them for screen readers and its tooltip (in CSS, by size).
 */
function paintTiles(root, binding, tiles, value, { number, percent, report, path }) {
  const container = pick(root, binding.container);
  const template = container ? pick(container, binding.item) : null;
  if (!container || !template) { report('warning', 'list-slot-missing', path, `The contract expects "${binding.item}" inside "${binding.container}" for the tiles.`); return; }
  const clone = template.cloneNode(true);
  clone.removeAttribute('style');
  container.querySelectorAll(binding.item).forEach(node => node.remove());
  const items = (Array.isArray(tiles) ? tiles.slice(0, IR_LIMITS.maxListItems) : []).map((item, index) => ({ item, index, value: Number(item?.value) })).filter(tile => Number.isFinite(tile.value) && tile.value > 0);
  const total = items.reduce((sum, tile) => sum + tile.value, 0);
  const groups = [...new Set(items.map(tile => tile.item.group).filter(group => typeof group === 'string' && group.trim()))];
  const width = (binding.aspect ?? 2) * 100, height = 100;
  const rects = new Map();
  const place = (members, x, y, w, h) => { for (const [ref, rect] of squarify(members.map(tile => ({ ref: tile, value: tile.value })), x, y, w, h)) rects.set(ref, rect); };
  if (groups.length) {
    const blocks = [...groups.map(name => items.filter(tile => tile.item.group === name)), items.filter(tile => !groups.includes(tile.item.group))].filter(members => members.length);
    for (const [members, rect] of squarify(blocks.map(members => ({ ref: members, value: members.reduce((sum, tile) => sum + tile.value, 0) })), 0, 0, width, height)) place(members, rect.x, rect.y, rect.w, rect.h);
  } else place(items, 0, 0, width, height);
  const share = figure => { const part = figure / total * 100; return part < 1 ? `<1${percent}` : `${number(Math.round(part))}${percent}`; };
  for (const tile of items) {
    const rect = rects.get(tile);
    if (!rect) continue;
    const node = clone.cloneNode(true);
    node.dataset.syntariIndex = String(tile.index);
    for (const [name, at] of [['--x', rect.x / width], ['--y', rect.y / height], ['--w', rect.w / width], ['--h', rect.h / height]]) node.style.setProperty(name, `${tidy(at * 100)}%`);
    const label = String(tile.item.label ?? ''), shown = tile.item.display !== undefined ? String(tile.item.display) : share(tile.value);
    fillText(pick(node, binding.label), label);
    fillText(pick(node, binding.text), shown);
    node.dataset.tone = groups.includes(tile.item.group) ? String(groups.indexOf(tile.item.group)) : 'none';
    node.setAttribute('role', 'listitem');
    node.title = `${label}: ${shown}${tile.item.display !== undefined ? ` (${share(tile.value)})` : ''}`;
    container.append(node);
  }
  container.dataset.layout = 'tiles';
  container.setAttribute('role', 'list');
  if (binding.name && value(binding.name) !== undefined) container.setAttribute('aria-label', String(value(binding.name)));
  else container.removeAttribute('aria-label');
  if (!groups.length) return;
  const legend = document.createElement('ul');
  legend.className = 'chart-legend tree-legend';
  groups.forEach((name, tone) => {
    const entry = document.createElement('li'), swatch = document.createElement('span'), text = document.createElement('span'), amount = document.createElement('b');
    swatch.className = 'legend-swatch';
    swatch.dataset.tone = String(tone);
    text.textContent = name;
    amount.textContent = share(items.filter(tile => tile.item.group === name).reduce((sum, tile) => sum + tile.value, 0));
    entry.append(swatch, text, amount);
    legend.append(entry);
  });
  container.after(legend);
}

/** Write resolved props into the mounted component using the bindings its manifest declares. */
export function applyContract(element, manifest, props, diagnostics, path, context = {}) {
  const ir = manifest.ir;
  const report = (severity, code, at, message) => diagnostics.push({ severity, code, path: at, message });
  const root = ir.node ? element.querySelector(ir.node) : element;
  if (!root) { report('warning', 'instance-root-missing', path, `The contract expects "${ir.node}" inside ${manifest.id}; the markup has changed.`); return element; }
  /* Keep the instance root and its ancestors; every other branch of the example is discarded. */
  for (let node = root; node && node !== element; node = node.parentElement) for (const sibling of [...(node.parentElement?.children ?? [])]) if (sibling !== node) sibling.remove();
  /* Contract mode: demo-only parts go, and the runtime leaves declared actions to the host. */
  root.dataset.syntariContract = manifest.id;
  for (const selector of ir.remove ?? []) root.querySelectorAll(selector).forEach(node => node.remove());
  /* An action slot inside an empty list is not missing; only a template without it means the markup changed. */
  const authored = new Set(Object.entries(manifest.actions ?? {}).filter(([, action]) => root.matches(action.selector) || root.querySelector(action.selector)).map(([name]) => name));
  /* A contract button is not a form's submit button unless the contract's own form owns it. */
  for (const button of root.querySelectorAll('button:not([type])')) if (!button.closest('form') || !root.contains(button.closest('form'))) button.type = 'button';
  if (root.matches('button:not([type])')) root.type = 'button';
  const value = key => props[key];
  /* With screen data, figures are written in its locale: 14,5 % beside a table that says 14,5 %, not 14.5%. */
  const number = n => context.locale && typeof n === 'number' && Number.isFinite(n) ? new Intl.NumberFormat(context.locale, { maximumFractionDigits: 4 }).format(n) : String(n);
  const percentGap = context.locale && /\s/.test(new Intl.NumberFormat(context.locale, { style: 'percent' }).format(0.5)) ? '\u00a0' : '';
  const unitAfter = suffix => suffix === '%' ? `${percentGap}%` : suffix;
  /** Text comes from props or defaults only: a slot whose optional prop is unset is emptied, never left with demo copy. */
  const bound = (key, apply, clear) => { const current = value(key); if (current !== undefined) apply(current); else clear?.(); };
  const each = (selector, fn) => { for (const one of [].concat(selector)) fn(pick(root, one)); };
  /* A text slot may frame its value, such as "68%" from 68 or "+4" from 4; a figure is then written in the screen's locale. */
  for (const [key, selector] of Object.entries(ir.text ?? {})) {
    const framed = typeof selector === 'object' && selector !== null && !Array.isArray(selector) ? selector : null;
    const at = framed ? framed.selector : selector;
    const write = current => !framed ? current : `${framed.prefix ?? ''}${typeof current === 'number' ? `${number(current)}${unitAfter(framed.suffix ?? '')}` : `${current}${framed.suffix ?? ''}`}`;
    bound(key, current => each(at, target => fillText(target, write(current))), () => each(at, target => fillText(target, '')));
  }
  for (const [key, selector] of Object.entries(ir.lead ?? {})) bound(key, current => each(selector, target => fillLead(target, current)), () => each(selector, target => fillLead(target, '')));
  for (const [key, selector] of Object.entries(ir.icon ?? {})) bound(key, current => each(selector, target => setIcon(target, current)));
  /* Chrome that only means something beside a value, like a "Total" label, goes when that value is unset. */
  for (const [key, selector] of Object.entries(ir.showWhen ?? {})) { const current = value(key); each(selector, target => markEmpty(target, current === undefined || current === '' || (Array.isArray(current) && !current.length))); }
  /* One prop can set classes in several places, such as a status badge and the dot beside it. */
  for (const [key, binding] of Object.entries(ir.variant ?? {})) bound(key, current => { for (const one of [].concat(binding)) applyVariant(pick(root, one.selector), one.values, current, report, path); });
  for (const [key, binding] of Object.entries(ir.attributes ?? {})) {
    for (const one of [].concat(binding)) {
      const current = value(key) ?? (one.fallback ? value(one.fallback) : undefined);
      /* An unset value leaves no template attribute behind: the example's label or value describes other data. */
      if (current === undefined) pick(root, one.selector)?.removeAttribute(one.attribute);
      else setAttributes(pick(root, one.selector), one, current);
    }
  }
  for (const [key, className] of Object.entries(ir.class ?? {})) bound(key, current => toggleClass(root, className, current));
  /* A value can drive a custom property, such as how far a ring is filled; unset, the template's own value goes too. */
  for (const [key, binding] of Object.entries(ir.style ?? {})) for (const one of [].concat(binding)) {
    const target = pick(root, one.selector);
    if (!target?.style) continue;
    if (value(key) === undefined) target.style.removeProperty(one.name);
    else target.style.setProperty(one.name, `${value(key)}${one.suffix ?? ''}`);
  }
  /**
   * Chart geometry stays data: the series arrives as numbers and the renderer draws the path. A contract may draw several
   * lines from one list ("lines": one field each), and they always share one scale, so two series are comparable by eye.
   */
  for (const [key, declared] of Object.entries(ir.series ?? {})) {
    const points = Array.isArray(value(key)) ? value(key) : [];
    const svg = pick(root, declared.selector);
    const drawn = (declared.lines ?? [{ field: declared.value ?? 'value', line: declared.line, fill: declared.fill }]).map(one => ({ ...one, element: svg && pick(svg, one.line), fillElement: one.fill && svg ? pick(svg, one.fill) : null }));
    if (!drawn[0]?.element) { report('warning', 'series-slot-missing', path, `The contract expects "${drawn[0]?.line}" inside "${declared.selector}" for ${key}.`); continue; }
    const [width, height] = String(declared.viewBox ?? svg.getAttribute('viewBox') ?? '0 0 360 160').split(/\s+/).slice(2).map(Number);
    const inset = declared.inset ?? (svg.dataset.inset ? Object.fromEntries(['top', 'bottom', 'left', 'right'].map((side, index) => [side, Number(svg.dataset.inset.split(/\s+/)[index])])) : {});
    const top = inset.top ?? 18, bottom = inset.bottom ?? 24, left = inset.left ?? 12, right = inset.right ?? 12;
    const labelField = declared.label ?? 'label';
    const unit = declared.unitFrom !== undefined && value(declared.unitFrom) !== undefined ? String(value(declared.unitFrom)) : declared.unit ?? '';
    /* A line whose field no point carries is not drawn: one series is a complete chart. */
    for (const one of drawn) {
      one.numbers = points.map(point => point?.[one.field] === undefined ? NaN : Number(point[one.field]));
      one.present = one.numbers.some(Number.isFinite);
      if (!one.present && one.optional) { one.element?.setAttribute('d', ''); one.element?.setAttribute('data-syntari-empty', ''); }
    }
    const shown = drawn.filter(one => one.present || !one.optional);
    const numbers = shown[0].numbers;
    const all = shown.flatMap(one => one.numbers).filter(Number.isFinite);
    const axis = declared.axis ? [...root.querySelectorAll(declared.axis)] : [];
    const preset = typeof declared.scale === 'object' ? declared.scale : (svg.dataset.scale ? { min: Number(svg.dataset.scale.split(/\s+/)[0]), max: Number(svg.dataset.scale.split(/\s+/)[1]) } : {});
    /* An automatic scale fits the agent's data, so the axis, the grid, and the line always agree. */
    const limits = manifest.props?.[key]?.items?.fields?.[shown[0].field] ?? {};
    const { min, max } = declared.scale === 'auto' ? niceScale(declared.includeZero ? [...all, 0] : all, Math.max(1, (axis.length || 4) - 1), { min: limits.minimum, max: limits.maximum }) : { min: preset.min ?? 0, max: preset.max ?? 100 };
    const x = index => left + index * ((width - left - right) / Math.max(1, points.length - 1));
    const y = number => height - bottom - ((Number(number) - min) / ((max - min) || 1)) * (height - top - bottom);
    for (const one of shown) {
      const pathOf = values => values.map((number, index) => Number.isFinite(number) ? `${index && Number.isFinite(values[index - 1]) ? 'L' : 'M'}${x(index).toFixed(1)},${y(number).toFixed(1)}` : '').filter(Boolean).join(' ');
      const path = pathOf(one.numbers);
      one.element.setAttribute('d', path);
      one.element.removeAttribute('data-syntari-empty');
      if (one.fillElement) one.fillElement.setAttribute('d', `${path} L${x(points.length - 1).toFixed(1)},${height - bottom} L${x(0).toFixed(1)},${height - bottom} Z`);
    }
    /* Values on both sides of zero get a zero line, so a loss reads as a loss. */
    const zero = declared.zero && pick(svg, declared.zero);
    if (zero) { if (min < 0 && max > 0) { const at = y(0).toFixed(1); zero.setAttribute('y1', at); zero.setAttribute('y2', at); zero.removeAttribute('data-syntari-empty'); } else zero.setAttribute('data-syntari-empty', ''); }
    const tick = (index, count) => tidy(max - index * ((max - min) / Math.max(1, count - 1)));
    const step = (max - min) / Math.max(1, axis.length - 1) || 1;
    const compact = number => { const size = Math.abs(number); return size >= 1e9 ? [number / 1e9, 'B'] : size >= 1e6 ? [number / 1e6, 'M'] : size >= 1e4 ? [number / 1e3, 'k'] : [number, '']; };
    const readable = figure => { const [n, suffix] = compact(figure); const scaled = suffix ? step / (Math.abs(figure) / Math.abs(n || 1)) : step; return `${number(Number(n.toFixed(Math.max(0, 1 - Math.floor(Math.log10(scaled || 1))))))}${suffix}`; };
    /* Dollars and pounds lead the figure, everything else follows it: $482k, 482k€, 3.4%. */
    const withUnit = text => ['$', '£'].includes(unit) ? (text.startsWith('-') ? `-${unit}${text.slice(1)}` : `${unit}${text}`) : `${text}${unitAfter(unit)}`;
    const reading = figure => { const [n, suffix] = compact(figure); return withUnit(`${number(tidy(Number(n.toFixed(suffix ? 2 : 4))))}${suffix}`); };
    if (declared.scale === 'auto') {
      axis.forEach((label, index) => {
        label.textContent = withUnit(readable(tick(index, axis.length)));
        /* Each label sits level with its gridline, however many the template draws. */
        if (declared.placeAxis) label.style.top = `${(y(tick(index, axis.length)) / height) * 100}%`;
      });
      const grid = declared.grid ? [...svg.querySelectorAll(declared.grid)] : [];
      grid.forEach((rule, index) => { const at = y(tick(index, grid.length)).toFixed(1); rule.setAttribute('y1', at); rule.setAttribute('y2', at); });
    }
    if (declared.markers) {
      const markers = [...svg.querySelectorAll(declared.markers)];
      markers.forEach(marker => marker.remove());
      const names = drawn.map(one => one.nameFrom ? value(one.nameFrom) : null);
      if (markers[0]) points.forEach((point, index) => {
        if (!Number.isFinite(numbers[index])) return;
        const marker = markers[0].cloneNode(true);
        const others = shown.slice(1).filter(one => Number.isFinite(one.numbers[index])).map(one => `${names[drawn.indexOf(one)] ? `${names[drawn.indexOf(one)]} ` : ''}${reading(one.numbers[index])}`);
        const text = `${reading(numbers[index])}${others.length ? ` · ${others.join(' · ')}` : ''}`;
        marker.setAttribute('transform', `translate(${x(index).toFixed(1)} ${y(numbers[index]).toFixed(1)})`);
        marker.setAttribute('aria-label', `${point[labelField]}: ${names[0] ? `${names[0]} ` : ''}${text}`);
        marker.style.setProperty('--point-order', String(index));
        const label = declared.markerText && marker.querySelector(declared.markerText);
        if (label) label.textContent = `${point[labelField]} · ${text}`;
        /* A tooltip as wide as its words: two series need more room than one. */
        const box = declared.markerBox && marker.querySelector(declared.markerBox);
        if (box) { const wide = Math.max(60, Math.round(label?.textContent.length * 5.6 + 16)); box.setAttribute('width', String(wide)); box.setAttribute('x', String(-wide / 2)); }
        svg.append(marker);
      });
      /* The template's description named its own data; the points now describe themselves. */
      svg.setAttribute('aria-label', 'Focus a point to read its value.');
    }
    if (declared.ticks) {
      const labels = [...root.querySelectorAll(declared.ticks)];
      const count = Math.min(labels.length, points.length);
      labels.forEach((label, index) => {
        if (index >= count) { label.remove(); return; }
        const at = count === 1 ? 0 : Math.round(index * (points.length - 1) / (count - 1));
        label.textContent = String(points[at][labelField]);
        /* Under its point, not spread across the figure; the first and last align to the edges so they never spill out. */
        label.style.left = `${(x(at) / width) * 100}%`;
        if (count > 1) label.style.transform = index === 0 ? 'translateX(0)' : index === count - 1 ? 'translateX(-100%)' : '';
        label.parentElement.dataset.placed = '';
      });
    }
  }
  for (const [key, declared] of Object.entries(ir.list ?? {})) {
    const items = Array.isArray(value(key)) ? value(key) : [];
    const fieldContract = manifest.props?.[key]?.items?.fields ?? {};
    for (const part of [].concat(declared)) {
      const container = pick(root, part.container);
      const template = container ? pick(container, part.item) : null;
      if (!container || !template) { report('warning', 'list-slot-missing', path, `The contract expects "${part.item}" inside "${part.container}" for ${key}.`); continue; }
      const existing = [...container.querySelectorAll(part.item)];
      const clone = template.cloneNode(true);
      existing.forEach(node => node.remove());
      const limit = Math.min(items.length, IR_LIMITS.maxListItems);
      const scales = {};
      /* One field can drive several properties, such as a ring segment's length and where it starts. */
      const styles = Object.entries(part.style ?? {}).flatMap(([name, style]) => [].concat(style).map(one => [name, one]));
      for (const [name, style] of styles) if (style.scaleGroup) scales[style.scaleGroup] = Math.max(scales[style.scaleGroup] ?? 0, ...items.map(item => Number(item?.[name])).filter(Number.isFinite));
      for (let i = 0; i < limit; i += 1) {
        const item = clone.cloneNode(true);
        const data = items[i];
        /* "." names the item itself, for a list of plain strings. */
        const given = name => name === '.' ? data : Array.isArray(data) ? data[Number(name)] : data?.[name];
        /* A field left out can follow another, such as a stage's mark following its state, so a pending stage never keeps the template's check. */
        const field = (name, follow = true) => {
          const current = given(name);
          if (current !== undefined) return current;
          const from = follow ? fieldContract[name]?.defaultFrom : null;
          return (from ? from.values[field(from.field, false)] : undefined) ?? fieldContract[name]?.default;
        };
        item.dataset.syntariIndex = String(i);
        for (const attribute of part.strip ?? []) item.removeAttribute(attribute);
        if (part.cells) {
          const cellValues = Array.isArray(data) ? data : [];
          const columns = part.cellCount && Array.isArray(value(part.cellCount)) ? value(part.cellCount).length : cellValues.length;
          const cells = [...item.querySelectorAll(part.cells)];
          /* One cell per column: the template's cell count is an example, not a limit. */
          while (cells.length < columns) { const cell = (cells.at(-1) ?? document.createElement('td')).cloneNode(false); item.append(cell); cells.push(cell); }
          cells.splice(columns).forEach(cell => cell.remove());
          cells.forEach((cell, index) => setText(cell, cellValues[index] ?? ''));
        }
        const filled = (name, apply, clear) => { const current = field(name); if (current !== undefined) apply(current); else clear?.(); };
        /* A text slot may carry the unit a prop names, such as "%" after every column value, and a second field beside the
           first, such as both series of a bar, so neither number hides behind the bar. */
        for (const [name, selector] of Object.entries(part.text ?? {})) {
          const at = typeof selector === 'object' && selector ? selector.selector : selector;
          const suffix = typeof selector === 'object' && selector?.suffixFrom && value(selector.suffixFrom) !== undefined ? String(value(selector.suffixFrom)) : typeof selector === 'object' && selector?.suffix ? selector.suffix : '';
          const joined = typeof selector === 'object' && selector?.joinField ? given(selector.joinField) : undefined;
          const write = figure => `${number(figure)}${typeof figure === 'number' ? unitAfter(suffix) : suffix}`;
          filled(name, current => fillText(pick(item, at), `${write(current)}${joined !== undefined ? ` · ${write(joined)}` : ''}`), () => fillText(pick(item, at), ''));
        }
        for (const [name, selector] of Object.entries(part.lead ?? {})) filled(name, current => fillLead(pick(item, selector), current), () => fillLead(pick(item, selector), ''));
        for (const [name, selector] of Object.entries(part.icon ?? {})) filled(name, current => setIcon(pick(item, selector), current));
        for (const [name, style] of styles) {
          /* A field left out removes what it would have drawn, such as the second bar of a single-series chart. */
          /* A scale group draws every field in it against the largest value, so the longest bar fills its track. */
          /* A running value is the sum of the items before this one: where a segment of a ring begins. */
          const scaled = current => style.running ? tidy(items.slice(0, i).reduce((sum, other) => sum + (Number(other?.[name]) || 0), 0)) : style.scaleGroup && scales[style.scaleGroup] > 0 ? tidy(Number(current) / scales[style.scaleGroup] * 100) : current;
          filled(name, current => { const target = pick(item, style.selector) ?? item; if (target.style) target.style.setProperty(style.name, `${scaled(current)}${style.suffix ?? ''}`); }, () => { if (style.removeWhenEmpty) pick(item, style.selector)?.remove(); });
        }
        for (const [name, binding] of Object.entries(part.variant ?? {})) filled(name, current => applyVariant(pick(item, binding.selector), binding.values, current, report, path));
        for (const [name, binding] of Object.entries(part.attributes ?? {})) {
          filled(name, current => { for (const one of [].concat(binding)) setAttributes(pick(item, one.selector), one, current); }, () => { for (const one of [].concat(binding)) pick(item, one.selector)?.removeAttribute(one.attribute); });
        }
        /* The template carries the demo's classes, so a managed class starts from nothing. */
        for (const [name, className] of Object.entries(part.class ?? {})) { toggleClass(item, className, false); filled(name, current => toggleClass(item, className, current)); }
        for (const [name, binding] of Object.entries(part.image ?? {})) {
          const image = pick(item, binding.selector);
          if (!image) continue;
          image.hidden = true;
          image.removeAttribute('src');
          filled(name, current => {
            const source = assetUrl(context.assets, current);
            if (!source) { report('warning', 'unknown-asset', `${path === 'props' ? path : `${path}.props`}.${key}[${i}].${name}`, `"${current}" is not an image this host provides, so the card shows its icon.`); return; }
            image.src = source;
            image.alt = binding.alt ? String(field(binding.alt) ?? '') : '';
            image.hidden = false;
          });
        }
        container.append(item);
      }
    }
  }
  /* A count read from a list, such as how many tasks are done, so the summary can never disagree with the rows. */
  for (const [key, binding] of Object.entries(ir.count ?? {})) {
    const items = Array.isArray(value(key)) ? value(key) : [];
    const fallback = manifest.props?.[key]?.items?.fields?.[binding.field]?.default;
    const count = items.filter(item => (item?.[binding.field] ?? fallback) === binding.value).length;
    each(binding.selector, target => fillText(target, String(binding.format ?? '{count} of {total}').replace('{count}', number(count)).replace('{total}', number(items.length))));
  }
  for (const [key, binding] of Object.entries(ir.matrix ?? {})) paintMatrix(root, binding, value(key), value, { number, percent: unitAfter('%'), report, path });
  for (const [key, binding] of Object.entries(ir.tiles ?? {})) paintTiles(root, binding, value(key), value, { number, percent: unitAfter('%'), report, path });
  /* The item whose field matches the prop is the selected one, so the two can never disagree. */
  for (const [key, binding] of Object.entries(ir.select ?? {})) {
    const part = [].concat(ir.list?.[binding.list] ?? [])[0];
    const container = part && pick(root, part.container);
    const data = Array.isArray(value(binding.list)) ? value(binding.list) : [];
    container?.querySelectorAll('[data-syntari-index]').forEach(item => item.setAttribute(binding.attribute, String(data[Number(item.dataset.syntariIndex)]?.[binding.field] === value(key))));
  }
  if (ir.compute) bindCompute(root, ir.compute, props);
  if (ir.sort) bindSort(root, ir.sort, props);
  for (const [name, action] of Object.entries(manifest.actions ?? {})) {
    const targets = [...root.querySelectorAll(action.selector)];
    if (root.matches(action.selector)) targets.unshift(root);
    if (!targets.length && !authored.has(name)) report('warning', 'action-slot-missing', path, `The contract declares "${name}" at "${action.selector}", but the markup has no such element.`);
    for (const target of targets) {
      target.dataset.syntariAction = name;
      if (action.local) target.dataset.syntariLocal = '';
    }
  }
  return root;
}

/** Collect what a person entered in a submitted form. Radio names lose the per-mount prefix prepare() adds. */
function formValues(form) {
  const values = {};
  for (const [name, entry] of new FormData(form)) {
    if (typeof File !== 'undefined' && entry instanceof File && !entry.name) continue;
    const key = name.replace(/^syntari-[0-9a-f-]{36}-/, '');
    values[key] = key in values ? [].concat(values[key], entry) : entry;
  }
  return values;
}

/** The state a view control shows after a person used it. */
function controlState(source) {
  if (source.matches('input[type=checkbox], input[type=radio]')) return { checked: source.checked };
  if (source.matches('input[type=range], input[type=number]')) return { value: Number(source.value) };
  if (source.matches('input, select, textarea')) return { value: source.value };
  if (source.hasAttribute('value')) return { value: source.getAttribute('value') };
  if (source.hasAttribute('aria-pressed')) return { pressed: source.getAttribute('aria-pressed') === 'true' };
  return undefined;
}

/**
 * Turn the actions a contract declares into `syntari:action` events.
 * The event reports what a person asked for. It never performs the action: the host decides whether it may run.
 */

export function bindActions(element, manifest, context = {}) {
  const declared = manifest.actions ?? {};
  if (!Object.keys(declared).length) return;
  const emit = (source, name, values) => {
    const item = source.closest('[data-syntari-index]');
    const detail = {
      component: manifest.id,
      action: name,
      ...(context.id ? { id: context.id } : {}),
      ...(context.path ? { path: context.path } : {}),
      ...(item && element.contains(item) ? { index: Number(item.dataset.syntariIndex) } : {}),
      ...(values ? { values } : {}),
      consequential: Boolean(declared[name].consequential || (declared[name].consequentialProp && context.props?.[declared[name].consequentialProp]))
    };
    source.dispatchEvent(new CustomEvent('syntari:action', { bubbles: true, detail }));
    context.onAction?.(detail);
  };
  element.addEventListener('click', event => {
    const source = event.target.closest?.('[data-syntari-action]');
    if (!source || !element.contains(source)) return;
    const name = source.dataset.syntariAction;
    if (!declared[name] || (declared[name].event ?? 'click') !== 'click') return;
    /* A local action lets the component update itself first, so the request reports what the person now sees. */
    if (declared[name].local) setTimeout(() => emit(source, name, controlState(source)));
    else emit(source, name);
  });
  element.addEventListener('change', event => {
    const source = event.target.closest?.('[data-syntari-action]');
    if (!source || !element.contains(source)) return;
    const name = source.dataset.syntariAction;
    if (declared[name]?.event !== 'change') return;
    emit(source, name, controlState(source));
  });
  element.addEventListener('submit', event => {
    const form = event.target;
    if (!form?.matches?.('form[data-syntari-action]') || !element.contains(form)) return;
    const name = form.dataset.syntariAction;
    if (declared[name]?.event !== 'submit') return;
    event.preventDefault();
    emit(form, name, formValues(form));
  });
}

function fallback(node, reason, component) {
  const box = document.createElement('div');
  box.className = 'ir-fallback';
  box.setAttribute('role', 'status');
  box.innerHTML = '<span class="ir-fallback-mark" aria-hidden="true">!</span><div><strong></strong><p></p></div>';
  box.querySelector('strong').textContent = component ? `${component} was not rendered` : 'This node was not rendered';
  box.querySelector('p').textContent = reason;
  return box;
}
/* Children that are not a list were reported by validation; rendering skips them rather than failing. */
const listed = children => (Array.isArray(children) ? children : []).entries();
/** Remove what could leave the frame or reload it: navigation, embedded documents, forms, and meta refreshes. */
function sanitizeSandbox(html) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.body.querySelectorAll('script, meta, base, link, iframe, frame, frameset, object, embed, form, portal').forEach(node => node.remove());
  for (const node of doc.body.querySelectorAll('*')) for (const attribute of [...node.attributes]) {
    const name = attribute.name.toLowerCase();
    if (name.startsWith('on') || name === 'formaction' || name === 'action' || name === 'srcdoc') node.removeAttribute(attribute.name);
    else if ((name === 'href' || name === 'xlink:href') && !attribute.value.trim().startsWith('#')) node.removeAttribute(attribute.name);
  }
  return doc.body.innerHTML;
}
const SANDBOX_THEMES = {
  light: '--text:#181925;--muted:#5f6075;--surface:#fff;--subtle:#f5f5f7;--border:#1819251a;--accent:#2c78fc;--success:#1d7f37;--warning:#8f5b00;--danger:#bf2a0f',
  dark: '--text:#eaeaeb;--muted:#a2a3b5;--surface:#181925;--subtle:#212131;--border:#cccfff1a;--accent:#6f9dff;--success:#65da82;--warning:#ffc65c;--danger:#ff9078'
};
/** An unverified block renders in an opaque-origin frame: no scripts, no network, no forms, no navigation, no actions. */
function sandboxFrame(node, host) {
  /* Syntari components follow the nearest data-theme, so the block does too. */
  const theme = host.closest('[data-theme]')?.dataset.theme === 'dark' ? 'dark' : 'light';
  const policy = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; form-action 'none'";
  const figure = document.createElement('figure');
  figure.className = 'ir-sandbox';
  const caption = document.createElement('figcaption');
  const label = document.createElement('span');
  label.textContent = String(node.label);
  const badge = document.createElement('span');
  badge.className = 'ir-sandbox-badge';
  badge.textContent = 'Unverified · not from the registry';
  caption.append(label, badge);
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', '');
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.setAttribute('title', String(node.label));
  frame.style.height = `${Math.round(node.height ?? SANDBOX_LIMITS.defaultHeight)}px`;
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{color-scheme:${theme};${SANDBOX_THEMES[theme]}}body{margin:0;padding:16px;background:var(--surface);color:var(--text);font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}</style></head><body>${sanitizeSandbox(node.html)}</body></html>`;
  figure.append(caption, frame);
  return figure;
}
/**
 * A screen says where its figures come from in data.mode (or, before screen data, meta.data): "demo" or "provided".
 * Demonstration data is always labelled on the screen, so illustrative numbers are never mistaken for real ones.
 */
export function dataNote(meta, screenData) {
  const data = isObject(screenData) && screenData.mode ? screenData : isObject(meta?.data) ? meta.data : null;
  if (data?.mode !== 'demo' || typeof document === 'undefined') return null;
  const note = document.createElement('p');
  note.className = 'ir-data-note';
  note.dataset.irData = 'demo';
  const badge = document.createElement('span');
  badge.className = 'ir-data-badge';
  badge.textContent = 'Demonstration data';
  note.append(badge, document.createTextNode(typeof data.label === 'string' && data.label.trim() ? data.label.trim().slice(0, 140) : 'Illustrative values, not from your systems.'));
  return note;
}
const errorFor = (diagnostics, path) => diagnostics.find(d => d.severity === 'error' && (d.path === path || d.path.startsWith(`${path}.`)));

/**
 * Render a validated spec into a container.
 * A node with an error paints a labelled fallback instead of partial output.
 */
export async function render(spec, target, options = {}) {
  const reg = options.registry ?? await registry();
  const limits = { ...IR_LIMITS, ...options.limits };
  const { diagnostics, screen, data } = await validate(spec, { registry: reg, limits, sandbox: options.sandbox });
  const locale = data?.data?.locale !== undefined ? data.locale : null;
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  if (!(host instanceof Element)) throw new TypeError('Syntari IR render() needs a matching selector or Element.');
  const mounted = [];
  const root = document.createElement('div');
  root.className = 'ir-screen';
  root.dataset.syntariRoot = '';
  root.dataset.irLayout = layoutName(screen?.layout);
  if (screen?.title) {
    const heading = document.createElement('h2');
    heading.className = 'ir-screen-title';
    heading.textContent = String(screen.title);
    root.append(heading);
  }
  /* A part rendered on its own, such as one streamed node, leaves the note to the screen it belongs to. */
  const note = options.dataNote === false ? null : dataNote(screen?.meta, screen?.data);
  if (note) root.append(note);

  async function paint(node, parent, path) {
    if (node?.type === 'region') {
      const region = document.createElement('details');
      region.className = 'ir-region';
      if (typeof node.id === 'string') region.dataset.irId = node.id;
      region.open = node.open === true;
      const summary = document.createElement('summary');
      summary.textContent = String(node.label ?? 'Details');
      const body = document.createElement('div');
      body.className = 'ir-region-body';
      region.append(summary, body);
      parent.append(region);
      for (const [i, child] of listed(node.children)) await paint(child, body, `${path}.children[${i}]`);
      return;
    }
    if (node?.type === 'section') {
      const section = document.createElement('section');
      section.className = 'ir-section';
      if (typeof node.id === 'string') section.dataset.irId = node.id;
      const heading = document.createElement('h3');
      heading.className = 'ir-section-heading';
      heading.textContent = typeof node.heading === 'string' ? node.heading : '';
      const body = document.createElement('div');
      body.className = 'ir-section-body';
      body.dataset.irLayout = layoutName(node.layout);
      section.append(heading, body);
      parent.append(section);
      for (const [i, child] of listed(node.children)) await paint(child, body, `${path}.children[${i}]`);
      return;
    }
    if (node?.type === 'sandbox') {
      const failure = errorFor(diagnostics, path);
      if (failure) { const slot = document.createElement('div'); slot.className = 'ir-node'; slot.dataset.irStatus = 'fallback'; slot.append(fallback(node, failure.message, 'Unverified block')); parent.append(slot); return; }
      const figure = sandboxFrame(node, host);
      if (typeof node.id === 'string') figure.dataset.irId = node.id;
      parent.append(figure);
      return;
    }
    const slot = document.createElement('div');
    slot.className = 'ir-node';
    parent.append(slot);
    const failure = errorFor(diagnostics, path);
    if (failure) { slot.append(fallback(node, failure.message, node?.component)); slot.dataset.irStatus = 'fallback'; return; }
    const slug = componentSlug(node.component);
    const manifest = await reg.manifest(slug);
    const props = resolveProps(node.props ?? {}, manifest);
    slot.dataset.irComponent = slug;
    if (node.id) slot.dataset.irId = node.id;
    const instance = await mount(slug, slot, {
      configure: element => {
        const painted = applyContract(element, manifest, props, diagnostics, path, { assets: options.assets, locale });
        if (node.provenance) painted.dataset.irProvenance = JSON.stringify(node.provenance);
        bindActions(element, manifest, { id: node.id, path, props, onAction: options.onActionRequest });
      }
    });
    mounted.push(instance);
    for (const [i, child] of listed(node.children)) await paint(child, parent, `${path}.children[${i}]`);
  }

  for (const [i, child] of listed(screen?.children)) await paint(child, root, `children[${i}]`);
  if (diagnostics.some(d => d.severity === 'error')) root.dataset.irStatus = 'partial';
  host.replaceChildren(root);
  options.onDiagnostics?.(diagnostics);
  return {
    get element() { return root; },
    diagnostics,
    destroy() { mounted.forEach(instance => instance.destroy()); root.remove(); }
  };
}

if (typeof window !== 'undefined') window.SyntariIR = { validate, validateProps, render, registry, resolveProps, renderableSlugs, applyOperations, assignIds, versionOf, diffScreens, findNode, layouts: IR_LAYOUTS, limits: IR_LIMITS };
