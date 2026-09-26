#!/usr/bin/env node
import { access, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRegistry, validateScreenSchema } from './registry-validator.mjs';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const kitRoot = join(packageRoot, 'kit');
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const cleanArgs = args.filter((arg) => arg !== '--json');
const usage = `Syntari UI

  syntari list [--json]
  syntari search <query> [--json]
  syntari info <name> [--json]
  syntari doctor [--dir <path>] [--json]
  syntari validate [--dir <path>] [--spec <screen.json>] [--json]
  syntari registry [<component>|policy] [--json]
  syntari patterns [--json]
  syntari add <component...> [--dir <path>] [--json]

Use npm install syntari-ui for the CLI and trusted component runtime.`;

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}
async function firstExisting(paths) {
  for (const path of paths) if (await exists(path)) return path;
  return paths[0];
}
async function getPackage() {
  try { return await readJson(join(packageRoot, 'package.json')); }
  catch { return { name: 'syntari-ui', version: '0.0.0' }; }
}
async function getRegistryDir() {
  return firstExisting([join(kitRoot, 'runtime', 'registry'), join(packageRoot, 'registry')]);
}
async function getRegistry() {
  return readJson(join(await getRegistryDir(), 'index.json'));
}
async function getCatalog(registry) {
  try { return await readJson(join(kitRoot, 'catalog.json')); }
  catch { return registry.components ?? []; }
}
async function getPatterns() {
  return readJson(join(await getRegistryDir(), 'patterns', 'index.json'));
}
function emit(data) {
  if (jsonOutput) console.log(JSON.stringify(data, null, 2));
  else if (typeof data === 'string') console.log(data);
  else console.log(JSON.stringify(data, null, 2));
}
function fail(message, code = 'SYNTARI_ERROR') {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function safeId(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
function parseOptions(argv, { allowSpec = false } = {}) {
  const values = [];
  let dir;
  let spec;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dir') {
      dir = argv[++i];
      if (!dir) fail('--dir requires a path.', 'INVALID_ARGUMENT');
    } else if (argv[i] === '--spec' && allowSpec) {
      spec = argv[++i];
      if (!spec) fail('--spec requires a JSON file.', 'INVALID_ARGUMENT');
    } else if (argv[i].startsWith('-')) fail(`Unknown option: ${argv[i]}`, 'INVALID_ARGUMENT');
    else values.push(argv[i]);
  }
  return { values, dir, spec };
}
async function componentDetails(id, registry, catalog, patternIndex) {
  const entry = (registry.components ?? []).find((item) => item.id === id);
  const pattern = (patternIndex.patterns ?? []).find((item) => item.id === id);
  const catalogEntry = catalog.find((item) => item.slug === id || item.id === id);
  if (!entry && !catalogEntry && !pattern) fail(`Unknown registry entry “${id}”. Run syntari search <query>.`, 'NOT_FOUND');
  const base = await getRegistryDir();
  let manifest = null;
  if (entry?.manifest) {
    const manifestPath = resolve(base, entry.manifest);
    if (manifestPath.startsWith(base + sep) && await exists(manifestPath)) manifest = await readJson(manifestPath);
  }
  const files = [];
  const kind = pattern ? 'pattern' : 'component';
  const requestedFiles = pattern?.files ?? ['js', 'html'].map((ext) => `components/${id}.${ext}`);
  for (const file of requestedFiles) {
    const path = pattern ? join(kitRoot, 'patterns', `${id}.${file.endsWith('.css') ? 'css' : 'js'}`) : join(kitRoot, file);
    if (await exists(path)) files.push(file);
  }
  return {
    ...(entry ?? pattern ?? {}),
    kind,
    name: entry?.name ?? catalogEntry?.name ?? pattern?.name,
    category: entry?.category ?? catalogEntry?.category,
    packageVersion: (await getPackage()).version,
    registryVersion: registry.version,
    preview: pattern?.preview ?? entry?.preview ?? `https://syntariui.giovanitier.com/components/${id}/`,
    manifest: manifest ?? undefined,
    dependencies: manifest?.dependencies ?? pattern?.dependencies ?? [],
    tokens: manifest?.tokens ?? entry?.tokens ?? pattern?.tokens ?? [],
    examples: manifest?.examples ?? pattern?.examples ?? {},
    ...(pattern?.screenMode ? { screen: (await readJson(join(base, 'patterns', 'screens.json')))[pattern.screenMode] } : {}),
    files: files.length ? files : requestedFiles,
    installable: pattern ? Boolean(pattern.installable && files.length === requestedFiles.length) : files.includes(`components/${id}.js`) && files.includes(`components/${id}.html`)
  };
}
async function checkInstallation(dir, packageVersion, registryVersion) {
  const root = resolve(dir);
  const checks = [];
  const markerPath = join(root, 'syntari.json');
  let marker;
  try { marker = await readJson(markerPath); } catch {}
  const markerOk = marker?.version === packageVersion && marker?.registryVersion === registryVersion;
  checks.push({ name: 'installation marker', ok: markerOk, detail: markerOk ? `Syntari ${marker.version}` : `expected Syntari ${packageVersion} and registry ${registryVersion}; installation marker is missing or stale` });
  const runtime = join(root, 'runtime');
  for (const file of ['syntari.js', 'tokens.css', 'styles.css']) {
    checks.push({ name: `runtime/${file}`, ok: await exists(join(runtime, file)), detail: await exists(join(runtime, file)) ? 'present' : 'missing' });
  }
  return { root, checks, ok: checks.every((check) => check.ok) };
}

async function main() {
  const [command, ...rest] = cleanArgs;
  if (!command || command === 'help' || command === '--help' || command === '-h') return emit(usage);
  const pkg = await getPackage();
  const registry = await getRegistry();
  const catalog = await getCatalog(registry);
  const patternIndex = await getPatterns();

  if (command === 'list') {
    const items = catalog.map((item) => ({
      id: item.slug ?? item.id, name: item.name, category: item.category,
      description: item.description, status: item.status ?? 'available'
    })).sort((a, b) => a.id.localeCompare(b.id));
    return emit(jsonOutput ? { version: pkg.version, count: items.length, components: items } : items.map((item) => `${item.id.padEnd(30)} ${item.category}`).join('\n'));
  }
  if (command === 'search') {
    const { values } = parseOptions(rest);
    const query = values.join(' ').trim().toLocaleLowerCase();
    if (!query) fail('Provide a search query, for example: syntari search dashboard.', 'INVALID_ARGUMENT');
    const components = catalog.filter((item) => [item.slug, item.id, item.name, item.category, item.description].join(' ').toLocaleLowerCase().includes(query))
      .map((item) => ({ id: item.slug ?? item.id, kind: 'component', name: item.name, category: item.category, description: item.description }));
    const patterns = (patternIndex.patterns ?? []).filter((item) => [item.id, item.name, item.type, item.description, ...(item.keywords ?? [])].join(' ').toLocaleLowerCase().includes(query))
      .map((item) => ({ id: item.id, kind: 'pattern', name: item.name, category: item.type, description: item.description }));
    const items = [...components, ...patterns].sort((a, b) => a.id.localeCompare(b.id));
    return emit(jsonOutput ? { query, count: items.length, results: items } : items.length ? items.map((item) => `${item.id} — ${item.name} (${item.kind})\n  ${item.description ?? ''}`).join('\n') : 'No matching registry entries.');
  }
  if (command === 'info') {
    const { values } = parseOptions(rest);
    if (values.length !== 1 || !safeId(values[0])) fail('Provide one component name.', 'INVALID_ARGUMENT');
    return emit(await componentDetails(values[0], registry, catalog, patternIndex));
  }
  if (command === 'registry') {
    const { values } = parseOptions(rest);
    if (values.length > 1) fail('Use syntari registry [component].', 'INVALID_ARGUMENT');
    if (values[0] === 'policy') return emit(await readJson(join(await getRegistryDir(), 'agent-policy.json')));
    if (values[0]) return emit(await componentDetails(values[0], registry, catalog, patternIndex));
    return emit(registry);
  }
  if (command === 'patterns') {
    const registryDir = await getRegistryDir();
    const patternsPath = join(registryDir, 'patterns', 'index.json');
    const patterns = await readJson(patternsPath);
    return emit(patterns);
  }
  if (command === 'doctor') {
    const { dir } = parseOptions(rest);
    const registryOk = Array.isArray(registry.components) && registry.components.length > 0;
    const contracts = await validateRegistry(await getRegistryDir(), kitRoot, pkg.version);
    const checks = [
      { name: 'Node.js version', ok: Number(process.versions.node.split('.')[0]) >= 22, detail: `${process.version} (requires Node.js 22+)` },
      { name: 'CLI package version', ok: Boolean(pkg.version), detail: pkg.version },
      { name: 'component registry', ok: registryOk, detail: registryOk ? `${registry.components.length} components · ${registry.version}` : 'registry index missing or empty' },
      { name: 'pattern registry', ok: await exists(join(await getRegistryDir(), 'patterns', 'index.json')), detail: await exists(join(await getRegistryDir(), 'patterns', 'index.json')) ? 'present' : 'missing' },
      { name: 'packaged component catalog', ok: await exists(join(kitRoot, 'catalog.json')), detail: await exists(join(kitRoot, 'catalog.json')) ? `${catalog.length} entries` : 'missing' },
      { name: 'registry contracts', ok: contracts.valid, detail: contracts.valid ? `${contracts.componentCount} components and ${contracts.patternCount} patterns validated` : contracts.problems.slice(0, 3).join('; ') }
    ];
    if (dir) checks.push(...(await checkInstallation(dir, pkg.version, registry.version)).checks);
    const ok = checks.every((check) => check.ok);
    if (!ok) process.exitCode = 1;
    return emit(jsonOutput ? { ok, checks } : checks.map((check) => `${check.ok ? '✓' : '✗'} ${check.name}: ${check.detail}`).join('\n'));
  }
  if (command === 'validate') {
    const { dir, spec } = parseOptions(rest, { allowSpec: true });
    const result = await validateRegistry(await getRegistryDir(), kitRoot, pkg.version);
    let install;
    if (dir) {
      install = await checkInstallation(dir, pkg.version, registry.version);
      for (const check of install.checks) if (!check.ok) result.problems.push(`${check.name}: ${check.detail}`);
    }
    if (spec) {
      const screen = await readJson(resolve(spec));
      const { validate } = await import('./kit/runtime/ir.js');
      const registryDir = await getRegistryDir();
      const screenSchema = await validateScreenSchema(screen, registryDir);
      if (!screenSchema.valid) result.problems.push(...screenSchema.problems.map(problem => `Screen schema ${problem}`));
      const entries = new Map(registry.components.map(entry => [entry.id, entry]));
      result.screen = await validate(screen, { registry: {
        entries,
        manifest: async slug => entries.has(slug) ? readJson(join(registryDir, 'components', `${slug}.json`)) : null
      } });
      if (!result.screen.ok) result.problems.push(...result.screen.diagnostics.filter(item => item.severity === 'error').map(item => `${item.path}: ${item.code}: ${item.message}`));
    }
    result.valid = result.problems.length === 0;
    if (install) result.installation = install;
    if (!result.valid) {
      if (jsonOutput) { process.exitCode = 1; return emit(result); }
      fail(result.problems.join('\n'), 'VALIDATION_FAILED');
    }
    return emit(jsonOutput ? result : `Registry valid: ${result.componentCount} components, ${result.patternCount} patterns (Syntari ${result.version}).`);
  }
  if (command === 'add') {
    const { values: names, dir } = parseOptions(rest);
    const output = dir ?? './components/syntari';
    if (!names.length) fail('Choose at least one component or installable pattern.', 'INVALID_ARGUMENT');
    const patterns = patternIndex.patterns ?? [];
    for (const name of names) if (!safeId(name) || (!catalog.some((item) => (item.slug ?? item.id) === name) && !patterns.some((item) => item.id === name && item.installable))) fail(`Unknown or non-installable entry: ${name}. Run syntari list or syntari patterns.`, 'NOT_FOUND');
    const target = resolve(output);
    const markerPath = join(target, 'syntari.json');
    if (await exists(target)) {
      let marker;
      try { marker = await readJson(markerPath); } catch {}
      if (!marker || marker.version !== pkg.version || marker.registryVersion !== registry.version) fail('Destination exists and is not a matching Syntari installation. Choose a new --dir.', 'DESTINATION_CONFLICT');
      if (!(await checkInstallation(target, pkg.version, registry.version)).ok) fail('Destination has missing or stale runtime files. Run syntari doctor --dir <path> and repair it before adding components.', 'INSTALLATION_INVALID');
    }
    for (const name of names) {
      const pattern = patterns.find((item) => item.id === name && item.installable);
      const files = pattern ? pattern.files : ['js', 'html'].map((ext) => `${name}.${ext}`);
      for (const file of files) {
        const source = pattern ? join(kitRoot, 'patterns', `${name}.${file.endsWith('.css') ? 'css' : 'js'}`) : join(kitRoot, 'components', file);
        if (await exists(join(target, file))) fail(`${file} already exists. Existing files were preserved.`, 'DESTINATION_CONFLICT');
        if (!await exists(source)) fail(`Packaged file is missing: ${file}. Run syntari doctor.`, 'PACKAGE_INCOMPLETE');
      }
    }
    if (!(await exists(target))) {
      await mkdir(target, { recursive: true });
      await cp(join(kitRoot, 'runtime'), join(target, 'runtime'), { recursive: true, errorOnExist: true, force: false });
      await writeFile(markerPath, JSON.stringify({ version: pkg.version, registryVersion: registry.version }, null, 2) + '\n');
    }
    for (const name of names) {
      const pattern = patterns.find((item) => item.id === name && item.installable);
      const files = pattern ? pattern.files : ['js', 'html'].map((ext) => `${name}.${ext}`);
      for (const file of files) {
        const source = pattern ? join(kitRoot, 'patterns', `${name}.${file.endsWith('.css') ? 'css' : 'js'}`) : join(kitRoot, 'components', file);
        await cp(source, join(target, file), { errorOnExist: true, force: false });
      }
    }
    return emit(jsonOutput ? { ok: true, version: pkg.version, components: names, directory: target } : `Added ${names.join(', ')} to ${target}.`);
  }
  fail(`Unknown command: ${command}.\n\n${usage}`, 'INVALID_COMMAND');
}

main().catch((error) => {
  if (jsonOutput) console.error(JSON.stringify({ ok: false, error: error.message, code: error.code ?? 'SYNTARI_ERROR' }));
  else console.error(`Syntari: ${error.message}`);
  process.exitCode = 1;
});
