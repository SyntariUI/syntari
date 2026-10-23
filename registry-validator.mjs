import { access, readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';

const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const exists = async path => { try { await access(path); return true; } catch { return false; } };
const safeId = id => typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
const semver = version => typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version);

const screenChecks = new Map();
/** "/children/0/props" becomes "children[0].props", the path form the runtime diagnostics use. */
const irPath = pointer => pointer.split('/').slice(1).reduce((path, part) => /^\d+$/.test(part) ? `${path}[${part}]` : path ? `${path}.${part}` : part, '') || 'spec';

export async function validateScreenSchema(spec, registryDir) {
  if (!screenChecks.has(registryDir)) screenChecks.set(registryDir, new Ajv({ allErrors: true, strict: false }).compile(await readJson(join(registryDir, 'schema/sui.schema.json'))));
  const check = screenChecks.get(registryDir);
  const valid = check(spec);
  /* The if/then branches add a summary error for every failed branch; the specific errors beneath them say what is wrong. */
  const details = valid ? [] : check.errors.filter(error => error.keyword !== 'if').map(error => {
    const extra = error.params?.additionalProperty ? ` ("${error.params.additionalProperty}")` : error.params?.allowedValues ? ` (${error.params.allowedValues.join(', ')})` : '';
    return { path: irPath(error.instancePath), message: `${error.message}${extra}` };
  });
  return { valid, details, problems: details.map(item => `${item.path}: ${item.message}`) };
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
    if ((manifest.actions || manifest.sample) && !(manifest.props && manifest.ir)) problems.push(`Actions and samples need a render contract: ${entry.id}`);
    for (const [name, action] of Object.entries(manifest.actions ?? {})) {
      if (!safeId(name)) problems.push(`Invalid action name for ${entry.id}: ${name}`);
      if (action.consequentialProp && manifest.props?.[action.consequentialProp]?.type !== 'boolean') problems.push(`consequentialProp for ${entry.id}.${name} must name a boolean prop`);
    }
    for (const [key, binding] of Object.entries(manifest.ir?.attributes ?? {})) for (const one of [].concat(binding)) {
      if (one.fallback && !(one.fallback in (manifest.props ?? {}))) problems.push(`Attribute fallback for ${entry.id}.${key} names an unknown prop: ${one.fallback}`);
    }
    for (const [key, binding] of Object.entries(manifest.ir?.select ?? {})) {
      if (!manifest.ir?.list?.[binding.list]) problems.push(`select for ${entry.id}.${key} names a list the contract does not bind: ${binding.list}`);
    }
    for (const [key, parts] of Object.entries(manifest.ir?.list ?? {})) for (const part of [].concat(parts)) {
      if (part.cellCount && manifest.props?.[part.cellCount]?.type !== 'array') problems.push(`cellCount for ${entry.id}.${key} must name an array prop`);
    }
    for (const [key, binding] of Object.entries(manifest.ir?.count ?? {})) {
      if (!manifest.props?.[key]?.items?.fields?.[binding.field]) problems.push(`count for ${entry.id}.${key} names a field its items do not have: ${binding.field}`);
    }
    for (const [key, binding] of Object.entries(manifest.ir?.matrix ?? {})) {
      if (manifest.props?.[binding.columns]?.type !== 'array') problems.push(`matrix.columns for ${entry.id}.${key} must name an array prop`);
      for (const role of ['unit', 'showValues', 'caption']) if (binding[role] !== undefined && !(binding[role] in (manifest.props ?? {}))) problems.push(`matrix.${role} for ${entry.id}.${key} must name a prop`);
    }
    for (const [key, binding] of Object.entries(manifest.ir?.tiles ?? {})) {
      if (manifest.props?.[key]?.items?.fields?.value?.type !== 'number') problems.push(`tiles for ${entry.id}.${key} need items with a number value`);
      if (binding.name !== undefined && !(binding.name in (manifest.props ?? {}))) problems.push(`tiles.name for ${entry.id}.${key} must name a prop`);
    }
    /* A field that follows another names an enum beside it, maps only that enum's values, and maps an icon field to icons the runtime ships. */
    for (const [key, prop] of Object.entries(manifest.props ?? {})) {
      if (prop.defaultFrom) problems.push(`defaultFrom for ${entry.id}.${key} is only read for fields of list items`);
      const fields = prop.items?.fields ?? {};
      const icons = new Set([].concat(manifest.ir?.list?.[key] ?? []).flatMap(part => Object.keys(part.icon ?? {})));
      for (const [name, field] of Object.entries(fields)) {
        if (!field.defaultFrom) continue;
        const source = fields[field.defaultFrom.field];
        if (source?.type !== 'enum' || source.defaultFrom) { problems.push(`defaultFrom for ${entry.id}.${key}.${name} must name an enum field of the same item that follows nothing`); continue; }
        for (const [from, to] of Object.entries(field.defaultFrom.values)) {
          if (!source.values.includes(from)) problems.push(`defaultFrom for ${entry.id}.${key}.${name} maps "${from}", which ${field.defaultFrom.field} does not allow`);
          if (icons.has(name) && !index.icons?.includes(to)) problems.push(`defaultFrom for ${entry.id}.${key}.${name} maps "${from}" to "${to}", which is not a Syntari icon`);
        }
      }
    }
    if (manifest.props && manifest.ir) {
      for (const [binding, value] of Object.entries(manifest.ir)) {
        if (binding === 'node' || binding === 'remove') continue;
        /* A computing contract maps its roles to props and its slots to selectors, so only the roles name props. */
        if (binding === 'compute') {
          for (const role of ['inputs', 'outputs', 'parts']) if (value[role] !== undefined && manifest.props[value[role]]?.type !== 'array') problems.push(`compute.${role} for ${entry.id} must name an array prop`);
          if (value.currency !== undefined && !(value.currency in manifest.props)) problems.push(`compute.currency for ${entry.id} must name a prop`);
          continue;
        }
        if (binding === 'sort') { if (manifest.props[value?.prop]?.type !== 'boolean') problems.push(`sort.prop for ${entry.id} must name a boolean prop`); continue; }
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
