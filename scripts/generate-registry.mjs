import { writeFile, access, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { catalog } from './catalog.mjs';

const registry = resolve('registry');
const componentsDir = resolve(registry, 'components');

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

function skeleton(component) {
  return {
    $schema: '../schema/component.schema.json',
    id: component.slug,
    name: component.name,
    version: '0.2.1',
    category: component.category,
    status: 'generated',
    purpose: component.description,
    description: component.description,
    intents: [],
    variants: {},
    states: [],
    anatomy: [],
    accessibility: { role: '', keyboard: [], accessibleNameRequired: false },
    rules: [],
    tokens: component.tokens || [],
    compatibleWith: [],
    avoidWhen: [],
    source: `components/${component.slug}/`
  };
}

const components = await catalog();
await mkdir(componentsDir, { recursive: true });

const index = {
  $id: 'https://syntariui.github.io/syntari/registry/index.json',
  version: '0.2.1',
  components: []
};

const arg = process.argv[2];
const slug = process.argv[3];

for (const component of components) {
  const manifestPath = resolve(componentsDir, `${component.slug}.json`);
  const authored = await exists(manifestPath);
  if (arg === '--skeleton' && slug !== undefined && slug !== component.slug) continue;

  index.components.push({
    id: component.slug,
    name: component.name,
    category: component.category,
    version: '0.2.1',
    description: component.description,
    tokens: component.tokens || [],
    source: `components/${component.slug}/`,
    manifest: `components/${component.slug}.json`,
    status: authored ? 'authored' : 'generated'
  });

  if (arg === '--skeleton' && (slug === 'all' || slug === component.slug) && !authored) {
    await writeFile(manifestPath, JSON.stringify(skeleton(component), null, 2) + '\n');
  }
}

await writeFile(resolve(registry, 'index.json'), JSON.stringify(index, null, 2) + '\n');
const authored = index.components.filter(c => c.status === 'authored').length;
console.log(`Wrote registry/index.json with ${index.components.length} components (${authored} authored).`);
