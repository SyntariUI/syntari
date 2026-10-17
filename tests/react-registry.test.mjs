import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildReactRegistry, DEFAULT_SITE, ICONS_FILE, iconSource, readManifest } from '../scripts/react-registry.mjs';

const contract = async slug => JSON.parse(await readFile(new URL(`../registry/components/${slug}.json`, import.meta.url), 'utf8'));
const source = file => readFile(new URL(`../react/${file}`, import.meta.url), 'utf8');
const pascal = slug => slug.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join('');
const components = async () => (await readManifest()).items.filter(item => item.type === 'registry:component');

/* The props block lists the contract first and host-only props after a "Host-only" comment. */
function propsBlock(code, name) {
  const start = code.indexOf(`export type ${name}Props =`);
  assert.notEqual(start, -1, `${name}Props is exported`);
  const body = code.slice(code.indexOf('{', start) + 1, code.indexOf('\n};', start));
  const [contractPart, hostPart = ''] = body.split(/\n\s*\/\*\s*\n?\s*\*?\s*Host-only|\n\s*\/\* Host-only/);
  const props = part => [...part.matchAll(/^ {2}(\w+)(\?)?:/gm)].map(([, prop, optional]) => ({ prop, optional: Boolean(optional) }));
  return { contract: props(contractPart), host: props(hostPart) };
}

test('React icons are generated from the runtime icon table', async () => {
  assert.equal(await readFile(ICONS_FILE, 'utf8'), await iconSource(), 'Run node scripts/react-registry.mjs to regenerate syntari-icons.ts');
  const vocabulary = JSON.parse(await readFile(new URL('../registry/index.json', import.meta.url), 'utf8')).icons;
  const generated = [...(await readFile(ICONS_FILE, 'utf8')).matchAll(/^ {2}"([\w-]+)": /gm)].map(([, name]) => name);
  assert.deepEqual(generated.sort(), [...vocabulary].sort());
});

test('each React component takes exactly its Screen IR contract props, with the same required props', async () => {
  for (const { name } of await components()) {
    const manifest = await contract(name);
    assert.ok(manifest.props && manifest.ir, `${name} has a render contract`);
    const { contract: props, host } = propsBlock(await source(`registry/syntari/${name}.tsx`), pascal(name));
    assert.deepEqual(props.map(item => item.prop).sort(), Object.keys(manifest.props).sort(), `${name} contract props`);
    for (const { prop, optional } of props) assert.equal(optional, !manifest.props[prop].required, `${name}.${prop} is ${manifest.props[prop].required ? 'required' : 'optional'}`);
    /* Host-only props never overlap the contract, so model output cannot set them through Screen IR. */
    for (const { prop } of host) assert.ok(!(prop in manifest.props), `${name}.${prop} is host-only`);
  }
});

test('each React component can send every action its contract declares', async () => {
  for (const { name } of await components()) {
    const code = await source(`registry/syntari/${name}.tsx`);
    const declared = Object.keys((await contract(name)).actions ?? {});
    const requested = new Set([...code.matchAll(/request\(([^,)]*)/g)].flatMap(([, argument]) => [...argument.matchAll(/'(\w+)'/g)].map(([, action]) => action)));
    for (const action of declared) assert.ok(requested.has(action), `${name} sends ${action}`);
    assert.equal(/useActionRequest[<(]/.test(code), declared.length > 0, `${name} sends requests only when it declares actions`);
  }
});

test('React sources import only React and the shared Syntari helpers, and never write markup', async () => {
  const files = ['registry/syntari/lib/syntari.tsx', ...(await components()).map(({ name }) => `registry/syntari/${name}.tsx`)];
  for (const file of files) {
    const code = await source(file);
    assert.ok(code.startsWith("'use client';"), `${file} is a client component`);
    for (const [, from] of code.matchAll(/from '([^']+)'/g)) assert.ok(['react', '@/registry/syntari/lib/syntari', '@/registry/syntari/lib/syntari-icons'].includes(from), `${file} imports ${from}`);
    assert.doesNotMatch(code, /dangerouslySetInnerHTML|innerHTML|eval\(/, `${file} never writes markup`);
  }
});

test('the registry build emits a shadcn index and self-contained items', async () => {
  const out = await mkdtemp(join(tmpdir(), 'syntari-react-registry-'));
  try {
    const manifest = await readManifest();
    await buildReactRegistry({ outDir: out });
    const index = JSON.parse(await readFile(join(out, 'registry.json'), 'utf8'));
    assert.equal(index.name, 'syntari');
    assert.equal(index.homepage, DEFAULT_SITE);
    assert.deepEqual(index.items.map(item => item.name), manifest.items.map(item => item.name));
    assert.deepEqual((await readdir(out)).sort(), ['registry.json', ...manifest.items.map(item => `${item.name}.json`)].sort());
    for (const entry of index.items) {
      const item = JSON.parse(await readFile(join(out, `${entry.name}.json`), 'utf8'));
      assert.equal(item.$schema, 'https://ui.shadcn.com/schema/registry-item.json');
      assert.ok(item.title && item.description, `${item.name} is described`);
      for (const file of item.files) assert.ok(file.content.length > 100, `${item.name} embeds ${file.path}`);
      if (item.type !== 'registry:component') continue;
      const component = await contract(item.name);
      assert.equal(item.title, component.name);
      assert.equal(item.description, component.purpose);
      assert.deepEqual(item.registryDependencies, [`${DEFAULT_SITE}/r/syntari.json`]);
      assert.equal(item.meta.contract, `${DEFAULT_SITE}/registry/components/${item.name}.json`);
    }
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
