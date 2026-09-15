import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, extname, sep, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { chromium } from 'playwright';
import { catalog } from './catalog.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const output = resolve(root, 'figma/extracted');
const digest = value => createHash('sha256').update(value).digest('hex');
const sourceFiles = ['package.json', 'syntari.js', 'support.html', 'app.js', 'starter.js', 'agents.js', 'extras.js', 'controls.js', 'motion.js', 'numbers.js', 'docs-data.js', 'docs.js', 'docs.html', 'gallery.html', ...['tokens','styles','controls','motion','numbers','starter','agents','extras','docs'].map(name => `${name}.css`)];
const sourceCatalog = await catalog();
const source = { commit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim(), files: Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, digest(await readFile(file))]))), version: JSON.parse(await readFile('package.json','utf8')).version };
const failures = [];
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/__inventory__') { response.writeHead(200, {'content-type':'text/html'}).end('<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>Syntari extraction</title></head><body><div id="inventory-stage" style="width:640px"></div></body></html>'); return; }
    const file = resolve(root, `.${pathname.endsWith('/') ? pathname + 'index.html' : pathname}`);
    if (!file.startsWith(root + sep) || pathname.split('/').some(part => part.startsWith('.'))) { response.writeHead(403).end(); return; }
    response.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream'}).end(await readFile(file));
  } catch { response.writeHead(404).end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}, reducedMotion:'reduce', locale:'en-US', timezoneId:'UTC'});
  page.on('pageerror', error => failures.push(error.message));
  // Reproducible generated DOM IDs; applies only to this isolated browser.
  await page.addInitScript(() => {
    let seed = 123456789, counter = 0;
    Math.random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
    crypto.randomUUID = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
  });
  await page.goto(origin + '/__inventory__');
  const inventory = await page.evaluate(async () => { window.extractor = await import('/scripts/inventory-browser.mjs'); return window.extractor.initializeInventory(); });
  assert.deepEqual(inventory.catalog.map(c => c.slug), sourceCatalog.map(c => c.slug), 'Browser and source catalogs differ.');
  const components = [];
  for (const component of inventory.catalog) {
    components.push(await page.evaluate(slug => window.extractor.componentInventory(slug), component.slug));
    if (components.length % 20 === 0) console.log(`Extracted ${components.length} / ${inventory.catalog.length} component families`);
  }
  const tokenNames = new Set(inventory.tokens.map(token => token.name));
  const sourceTokenNames = new Set([...String(await readFile('tokens.css')).matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]));
  assert.deepEqual([...tokenNames].sort(), [...sourceTokenNames].sort(), 'CSS parsing dropped a shared token.');
  const missingReferences = [];
  for (const token of inventory.tokens) {
    assert.ok(token.modes.light && token.modes.dark, `Unresolved token ${token.name}`);
    for (const declaration of token.declarations) for (const reference of declaration.aliases) {
      if (!tokenNames.has(reference)) missingReferences.push({token:token.name, reference});
    }
    token.normalized = Object.fromEntries(Object.entries(token.modes).map(([theme, value]) => [theme, normalize(value, parseFloat(inventory.rootFontSize))]));
  }
  assert.equal(missingReferences.length, 0, 'Some foundational token aliases do not exist.');
  const cssTokenNames = new Set(inventory.css.rules.flatMap(rule => rule.declarations.filter(d => d.property.startsWith('--')).map(d => d.property)));
  const documentedMissingTokens = components.flatMap(component => component.tokens.filter(token => !cssTokenNames.has(token.startsWith('--') ? token : '--'+token)).map(token => ({component:component.slug, token})));
  const stateFailures = components.flatMap(component => component.stateValidation.filter(state => !state.mounted).map(state => ({component:component.slug,...state})));
  assert.equal(stateFailures.length, 0, JSON.stringify(stateFailures));
  assert.equal(failures.length, 0, JSON.stringify(failures));
  assert.equal(new Set(components.map(c => c.slug)).size, components.length);

  const registrations = await Promise.all(['app.js','starter.js','agents.js','extras.js'].map(async file => ({file, text:await readFile(file,'utf8')})));
  for (const component of components) {
    const needle = `'${component.name}'`;
    const registration = registrations.find(file => file.text.includes(needle));
    assert.ok(registration, `No source registration for ${component.slug}`);
    component.source = { registration:{file:registration.file,line:registration.text.slice(0,registration.text.indexOf(needle)).split('\n').length}, interactions:component.interactionSource, states:'docs-data.js', runtime:'syntari.js', docs:`https://syntariui.github.io/syntari/components/${component.slug}/` };
    for (const snapshot of Object.values(component.defaultSnapshots)) {
      assert.ok(snapshot.length, `No enhanced structure for ${component.slug}`);
      assert.ok(snapshot.every(node => Object.values(node.bounds).every(Number.isFinite)), `Invalid geometry in ${component.slug}`);
    }
  }

  const app = await readFile('app.js', 'utf8');
  const iconContext = vm.createContext({});
  vm.runInContext(app.slice(0, app.indexOf('const components')) + '\nglobalThis.exportedPaths = paths;', iconContext);
  const icons = JSON.parse(JSON.stringify(iconContext.exportedPaths));
  const assets = { fonts: inventory.css.fonts, icons: { source:'app.js', family:'Lucide', version:'0.468.0', license:'assets/lucide-LICENSE.txt', viewBox:'0 0 24 24', paths:icons }, files: Object.fromEntries(await Promise.all((await readdir('assets')).map(async name => [`assets/${name}`, digest(await readFile(`assets/${name}`))]))) };
  for (const font of assets.fonts) for (const match of font.declarations.src.matchAll(/url\(["']?([^"')]+)/g)) assert.ok(assets.files[match[1]], `Missing font: ${match[1]}`);
  const buttonUsage = components.flatMap(component => component.controls.filter(control => control.treatment !== 'component-specific').map(control => ({component:component.slug, ...control})));
  const buttonCounts = Object.fromEntries([...new Set(buttonUsage.map(button => button.treatment))].sort().map(treatment => [treatment, buttonUsage.filter(button => button.treatment === treatment).length]));
  // CSSOM canonicalizes hex colors to rgb(); inspect both, including named colors.
  const rawCSS = inventory.css.rules.flatMap(rule => rule.declarations.filter(d => !d.property.startsWith('--') && /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|color)\(|\b(?:white|black)\b/i.test(d.value)).map(declaration => ({source:rule.id, selector:rule.selector, property:declaration.property, value:declaration.value})));
  const summary = { components:components.length, authoredStates:components.reduce((count,c) => count+c.states.length,0), checkedThemeStates:components.reduce((count,c)=>count+c.stateValidation.length,0), tokens:inventory.tokens.length, themeOverrides:inventory.tokens.filter(t=>t.modes.light!==t.modes.dark).length, fonts:assets.fonts.length, icons:Object.keys(icons).length, cssRules:inventory.css.rules.length, literalColorDeclarations:rawCSS.length, documentedMissingTokens, buttonCounts, errors:failures };
  for (const [file, hash] of Object.entries(source.files)) assert.equal(digest(await readFile(file)), hash, `Source changed during extraction: ${file}`);
  const manifest = { schemaVersion:1, source, target: { name:'Syntari', fileKey:'0rv4sI7MUcEZaERaCJX8bt', url:'https://www.figma.com/design/0rv4sI7MUcEZaERaCJX8bt', generated:false }, capture: { engine:await browser.version(), viewport:{width:1440,height:1000}, stageWidth:640, reducedMotion:true, themes:['light','dark'], note:'Default-state computed snapshots at one width. State checks confirm recipes mount; they are not visual or interaction parity certification.' }, summary, files:['tokens.json','components.json','styles.json','assets.json','button-audit.json','gaps.json'], limitations:['Authored preview states are not a complete Cartesian Figma variant matrix.','DOM trees are component templates and enhanced default examples, not native Figma nodes.','Computed values and matching CSS rules are evidence, not inferred variable bindings.','Figma font availability and prototype behavior remain unverified.','Live timers, overlays opened after interaction, and responsive layouts require a later capture pass.','Code Connect mappings have not been created.'] };
  await mkdir(output, {recursive:true});
  const outputs = { 'manifest.json':manifest, 'tokens.json':{rootFontSize:inventory.rootFontSize,tokens:inventory.tokens}, 'components.json':{commonAPI:inventory.commonAPI,components}, 'styles.json':inventory.css, 'assets.json':assets, 'button-audit.json':{scope:'Unenhanced default component templates; excludes documentation chrome, dynamically created menus, and starter screens.', counts:buttonCounts, knownTreatments:{outline:'.button',secondary:'.button.secondary',primary:'.button.primary',accent:'.button.accent',ghost:'.button.ghost',danger:'.button.danger'}, separateFilledSecondaryDefined:inventory.css.rules.some(rule => rule.selector.includes('.button.secondary')), buttons:buttonUsage}, 'gaps.json':{documentedMissingTokens,literalColorDeclarations:rawCSS,limitations:manifest.limitations} };
  for (const [file, data] of Object.entries(outputs)) await writeFile(resolve(output,file), JSON.stringify(data,null,2)+'\n');
  const rows = components.map(c => `| ${c.name} | ${c.category} | ${c.states.map(s=>s.label).join(', ')} | ${c.interactionSource} |`).join('\n');
  await writeFile(resolve(output,'REPORT.md'), `# Syntari extraction\n\nExtracted from Syntari ${source.version}. This is source evidence for the Figma generator; no Figma objects were generated by this step.\n\n- ${summary.components} component families; ${summary.authoredStates} authored preview states.\n- ${summary.checkedThemeStates} state/theme combinations mounted successfully.\n- ${summary.tokens} shared tokens, including ${summary.themeOverrides} that change between light and dark.\n- ${summary.fonts} font faces and ${summary.icons} Lucide icon definitions.\n- ${summary.cssRules} stylesheet rules and ${summary.literalColorDeclarations} declarations containing literal colors (candidates for review, not automatically defects).\n- ${documentedMissingTokens.length} documented token references need review.\n\n## Button hierarchy\n\nThe secondary button uses a quiet filled surface through .button.secondary. The base .button remains outlined; primary and contextual ghost treatments stay distinct. Counts below cover default component templates only, not documentation chrome or dynamically created actions.\n\n${Object.entries(buttonCounts).map(([name,count])=>`- ${name}: ${count}`).join('\n')}\n\n## Limits\n\n${manifest.limitations.map(text=>'- '+text).join('\n')}\n\n## Component and state inventory\n\n| Component | Category | Authored states | Interaction source |\n| --- | --- | --- | --- |\n${rows}\n`);
  console.log(JSON.stringify({output:relative(root,output),...summary},null,2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}

function normalize(value, rootFontSize) {
  if (/^#[0-9a-f]{3,8}$/i.test(value)) {
    let hex = value.slice(1);
    if (hex.length===3 || hex.length===4) hex = [...hex].map(char=>char+char).join('');
    if (hex.length===6) hex += 'ff';
    return {type:'color',rgba:Object.fromEntries(['r','g','b','a'].map((channel,index)=>[channel,parseInt(hex.slice(index*2,index*2+2),16)/255]))};
  }
  const dimension=value.match(/^(-?[\d.]+)(px|rem)$/);
  if(dimension) return {type:'dimension',value:parseFloat(dimension[1])*(dimension[2]==='rem'?rootFontSize:1),unit:'px',originalUnit:dimension[2]};
  const duration=value.match(/^([\d.]+)(ms|s)$/);
  if(duration) return {type:'duration',value:parseFloat(duration[1])*(duration[2]==='s'?1000:1),unit:'ms'};
  if(value.startsWith('cubic-bezier(')) return {type:'cubicBezier',value:value.slice(13,-1).split(',').map(Number)};
  if(/(?:inset\s+)?0\s/.test(value)) return {type:'shadow',css:value};
  return {type:'string',value};
}
