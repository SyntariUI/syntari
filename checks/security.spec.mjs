import { test, expect } from '@playwright/test';
import { origin } from './component.mjs';

/* Screen IR comes from a model. Nothing in it may reach the page as markup. */
test('model-authored icon names cannot inject markup', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  const result = await page.evaluate(async () => {
    const { validate, render } = await import('/ir.js');
    const { mount } = await import('/syntari.js');
    window.pwned = 0;
    /* Short enough to pass maxLength, so only the icon check stands between them and the page. */
    const payloads = ['"onmouseover="pwned=1', '"><svg onload=pwned=1>', 'x" onload="pwned=1'];
    const out = { codes: [], injected: 0 };
    const target = document.querySelector('[data-ir-output]');
    for (const icon of payloads) {
      const spec = { type: 'screen', children: [
        { component: 'syntari.agent-message', props: { author: 'Agent', text: 'Hello', icon } },
        { component: 'syntari.agent-activity', props: { events: [{ title: 'Opened', icon }] } }
      ] };
      out.codes.push((await validate(spec)).diagnostics.filter(item => item.severity === 'error').map(item => item.code));
      const rendered = await render(spec, target);
      out.injected += target.querySelectorAll('[onmouseover], [onerror], [onload], svg svg').length;
      rendered.destroy();
    }
    out.helperSafe = window.SyntariIcon('"onload="pwned=1') === window.SyntariIcon('layers');
    try { await mount('agent-message', document.createElement('div'), { props: { author: 'Agent', text: 'Hello', icon: payloads[0] } }); out.mountRejected = false; }
    catch (error) { out.mountRejected = error.diagnostics?.some(item => item.code === 'invalid-icon') ?? false; }
    await new Promise(resolve => setTimeout(resolve, 50));
    out.pwned = window.pwned;
    return out;
  });
  for (const codes of result.codes) expect(codes.filter(code => code === 'invalid-icon')).toHaveLength(2);
  expect(result.injected).toBe(0);
  expect(result.helperSafe).toBe(true);
  expect(result.mountRejected).toBe(true);
  expect(result.pwned).toBe(0);
});

/* Validation, MCP, and llms-full.txt read the icon vocabulary from the registry index; it must be exactly what the runtime draws. */
test('the registry lists exactly the icons the runtime ships', async ({ page }) => {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  const { listed, shipped } = await page.evaluate(async () => ({
    listed: (await (await fetch('/registry/index.json')).json()).icons,
    shipped: [...window.SyntariIconNames]
  }));
  expect([...listed].sort()).toEqual([...shipped].sort());
});
