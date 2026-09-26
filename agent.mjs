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

export async function validateScreen(spec) {
  const [schema, index] = await Promise.all([validateScreenSchema(spec, registryDir), readJson('index.json')]);
  const entries = new Map(index.components.map(entry => [entry.id, entry]));
  const runtime = await validateRuntime(spec, { registry: {
    entries,
    manifest: async slug => entries.has(slug) ? readJson(`components/${slug}.json`) : null
  } });
  const diagnostics = [
    ...schema.problems.map(message => ({ severity: 'error', code: 'screen-schema', path: 'spec', message })),
    ...runtime.diagnostics
  ];
  return { ok: schema.valid && runtime.ok, diagnostics };
}
