/** Node entry for agents that need local, versioned registry and Screen IR contracts. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate as validateRuntime, applyOperations as applyRuntime, assignIds, versionOf, diffScreens, findNode, OPS_VERSION } from './kit/runtime/ir.js';
import { validateScreenSchema } from './registry-validator.mjs';
import { assessComposition, profileData } from './kit/runtime/ir-compose.js';
import { matchScore } from './kit/runtime/search.js';

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

/**
 * Components whose name, aliases, category, or description match every word of the query, best match first (the same
 * rules as System and the command palette), then those whose intents do; then patterns that mention every word.
 */
export async function searchRegistry(query) {
  const words = String(query ?? '').toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const matches = text => words.every(word => text.toLocaleLowerCase().includes(word));
  const scored = [];
  for (const entry of await listComponents()) {
    const intents = entry.status === 'authored' ? (await readJson(`components/${entry.id}.json`)).intents ?? [] : [];
    const score = matchScore(entry, query) || (matches([entry.id, ...intents].join(' ')) ? 10 : 0);
    if (score) scored.push({ score, entry });
  }
  scored.sort((a, b) => b.score - a.score);
  const components = [];
  for (const { entry } of scored) {
    components.push({ kind: 'component', id: entry.id, name: entry.name, category: entry.category, renderable: Boolean(entry.renderable), description: entry.description });
  }
  const patterns = (await listPatterns()).filter(item => matches([item.id, item.name, item.type, item.description, ...(item.keywords ?? [])].join(' ')))
    .map(item => ({ kind: 'pattern', id: item.id, name: item.name, category: item.type, description: item.description }));
  return [...components, ...patterns];
}

async function nodeRegistry() {
  const index = await readJson('index.json');
  const entries = new Map(index.components.map(entry => [entry.id, entry]));
  const policy = await readJson('composition-policy.json').catch(() => null);
  return { index, entries, policy, manifest: async slug => entries.has(slug) ? readJson(`components/${slug}.json`) : null };
}

/** Validate a screen as the host would. Pass { sandbox: true } only for a host that allows unverified blocks. */
export async function validateScreen(spec, options = {}) {
  const runtime = await validateRuntime(spec, { sandbox: options.sandbox === true, registry: await nodeRegistry() });
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

export { assignIds, versionOf, diffScreens, findNode, OPS_VERSION };
export { buildDataModel, formatData, parseFigure } from './kit/runtime/ir.js';
export { unsupportedRequest } from './kit/runtime/ir-compose.js';

/** The registry's composition policy: which visualization fits which kind of data, and how each kind of screen is ordered. */
export async function getCompositionPolicy() {
  return readJson('composition-policy.json');
}
/**
 * How well a screen is composed, beyond validity: the pattern it reads as, each part's kind of data and how its component
 * fits it, and advice on hierarchy, redundancy, density, and readability. For a screen with data, also what each table,
 * measure, and group holds and which visualization fits it. Advice is a judgment under the policy; validation decides.
 */
export async function assessScreen(spec, options = {}) {
  const registry = await nodeRegistry();
  const checked = await validateRuntime(spec, { sandbox: options.sandbox === true, registry });
  const renderable = new Set((await listComponents()).filter(item => item.renderable).map(item => item.id));
  return {
    ok: checked.ok,
    diagnostics: checked.diagnostics,
    assessment: assessComposition(spec, { policy: registry.policy, resolved: checked.screen, model: checked.data, diagnostics: checked.diagnostics }),
    data: checked.data ? profileData(checked.data, registry.policy, renderable) : []
  };
}
/**
 * Apply a model's proposed change to one version of a screen, as a host would. The model proposes operations by node id
 * (insert, replace, move, remove, or one recompose); the runtime applies only those, refuses anything outside their scope,
 * protects existing data, and validates the whole result. On any error the result has ok: false and spec: null, so the
 * host keeps the last valid screen.
 */
export async function applyScreenOperations(spec, change, options = {}) {
  return applyRuntime(spec, change, { ...options, sandbox: options.sandbox === true, registry: await nodeRegistry() });
}
