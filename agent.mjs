/** Node entry for agents that need local, versioned registry and Screen IR contracts. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate as validateRuntime } from './kit/runtime/ir.js';
import { validateScreenSchema } from './registry-validator.mjs';

const registryDir = fileURLToPath(new URL('./kit/runtime/registry/', import.meta.url));
const readJson = async path => JSON.parse(await readFile(join(registryDir, path), 'utf8'));

export async function listComponents() {
  return (await readJson('index.json')).components;
}

export async function listPatterns() {
  return (await readJson('patterns/index.json')).patterns;
}

export async function getAgentPolicy() {
  return readJson('agent-policy.json');
}

export async function getPattern(id) {
  const pattern = (await listPatterns()).find(item => item.id === id);
  if (!pattern) return null;
  return { ...pattern, screen: pattern.screenMode ? (await readJson('patterns/screens.json'))[pattern.screenMode] : undefined };
}

/** One component's full manifest: contract, actions, sample, rules, and how to install it. */
export async function getComponent(id) {
  const entry = (await listComponents()).find(item => item.id === id);
  if (!entry) return null;
  const manifest = await readJson(`components/${id}.json`);
  /* A component with icon props carries the icon vocabulary, so an agent never has to guess a name. */
  const takesIcons = Object.keys(manifest.ir?.icon ?? {}).length > 0 || Object.values(manifest.ir?.list ?? {}).flat().some(part => part.icon);
  const icons = takesIcons ? { icons: (await readJson('index.json')).icons } : {};
  return { ...manifest, renderable: Boolean(manifest.props && manifest.ir), install: `npx syntari add ${id}`, preview: entry.preview, ...icons };
}

/** Components and patterns whose id, name, category, description, or intents mention every word of the query. */
export async function searchRegistry(query) {
  const words = String(query ?? '').toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const matches = text => words.every(word => text.toLocaleLowerCase().includes(word));
  const components = [];
  for (const entry of await listComponents()) {
    const intents = entry.status === 'authored' ? (await readJson(`components/${entry.id}.json`)).intents ?? [] : [];
    if (matches([entry.id, entry.name, entry.category, entry.description, ...intents].join(' '))) components.push({ kind: 'component', id: entry.id, name: entry.name, category: entry.category, renderable: Boolean(entry.renderable), description: entry.description });
  }
  const patterns = (await listPatterns()).filter(item => matches([item.id, item.name, item.type, item.description, ...(item.keywords ?? [])].join(' ')))
    .map(item => ({ kind: 'pattern', id: item.id, name: item.name, category: item.type, description: item.description }));
  return [...components, ...patterns];
}

export async function validateScreen(spec) {
  const index = await readJson('index.json');
  const entries = new Map(index.components.map(entry => [entry.id, entry]));
  const runtime = await validateRuntime(spec, { registry: {
    index,
    entries,
    manifest: async slug => entries.has(slug) ? readJson(`components/${slug}.json`) : null
  } });
  /* The runtime checks the budget first; a spec over it is rejected without walking the whole schema. */
  const overBudget = runtime.diagnostics.some(item => item.code === 'over-depth-budget' || item.code === 'over-node-budget');
  const schema = overBudget ? { valid: false, details: [] } : await validateScreenSchema(spec, registryDir);
  const covered = path => runtime.diagnostics.some(item => item.severity === 'error' && (item.path === path || item.path.startsWith(`${path}.`) || item.path.startsWith(`${path}[`)));
  const diagnostics = [
    /* The runtime already explains most schema problems in its own words; the schema adds only what it alone found. */
    ...schema.details.filter(item => !covered(item.path)).map(({ path, message }) => ({ severity: 'error', code: 'screen-schema', path, message })),
    ...runtime.diagnostics
  ];
  return { ok: schema.valid && runtime.ok, diagnostics };
}
