import { writeFile, access, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { catalog } from './catalog.mjs';

const registry = resolve(process.env.SYNTARI_REGISTRY_OUTPUT ?? 'registry');
const componentsDir = resolve(registry, 'components');
const releaseVersion = JSON.parse(await readFile(resolve('package.json'), 'utf8')).version;

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

function skeleton(component) {
  return {
    $schema: '../schema/component.schema.json',
    id: component.slug,
    name: component.name,
    version: releaseVersion,
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
    dependencies: [],
    examples: { good: [], bad: [], boundary: [] },
    files: [`kit/components/${component.slug}.js`, `kit/components/${component.slug}.html`, 'kit/runtime/syntari.js', 'kit/runtime/tokens.css', 'kit/runtime/styles.css'],
    compatibleWith: [],
    avoidWhen: [],
    source: `components/${component.slug}/`
  };
}

const components = await catalog();
await mkdir(componentsDir, { recursive: true });

const index = {
  $id: 'https://syntariui.giovanitier.com/registry/index.json',
  version: releaseVersion,
  components: []
};

const arg = process.argv[2];
const slug = process.argv[3];

for (const component of components) {
  const manifestPath = resolve(componentsDir, `${component.slug}.json`);
  const manifest = await exists(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : null;
  const authored = manifest?.status === 'authored';
  if (arg === '--skeleton' && slug !== undefined && slug !== 'all' && slug !== component.slug) continue;

  index.components.push({
    id: component.slug,
    name: component.name,
    category: component.category,
    version: releaseVersion,
    description: component.description,
    tokens: component.tokens || [],
    source: `components/${component.slug}/`,
    manifest: `components/${component.slug}.json`,
    status: authored ? 'authored' : 'generated',
    dependencies: manifest?.dependencies ?? [],
    examples: manifest?.examples ?? { good: [], bad: [], boundary: [] },
    files: [`kit/components/${component.slug}.js`, `kit/components/${component.slug}.html`, 'kit/runtime/syntari.js', 'kit/runtime/tokens.css', 'kit/runtime/styles.css'],
    preview: `https://syntariui.giovanitier.com/components/${component.slug}/`
  });

  if (arg === '--skeleton' && (slug === 'all' || slug === component.slug) && !authored) {
    await writeFile(manifestPath, JSON.stringify(skeleton(component), null, 2) + '\n');
  }
}

await writeFile(resolve(registry, 'index.json'), JSON.stringify(index, null, 2) + '\n');
const authored = index.components.filter(c => c.status === 'authored').length;
console.log(`Wrote registry/index.json with ${index.components.length} components (${authored} authored).`);
