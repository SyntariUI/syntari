import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getComponent, listComponents } from '../agent.mjs';

const PILOT = ['button', 'text-input', 'table', 'dialog', 'toast'];

test('the pilot components say when to use them, when not and what instead, their states, and what to do and not do', async () => {
  const ids = new Set((await listComponents()).map(item => item.id));
  for (const id of PILOT) {
    /* get_component is what an agent reads over MCP: guidance arrives with the rest of the manifest. */
    const { guidance: g, states } = await getComponent(id);
    assert.ok(g, `${id} has guidance`);
    assert.ok(g.useWhen.length >= 2 && g.avoidWhen.length >= 1 && g.dos.length >= 2 && g.donts.length >= 2, `${id} covers use, avoid, do, and don’t`);
    for (const item of g.avoidWhen) if (item.instead) assert.ok(ids.has(item.instead) && item.instead !== id, `${id} points to ${item.instead}, another registry component`);
    assert.deepEqual(states, g.states.map(state => state.id), `${id} lists its guidance states as its states`);
    for (const rule of [...g.dos, ...g.donts]) assert.ok(rule.why.length > 20, `${id}: every rule says why`);
    for (const rule of g.donts) assert.match(rule.text, /^Don’t /, `${id}: a don’t reads as one even on its own`);
  }
});

test('agents reading llms-full.txt get the same guidance people read in System', () => {
  const full = readFileSync('dist/llms-full.txt', 'utf8');
  const section = full.slice(full.indexOf('## Component guidance'));
  assert.ok(full.includes('## Component guidance'));
  for (const name of ['Button', 'Text input', 'Table', 'Dialog', 'Toast']) assert.ok(section.includes(`### ${name} (`), `${name} is in the guidance section`);
  assert.ok(section.includes('Use Confirmation dialog (`syntari.confirmation-dialog`).'), 'alternatives are named with their ids');
  assert.ok(section.includes('Don’t use a toast for errors or warnings. It vanishes before people can act'), 'each don’t carries its reason');
});
