/** Node entry for agents that need local, versioned registry and Screen IR contracts. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate as validateRuntime, applyOperations as applyRuntime, assignIds, versionOf, diffScreens, findNode, OPS_VERSION } from './kit/runtime/ir.js';
import { validateScreenSchema, validatePlanSchema } from './registry-validator.mjs';
import { assessComposition, profileData } from './kit/runtime/ir-compose.js';
import { planScreen as planRuntime, PLAN_VERSION } from './kit/runtime/ir-plan.js';
import { repairChange } from './kit/runtime/ir-lint.js';
import { lintMarkup as lintMarkupSource, componentClasses } from './markup-lint.mjs';
import { compositionRules } from './composition-rules.mjs';
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

/**
 * One pattern. A composition pattern carries a complete Screen IR example; an archetype pattern also carries the
 * anti-pattern screen for the same job, what differs between them, and the archetype's guidance from the composition
 * policy: goal, use and contraindications, the hierarchy of zones with their priority and disclosure, layouts,
 * responsive behaviour, states, and what to avoid.
 */
export async function getPattern(id) {
  const pattern = (await listPatterns()).find(item => item.id === id);
  if (!pattern) return null;
  const screens = pattern.screenMode || pattern.antiExample ? await readJson('patterns/screens.json') : {};
  const archetype = pattern.archetype ? (await getCompositionPolicy()).archetypes?.[pattern.archetype] : null;
  return {
    ...pattern,
    screen: pattern.screenMode ? screens[pattern.screenMode] : undefined,
    ...(pattern.antiExample ? { antiExampleScreen: screens[pattern.antiExample] } : {}),
    ...(archetype ? { guidance: { goal: archetype.goal, jobs: archetype.jobs, useWhen: archetype.useWhen, contraindications: archetype.contraindications, hierarchy: archetype.zones, layouts: archetype.layouts, responsive: archetype.responsive, states: archetype.states, avoid: archetype.avoid } } : {})
  };
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
  /* A versioned plan is checked against plan.schema.json too; the runtime has already named its structural problems. */
  const plan = spec?.meta?.plan?.version === PLAN_VERSION ? await validatePlanSchema(spec.meta.plan, registryDir) : { valid: true, details: [] };
  const planCovered = path => runtime.diagnostics.some(item => item.code.startsWith('plan-') && (item.path === path || path.startsWith(`${item.path}.`) || path.startsWith(`${item.path}[`)));
  const diagnostics = [
    /* The runtime already explains most schema problems in its own words; the schema adds only what it alone found. */
    ...schema.details.filter(item => !covered(item.path)).map(({ path, message }) => ({ severity: 'error', code: 'screen-schema', path, message })),
    ...plan.details.filter(item => !planCovered(item.path)).map(({ path, message }) => ({ severity: 'error', code: 'plan-invalid', path, message })),
    ...runtime.diagnostics
  ];
  return { ok: schema.valid && plan.valid && runtime.ok, diagnostics };
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
  const checked = await validateScreen(spec, { sandbox: options.sandbox === true });
  const resolved = await validateRuntime(spec, { sandbox: options.sandbox === true, registry });
  const renderable = new Set((await listComponents()).filter(item => item.renderable).map(item => item.id));
  /* Repairs name nodes by id, so they are offered against the screen's version only when its nodes carry ids. */
  const base = spec && typeof spec === 'object' ? versionOf(spec) : null;
  return {
    ok: checked.ok,
    diagnostics: checked.diagnostics,
    assessment: assessComposition(spec, { policy: registry.policy, resolved: resolved.screen, model: resolved.data, diagnostics: checked.diagnostics, plan: options.plan ?? null, base }),
    data: resolved.data ? profileData(resolved.data, registry.policy, renderable) : []
  };
}

/**
 * A composition plan for a brief, before any component is chosen: the archetype, the priority and disclosure of each
 * piece of information, the layout, candidate components, what to avoid, and the alternatives considered. The model
 * writes the brief from what it knows of the user and the request; the plan follows from the policy, deterministically.
 * Returns { plan, status, cues, problems }; status "needs-context" means the brief left out the job or the information,
 * and plan.openQuestions says what to ask.
 */
export async function planScreen(brief, options = {}) {
  const policy = await getCompositionPolicy();
  const renderable = options.renderableOnly === false ? null : new Set((await listComponents()).filter(item => item.renderable).map(item => item.id));
  const result = planRuntime(brief, policy, { renderable });
  const schema = await validatePlanSchema(result.plan, registryDir);
  return { ...result, problems: [...result.problems, ...schema.details] };
}

/**
 * What the policy says about composing for a job or with a component: one archetype (or all of them, summarized), the
 * kinds of information with their priority and disclosure rules, surfaces and dividers, the lint rules, and the
 * composition guidance of the components asked for.
 */
export async function getCompositionGuidance({ archetype, components = [] } = {}) {
  const policy = await getCompositionPolicy();
  if (archetype !== undefined && !policy.archetypes[archetype]) return null;
  const archetypes = archetype ? { [archetype]: policy.archetypes[archetype] } : Object.fromEntries(Object.entries(policy.archetypes).map(([id, item]) => [id, { label: item.label, goal: item.goal, jobs: item.jobs, useWhen: item.useWhen, contraindications: item.contraindications }]));
  const guidance = {};
  for (const id of components) {
    const component = await getComponent(id);
    if (component) guidance[id] = { purpose: component.purpose, summary: component.guidance?.summary ?? null, useWhen: component.guidance?.useWhen ?? [], avoidWhen: component.guidance?.avoidWhen ?? [], composition: component.guidance?.composition ?? null };
  }
  const patterns = (await listPatterns()).filter(item => item.archetype && (!archetype || item.archetype === archetype)).map(({ id, name, archetype: of, screenMode, antiExample }) => ({ id, name, archetype: of, example: screenMode ?? null, antiExample: antiExample ?? null }));
  return { jobs: policy.jobs, archetypes, information: policy.information, surfaces: policy.surfaces, dividers: policy.dividers, lint: policy.lint, patterns, components: guidance };
}

/**
 * Apply the safe repairs an assessment found, as a host would: only disclosure and emphasis change, through
 * applyScreenOperations, so data, records, and every other node are protected as for any change. Returns the
 * application's result with the findings it addressed, or { ok: true, spec, unchanged: true } when nothing was safe to repair.
 */
export async function repairScreen(spec, options = {}) {
  const prepared = assignIds(spec);
  const assessed = await assessScreen(prepared, options);
  const change = repairChange(assessed.assessment.findings, versionOf(prepared));
  if (!change) return { ok: true, spec: prepared, unchanged: true, findings: assessed.assessment.findings };
  const applied = await applyScreenOperations(prepared, change, options);
  return { ...applied, change, addressed: assessed.assessment.findings.filter(item => item.autofix) };
}

/**
 * A review of a rendered screen by an adapter the host supplies, such as a vision model: it receives a screenshot, the
 * screen, and its plan, and returns observations. Syntari does not render or call a model here. What comes back is
 * checked against schema/visual-review.schema.json and labelled as a judgment: it is never merged into validation.
 *   assessRenderedScreen({ screenshot, viewport, spec }, { adapter: async input => ({ observations: [...] }) })
 */
export async function assessRenderedScreen(input, { adapter } = {}) {
  if (typeof adapter !== 'function') return { available: false, deterministic: false, reason: 'No visual review adapter. Deterministic findings come from assessScreen; a rendered review needs a host-supplied adapter.' };
  const plan = input?.spec?.meta?.plan ?? null;
  const raw = await adapter({ screenshot: input?.screenshot, viewport: input?.viewport ?? null, spec: input?.spec ?? null, plan, criteria: (await getCompositionPolicy()).lint.criteria });
  const checked = await validateVisualReview(raw);
  return checked.valid
    ? { available: true, deterministic: false, source: raw.source ?? 'adapter', observations: raw.observations, note: 'A judgment from a rendered review. It is not validation and does not decide what renders.' }
    : { available: true, deterministic: false, ok: false, problems: checked.details, note: 'The adapter answered outside the visual review contract; nothing it said is used.' };
}
async function validateVisualReview(value) {
  const { default: Ajv } = await import('ajv');
  const schema = JSON.parse(await readFile(join(registryDir, 'schema/visual-review.schema.json'), 'utf8'));
  const check = new Ajv({ allErrors: true, strict: false }).compile(schema);
  const valid = check(value);
  return { valid, details: valid ? [] : check.errors.map(error => `${error.instancePath || '/'} ${error.message}`) };
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

/**
 * Check markup an agent wrote with installed components (HTML or JSX) against the composition policy, and a plan when
 * given. For projects that do not render through Screen IR: it reads the markup as text and says what it cannot see.
 */
export async function lintMarkup(markup, { plan = null, file = null } = {}) {
  const manifests = [];
  for (const entry of (await listComponents()).filter(item => item.renderable)) manifests.push(await readJson(`components/${entry.id}.json`));
  return lintMarkupSource(markup, { policy: await getCompositionPolicy(), classes: componentClasses(manifests), plan, file });
}

/** The composition rules as Markdown, for a project's agent instructions: generated from the policy, never hand-copied. */
export async function getCompositionRules() {
  return compositionRules(await getCompositionPolicy(), (await readJson('index.json')).version);
}
