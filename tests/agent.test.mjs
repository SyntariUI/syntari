import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { getPattern, getAgentPolicy, listComponents, listPatterns, validateScreen } from '../agent.mjs';

test('Node agent API exposes versioned patterns and validates Screen IR', async () => {
  assert.ok((await listComponents()).length > 100);
  assert.ok((await listPatterns()).some(pattern => pattern.id === 'approval-review'));
  assert.equal((await getAgentPolicy()).actions.default, 'deny');
  const pattern = await getPattern('approval-review');
  assert.equal((await validateScreen(pattern.screen)).ok, true);
  const invalid = structuredClone(pattern.screen);
  invalid.children[0].component = 'syntari.made-up';
  const result = await validateScreen(invalid);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(item => item.code === 'unknown-component'));
});

test('CLI validates an agent screen from a JSON file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'syntari-screen-'));
  const cli = join(process.cwd(), 'cli.mjs');
  try {
    const spec = (await getPattern('release-review')).screen;
    const file = join(dir, 'screen.json');
    await writeFile(file, JSON.stringify(spec));
    const result = JSON.parse(execFileSync(process.execPath, [cli, 'validate', '--spec', file, '--json'], { encoding: 'utf8' }));
    assert.equal(result.valid, true);
    spec.version = 'wrong';
    await writeFile(file, JSON.stringify(spec));
    const failed = spawnSync(process.execPath, [cli, 'validate', '--spec', file, '--json'], { encoding: 'utf8' });
    assert.equal(failed.status, 1);
    assert.ok(JSON.parse(failed.stdout).problems.some(problem => problem.includes('version')));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the published package ships no analytics', () => {
  const listing = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8' }));
  const files = listing[0].files.map(file => file.path);
  assert.ok(files.length > 100);
  for (const file of files) {
    if (!/\.(html|js|mjs|css|json)$/.test(file)) continue;
    assert.doesNotMatch(readFileSync(file, 'utf8'), /kobbe/i, `${file} must not load site analytics`);
  }
});

test('product sentence and component count match the registry everywhere they are published', async () => {
  const sentence = 'A design system for people and agents.';
  const count = (await listComponents()).length;
  const sources = {
    'README.md': readFileSync('README.md', 'utf8'),
    'package.json': JSON.parse(readFileSync('package.json', 'utf8')).description,
    'REFERENCE-COVERAGE.md': readFileSync('REFERENCE-COVERAGE.md', 'utf8'),
    'landing.html': readFileSync('landing.html', 'utf8')
  };
  for (const [name, text] of Object.entries(sources)) assert.ok(text.includes(sentence), `${name} must use the product sentence`);
  for (const name of ['README.md', 'package.json', 'REFERENCE-COVERAGE.md']) {
    /* "N components can be rendered" describes the Screen IR subset, not the catalogue size. */
    const stated = [...sources[name].matchAll(/(\d+) components(?! can)/g)].map(match => Number(match[1]));
    assert.ok(stated.length, `${name} must state the component count`);
    for (const value of stated) assert.equal(value, count, `${name} states ${value} components; the registry has ${count}`);
  }
});

test('every render contract ships a sample that validates as Screen IR', async () => {
  const components = await listComponents();
  let contracts = 0;
  for (const entry of components) {
    const manifest = JSON.parse(readFileSync(`kit/runtime/registry/components/${entry.id}.json`, 'utf8'));
    if (!(manifest.props && manifest.ir)) continue;
    contracts += 1;
    assert.ok(manifest.sample?.props, `${entry.id} needs a sample`);
    const result = await validateScreen({ type: 'screen', children: [{ id: `${entry.id}-sample`, component: `syntari.${entry.id}`, props: manifest.sample.props }] });
    assert.equal(result.ok, true, `${entry.id} sample: ${JSON.stringify(result.diagnostics)}`);
    assert.deepEqual(result.diagnostics.filter(item => item.severity === 'warning'), [], `${entry.id} sample raised warnings`);
  }
  assert.ok(contracts >= 31, `expected at least 31 render contracts, found ${contracts}`);
});

test('node ids are validated and must be unique', async () => {
  const node = { component: 'syntari.button', props: { label: 'Save' } };
  const duplicate = await validateScreen({ type: 'screen', children: [{ ...node, id: 'save' }, { ...node, id: 'save' }] });
  assert.ok(duplicate.diagnostics.some(item => item.code === 'duplicate-node-id'));
  const invalid = await validateScreen({ type: 'screen', children: [{ ...node, id: '../save' }] });
  assert.equal(invalid.ok, false);
});

test('icon props accept only the registry vocabulary', async () => {
  const message = icon => ({ type: 'screen', children: [{ id: 'reply', component: 'syntari.agent-message', props: { author: 'Agent', text: 'Hello', icon } }] });
  const codes = result => result.diagnostics.map(item => `${item.severity}:${item.code}`);
  assert.deepEqual(codes(await validateScreen(message('bot'))), []);
  assert.deepEqual(codes(await validateScreen(message('rocketship'))), ['warning:unknown-icon']);
  const injected = await validateScreen(message('"><svg onload=x>'));
  assert.equal(injected.ok, false);
  assert.deepEqual(codes(injected), ['error:invalid-icon']);
});

test('validation names the exact problem, at its own path, and stays fast on hostile specs', async () => {
  const codes = result => result.diagnostics.map(item => `${item.severity}:${item.code}:${item.path}`);
  const approval = { title: 'Run it?', question: 'Apply the change.', scope: 'billing' };
  assert.deepEqual(codes(await validateScreen({ type: 'screen', children: [{ component: 'syntari.tool-approval', props: approval }] })), ['warning:missing-node-id:children[0].id']);
  const empty = await validateScreen({ type: 'screen', children: [{ id: 'run', component: 'syntari.tool-approval', props: { ...approval, title: ' ' } }] });
  assert.deepEqual(codes(empty), ['error:empty-value:children[0].props.title']);
  const stray = await validateScreen({ type: 'screen', layout: 7, children: [{ id: 'run', component: 'syntari.tool-approval', props: approval, onClick: 'x' }] });
  assert.deepEqual(codes(stray).sort(), ['error:unknown-key:children[0].onClick', 'error:wrong-type:layout']);
  const table = await validateScreen({ type: 'screen', children: [{ component: 'syntari.table', props: { columns: [{ label: 'Tool' }, { label: 'Calls' }], rows: [['read_files', '412', 'extra']] } }] });
  assert.deepEqual(codes(table), ['warning:row-length:children[0].props.rows[0]']);
  let deep = { component: 'syntari.button', props: { label: 'Go' } };
  for (let i = 0; i < 400; i += 1) deep = { type: 'region', label: 'Level', children: [deep] };
  const started = performance.now();
  const result = await validateScreen({ type: 'screen', children: [deep] });
  assert.ok(performance.now() - started < 2000, 'a deep spec is rejected quickly');
  assert.ok(result.diagnostics.some(item => item.code === 'over-depth-budget'));
});

test('the CLI validates a screen with the same diagnostics as the Node API', async () => {
  const { mkdtemp, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { execFileSync } = await import('node:child_process');
  const screen = { type: 'screen', children: [{ id: 'reply', component: 'syntari.agent-message', props: { author: 'Agent', text: 'Hello', icon: 'rocketship' } }] };
  const file = join(await mkdtemp(join(tmpdir(), 'syntari-')), 'screen.json');
  await writeFile(file, JSON.stringify(screen));
  const cli = JSON.parse(execFileSync(process.execPath, ['cli.mjs', 'validate', '--spec', file, '--json'], { encoding: 'utf8' }));
  assert.deepEqual(cli.screen.diagnostics, (await validateScreen(screen)).diagnostics);
  const listed = JSON.parse(execFileSync(process.execPath, ['cli.mjs', 'list', '--json'], { encoding: 'utf8' }));
  assert.equal(listed.components.filter(item => item.renderable).length, 31);
});

test('pattern screens that agents copy validate without warnings', async () => {
  for (const pattern of (await listPatterns()).filter(item => item.screenMode)) {
    const { screen } = await getPattern(pattern.id);
    const result = await validateScreen(screen);
    assert.deepEqual(result.diagnostics, [], `${pattern.id} raised diagnostics`);
  }
});

test('validation covers unresolved subtrees, structure, empty lists, labels, and selection', async () => {
  const codes = result => result.diagnostics.map(item => `${item.severity}:${item.code}:${item.path}`);
  let deep = { component: 'syntari.button', props: { label: 'Go' } };
  for (let i = 0; i < 3000; i += 1) deep = { component: 'syntari.not-a-component', children: [deep] };
  const bypass = await validateScreen({ type: 'screen', children: [deep] });
  assert.ok(bypass.diagnostics.some(item => item.code === 'over-depth-budget'), 'an unresolved node cannot hide a deep subtree');
  const shape = await validateScreen({ type: 'screen', meta: 'x', children: [{ component: 'syntari.banner', slot: 5, props: { message: 'ok' }, provenance: { source: 'model', extra: 1 } }, { type: 'region', label: 'Evidence' }] });
  assert.deepEqual(codes(shape).sort(), ['error:missing-required:children[1].children', 'error:unknown-key:children[0].provenance.extra', 'error:wrong-type:children[0].slot', 'error:wrong-type:meta']);
  const lists = await validateScreen({ type: 'screen', children: [{ id: 'diff', component: 'syntari.file-diff', props: { file: 'a.css', lines: [] } }, { id: 'ask', component: 'syntari.prompt-input', props: { placeholder: '' } }] });
  assert.deepEqual(codes(lists), ['error:empty-list:children[0].props.lines']);
  const period = await validateScreen({ type: 'screen', children: [{ id: 'scope', component: 'syntari.filter-bar', props: { period: 'Last year', periods: [{ label: 'Last 7 days', value: '7d' }] } }] });
  assert.deepEqual(codes(period), ['warning:no-matching-item:children[0].props.period']);
});
