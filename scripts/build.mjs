import { mkdir, copyFile, cp, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { catalog } from './catalog.mjs';
import { scopeCss, ROOT_TYPOGRAPHY } from './scope-css.mjs';
import { modes } from '../screen-recipes.js';
import { buildLlms } from './llms.mjs';

const kobbeTracker = `  <script
    src="https://app.kobbe.io/tracker.js"
    data-token="01b288b6.Nx0YyvTQEED6n-xflmasSvpRFosUDlsw"
    defer
  ></script>`;

function withKobbeTracker(html) {
  if (html.includes('https://app.kobbe.io/tracker.js')) return html;
  return html.replace('</head>', `${kobbeTracker}\n</head>`);
}

/* Syntari's own pages are Syntari markup from top to bottom, so the scoped runtime styles and listeners cover them. */
const withSiteRoot = html => /<html\b[^>]*data-syntari-root/.test(html) ? html : html.replace(/<html\b/, '<html data-syntari-root');

async function injectKobbeTracking(file) {
  const html = await readFile(file, 'utf8');
  const tracked = withSiteRoot(withKobbeTracker(html));
  if (tracked !== html) await writeFile(file, tracked);
}

const kobbeIgnoredDirs = new Set(['.git', 'node_modules', 'dist', 'kit', 'downloads']);

async function injectKobbeTrackingTree(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && kobbeIgnoredDirs.has(entry.name)) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await injectKobbeTrackingTree(path);
    else if (entry.isFile() && entry.name.endsWith('.html')) await injectKobbeTracking(path);
  }
}

const components=await catalog();
const runtime=['syntari.js','support.html','ir.js','ir.css','screen-recipes.js','tokens.css','styles.css','motion.css','numbers.css','controls.css','app.js','motion.js','numbers.js','controls.js','starter.js','starter.css','navigation.js','navigation.css','agents.js','agents.css','extras.js','extras.css'];
const systemPage=await readFile('system/index.html','utf8');
await rm('kit',{recursive:true,force:true});
await mkdir('kit/runtime',{recursive:true});await mkdir('kit/components',{recursive:true});await mkdir('kit/patterns',{recursive:true});await cp('patterns','kit/patterns',{recursive:true});
for(const file of runtime)await copyFile(file,'kit/runtime/'+file);
/* The runtime styles and tokens apply only inside Syntari markup, so a host page keeps its own look. */
const scopedStyles=runtime.filter(file=>file.endsWith('.css'));
for(const file of scopedStyles)await writeFile('kit/runtime/'+file,(file==='styles.css'?ROOT_TYPOGRAPHY:'')+scopeCss(await readFile(file,'utf8')));
await cp('assets','kit/runtime/assets',{recursive:true});
await cp('registry','kit/runtime/registry',{recursive:true});
execFileSync(process.execPath,['scripts/generate-registry.mjs','--skeleton','all'],{
  stdio:'inherit',env:{...process.env,SYNTARI_REGISTRY_OUTPUT:resolve('kit/runtime/registry')}
});
await writeFile('kit/runtime/registry/patterns/screens.json',JSON.stringify(Object.fromEntries(Object.entries(modes).map(([id,mode])=>[id,mode.spec])),null,2)+'\n');
await writeFile('kit/catalog.json',JSON.stringify(components.map(({html,...c})=>c),null,2));
for(const c of components){
 const module=`import { mount as mountPattern } from './runtime/syntari.js';\n\nexport function mount(target, options = {}) {\n  return mountPattern('${c.slug}', target, options);\n}\n\nexport { prepare, setTheme } from './runtime/syntari.js';\n`;
 await writeFile(`kit/components/${c.slug}.js`,module);
 await writeFile(`kit/components/${c.slug}.html`,c.html.replace(/></g,'>\n<')+'\n');

}
await mkdir('downloads',{recursive:true});
/* Only the current release is downloadable; older archives would contradict the changelog. */
for(const file of await readdir('downloads'))if(/^syntari-ui-.*\.tgz$/.test(file))await rm(join('downloads',file));
execFileSync('npm',['pack','--pack-destination','downloads','--silent'],{
  stdio:'inherit',
  env:{...process.env,npm_config_cache:join(tmpdir(),'syntari-npm-cache')}
});
await rm('dist',{recursive:true,force:true});await mkdir('dist');
await copyFile('landing.html','dist/index.html');
await mkdir('dist/renderer',{recursive:true});
await copyFile('renderer.html','dist/renderer/index.html');
await writeFile('dist/library.html',redirect('/system/'));
await writeFile('dist/gallery.html',redirect('/system/'));
for(const file of ['HISTORY.md','CONTRIBUTING.md','LICENSE','landing.css','homepage.js','intent-renderer.js','renderer-workspace.css','workspace.css','workspace.js','favicon.svg','docs-data.js','docs-guides.js','preview.html','preview.js','preview.css','generative-ui.html','generative-ui.js',...runtime])await copyFile(file,'dist/'+file);
for(const file of scopedStyles)await copyFile('kit/runtime/'+file,'dist/'+file);
for(const dir of ['assets','downloads','system'])await cp(dir,'dist/'+dir,{recursive:true});
await cp('kit/runtime/registry','dist/registry',{recursive:true});
// Plain-text entry points for models, generated from the same registry the package ships.
const llms=await buildLlms('kit/runtime/registry');
await writeFile('dist/llms.txt',llms.short);await writeFile('dist/llms-full.txt',llms.full);
for(const file of ['README.md','AGENT-GUIDE.md'])await copyFile(file,'dist/'+file);
// Legacy documentation routes now lead to the integrated component reference.
await mkdir('dist/docs',{recursive:true});
await writeFile('dist/docs/index.html',redirect('/system/?guide=getting-started#button'));
await writeFile('dist/docs.html',redirect('/system/?guide=getting-started#button'));
await mkdir('dist/components',{recursive:true});
await writeFile('dist/components/index.html',systemPage);
for(const c of components){
  await mkdir(`dist/components/${c.slug}`,{recursive:true});
  await writeFile(`dist/components/${c.slug}/index.html`,systemPage);
  await mkdir(`dist/docs/components/${c.slug}`,{recursive:true});
  await writeFile(`dist/docs/components/${c.slug}/index.html`,redirect(`/system/?panel=usage#${c.slug}`));
}
for(const id of ['getting-started','installation','theming','motion','generative-ui','ai-patterns','composition','api','migration']){
  await mkdir(`dist/guides/${id}`,{recursive:true});
  await writeFile(`dist/guides/${id}/index.html`,redirect(`/system/?guide=${id}#button`));
}
function redirect(target, preserveHash=false){
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${target}"><title>Syntari</title></head><body><a href="${target}">Open Syntari</a><script>location.replace(${JSON.stringify(target)}${preserveHash ? '+location.hash' : ''})</script></body></html>`;
}
// Prototype workspaces live on the archive/prototypes branch; their public URLs lead to the production surfaces.
const legacyRoutes={'ai-behavioural-patterns.html':'/system/?guide=ai-patterns#agent-questions','Jev/index.html':'/renderer/','tmp/index.html':'/system/','tmp/components.html':'/system/','art-atlas/index.html':'/',
  'new/index.html':'/system/','new/components.html':'/system/','new/gallery.html':'/system/'};
for(const id of ['agentic-playground','command-palette','q2-performance','revenue-card','team-projects-report'])legacyRoutes[`new/${id}/index.html`]='/system/';
for(const [path,target] of Object.entries(legacyRoutes)){await mkdir(dirname(`dist/${path}`),{recursive:true});await writeFile(`dist/${path}`,redirect(target));}
await mkdir('dist/tmp/system',{recursive:true});
await writeFile('dist/tmp/system/index.html',redirect('/system/',true));

await injectKobbeTrackingTree('dist');
const packageMetadata=JSON.parse(await readFile('package.json','utf8'));
console.log(`Built Syntari ${packageMetadata.version}: ${components.length} component pages, Renderer and System workspaces, 9 integrated guides, and installable source archive.`);
