/** Syntari UI IR: validate an agent-authored screen spec, then render it with Syntari components. */
import { mount } from './syntari.js';
const base = new URL('.', import.meta.url);
export const IR_LAYOUTS = ['stack', 'row', 'grid', 'two-column'];
export const IR_LIMITS = { maxDepth: 8, maxNodes: 120, maxChildren: 40, maxListItems: 40 };
const ID_PATTERN = /^syntari\.[a-z0-9]+(-[a-z0-9]+)*$/;
/** The keys Screen IR defines. Anything else is reported, as the published schema reports it. */
const SCREEN_KEYS = ['version', 'type', 'layout', 'title', 'children', 'meta'];
const NODE_KEYS = ['id', 'component', 'slot', 'props', 'children', 'provenance'];
const REGION_KEYS = ['type', 'label', 'open', 'children', 'provenance'];
const SECTION_KEYS = ['type', 'heading', 'layout', 'children', 'provenance'];
const SANDBOX_KEYS = ['type', 'label', 'html', 'height', 'provenance'];
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
    return { index, entries, manifest };
  })();
  return registryPromise;
}
export const componentSlug = component => String(component ?? '').replace(/^syntari\./, '');
/** A component is renderable from IR once its manifest declares both props and slot bindings. */
export const isRenderable = manifest => Boolean(manifest?.props && manifest?.ir);
export const layoutName = layout => IR_LAYOUTS.includes(layout) ? layout : 'stack';
export async function renderableSlugs() {
  const reg = await registry();
  const found = [];
  for (const entry of reg.index.components) {
    if (entry.status !== 'authored') continue;
    const manifest = await reg.manifest(entry.id);
    if (isRenderable(manifest)) found.push(entry.id);
  }
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

/** Validate one node against the registry. Returns the diagnostics raised for that node only. */
async function checkNode(node, context, path) {
  const { reg, report } = context;
  if (!node || typeof node !== 'object' || Array.isArray(node)) { report('error', 'invalid-node', path, 'A node must be an object with a component id.'); return null; }
  if (node.type === 'region') {
    for (const key of Object.keys(node)) if (!REGION_KEYS.includes(key)) report('error', 'unknown-key', `${path}.${key}`, `Regions take ${REGION_KEYS.join(', ')}.`);
    if (!Array.isArray(node.children)) report('error', 'missing-required', `${path}.children`, 'A region needs a children array, even an empty one.');
    checkProvenance(node.provenance, `${path}.provenance`, report);
    if (typeof node.label !== 'string' || !node.label.trim()) report('error', 'invalid-region', `${path}.label`, 'A region needs a label; it becomes the summary a person reads.');
    else if (node.label.length > 60) report('error', 'over-length', `${path}.label`, 'Region labels stay under 60 characters.');
    if (node.open !== undefined && typeof node.open !== 'boolean') report('error', 'wrong-type', `${path}.open`, 'A region is either open or closed.');
    return { region: true, group: true };
  }
  if (node.type === 'section') {
    for (const key of Object.keys(node)) if (!SECTION_KEYS.includes(key)) report('error', 'unknown-key', `${path}.${key}`, `Sections take ${SECTION_KEYS.join(', ')}.`);
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
  if (node.id !== undefined) {
    if (typeof node.id !== 'string' || !NODE_ID_PATTERN.test(node.id)) report('error', 'invalid-node-id', `${path}.id`, 'Node ids use letters, digits, dots, dashes, or underscores, up to 64 characters.');
    else if (context.ids?.has(node.id)) report('error', 'duplicate-node-id', `${path}.id`, `"${node.id}" is already used by another node.`);
    else context.ids?.add(node.id);
  }
  if (Object.keys(manifest.actions ?? {}).length && node.id === undefined) report('warning', 'missing-node-id', `${path}.id`, `${component} sends action requests. Give it an id so the host can match each request to its own state.`);
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
  const context = { reg, report, limits, count: 0, ids: new Set(), sandbox: options.sandbox === true };
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    report('error', 'invalid-spec', '', 'The spec must be an object describing a screen or a node.');
    return { ok: false, diagnostics, screen: null };
  }
  const screen = spec.type === 'screen' ? spec : { type: 'screen', layout: 'stack', children: [spec] };
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
  return { ok: !diagnostics.some(d => d.severity === 'error'), diagnostics, screen };
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
  /** Text comes from props or defaults only: a slot whose optional prop is unset is emptied, never left with demo copy. */
  const bound = (key, apply, clear) => { const current = value(key); if (current !== undefined) apply(current); else clear?.(); };
  const each = (selector, fn) => { for (const one of [].concat(selector)) fn(pick(root, one)); };
  for (const [key, selector] of Object.entries(ir.text ?? {})) bound(key, current => each(selector, target => fillText(target, current)), () => each(selector, target => fillText(target, '')));
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
  /** Chart geometry stays data: the series arrives as numbers and the renderer draws the path. */
  for (const [key, declared] of Object.entries(ir.series ?? {})) {
    const points = Array.isArray(value(key)) ? value(key) : [];
    const svg = pick(root, declared.selector);
    const line = svg && pick(svg, declared.line);
    if (!line) { report('warning', 'series-slot-missing', path, `The contract expects "${declared.line}" inside "${declared.selector}" for ${key}.`); continue; }
    const [width, height] = String(declared.viewBox ?? svg.getAttribute('viewBox') ?? '0 0 360 160').split(/\s+/).slice(2).map(Number);
    const inset = declared.inset ?? (svg.dataset.inset ? Object.fromEntries(['top', 'bottom', 'left', 'right'].map((side, index) => [side, Number(svg.dataset.inset.split(/\s+/)[index])])) : {});
    const top = inset.top ?? 18, bottom = inset.bottom ?? 24, left = inset.left ?? 12, right = inset.right ?? 12;
    const field = declared.value ?? 'value', labelField = declared.label ?? 'label', unit = declared.unit ?? '';
    const numbers = points.map(point => Number(point[field]));
    const axis = declared.axis ? [...root.querySelectorAll(declared.axis)] : [];
    const preset = typeof declared.scale === 'object' ? declared.scale : (svg.dataset.scale ? { min: Number(svg.dataset.scale.split(/\s+/)[0]), max: Number(svg.dataset.scale.split(/\s+/)[1]) } : {});
    /* An automatic scale fits the agent's data, so the axis, the grid, and the line always agree. */
    const limits = manifest.props?.[key]?.items?.fields?.[field] ?? {};
    const { min, max } = declared.scale === 'auto' ? niceScale(numbers, Math.max(1, (axis.length || 4) - 1), { min: limits.minimum, max: limits.maximum }) : { min: preset.min ?? 0, max: preset.max ?? 100 };
    const x = index => left + index * ((width - left - right) / Math.max(1, points.length - 1));
    const y = number => height - bottom - ((Number(number) - min) / ((max - min) || 1)) * (height - top - bottom);
    const path = points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(numbers[index]).toFixed(1)}`).join(' ');
    line.setAttribute('d', path);
    const fill = declared.fill && pick(svg, declared.fill);
    if (fill) fill.setAttribute('d', `${path} L${x(points.length - 1).toFixed(1)},${height - bottom} L${x(0).toFixed(1)},${height - bottom} Z`);
    const tick = (index, count) => tidy(max - index * ((max - min) / Math.max(1, count - 1)));
    const step = (max - min) / Math.max(1, axis.length - 1) || 1;
    const readable = number => String(Number(number.toFixed(Math.max(0, 1 - Math.floor(Math.log10(step))))));
    if (declared.scale === 'auto') {
      axis.forEach((label, index) => { label.textContent = `${readable(tick(index, axis.length))}${unit}`; });
      const grid = declared.grid ? [...svg.querySelectorAll(declared.grid)] : [];
      grid.forEach((rule, index) => { const at = y(tick(index, grid.length)).toFixed(1); rule.setAttribute('y1', at); rule.setAttribute('y2', at); });
    }
    if (declared.markers) {
      const markers = [...svg.querySelectorAll(declared.markers)];
      markers.forEach(marker => marker.remove());
      if (markers[0]) points.forEach((point, index) => {
        const marker = markers[0].cloneNode(true);
        const reading = `${tidy(numbers[index])}${unit}`;
        marker.setAttribute('transform', `translate(${x(index).toFixed(1)} ${y(numbers[index]).toFixed(1)})`);
        marker.setAttribute('aria-label', `${point[labelField]}: ${reading}`);
        marker.style.setProperty('--point-order', String(index));
        const text = declared.markerText && marker.querySelector(declared.markerText);
        if (text) text.textContent = `${point[labelField]} · ${reading}`;
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
        /* Under its point, not spread across the figure. */
        label.style.left = `${(x(at) / width) * 100}%`;
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
        for (const [name, selector] of Object.entries(part.text ?? {})) filled(name, current => fillText(pick(item, selector), current), () => fillText(pick(item, selector), ''));
        for (const [name, selector] of Object.entries(part.lead ?? {})) filled(name, current => fillLead(pick(item, selector), current), () => fillLead(pick(item, selector), ''));
        for (const [name, selector] of Object.entries(part.icon ?? {})) filled(name, current => setIcon(pick(item, selector), current));
        for (const [name, style] of Object.entries(part.style ?? {})) {
          filled(name, current => { const target = pick(item, style.selector) ?? item; if (target.style) target.style.setProperty(style.name, `${current}${style.suffix ?? ''}`); });
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
  /* The item whose field matches the prop is the selected one, so the two can never disagree. */
  for (const [key, binding] of Object.entries(ir.select ?? {})) {
    const part = [].concat(ir.list?.[binding.list] ?? [])[0];
    const container = part && pick(root, part.container);
    const data = Array.isArray(value(binding.list)) ? value(binding.list) : [];
    container?.querySelectorAll('[data-syntari-index]').forEach(item => item.setAttribute(binding.attribute, String(data[Number(item.dataset.syntariIndex)]?.[binding.field] === value(key))));
  }
  if (ir.compute) bindCompute(root, ir.compute, props);
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
const errorFor = (diagnostics, path) => diagnostics.find(d => d.severity === 'error' && (d.path === path || d.path.startsWith(`${path}.`)));

/**
 * Render a validated spec into a container.
 * A node with an error paints a labelled fallback instead of partial output.
 */
export async function render(spec, target, options = {}) {
  const reg = options.registry ?? await registry();
  const limits = { ...IR_LIMITS, ...options.limits };
  const { diagnostics, screen } = await validate(spec, { registry: reg, limits, sandbox: options.sandbox });
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

  async function paint(node, parent, path) {
    if (node?.type === 'region') {
      const region = document.createElement('details');
      region.className = 'ir-region';
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
      parent.append(sandboxFrame(node, host));
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
        const painted = applyContract(element, manifest, props, diagnostics, path, { assets: options.assets });
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

if (typeof window !== 'undefined') window.SyntariIR = { validate, validateProps, render, registry, resolveProps, renderableSlugs, layouts: IR_LAYOUTS, limits: IR_LIMITS };
