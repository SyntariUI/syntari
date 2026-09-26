import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
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
