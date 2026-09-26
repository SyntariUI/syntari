import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve('.');
const cli = join(root, 'cli.mjs');
function run(...args) {
  return execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
}
test('machine-readable discovery and validation commands work', () => {
  const list = JSON.parse(run('list', '--json'));
  assert.ok(list.count > 0);
  assert.ok(list.components.some((item) => item.id === 'button'));
  assert.ok(JSON.parse(run('search', 'action', '--json')).count > 0);
  assert.equal(JSON.parse(run('info', 'button', '--json')).id, 'button');
  const patterns = JSON.parse(run('patterns', '--json'));
  assert.ok(patterns.patterns.some((pattern) => pattern.id === 'app-shell' && pattern.installable));
  assert.equal(JSON.parse(run('registry', 'policy', '--json')).actions.default, 'deny');
  assert.equal(JSON.parse(run('validate', '--json')).valid, true);
  assert.equal(JSON.parse(run('doctor', '--json')).ok, true);
});
test('component and app-shell install as editable source without overwriting', async () => {
  const base = await mkdtemp(join(tmpdir(), 'syntari-cli-'));
  const target = join(base, 'install');
  try {
    const result = JSON.parse(run('add', 'app-shell', 'button', '--dir', target, '--json'));
    assert.deepEqual(result.components, ['app-shell', 'button']);
    for (const file of ['app-shell.js', 'app-shell.css', 'button.js', 'button.html', 'syntari.json']) await access(join(target, file));
    const marker = JSON.parse(await readFile(join(target, 'syntari.json'), 'utf8'));
    assert.equal(marker.version, JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version);
    const validation = JSON.parse(run('validate', '--dir', target, '--json'));
    assert.equal(validation.valid, true);
    assert.throws(() => run('add', 'button', '--dir', target, '--json'));
  } finally { await rm(base, { recursive: true, force: true }); }
});
