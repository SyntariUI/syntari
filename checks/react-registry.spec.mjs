import { test, expect } from '@playwright/test';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { buildReactRegistry } from '../scripts/react-registry.mjs';

/*
 * Installs the React registry the way a person would: a fresh Vite, React, Tailwind v4 and shadcn project,
 * `shadcn add` for every component, a strict type check of each contract sample, and a production build.
 */
const exec = promisify(execFile);
const fixture = fileURLToPath(new URL('./fixtures/react-shadcn/', import.meta.url));
const contract = async slug => JSON.parse(await readFile(new URL(`../registry/components/${slug}.json`, import.meta.url), 'utf8'));
const pascal = slug => slug.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join('');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

function serve(root) {
  const server = createServer(async (req, res) => {
    try {
      const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (!path.startsWith(root)) throw new Error('Outside root');
      const file = path === root ? join(root, 'index.html') : path;
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  return new Promise(done => server.listen(0, '127.0.0.1', () => done(server)));
}

/* Every contract prop is a JSX attribute, so TypeScript checks each sample value against the component's props. */
async function app(components) {
  const imports = [], samples = [];
  for (const { name } of components) {
    const manifest = await contract(name);
    const attributes = Object.entries(manifest.sample.props).map(([key, value]) => `${key}={${JSON.stringify(value)}}`);
    const handler = Object.keys(manifest.actions ?? {}).length ? ' onActionRequest={log}' : '';
    imports.push(`import { ${pascal(name)} } from '@/components/${name}';`);
    samples.push(`      <${pascal(name)} id="${name}-sample" ${attributes.join(' ')}${handler} />`);
  }
  return `import type { SyntariActionRequest } from '@/lib/syntari';
${imports.join('\n')}

declare global { interface Window { requests: SyntariActionRequest[]; events: SyntariActionRequest[]; pwned?: number } }
window.requests = [];
window.events = [];
document.addEventListener('syntari:action', event => window.events.push((event as CustomEvent<SyntariActionRequest>).detail));
const log = (request: SyntariActionRequest) => { window.requests.push(request); };
const hostileIcon = '"><img src=x onerror="window.pwned=1">';

export function App() {
  return (
    <main className="mx-auto grid max-w-2xl gap-4 p-6">
${samples.join('\n')}
      <ToolApproval id="irreversible" title="Delete the staging database?" question="Drop every table in staging." scope="staging · admin" risk="critical" reversibility="irreversible" onActionRequest={log} />
      <ToolApproval id="blocked" title="Send the invoices?" question="Email 42 customers their invoices." scope="billing · send" status="blocked" onActionRequest={log} />
      <StreamingResponse id="streaming" author="Research assistant" text="Renewals grew" status="Writing" streaming onActionRequest={log} />
      <Banner id="hostile-icon" message="Icon from a model" icon={hostileIcon} />
    </main>
  );
}
`;
}

test.describe.configure({ mode: 'serial' });

let temp, project, registryServer, appServer, origin, components;

test.beforeAll(async () => {
  test.setTimeout(420000);
  temp = await mkdtemp(join(tmpdir(), 'syntari-react-'));
  project = join(temp, 'project');
  await cp(fixture, project, { recursive: true });
  const registryRoot = join(temp, 'registry');
  await mkdir(registryRoot);
  registryServer = await serve(registryRoot);
  const site = `http://127.0.0.1:${registryServer.address().port}`;
  components = (await buildReactRegistry({ outDir: join(registryRoot, 'r'), site })).filter(item => item.type === 'registry:component');
  /* shadcn add reads a base colour from REGISTRY_URL even for third-party items; serving it here keeps the check independent of ui.shadcn.com. */
  await mkdir(join(registryRoot, 'r/colors'));
  await writeFile(join(registryRoot, 'r/colors/neutral.json'), JSON.stringify({ inlineColors: { light: {}, dark: {} }, cssVars: { light: {}, dark: {} }, inlineColorsTemplate: '', cssVarsTemplate: '' }));
  await exec('npm', ['install', '--no-audit', '--no-fund'], { cwd: project, timeout: 300000 });
  await exec('npx', ['shadcn', 'add', ...components.map(item => `${site}/r/${item.name}.json`), '--yes'], { cwd: project, timeout: 120000, env: { ...process.env, REGISTRY_URL: `${site}/r` } });
  await writeFile(join(project, 'src/App.tsx'), await app(components));
  await exec('npx', ['tsc', '-p', '.'], { cwd: project, timeout: 120000 });
  await exec('npx', ['vite', 'build'], { cwd: project, timeout: 120000 });
  appServer = await serve(join(project, 'dist'));
  origin = `http://127.0.0.1:${appServer.address().port}`;
});

test.afterAll(async () => {
  for (const server of [registryServer, appServer]) if (server) await new Promise(done => server.close(done));
  if (temp) await rm(temp, { recursive: true, force: true });
});

const open = async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(origin);
  await page.locator('[data-syntari-id="banner-sample"]').waitFor();
  return errors;
};
const last = page => page.evaluate(() => ({ request: window.requests.at(-1), event: window.events.at(-1), count: window.requests.length }));

test('shadcn installs the lib once and every component under the project aliases', async () => {
  const lib = await readFile(join(project, 'src/lib/syntari.tsx'), 'utf8');
  expect(lib).toContain("from '@/lib/syntari-icons'");
  for (const { name } of components) {
    const source = await readFile(join(project, `src/components/${name}.tsx`), 'utf8');
    expect(source).toContain("from '@/lib/syntari'");
    expect(source).not.toContain('@/registry/');
  }
});

test('every contract sample renders its props and nothing from a template', async ({ page }) => {
  const errors = await open(page);
  for (const { name } of components) {
    const root = page.locator(`[data-syntari-id="${name}-sample"]`);
    await expect(root).toHaveAttribute('data-syntari-component', name);
    const text = await root.innerText();
    const manifest = await contract(name);
    const strings = Object.entries(manifest.sample.props).filter(([key]) => manifest.props[key].type === 'string' && key !== 'icon').map(([, value]) => value);
    for (const value of strings) expect(text, `${name} shows ${value}`).toContain(value);
    expect(text).not.toMatch(/undefined|null|\[object Object\]/);
  }
  expect(errors).toEqual([]);
});

test('decisions report requests and leave running anything to the host', async ({ page }) => {
  await open(page);
  const approval = page.locator('[data-syntari-id="tool-approval-sample"]');
  await approval.getByRole('button', { name: 'Approve' }).click();
  const approved = await last(page);
  expect(approved.request).toEqual({ component: 'tool-approval', action: 'approve', id: 'tool-approval-sample', consequential: true });
  expect(approved.event).toEqual(approved.request);
  await expect(approval.getByRole('button')).toHaveCount(0);
  await expect(approval.getByText('Nothing runs until the app confirms it is allowed.')).toBeFocused();

  await page.locator('[data-syntari-id="approval-card-sample"]').getByRole('button', { name: 'Decline' }).click();
  expect((await last(page)).request).toEqual({ component: 'approval-card', action: 'reject', id: 'approval-card-sample', consequential: false });
  await page.locator('[data-syntari-id="file-diff-sample"]').getByRole('button', { name: 'Keep changes' }).click();
  expect((await last(page)).request).toEqual({ component: 'file-diff', action: 'approve', id: 'file-diff-sample', consequential: true });
});

test('an irreversible request asks twice, and Escape goes back', async ({ page }) => {
  await open(page);
  const card = page.locator('[data-syntari-id="irreversible"]');
  await expect(card.getByText('Critical risk')).toBeVisible();
  await expect(card.getByText("Can't be undone")).toBeVisible();
  const approve = card.getByRole('button', { name: 'Approve', exact: true });
  await approve.click();
  expect((await last(page)).count).toBe(0);
  const confirm = card.getByRole('group', { name: "This can't be undone. Approve anyway?" });
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
  await expect(approve).toBeFocused();
  await approve.click();
  await card.getByRole('button', { name: 'Approve anyway' }).click();
  const { request, count } = await last(page);
  expect(count).toBe(1);
  expect(request).toEqual({ component: 'tool-approval', action: 'approve', id: 'irreversible', consequential: true });
});

test('a request the host blocked offers no action', async ({ page }) => {
  await open(page);
  const card = page.locator('[data-syntari-id="blocked"]');
  await expect(card.getByText('Blocked by policy. This action is not allowed here.')).toBeVisible();
  await expect(card.getByRole('button')).toHaveCount(0);
});

test('questions, sources, results, streaming and messages send only their declared actions', async ({ page }) => {
  await open(page);
  const questions = page.locator('[data-syntari-id="agent-questions-sample"]');
  await questions.getByRole('radio', { name: 'Team' }).check();
  await questions.getByLabel('Anything to preserve?').fill('Keep the revenue table');
  await questions.getByRole('button', { name: 'Send answer' }).click();
  expect((await last(page)).request).toEqual({ component: 'agent-questions', action: 'submit', id: 'agent-questions-sample', values: { choice: 'Team', notes: 'Keep the revenue table' }, consequential: false });
  await expect(questions.getByRole('status')).toHaveText('Answer sent: Team.');

  const citations = page.locator('[data-syntari-id="citations-sample"]');
  await citations.getByText('Sales dashboard').click();
  await citations.getByRole('button', { name: 'Open source: Sales dashboard' }).click();
  expect((await last(page)).request).toEqual({ component: 'citations', action: 'open', id: 'citations-sample', index: 1, consequential: false });

  await page.locator('[data-syntari-id="tool-result-sample"]').getByRole('button', { name: 'Run again' }).click();
  expect((await last(page)).request).toEqual({ component: 'tool-result', action: 'rerun', id: 'tool-result-sample', consequential: true });

  const settled = page.locator('[data-syntari-id="streaming-response-sample"]');
  await expect(settled.getByRole('button', { name: 'Stop' })).toBeDisabled();
  await settled.getByRole('button', { name: 'Generate response' }).click();
  expect((await last(page)).request.action).toBe('generate');
  const streaming = page.locator('[data-syntari-id="streaming"]');
  await expect(streaming.getByRole('button', { name: 'Generate response' })).toBeDisabled();
  await streaming.getByRole('button', { name: 'Stop' }).click();
  expect((await last(page)).request).toEqual({ component: 'streaming-response', action: 'stop', id: 'streaming', consequential: false });

  const message = page.locator('[data-syntari-id="agent-message-sample"]');
  const helpful = message.getByRole('button', { name: 'Helpful' });
  await expect(helpful).toHaveAttribute('aria-pressed', 'false');
  await helpful.click();
  await expect(helpful).toHaveAttribute('aria-pressed', 'true');
  expect((await last(page)).request).toEqual({ component: 'agent-message', action: 'helpful', id: 'agent-message-sample', values: { pressed: true }, consequential: false });
  await message.getByRole('button', { name: 'Regenerate' }).click();

  /* Each request names an action its contract declares, with the contract's consequence. */
  const requests = await page.evaluate(() => window.requests);
  for (const request of requests) {
    const declared = (await contract(request.component)).actions[request.action];
    expect(declared, `${request.component}.${request.action}`).toBeTruthy();
    expect(request.consequential, `${request.component}.${request.action}`).toBe(Boolean(declared.consequential));
  }
});

test('a model-authored icon name selects an icon and never becomes markup', async ({ page }) => {
  await open(page);
  const banner = page.locator('[data-syntari-id="hostile-icon"]');
  await expect(banner.locator('svg')).toHaveCount(1);
  await expect(banner.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => window.pwned)).toBeUndefined();
});

test('axe finds no WCAG A or AA violations, collapsed and expanded, in light and dark', async ({ page }) => {
  await open(page);
  await page.addScriptTag({ path: join(project, 'node_modules/axe-core/axe.min.js') });
  const audit = () => page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }))
    .violations.map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(', ')}`));
  for (const theme of ['light', 'dark']) {
    /* Colours transition when the theme changes; audit the settled colours. */
    await page.evaluate(async dark => { document.documentElement.classList.toggle('dark', dark); await Promise.all(document.getAnimations().filter(animation => animation instanceof CSSTransition).map(animation => animation.finished)); }, theme === 'dark');
    await page.evaluate(() => document.querySelectorAll('details').forEach(details => { details.open = false; }));
    expect(await audit(), `${theme}, collapsed`).toEqual([]);
    await page.evaluate(() => document.querySelectorAll('details').forEach(details => { details.open = true; }));
    expect(await audit(), `${theme}, expanded`).toEqual([]);
  }
});
