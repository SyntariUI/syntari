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
