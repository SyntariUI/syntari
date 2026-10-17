import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* The React registry is a shadcn registry: `npx shadcn add <site>/r/<name>.json` copies the source into a React project. */
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const reactRoot = join(root, 'react');
export const ICONS_FILE = join(reactRoot, 'registry/syntari/lib/syntari-icons.ts');
export const DEFAULT_SITE = 'https://syntariui.giovanitier.com';

/* The runtime's icon table is the single source: the same Lucide paths render in both. */
export async function iconNodes() {
  const source = await readFile(join(root, 'app.js'), 'utf8');
  const paths = JSON.parse(source.match(/const paths=(\{.*?\});/s)[1]);
  for (const [, name, markup] of source.matchAll(/^paths\['([\w-]+)'\]='(.*?)';$/gm)) paths[name] = markup;
  return Object.fromEntries(Object.entries(paths).map(([name, markup]) => [name, [...markup.matchAll(/<(\w+)([^>]*?)\s*\/>/g)].map(([, tag, attributes]) =>
    [tag, Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]))])]));
}

export async function iconSource() {
  const nodes = await iconNodes();
  const body = Object.entries(nodes).map(([name, children]) => `  ${JSON.stringify(name)}: ${JSON.stringify(children)},`).join('\n');
  const license = (await readFile(join(root, 'assets/lucide-LICENSE.txt'), 'utf8')).trim().split('\n').map(line => ` * ${line}`.trimEnd()).join('\n');
  return `/**
 * Syntari icons for React. Generated from the Syntari runtime by scripts/react-registry.mjs; do not edit.
 * The paths come from Lucide (https://lucide.dev):
 *
${license}
 */
export type SyntariIconNode = ReadonlyArray<readonly [string, Readonly<Record<string, string>>]>;

export const SYNTARI_ICONS = {
${body}
} as const satisfies Record<string, SyntariIconNode>;

export type SyntariIconName = keyof typeof SYNTARI_ICONS;
`;
}

export async function readManifest() {
  return JSON.parse(await readFile(join(reactRoot, 'registry.json'), 'utf8'));
}

/**
 * Write a shadcn registry index and one item file per entry. Each component depends on the shared
 * `syntari` helpers by absolute URL, so it installs the same way with or without a configured namespace.
 */
export async function buildReactRegistry({ outDir, site = DEFAULT_SITE } = {}) {
  const manifest = await readManifest();
  const base = `${site.replace(/\/$/, '')}/r`;
  const names = new Set(manifest.items.map(item => item.name));
  const items = [];
  for (const entry of manifest.items) {
    const contract = entry.type === 'registry:component'
      ? JSON.parse(await readFile(join(root, 'registry/components', `${entry.name}.json`), 'utf8'))
      : null;
    const item = {
      name: entry.name,
      type: entry.type,
      title: entry.title ?? contract?.name,
      description: entry.description ?? contract?.purpose,
      ...(entry.dependencies ? { dependencies: entry.dependencies } : {}),
      ...(entry.registryDependencies ? { registryDependencies: entry.registryDependencies.map(name => names.has(name) ? `${base}/${name}.json` : name) } : {}),
      files: entry.files,
      ...(entry.docs ? { docs: entry.docs } : {}),
      ...(contract ? { meta: { contract: `${site.replace(/\/$/, '')}/registry/components/${entry.name}.json`, ...(entry.meta ?? {}) } } : entry.meta ? { meta: entry.meta } : {})
    };
    items.push(item);
  }
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'registry.json'), JSON.stringify({ $schema: 'https://ui.shadcn.com/schema/registry.json', name: manifest.name, homepage: manifest.homepage, items }, null, 2) + '\n');
  for (const item of items) {
    const files = await Promise.all(item.files.map(async file => ({ ...file, content: await readFile(join(reactRoot, file.path), 'utf8') })));
    await writeFile(join(outDir, `${item.name}.json`), JSON.stringify({ $schema: 'https://ui.shadcn.com/schema/registry-item.json', ...item, files }, null, 2) + '\n');
  }
  return items;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await writeFile(ICONS_FILE, await iconSource());
  const outDir = process.env.SYNTARI_REACT_REGISTRY_OUTPUT ?? join(root, 'dist/r');
  const items = await buildReactRegistry({ outDir, site: process.env.SYNTARI_SITE ?? DEFAULT_SITE });
  console.log(`React registry: ${items.length} items in ${outDir}.`);
}
