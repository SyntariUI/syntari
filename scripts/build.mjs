import { mkdir, copyFile, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { catalog } from './catalog.mjs';
const components=await catalog();
const runtime=['syntari.js','support.html','tokens.css','styles.css','motion.css','numbers.css','controls.css','app.js','motion.js','numbers.js','controls.js','starter.js','starter.css','navigation.js','navigation.css','agents.js','agents.css','extras.js','extras.css'];
const docs=await readFile('docs.html','utf8');
await writeFile('index.html',docs);
await writeFile('gallery.html',docs.replace('<title>Syntari — Component library</title>','<title>Gallery — Syntari UI</title>'));
await rm('kit',{recursive:true,force:true});
await mkdir('kit/runtime',{recursive:true});await mkdir('kit/components',{recursive:true});
for(const file of runtime)await copyFile(file,'kit/runtime/'+file);
await cp('assets','kit/runtime/assets',{recursive:true});
await writeFile('kit/catalog.json',JSON.stringify(components.map(({html,...c})=>c),null,2));
for(const c of components){
 const module=`import { mount as mountPattern } from './runtime/syntari.js';\n\nexport function mount(target, options = {}) {\n  return mountPattern('${c.slug}', target, options);\n}\n\nexport { prepare, setTheme } from './runtime/syntari.js';\n`;
 await writeFile(`kit/components/${c.slug}.js`,module);
 await writeFile(`kit/components/${c.slug}.html`,c.html.replace(/></g,'>\n<')+'\n');
 const dir=`components/${c.slug}`;await mkdir(dir,{recursive:true});
 const page=docs.replace('<head>','<head><base href="../../">').replace('<title>Syntari — Component library</title>',`<title>${c.name.replace(/&/g,'&amp;')} — Syntari UI</title>`);
 await writeFile(dir+'/index.html',page);
}
for(const id of ['getting-started','installation','theming','motion','composition','api','migration']){await mkdir(`guides/${id}`,{recursive:true});await writeFile(`guides/${id}/index.html`,docs.replace('<head>','<head><base href="../../">'));}
await mkdir('downloads',{recursive:true});
execFileSync('npm',['pack','--pack-destination','downloads','--silent'],{stdio:'pipe'});
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const file of ['index.html','gallery.html','favicon.svg','docs.css','docs.js','docs-data.js','docs-guides.js','docs-gallery.js','preview.html','preview.js','preview.css',...runtime])await copyFile(file,'dist/'+file);
for(const dir of ['assets','components','guides','downloads'])await cp(dir,'dist/'+dir,{recursive:true});
console.log(`Built Syntari 0.2.1: ${components.length} component pages, 7 guides, gallery, and installable source archive.`);
