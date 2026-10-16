/**
 * Syntari MCP server over stdio. Read-only: agents discover components and patterns, read contracts,
 * and validate Screen IR. Nothing here writes files, renders, or performs an action.
 * Messages are newline-delimited JSON-RPC 2.0, as the MCP stdio transport specifies. No dependencies.
 */
import { createInterface } from 'node:readline';
import { readFile } from 'node:fs/promises';
import { listComponents, listPatterns, getPattern, getAgentPolicy, getComponent, searchRegistry, validateScreen } from './agent.mjs';

const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));

const INSTRUCTIONS = `Syntari is a design system for people and agents. To build a screen:
1. Find components with search_components or list_components (renderable: true means it has a contract).
2. Read get_component for the contract: props, actions, rules, and a valid sample.
3. Compose Screen IR (see get_pattern for complete examples) and give interactive nodes an id.
4. Call validate_screen and repair every error before showing the screen.
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
    inputSchema: object({ screen: { type: 'object', description: 'A Screen IR object: { "type": "screen", "children": [...] }.' } }, ['screen']),
    async run({ screen }) { return validateScreen(screen); }
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

async function callTool({ name, arguments: args = {} } = {}) {
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

export function serve({ input = process.stdin, output = process.stdout } = {}) {
  const send = payload => output.write(`${JSON.stringify({ jsonrpc: '2.0', ...payload })}\n`);
  const lines = createInterface({ input, crlfDelay: Infinity });
  lines.on('line', async line => {
    if (!line.trim()) return;
    let message;
    try { message = JSON.parse(line); } catch { send({ id: null, error: { code: -32700, message: 'Parse error' } }); return; }
    const isRequest = message && message.id !== undefined && message.id !== null && typeof message.method === 'string';
    if (!isRequest) return; // Notifications such as notifications/initialized need no reply.
    try { send({ id: message.id, result: await handle(message) }); }
    catch (error) { send({ id: message.id, error: { code: error.code ?? -32603, message: error.message } }); }
  });
  return new Promise(resolve => lines.on('close', resolve));
}
