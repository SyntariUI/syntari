import { expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

/*
 * The Syntari Renderer artifact, served as a host would serve it, with Claude replaced by a scripted model. Each answer
 * streams in small pieces, as the real one does, so every check sees the progressive states a person sees. With tools on,
 * the scripted model answers through the page's submit_change tool instead, round by round, as the platform does.
 */
const page = resolve('artifacts/renderer/index.html');
const runtime = resolve('kit/runtime');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
let server;
export let origin;
export function serveRenderer(test) {
  test.beforeAll(async () => {
    server = createServer(async (req, res) => {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      try {
        if (path === '/') {
          const body = await readFile(page, 'utf8');
          res.writeHead(200, { 'Content-Type': types['.html'] }).end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n${body}\n</body></html>`);
          return;
        }
        if (path.startsWith('/runtime/')) {
          const file = resolve(runtime, `.${path.slice('/runtime'.length)}`);
          if (!file.startsWith(runtime + sep)) throw new Error('Outside the runtime');
          res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }).end(await readFile(file));
          return;
        }
        res.writeHead(404).end();
      } catch { res.writeHead(404).end(); }
    });
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    origin = `http://127.0.0.1:${server.address().port}`;
  });
  test.afterAll(() => server?.close());
}

/* A scripted Claude: each answer streams in pieces; {{BASE}} becomes the version the prompt names. */
export function installClaude({ tools = false } = {}) {
  const sleep = ms => new Promise(done => setTimeout(done, ms));
  const mock = window.__claude = { queue: [], prompts: [], toolCalls: [], toolResults: [], released: false, paused: false, tools };
  const cancelled = () => Object.assign(new Error('Stopped'), { code: 'cancelled' });
  const sample = async (input, { signal, onText, modelTier, tools: offered } = {}) => {
    mock.prompts.push(input);
    const base = (input.match(/CURRENT SCREEN \(version (sv-[0-9a-f]{8})/) ?? [])[1] ?? 'sv-none';
    /* The tool path: every queued answer is one round, a call to the first tool, until the page stops the call. */
    if (offered?.length && mock.tools) {
      for (;;) {
        const next = mock.queue.shift();
        if (!next) throw Object.assign(new Error('No scripted answer'), { code: 'empty_completion' });
        await sleep(next.delay ?? 30);
        if (signal?.aborted) throw cancelled();
        const text = next.text.replaceAll('{{BASE}}', next.base ?? base);
        if (next.kind === 'text') { onText?.({ text, delta: text }); return { text, truncated: false, modelTierApplied: modelTier ?? 'default' }; }
        let call;
        try { call = JSON.parse(text); } catch { call = {}; }
        mock.toolCalls.push(call);
        const output = await offered[0].execute(call, { signal });
        mock.toolResults.push(output);
        await sleep(20);
        if (signal?.aborted) throw cancelled();
        if (typeof output === 'string') { onText?.({ text: 'Done.', delta: 'Done.' }); return { text: 'Done.', truncated: false, modelTierApplied: modelTier ?? 'default' }; }
      }
    }
    const next = mock.queue.shift();
    if (!next) throw Object.assign(new Error('No scripted answer'), { code: 'empty_completion' });
    const text = next.text.replaceAll('{{BASE}}', next.base ?? base);
    const pauseAt = next.pauseAfter ? text.indexOf(next.pauseAfter) + next.pauseAfter.length : -1;
    mock.released = false;
    for (let at = Math.min(next.chunk ?? 48, text.length); ; at = Math.min(at + (next.chunk ?? 48), text.length)) {
      if (signal?.aborted) throw cancelled();
      if (pauseAt > 0 && at >= pauseAt && !mock.released) {
        onText?.({ text: text.slice(0, pauseAt) });
        mock.paused = true;
        while (!mock.released) { if (signal?.aborted) throw cancelled(); await sleep(20); }
        mock.paused = false;
      }
      onText?.({ text: text.slice(0, at) });
      if (at >= text.length) break;
      await sleep(next.delay ?? 8);
    }
    return { text, truncated: false, modelTierApplied: modelTier ?? 'default' };
  };
  sample.limits = async () => mock.tools ? { maxPromptBytes: 262144, tools: { maxCount: 8 } } : { maxPromptBytes: 262144 };
  window.claude = { use: async name => name !== 'sample' ? null : sample };
}

export async function openRenderer(browserPage, { tools = false, example = null, publicPage = false } = {}) {
  const errors = [];
  browserPage.on('pageerror', error => errors.push(error.message));
  if (publicPage) await browserPage.addInitScript(model => { window.syntariRenderer = { public: true, model }; }, publicPage === 'model');
  await browserPage.addInitScript(installClaude, { tools });
  if (example) await browserPage.addInitScript(id => { try { localStorage.setItem('syntari-renderer:example', id); } catch {} }, example);
  await browserPage.goto(origin);
  /* The templates-only public page never connects a model: it is ready when it starts building its first template. */
  await expect(browserPage.locator(publicPage === true ? '[data-app][data-templates]' : '[data-app][data-ai-ready]')).toBeAttached({ timeout: 30000 });
  if (!publicPage) await expect(browserPage.locator('[data-status-label]')).toHaveText(/Ready/);
  return errors;
}
export const script = (p, ...answers) => p.evaluate(list => window.__claude.queue.push(...list), answers.map(answer => typeof answer === 'string' ? { text: answer } : answer));
export const prompts = p => p.evaluate(() => window.__claude.prompts);
export async function ask(p, request) {
  if (await p.locator('[data-trigger]').isVisible()) await p.locator('[data-trigger]').click();
  await p.locator('[data-prompt]').fill(request);
  await p.locator('[data-generate]').click();
}
export async function settled(p) {
  await expect(p.locator('[data-composer]')).not.toHaveAttribute('data-state', /submitting|generating/, { timeout: 30000 });
  await expect(p.locator('.canvas .stream-slot')).toHaveCount(0);
}
export const screenIR = async p => JSON.parse(await p.locator('[data-ir-text]').inputValue());
/* Every node by id, as data, so "unchanged" means unchanged value for value. */
export function nodesById(spec) {
  const map = {};
  const go = list => (list ?? []).forEach(node => { const { children, ...own } = node; map[node.id] = own; go(children); });
  go(spec.children);
  return map;
}
/* What each part shows, by id: components only, so a group's text does not count its children twice. */
export const shown = p => p.$$eval('.canvas .ir-node[data-ir-id]', nodes => Object.fromEntries(nodes.map(node => [node.dataset.irId, node.innerText])));
export async function openExample(p, id) {
  await p.locator('[data-examples-toggle]').click();
  await p.locator(`[data-examples] button[data-id="${id}"]`).click();
  await expect(p.locator('[data-status-label]')).toHaveText(/Ready/);
}
