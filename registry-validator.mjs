import { access, readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';

const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const exists = async path => { try { await access(path); return true; } catch { return false; } };
const safeId = id => typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
const semver = version => typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version);

export async function validateScreenSchema(spec, registryDir) {
  const schema = await readJson(join(registryDir, 'schema/sui.schema.json'));
  const check = new Ajv({ allErrors: true, strict: false }).compile(schema);
  const valid = check(spec);
  return { valid, problems: valid ? [] : check.errors.map(error => `${error.instancePath || '/'}: ${error.message}`) };
}

export async function validateRegistry(registryDir, kitDir, packageVersion) {
  const problems = [];
  const index = await readJson(join(registryDir, 'index.json'));
  const patterns = await readJson(join(registryDir, 'patterns/index.json'));
  const primitive = await readJson(join(registryDir, 'tokens/primitive.json'));
  const semantic = await readJson(join(registryDir, 'tokens/semantic.json'));
  const policy = await readJson(join(registryDir, 'agent-policy.json'));
  const componentSchema = await readJson(join(registryDir, 'schema/component.schema.json'));
  const patternSchema = await readJson(join(registryDir, 'schema/patterns.schema.json'));
  const runtimeTokens = await readFile(join(kitDir, 'runtime/tokens.css'), 'utf8');
  const checkComponent = new Ajv({ allErrors: true, strict: false }).compile(componentSchema);
  const checkPatterns = new Ajv2020({ allErrors: true, strict: false }).compile(patternSchema);
  if (!checkPatterns(patterns)) problems.push(...checkPatterns.errors.map(error => `Pattern registry ${error.instancePath || '/'}: ${error.message}`));
  for (const [name, value] of [['component index', index], ['pattern index', patterns], ['primitive tokens', primitive], ['semantic tokens', semantic], ['agent policy', policy]]) {
    if (!semver(value.version) || value.version !== packageVersion) problems.push(`${name} version ${value.version} does not match package ${packageVersion}`);
  }
  if (policy.screenIR?.requiresValidation !== true || policy.screenIR?.onError !== 'reject') problems.push('Agent policy must reject invalid Screen IR.');
  if (policy.actions?.default !== 'deny' || policy.actions?.modelAuthoredApprovalIsAuthorization !== false) problems.push('Agent policy must leave action authorization with the host.');
  for (const ref of [policy.screenIR?.schema, policy.screenIR?.componentIndex, policy.screenIR?.patternIndex]) {
    if (!ref || !await exists(join(registryDir, ref))) problems.push(`Missing agent policy reference: ${ref}`);
  }
  if (!Array.isArray(index.components) || !index.components.length) problems.push('Component index is missing or empty.');
  const ids = new Set();
  const componentEntries = Array.isArray(index.components) ? index.components : [];
  for (const entry of componentEntries) {
    if (!safeId(entry.id)) { problems.push(`Invalid component id: ${entry.id}`); continue; }
    if (ids.has(entry.id)) problems.push(`Duplicate component id: ${entry.id}`);
    ids.add(entry.id);
    if (!entry.name || !entry.category || !entry.manifest || !entry.source) problems.push(`Incomplete component entry: ${entry.id}`);
    if (entry.version !== packageVersion) problems.push(`Component index version mismatch: ${entry.id}`);
    const path = resolve(registryDir, entry.manifest ?? '');
    if (!path.startsWith(resolve(registryDir) + sep) || !await exists(path)) { problems.push(`Missing or unsafe manifest: ${entry.id}`); continue; }
    let manifest;
    try { manifest = await readJson(path); }
    catch (error) { problems.push(`Invalid manifest JSON: ${entry.id}: ${error.message}`); continue; }
    if (!checkComponent(manifest)) problems.push(...checkComponent.errors.map(error => `${entry.id}${error.instancePath || '/'}: ${error.message}`));
    if (manifest.id !== entry.id) problems.push(`Manifest id mismatch: ${entry.id}`);
    if (manifest.status !== entry.status) problems.push(`Manifest status mismatch: ${entry.id}`);
    for (const dependency of manifest.dependencies ?? []) if (!componentEntries.some(item => item.id === dependency)) problems.push(`Unknown component dependency for ${entry.id}: ${dependency}`);
    for (const token of manifest.tokens ?? []) if (!(token in semantic.tokens) && !(token.startsWith('--') && runtimeTokens.includes(`${token}:`))) problems.push(`Unknown token for ${entry.id}: ${token}`);
    if (Boolean(manifest.props) !== Boolean(manifest.ir)) problems.push(`Incomplete render contract: ${entry.id} needs both props and ir.`);
    if (manifest.props && manifest.ir) {
      for (const [binding, value] of Object.entries(manifest.ir)) {
        if (binding === 'node') continue;
        for (const prop of Object.keys(value ?? {})) if (!(prop in manifest.props)) problems.push(`Unknown render binding ${entry.id}.${prop}`);
      }
    }
    for (const file of entry.files ?? []) {
      if (!file.startsWith('kit/') || !await exists(join(kitDir, file.slice(4)))) problems.push(`Missing packaged file for ${entry.id}: ${file}`);
    }
  }
  const patternIds = new Set();
  const screenPath = join(registryDir, 'patterns/screens.json');
  const screens = await exists(screenPath) ? await readJson(screenPath) : {};
  for (const pattern of Array.isArray(patterns.patterns) ? patterns.patterns : []) {
    if (!safeId(pattern.id)) { problems.push(`Invalid pattern id: ${pattern.id}`); continue; }
    if (patternIds.has(pattern.id)) problems.push(`Duplicate pattern id: ${pattern.id}`);
    patternIds.add(pattern.id);
    for (const dependency of pattern.dependencies ?? []) if (!ids.has(dependency) && !patternIds.has(dependency)) problems.push(`Unknown dependency for ${pattern.id}: ${dependency}`);
    for (const token of pattern.tokens ?? []) if (!(token in semantic.tokens)) problems.push(`Unknown semantic token for ${pattern.id}: ${token}`);
    if (pattern.screenMode) {
      const screen = screens[pattern.screenMode];
      if (!screen) problems.push(`Missing Screen IR for ${pattern.id}: ${pattern.screenMode}`);
      else {
        const check = await validateScreenSchema(screen, registryDir);
        if (!check.valid) problems.push(...check.problems.map(problem => `${pattern.id} Screen IR ${problem}`));
        const used = new Set();
        const visit = node => { if (node.component) used.add(node.component.replace(/^syntari\./, '')); for (const child of node.children ?? []) visit(child); };
        for (const child of screen.children ?? []) visit(child);
        for (const component of used) if (!pattern.dependencies?.includes(component)) problems.push(`Unlisted Screen IR dependency for ${pattern.id}: ${component}`);
      }
    }
    if (pattern.installable) for (const file of pattern.files ?? []) {
      if (!safeId(pattern.id) || !/^[a-z0-9-]+\.(js|css)$/.test(file) || !await exists(join(kitDir, 'patterns', file))) problems.push(`Missing packaged pattern file: ${pattern.id}/${file}`);
    }
  }
  for (const [name, token] of Object.entries(semantic.tokens ?? {})) if (!(token.primitive in primitive.values)) problems.push(`Unknown primitive for ${name}: ${token.primitive}`);
  return { valid: problems.length === 0, version: index.version, componentCount: ids.size, patternCount: patternIds.size, problems };
}
