import {test,expect} from '@playwright/test';
import { readFileSync } from 'node:fs';
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const origin='http://127.0.0.1:4398';
test('System preserves the live component while inspecting contracts, code and installation',async({page,context})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.route('**/registry/index.json',async route=>{await new Promise(resolve=>setTimeout(resolve,1500));await route.continue();});
 await page.goto(origin+'/system/#button');
 await expect(page.locator('[data-preview-loader]')).toBeVisible();
 await expect(page.locator('[data-preview-loader] .brand-mark')).toBeVisible();
 await expect(page.locator('[data-preview-skeleton]')).toHaveCount(0);
 const preview=page.locator('[data-component-mount] > [data-syntari-component]');
 await expect(preview).toHaveAttribute('data-syntari-component','button');
 await expect(page.locator('[data-component-count]')).toHaveText('139');
 expect(await page.locator('.sys-workspace').evaluate(el=>el.getBoundingClientRect().width/innerWidth)).toBeGreaterThan(.75);
 const initial=await preview.elementHandle();
 await page.getByRole('button',{name:'Inspect component'}).click();
 await expect(page.locator('[data-contract-status]')).toHaveText('Screen IR contract');
 await expect(page.locator('[data-guidance] [data-guide="use"]')).toBeVisible();
 await expect(page.locator('[data-info-panel]')).toBeVisible();
 await expect(page.locator('[data-inspector] .sys-reference-tabs')).toHaveCount(0);
 expect(await page.evaluate(el=>el===document.querySelector('[data-syntari-component]'),initial)).toBe(true);
 await page.getByRole('button',{name:'View code'}).click();
 await expect(page.locator('[data-workspace]')).toHaveAttribute('data-panel','code');
 await expect(page.locator('[data-code-panel]')).toBeVisible();
 await page.getByRole('button',{name:'Manifest',exact:true}).click();
 await expect(page.locator('[data-source]')).toContainText('"id": "button"');
 await page.getByRole('button',{name:'Install',exact:true}).click();
 await expect(page.locator('[data-install-command]')).toHaveText('npx syntari-ui add button');
 await expect(page.locator('[data-workspace]')).toHaveAttribute('data-panel','install');
 const drawer=await page.locator('[data-inspector]').boundingBox(),stage=await page.locator('[data-stage]').boundingBox(),workspace=await page.locator('.sys-workspace').boundingBox();
 expect(Math.abs(stage.x+stage.width-drawer.x)).toBeLessThan(3);
 expect(Math.abs(drawer.x+drawer.width-(workspace.x+workspace.width))).toBeLessThan(3);
 expect(Math.abs(stage.y+stage.height-(workspace.y+workspace.height))).toBeLessThan(3);
 await expect(page.locator('[data-inspector] .sys-reference-tabs')).toHaveCount(0);
 await page.getByRole('button',{name:'Copy command'}).click();
 expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('npx syntari-ui add button');
 await expect(page.locator('[data-copy-status]')).toContainText('Copied');
 await page.getByRole('button',{name:'Close panel'}).click();
 await page.getByRole('searchbox',{name:'Find a component'}).fill('app shell');
 await page.locator('[data-slug="app-shell"]').click();
 await expect(preview).toHaveAttribute('data-syntari-component','app-shell');
 await expect(page).toHaveURL(/system\/#app-shell$/);
 await page.goBack();
 await expect(preview).toHaveAttribute('data-syntari-component','button');
 expect(errors).toEqual([]);
});
test('System component routes, mobile navigation, states and inspector focus work',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto(origin+'/components/slider/');
 await expect(page.locator('[data-syntari-component="slider"]')).toBeVisible();
 await page.getByRole('button',{name:'Open System navigation'}).click();
 await page.getByRole('searchbox',{name:'Find a component'}).fill('tool approval');
 await page.locator('[data-slug="tool-approval"]').click();
 await expect(page.locator('[data-syntari-component="tool-approval"]')).toBeVisible();
 await page.getByRole('button',{name:'Inspect component'}).click();
 await expect(page.locator('[data-inspector]')).toBeVisible();
 await expect(page.locator('[data-ir-support]')).toContainText('Screen IR supported');
 await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'Inspect component'})).toBeFocused();
 await page.getByRole('button',{name:'Install',exact:true}).click();
 await expect(page.locator('[data-workspace]')).toHaveAttribute('data-panel','install');
 await expect(page.getByRole('button',{name:'View code'})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>{const workspace=document.querySelector('.sys-workspace').getBoundingClientRect(),drawer=document.querySelector('[data-inspector]').getBoundingClientRect();return Math.abs(workspace.left-drawer.left)<3&&Math.abs(workspace.right-drawer.right)<3})).toBe(true);
 await page.getByRole('button',{name:'View code'}).click();
 await expect(page.locator('[data-workspace]')).toHaveAttribute('data-panel','code');
 await expect(page.locator('[data-code-panel]')).toBeVisible();
 await page.keyboard.press('Escape');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Open System navigation'}).click();
 await page.getByRole('searchbox',{name:'Find a component'}).fill('slider');
 await page.locator('[data-slug="slider"]').click();
 await page.locator('[data-states]').getByRole('button',{name:'Disabled'}).click();
 await expect(page.getByRole('slider',{name:'Monthly events'})).toBeDisabled();
});

test('AI behaviour patterns are published as a System guide and link to their components', async ({page}) => {
 await page.goto('http://127.0.0.1:4398/ai-behavioural-patterns.html');
 await expect(page).toHaveURL(/\/system\/\?guide=ai-patterns#agent-questions$/);
 const guide = page.locator('[data-guide-content]');
 await expect(guide.getByRole('heading',{name:'Agents that earn trust.'})).toBeVisible();
 for (const name of ['Clarification','Uncertainty','Delegation','Recovery','Memory','Generation']) await expect(guide.getByRole('heading',{name,exact:true})).toBeVisible();
 await guide.getByRole('link',{name:'Tool approval',exact:true}).click();
 await expect(page.locator('[data-syntari-component="tool-approval"]')).toBeVisible();
 const patterns = await (await page.request.get('http://127.0.0.1:4398/registry/patterns/index.json')).json();
 const interaction = patterns.patterns.filter(item => item.type === 'interaction');
 expect(interaction).toHaveLength(6);
 for (const item of interaction) expect(item.preview).toContain('/system/?guide=ai-patterns');
});

test('components with a contract document mounting with props and their actions', async ({page}) => {
 await page.goto('http://127.0.0.1:4398/system/?panel=api#tool-approval');
 const api = page.locator('[data-ir-api]');
 await expect(api.getByRole('heading', {name: 'Mount with props'})).toBeVisible();
 await expect(api).toContainText("import { mount } from './components/syntari/tool-approval.js';");
 await expect(api).toContainText('onActionRequest');
 await expect(api).toContainText('"approve" or "reject"');
 await page.goto('http://127.0.0.1:4398/system/?panel=api#password-field');
 await expect(page.locator('[data-ir-api]')).toContainText('has not been authored');
 await expect(page.locator('[data-ir-api]').getByRole('heading', {name: 'Mount with props'})).toHaveCount(0);
});

test('a guide link without a component opens the guide and keeps its address', async ({page}) => {
 await page.goto('http://127.0.0.1:4398/system/?guide=ai-patterns');
 await expect(page.locator('[data-workspace]')).toHaveAttribute('data-panel', 'guide');
 await expect(page.locator('[data-guide-content]')).toContainText('Clarification');
 await expect(page).toHaveURL(/\/system\/\?guide=ai-patterns#[a-z-]+$/);
 await page.goto('http://127.0.0.1:4398/system/?panel=install');
 await expect(page.locator('[data-workspace]')).toHaveAttribute('data-panel', 'install');
 await expect(page).toHaveURL(/\/system\/\?panel=install#[a-z-]+$/);
});

test('every package manager gets a command for the published package, and the panel shows how to use it', async ({page}) => {
 await page.goto('http://127.0.0.1:4398/system/?panel=install#file-diff');
 const command = page.locator('[data-install-command]'), hint = page.locator('[data-install-hint]');
 /* The buttons are wired when System boots; a click before that is lost. The default command means it has. */
 await expect(command).toHaveText('npx syntari-ui add file-diff');
 for (const [manager, expected] of [['pnpm', 'pnpm dlx syntari-ui add file-diff'], ['yarn', 'yarn dlx syntari-ui add file-diff'], ['bun', 'bunx syntari-ui add file-diff'], ['npm', 'npx syntari-ui add file-diff']]) {
  await page.locator(`[data-package-manager="${manager}"]`).click();
  await expect(command).toHaveText(expected);
  await expect(hint).toHaveText(manager === 'yarn' ? 'Needs Yarn 2 or later. With Yarn 1, use the npm command.' : '');
 }
 const details = page.locator('[data-install-details]');
 await expect(details).not.toContainText('npm publication is pending');
 await expect(details.getByRole('heading', {name: 'Use it'})).toBeVisible();
 await expect(details).toContainText("import { mount } from './components/syntari/file-diff.js';");
 await expect(details).toContainText('npx syntari-ui doctor --dir ./components/syntari');
});

test('code shows its own characters: monospace ligatures are off', async ({page}) => {
 await page.goto('http://127.0.0.1:4398/system/#file-diff');
 await page.locator('[data-stage] .diff-lines').waitFor();
 expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-stage] .diff-lines code')).fontVariantLigatures)).toBe('none');
 await page.getByRole('button', {name: 'View code'}).click();
 expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-source]')).fontVariantLigatures)).toBe('none');
});
test('System with no component named opens on the first one in its list',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin+'/system/');
 const first=page.locator('[data-nav] .sys-nav-item').first();
 await expect(first).toHaveAttribute('aria-current','true');
 const slug=await first.getAttribute('data-slug');
 await expect(page).toHaveURL(`${origin}/system/#${slug}`);
 await expect(page.locator('[data-component-mount] [data-syntari-component]')).toBeVisible();
 expect(errors).toEqual([]);
});

test('a documented component says when to use it, when not and what instead, its states, and its dos and don’ts', async({page}) => {
 await page.goto('http://127.0.0.1:4398/system/?panel=info#dialog');
 const guide = page.locator('[data-guidance]');
 await expect(guide.locator('[data-guide="use"] h3')).toHaveText('When to use');
 await expect(page.locator('[data-description]')).toHaveText(/^A modal window for one short, focused task/);
 await expect(page.locator('[data-contract-status]')).toHaveText('Documented');
 await expect(guide.locator('[data-guide="states"] dt')).toHaveText(['Closed', 'Open', 'Invalid', 'Dismissed']);
 await expect(guide.locator('[data-guide="rules"] h3')).toHaveText('Do and don’t');
 await expect(guide.locator('[data-guide="do"] li')).toHaveCount(4);
 /* A do is a check and a don't a cross: the shape tells them apart without colour, and screen readers hear the word. */
 await expect(guide.locator('[data-guide="do"] li').first().locator('svg path')).toHaveAttribute('d', 'm9 12 2 2 4-4');
 await expect(guide.locator('[data-guide="dont"] li').first().locator('svg path')).toHaveCount(2);
 await expect(guide.locator('[data-guide="dont"] li strong').first()).toHaveText('Don’t: Unrequested dialogs');
 await expect(guide.locator('[data-guide="dont"] li p').first()).toHaveText('They interrupt work and get dismissed unread.');
 expect(await guide.locator('[data-guide="dont"] li svg').first().evaluate(svg => getComputedStyle(svg).stroke)).not.toBe(await guide.locator('[data-guide="do"] li svg').first().evaluate(svg => getComputedStyle(svg).stroke));
 await expect(guide.locator('[data-guide="accessibility"] kbd').first()).toHaveText('Tab');
 await expect(page.locator('[data-accessibility-block]')).toBeHidden();
 /* Each alternative opens that component's own guidance. */
 await guide.getByRole('link', { name: 'Use Toast' }).click();
 await expect(page.locator('[data-inspector-title]')).toHaveText('Toast');
 await expect(guide.locator('[data-guide="accessibility"]')).toContainText('Takes no focus and needs no keys.');
 /* A component without guidance keeps the panel it had. */
 await page.goto('http://127.0.0.1:4398/system/?panel=info#banner');
 await expect(page.locator('[data-rules]')).not.toBeEmpty();
 await expect(page.locator('[data-guidance]')).toBeHidden();
 await expect(page.locator('[data-accessibility-block]')).toBeVisible();
});
