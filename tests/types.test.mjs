import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

test('published TypeScript types compile for a strict ESM consumer', () => {
  const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
  const result = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--module', 'nodenext', '--moduleResolution', 'nodenext', '--target', 'es2022', 'tests/types/consumer.ts'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
