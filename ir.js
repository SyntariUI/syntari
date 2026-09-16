/** Syntari UI IR: validate an agent-authored screen spec, then render it with Syntari components. */
import { mount } from './syntari.js';
const base = new URL('.', import.meta.url);
export const IR_LAYOUTS = ['stack', 'row', 'grid', 'two-column'];
export const IR_LIMITS = { maxDepth: 8, maxNodes: 120, maxChildren: 40, maxListItems: 40 };
const ID_PATTERN = /^syntari\.[a-z0-9]+(-[a-z0-9]+)*$/;

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
  if (descriptor.maxLength && value.length > descriptor.maxLength) report('error', 'over-length', path, `Received ${value.length} characters; the limit is ${descriptor.maxLength}.`);
  if (descriptor.minimum !== undefined && value < descriptor.minimum) report('error', 'below-minimum', path, `Received ${value}; the minimum is ${descriptor.minimum}.`);
  if (descriptor.maximum !== undefined && value > descriptor.maximum) report('error', 'above-maximum', path, `Received ${value}; the maximum is ${descriptor.maximum}.`);
}

/** Validate one node against the registry. Returns the diagnostics raised for that node only. */
async function checkNode(node, context, path) {
  const { reg, report } = context;
  if (!node || typeof node !== 'object' || Array.isArray(node)) { report('error', 'invalid-node', path, 'A node must be an object with a component id.'); return null; }
  const { component } = node;
  if (typeof component !== 'string' || !ID_PATTERN.test(component)) {
    report('error', 'invalid-component-id', `${path}.component`, 'Component ids use the form "syntari.component-slug".');
    return null;
  }
  const slug = componentSlug(component);
  if (!reg.entries.has(slug)) { report('error', 'unknown-component', `${path}.component`, `"${component}" is not in the Syntari registry.`); return null; }
  const manifest = await reg.manifest(slug);
  if (!isRenderable(manifest)) { report('error', 'unsupported-component', `${path}.component`, `"${component}" is documented but has no prop contract yet, so it cannot be rendered from IR.`); return null; }
  const props = node.props ?? {};
  if (typeOf(props) !== 'object') { report('error', 'wrong-type', `${path}.props`, 'Props must be an object.'); return { slug, manifest }; }
  for (const [key, value] of Object.entries(props)) {
    const descriptor = manifest.props[key];
    if (!descriptor) { report('warning', 'unknown-prop', `${path}.props.${key}`, `${component} has no "${key}" prop. It was ignored.`); continue; }
    checkValue(value, descriptor, `${path}.props.${key}`, report);
  }
  for (const [key, descriptor] of Object.entries(manifest.props)) {
    if (descriptor.required && props[key] === undefined && descriptor.default === undefined) report('error', 'missing-required', `${path}.props.${key}`, `"${key}" is required by ${component}.`);
  }
  return { slug, manifest };
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
  const context = { reg, report, limits, count: 0 };
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    report('error', 'invalid-spec', '', 'The spec must be an object describing a screen or a node.');
    return { ok: false, diagnostics, screen: null };
  }
  const screen = spec.type === 'screen' ? spec : { type: 'screen', layout: 'stack', children: [spec] };
  if (spec.type === 'screen' && spec.layout !== undefined && !IR_LAYOUTS.includes(spec.layout)) report('warning', 'unknown-layout', 'layout', `"${spec.layout}" is not a reference layout. The screen renders as a stack.`);
  if (screen.children !== undefined && !Array.isArray(screen.children)) report('error', 'wrong-type', 'children', 'Screen children must be an array.');
  const children = Array.isArray(screen.children) ? screen.children : [];
  if (children.length > limits.maxChildren) report('error', 'over-node-budget', 'children', `${children.length} top-level nodes were supplied; the limit is ${limits.maxChildren}.`);

  async function walk(node, path, depth) {
    context.count += 1;
    if (depth > limits.maxDepth) { report('error', 'over-depth-budget', path, `The spec nests deeper than ${limits.maxDepth} levels.`); return; }
    if (context.count > limits.maxNodes) { report('error', 'over-node-budget', path, `The spec holds more than ${limits.maxNodes} nodes.`); return; }
    const resolved = await checkNode(node, context, path);
    if (!resolved) return;
    const nested = node.children;
    if (nested === undefined) return;
    if (!Array.isArray(nested)) { report('error', 'wrong-type', `${path}.children`, 'Children must be an array.'); return; }
    if (nested.length) report('warning', 'nested-children-unsupported', `${path}.children`, 'This release renders nested children as siblings of the parent node.');
    for (const [i, child] of nested.entries()) await walk(child, `${path}.children[${i}]`, depth + 1);
  }
  for (const [i, child] of children.entries()) await walk(child, `children[${i}]`, 1);
  return { ok: !diagnostics.some(d => d.severity === 'error'), diagnostics, screen };
}

function setText(target, value) {
  if (target) target.textContent = String(value);
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
  const node = [...target.childNodes].find(child => child.nodeType === 3 && child.nodeValue.trim());
  if (node) node.nodeValue = ` ${String(value)} `;
  else target.prepend(document.createTextNode(String(value)));
}
function setIcon(target, value, report, path) {
  if (!target) return;
  const markup = window.SyntariIcon?.(String(value));
  if (!markup) { report('warning', 'unknown-icon', path, `"${value}" is not a Lucide icon in this runtime, so the component's own icon was kept.`); return; }
  if (target.tagName.toLowerCase() === 'svg') target.outerHTML = markup;
  else target.innerHTML = markup;
}
function applyVariant(target, values, value, report, path) {
  if (!target) return;
  const chosen = values[value];
  if (chosen === undefined) { report('warning', 'unknown-variant', path, `"${value}" has no class mapping and was ignored.`); return; }
  for (const className of new Set(Object.values(values))) if (className) target.classList.remove(...className.split(/\s+/));
  if (chosen) target.classList.add(...chosen.split(/\s+/));
}

/** Write resolved props into the mounted component using the bindings its manifest declares. */
export function applyContract(element, manifest, props, diagnostics, path) {
  const ir = manifest.ir;
  const report = (severity, code, detail) => diagnostics.push({ severity, code, path, message: detail });
  const root = ir.node ? element.querySelector(ir.node) : element;
  if (!root) { report('warning', 'instance-root-missing', `The contract expects "${ir.node}" inside ${manifest.id}; the markup has changed.`); return element; }
  if (root !== element) for (const child of [...element.children]) if (child !== root && !child.contains(root)) child.remove();
  const value = key => props[key];
  /** An optional prop that the spec left out must not write "undefined" into the markup. */
  const bound = (key, apply) => { const current = value(key); if (current !== undefined) apply(current); };
  for (const [key, selector] of Object.entries(ir.text ?? {})) bound(key, current => setText(pick(root, selector), current));
  for (const [key, selector] of Object.entries(ir.lead ?? {})) bound(key, current => setLead(pick(root, selector), current));
  for (const [key, selector] of Object.entries(ir.icon ?? {})) bound(key, current => setIcon(pick(root, selector), current, report, path));
  for (const [key, binding] of Object.entries(ir.variant ?? {})) bound(key, current => applyVariant(pick(root, binding.selector), binding.values, current, report, path));
  for (const [key, binding] of Object.entries(ir.attributes ?? {})) {
    bound(key, current => { const target = pick(root, binding.selector); if (target) target.setAttribute(binding.attribute, String(current)); });
  }
  for (const [key, declared] of Object.entries(ir.list ?? {})) {
    const items = Array.isArray(value(key)) ? value(key) : [];
    for (const part of [].concat(declared)) {
      const container = pick(root, part.container);
      const template = container ? pick(container, part.item) : null;
      if (!container || !template) { report('warning', 'list-slot-missing', `The contract expects "${part.item}" inside "${part.container}" for ${key}.`); continue; }
      const existing = [...container.querySelectorAll(part.item)];
      const clone = template.cloneNode(true);
      existing.forEach(node => node.remove());
      const limit = Math.min(items.length, IR_LIMITS.maxListItems);
      for (let i = 0; i < limit; i += 1) {
        const item = clone.cloneNode(true);
        const data = items[i];
        const field = name => Array.isArray(data) ? data[Number(name)] : data?.[name];
        for (const attribute of part.strip ?? []) item.removeAttribute(attribute);
        if (part.cells) [...item.querySelectorAll(part.cells)].forEach((cell, index) => setText(cell, Array.isArray(data) ? data[index] ?? '' : ''));
        const filled = (name, apply) => { const current = field(name); if (current !== undefined) apply(current); };
        for (const [name, selector] of Object.entries(part.text ?? {})) filled(name, current => setText(pick(item, selector), current));
        for (const [name, selector] of Object.entries(part.lead ?? {})) filled(name, current => setLead(pick(item, selector), current));
        for (const [name, selector] of Object.entries(part.icon ?? {})) filled(name, current => setIcon(pick(item, selector), current, report, path));
        for (const [name, style] of Object.entries(part.style ?? {})) {
          filled(name, current => { const target = pick(item, style.selector) ?? item; if (target.style) target.style.setProperty(style.name, `${current}${style.suffix ?? ''}`); });
        }
        for (const [name, binding] of Object.entries(part.variant ?? {})) filled(name, current => applyVariant(pick(item, binding.selector), binding.values, current, report, path));
        for (const [name, binding] of Object.entries(part.attributes ?? {})) {
          filled(name, current => { const target = pick(item, binding.selector); if (target) target.setAttribute(binding.attribute, String(current)); });
        }
        container.append(item);
      }
    }
  }
  return root;
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
const errorFor = (diagnostics, path) => diagnostics.find(d => d.severity === 'error' && (d.path === path || d.path.startsWith(`${path}.`)));

/**
 * Render a validated spec into a container.
 * A node with an error paints a labelled fallback instead of partial output.
 */
export async function render(spec, target, options = {}) {
  const reg = options.registry ?? await registry();
  const limits = { ...IR_LIMITS, ...options.limits };
  const { diagnostics, screen } = await validate(spec, { registry: reg, limits });
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  if (!(host instanceof Element)) throw new TypeError('Syntari IR render() needs a matching selector or Element.');
  const mounted = [];
  const root = document.createElement('div');
  root.className = 'ir-screen';
  root.dataset.irLayout = layoutName(screen?.layout);
  if (screen?.title) {
    const heading = document.createElement('h2');
    heading.className = 'ir-screen-title';
    heading.textContent = String(screen.title);
    root.append(heading);
  }

  async function paint(node, parent, path) {
    const slot = document.createElement('div');
    slot.className = 'ir-node';
    parent.append(slot);
    const failure = errorFor(diagnostics, path);
    if (failure) { slot.append(fallback(node, failure.message, node?.component)); slot.dataset.irStatus = 'fallback'; return; }
    const slug = componentSlug(node.component);
    const manifest = await reg.manifest(slug);
    const props = resolveProps(node.props ?? {}, manifest);
    slot.dataset.irComponent = slug;
    const instance = await mount(slug, slot, {
      configure: element => {
        const painted = applyContract(element, manifest, props, diagnostics, path);
        if (node.provenance) painted.dataset.irProvenance = JSON.stringify(node.provenance);
      }
    });
    mounted.push(instance);
    for (const [i, child] of (node.children ?? []).entries()) await paint(child, parent, `${path}.children[${i}]`);
  }

  for (const [i, child] of (screen?.children ?? []).entries()) await paint(child, root, `children[${i}]`);
  if (diagnostics.some(d => d.severity === 'error')) root.dataset.irStatus = 'partial';
  host.replaceChildren(root);
  options.onDiagnostics?.(diagnostics);
  return {
    get element() { return root; },
    diagnostics,
    destroy() { mounted.forEach(instance => instance.destroy()); root.remove(); }
  };
}

window.SyntariIR = { validate, render, registry, resolveProps, renderableSlugs, layouts: IR_LAYOUTS, limits: IR_LIMITS };
