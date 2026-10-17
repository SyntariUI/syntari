import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/* The official MCP client talks to `syntari mcp` exactly as Claude Code, Cursor, or VS Code would. */
async function connect() {
  const client = new Client({ name: 'syntari-test', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: ['cli.mjs', 'mcp'], stderr: 'pipe' });
  await client.connect(transport);
  return client;
}

test('MCP server negotiates with the official client and lists read-only tools', async () => {
  const client = await connect();
  try {
    assert.equal(client.getServerVersion().name, 'syntari');
    assert.match(client.getInstructions(), /validate_screen/);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name).sort(), ['get_agent_policy', 'get_component', 'get_pattern', 'list_components', 'list_patterns', 'search_components', 'validate_screen']);
    for (const tool of tools) assert.equal(tool.annotations.readOnlyHint, true, `${tool.name} must be read-only`);
  } finally { await client.close(); }
});

test('an agent can discover a contract, compose from its sample, and validate the screen', async () => {
  const client = await connect();
  try {
    const renderable = (await client.callTool({ name: 'list_components', arguments: { category: 'Agents', renderable: true } })).structuredContent;
    assert.ok(renderable.components.some(item => item.id === 'prompt-input'));
    assert.ok(renderable.components.every(item => item.renderable));

    const search = (await client.callTool({ name: 'search_components', arguments: { query: 'approve' } })).structuredContent;
    assert.ok(search.results.some(item => item.id === 'tool-approval'));

    const contract = (await client.callTool({ name: 'get_component', arguments: { id: 'tool-approval' } })).structuredContent;
    assert.equal(contract.renderable, true);
    assert.equal(contract.actions.approve.consequential, true);
    assert.equal(contract.install, 'npx syntari add tool-approval');
    assert.ok(contract.icons.includes('terminal'), 'components with icon props carry the icon vocabulary');
    const plain = (await client.callTool({ name: 'get_component', arguments: { id: 'table' } })).structuredContent;
    assert.equal(plain.icons, undefined);

    const screen = { type: 'screen', children: [{ id: 'deploy', component: 'syntari.tool-approval', props: contract.sample.props }] };
    const valid = (await client.callTool({ name: 'validate_screen', arguments: { screen } })).structuredContent;
    assert.equal(valid.ok, true, JSON.stringify(valid.diagnostics));

    const invalid = (await client.callTool({ name: 'validate_screen', arguments: { screen: { type: 'screen', children: [{ component: 'syntari.made-up' }] } } })).structuredContent;
    assert.equal(invalid.ok, false);
    assert.ok(invalid.diagnostics.some(item => item.code === 'unknown-component'));

    const pattern = (await client.callTool({ name: 'get_pattern', arguments: { id: 'approval-review' } })).structuredContent;
    assert.equal((await client.callTool({ name: 'validate_screen', arguments: { screen: pattern.screen } })).structuredContent.ok, true);

    const policy = (await client.callTool({ name: 'get_agent_policy', arguments: {} })).structuredContent;
    assert.equal(policy.actions.default, 'deny');
  } finally { await client.close(); }
});

test('MCP tool errors are reported to the agent instead of crashing the server', async () => {
  const client = await connect();
  try {
    const missing = await client.callTool({ name: 'get_component', arguments: { id: 'wizard-hat' } });
    assert.equal(missing.isError, true);
    assert.match(missing.content[0].text, /search_components/);
    const badArgs = await client.callTool({ name: 'get_component', arguments: { id: '../etc/passwd' } });
    assert.equal(badArgs.isError, true);
    await assert.rejects(client.callTool({ name: 'delete_everything', arguments: {} }));
    assert.equal((await client.callTool({ name: 'list_patterns', arguments: {} })).structuredContent.count > 0, true);
  } finally { await client.close(); }
});

/* Clients that are not the official SDK still get JSON-RPC answers: batches, malformed requests, and parse errors. */
test('MCP server answers raw JSON-RPC edge cases without dying', async () => {
  const { spawn } = await import('node:child_process');
  const lines = [
    '[{"jsonrpc":"2.0","id":1,"method":"ping"},{"jsonrpc":"2.0","method":"notifications/initialized"},{"jsonrpc":"2.0","id":2,"method":"nope"}]',
    '{"jsonrpc":"2.0","id":3}',
    '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":null}',
    '[]',
    'not json',
    '{"jsonrpc":"2.0","id":5,"method":"ping"}'
  ];
  const child = spawn(process.execPath, ['cli.mjs', 'mcp'], { stdio: ['pipe', 'pipe', 'ignore'] });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stdin.end(`${lines.join('\n')}\n`);
  await new Promise(resolve => child.on('close', resolve));
  const replies = output.trim().split('\n').map(line => JSON.parse(line));
  const errorOf = reply => reply.error?.code;
  const batch = replies.find(Array.isArray);
  assert.deepEqual(batch.map(reply => [reply.id, errorOf(reply) ?? 'ok']), [[1, 'ok'], [2, -32601]]);
  /* Lines are answered as they finish, which JSON-RPC allows, so compare without order. */
  const single = replies.filter(reply => !Array.isArray(reply)).map(reply => `${reply.id}:${errorOf(reply) ?? 'ok'}`).sort();
  assert.deepEqual(single, ['3:-32600', '4:-32602', '5:ok', 'null:-32600', 'null:-32700']);
});
