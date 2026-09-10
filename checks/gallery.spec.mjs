import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import gallery from './browser-check.mjs';
import motion from './motion-check.mjs';
import numbers from './numbers-check.mjs';
import refinement from './refinement-check.mjs';
import controls from './controls-check.mjs';
for (const [name, run] of Object.entries({gallery,motion,numbers,refinement,controls})) {
  test(name, async ({page}) => {
    await mkdir('test-results', {recursive:true});
    const results = await run(page);
    expect(results.length).toBeGreaterThan(0);
    console.log(`${name}: ${results.length} checks passed`);
  });
}
