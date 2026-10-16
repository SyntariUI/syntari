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
