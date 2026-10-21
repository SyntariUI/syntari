/**
 * Syntari MCP server over stdio. Read-only: agents discover components and patterns, read contracts,
 * validate Screen IR, and check a proposed change to a screen. Nothing here writes files, renders, or performs an action.
 * Messages are newline-delimited JSON-RPC 2.0, as the MCP stdio transport specifies. No dependencies.
 */
import { createInterface } from 'node:readline';
import { readFile } from 'node:fs/promises';
import { listComponents, listPatterns, getPattern, getAgentPolicy, getComponent, searchRegistry, validateScreen, applyScreenOperations, assignIds, versionOf, assessScreen, getCompositionPolicy } from './agent.mjs';

const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));

const INSTRUCTIONS = `Syntari is a design system for people and agents. To build a screen:
1. Find components with search_components or list_components (renderable: true means it has a contract).
2. Read get_component for the contract: props, actions, rules, a valid sample, and the icon names icon props accept.
3. Compose Screen IR (see get_pattern for complete examples) and give interactive nodes an id.
4. Call validate_screen and repair every error before showing the screen.
Put the figures a screen shows in its "data" block (tables, measures, groups) and bind props to them with {"$data": ...}: the runtime computes every bound figure from the rows, and validation refuses a written figure that contradicts them.
Choose each visualization by the kind of data it shows (get_composition_policy), then call assess_composition: it reads the screen as the policy does and names redundant, misleading, or badly ordered parts. Name a visualization the registry does not have instead of imitating it.
To change a screen that already exists, never regenerate it: call prepare_screen once for its ids and version, propose insert, replace, move, and remove operations by node id (or one recompose for a request to rework the whole screen, which keeps its data and every record), and call apply_operations. Keep the last valid screen when it refuses the change.
Actions in a rendered screen are requests from a person. The host application decides whether anything runs; read get_agent_policy.`;

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const object = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const id = { type: 'string', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' };

const tools = {
  list_components: {
    title: 'List components',
    description: 'All Syntari components with category and whether they can be rendered from Screen IR. Filter by category or renderable.',
    inputSchema: object({ category: { type: 'string', description: 'Exact category, such as Agents or Data display.' }, renderable: { type: 'boolean', description: 'Only components with a render contract.' } }),
    async run({ category, renderable }) {
      const components = (await listComponents())
        .filter(item => category === undefined || item.category === category)
        .filter(item => renderable === undefined || Boolean(item.renderable) === renderable)
        .map(item => ({ id: item.id, name: item.name, category: item.category, renderable: Boolean(item.renderable), description: item.description }));
      return { count: components.length, components };
    }
  },
  search_components: {
    title: 'Search components and patterns',
    description: 'Find components and patterns whose name, category, description, or intents mention every word of the query.',
    inputSchema: object({ query: { type: 'string', minLength: 1, maxLength: 120 } }, ['query']),
    async run({ query }) {
      const results = await searchRegistry(query);
      return { query, count: results.length, results };
    }
  },
  get_component: {
    title: 'Get a component contract',
    description: 'The full manifest for one component: purpose, rules, accessibility, props, actions, a valid sample, and the install command.',
    inputSchema: object({ id: { ...id, description: 'Component id without the syntari. prefix, such as tool-approval.' } }, ['id']),
    async run({ id: componentId }) {
      const component = await getComponent(componentId);
      if (!component) throw new ToolError(`"${componentId}" is not a Syntari component. Use search_components to find one.`);
      return component;
    }
  },
  list_patterns: {
    title: 'List patterns',
    description: 'Layouts, AI behaviour patterns, and complete screen compositions with their component dependencies.',
    inputSchema: object(),
    async run() {
      const patterns = (await listPatterns()).map(({ id: patternId, name, type, description, status, dependencies }) => ({ id: patternId, name, type, description, status, dependencies }));
      return { count: patterns.length, patterns };
    }
  },
  get_pattern: {
    title: 'Get a pattern',
    description: 'One pattern. Screen compositions include a complete Screen IR example that validates.',
    inputSchema: object({ id }, ['id']),
    async run({ id: patternId }) {
      const pattern = await getPattern(patternId);
      if (!pattern) throw new ToolError(`"${patternId}" is not a Syntari pattern. Use list_patterns.`);
      return pattern;
    }
  },
  get_agent_policy: {
    title: 'Get the agent policy',
    description: 'The machine-readable boundary: what Screen IR validation controls, and why the host application owns every action.',
    inputSchema: object(),
    async run() { return getAgentPolicy(); }
  },
  validate_screen: {
    title: 'Validate Screen IR',
    description: 'Check a Screen IR spec against the schema and every component contract. Errors must be repaired before rendering; warnings describe repairs the renderer makes.',
    inputSchema: object({
      screen: { type: 'object', description: 'A Screen IR object: { "type": "screen", "children": [...] }.' },
      sandbox: { type: 'boolean', description: 'True only when the host has said it allows unverified blocks. Otherwise a sandbox node is an error.' }
    }, ['screen']),
    async run({ screen, sandbox }) { return validateScreen(screen, { sandbox: sandbox === true }); }
  },
  prepare_screen: {
    title: 'Prepare a screen for changes',
    description: 'Give every node of a Screen IR spec a stable id (ids already written stay) and return its version. A change names that version as its base and its nodes by these ids.',
    inputSchema: object({ screen: { type: 'object', description: 'A Screen IR object: { "type": "screen", "children": [...] }.' } }, ['screen']),
    async run({ screen }) { const prepared = assignIds(screen); return { screen: prepared, version: versionOf(prepared) }; }
  },
  assess_composition: {
    title: 'Assess a screen\'s composition',
    description: 'Read a Screen IR spec as the composition policy does: the pattern it reads as, each part\'s kind of data and how its component fits it, and advice on redundancy, hierarchy, density, and readability; for screen data, which visualization fits each table, measure, and group. Advice is a judgment; validation decides what renders.',
    inputSchema: object({ screen: { type: 'object', description: 'A Screen IR object.' }, sandbox: { type: 'boolean', description: 'True only when the host allows unverified blocks.' } }, ['screen']),
    async run({ screen, sandbox }) { return assessScreen(screen, { sandbox: sandbox === true }); }
  },
  get_composition_policy: {
    title: 'Get the composition policy',
    description: 'Which visualization fits which kind of data (time series, composition, ordered buckets, category comparison, records, headline measures), which are misleading, which Syntari does not have, and the order each kind of screen follows.',
    inputSchema: object(),
    async run() { return getCompositionPolicy(); }
  },
  apply_operations: {
    title: 'Apply operations to a screen',
    description: 'Apply a proposed change { "version": "syntari-ops-1", "base", "summary"?, "operations": [...] } to one version of a screen. insert { op, parent?, after? | before?, node }, replace { op, target, set: { "props.<prop>": value } } or { op, target, node }, replace { op, target: "data", set: { "measures.<name>" | "groups.<name>": definition } }, move { op, target, parent?, after? | before? }, remove { op, target }, or recompose { op, screen } alone. Refuses a stale base, anything outside the declared scopes, changes to existing data without allowDataChanges, figures without a source in strict mode, a recomposition that drops a row or a record, and any new validation error. A change may carry clarify, needs, or unsupported instead of operations. Returns the new screen, or ok: false and spec: null with the reasons. Nothing is stored or rendered.',
    inputSchema: object({
      screen: { type: 'object', description: 'The screen the change was written against, with ids from prepare_screen.' },
      change: { type: 'object', description: 'The proposed change.', required: ['version', 'base'], properties: {
        version: { const: 'syntari-ops-1' }, base: { type: 'string' }, summary: { type: 'string' },
        operations: { type: 'array', maxItems: 20, items: { type: 'object', required: ['op'], properties: { op: { enum: ['insert', 'replace', 'move', 'remove', 'recompose'] }, target: { type: 'string' }, parent: { type: 'string' }, after: { type: 'string' }, before: { type: 'string' }, node: { type: 'object' }, set: { type: 'object' }, screen: { type: 'object' }, reason: { type: 'string' } } } },
        clarify: { type: 'object' }, needs: { type: 'array' }, unsupported: { type: 'array' }
      } },
      data: { type: 'string', description: '"strict" (default): a figure that is neither on the screen nor in sources is refused. "demo": it is reported, for screens labelled as demonstration data.' },
      sources: { type: 'array', description: 'Data the host provides. Its figures count as sourced.' },
      allowDataChanges: { type: 'boolean', description: 'True only after a person confirmed the data changes a previous result listed in authorization.' },
      sandbox: { type: 'boolean', description: 'True only when the host allows unverified blocks.' }
    }, ['screen', 'change']),
    async run({ screen, change, data, sources, allowDataChanges, sandbox }) {
      if (data !== undefined && !['strict', 'demo'].includes(data)) throw new ToolError('data is "strict" or "demo".');
      const result = await applyScreenOperations(screen, change, { data, sources, allowDataChanges: allowDataChanges === true, sandbox: sandbox === true });
      /* The full validation is summarised: its diagnostics already appear in result.diagnostics where the change caused them. */
      return { ...result, validation: result.validation ? { ok: result.validation.ok } : null };
    }
  }
};

class ToolError extends Error {}

/** Check arguments against the small JSON Schema subset the tool definitions use. */
function checkArguments(schema, args) {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return 'Arguments must be an object.';
  for (const key of schema.required ?? []) if (args[key] === undefined) return `Missing required argument "${key}".`;
  for (const [key, value] of Object.entries(args)) {
    const rule = schema.properties?.[key];
    if (!rule) return `Unknown argument "${key}".`;
    const actual = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
    if (rule.type !== actual) return `"${key}" must be a ${rule.type}.`;
    if (rule.type === 'string' && rule.pattern && !new RegExp(rule.pattern).test(value)) return `"${key}" has an invalid format.`;
    if (rule.type === 'string' && (value.length < (rule.minLength ?? 0) || value.length > (rule.maxLength ?? Infinity))) return `"${key}" has an invalid length.`;
  }
  return null;
}

async function callTool(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) throw Object.assign(new Error('tools/call needs params with a tool name.'), { code: -32602 });
  const { name, arguments: args = {} } = params;
  const tool = tools[name];
  if (!tool) throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
  const problem = checkArguments(tool.inputSchema, args);
  if (problem) return { content: [{ type: 'text', text: problem }], isError: true };
  try {
    const result = await tool.run(args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result };
  } catch (error) {
    if (error instanceof ToolError) return { content: [{ type: 'text', text: error.message }], isError: true };
    throw error;
  }
}

async function handle(message) {
  switch (message.method) {
    case 'initialize': {
      const requested = message.params?.protocolVersion;
      return {
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'syntari', title: 'Syntari', version: pkg.version },
        instructions: INSTRUCTIONS
      };
    }
    case 'ping': return {};
    case 'tools/list': return { tools: Object.entries(tools).map(([name, { title, description, inputSchema }]) => ({ name, title, description, inputSchema, annotations: readOnly })) };
    case 'tools/call': return callTool(message.params);
    default: throw Object.assign(new Error(`Method not found: ${message.method}`), { code: -32601 });
  }
}

/** Answer one JSON-RPC message. Returns undefined for notifications and replies, which need no answer. */
async function answer(message) {
  const reply = payload => ({ jsonrpc: '2.0', ...payload });
  if (!message || typeof message !== 'object' || Array.isArray(message)) return reply({ id: null, error: { code: -32600, message: 'Invalid Request' } });
  const hasId = message.id !== undefined && message.id !== null;
  if (typeof message.method !== 'string') return hasId && !('result' in message) && !('error' in message) ? reply({ id: message.id, error: { code: -32600, message: 'Invalid Request: method is required.' } }) : undefined;
  if (!hasId) return undefined; // Notifications such as notifications/initialized need no reply.
  try { return reply({ id: message.id, result: await handle(message) }); }
  catch (error) { return reply({ id: message.id, error: { code: error.code ?? -32603, message: error.code ? error.message : 'Internal error' } }); }
}

export function serve({ input = process.stdin, output = process.stdout } = {}) {
  const send = payload => { if (payload !== undefined) output.write(`${JSON.stringify(payload)}\n`); };
  const lines = createInterface({ input, crlfDelay: Infinity });
  lines.on('line', async line => {
    if (!line.trim()) return;
    let message;
    try { message = JSON.parse(line); } catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); return; }
    if (!Array.isArray(message)) { send(await answer(message)); return; }
    /* Batches, which 2025-03-26 clients may send: answer each request, and nothing for an all-notification batch. */
    if (!message.length) { send({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request: empty batch.' } }); return; }
    const replies = (await Promise.all(message.map(answer))).filter(Boolean);
    if (replies.length) send(replies);
  });
  return new Promise(resolve => lines.on('close', resolve));
}
