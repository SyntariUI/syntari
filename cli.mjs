#!/usr/bin/env node
import { readFile, mkdir, cp, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
const packageRoot=dirname(fileURLToPath(import.meta.url));
const kit=join(packageRoot,'kit');
const args=process.argv.slice(2);
try {
  const catalog=JSON.parse(await readFile(join(kit,'catalog.json'),'utf8'));
  if(args[0]==='list') {console.log(catalog.map(c=>`${c.slug.padEnd(30)} ${c.category}`).join('\n'));process.exit(0)}
  if(args[0]!=='add'||!args[1]) {console.log('Syntari UI 0.2\n\n  syntari list\n  syntari add <component...> [--dir ./components/syntari]\n\nCopies editable HTML, CSS and JavaScript. Existing files are never overwritten.\nServe your project over HTTP, then import the component module.');process.exit(args.length?1:0)}
  const names=[];let output='./components/syntari';
  for(let i=1;i<args.length;i++){if(args[i]==='--dir'){output=args[++i];if(!output)throw Error('--dir requires a path')}else if(args[i].startsWith('-'))throw Error(`Unknown option: ${args[i]}`);else names.push(args[i]);}
  if(!names.length)throw Error('Choose at least one component.');
  for(const name of names)if(!catalog.some(c=>c.slug===name))throw Error(`Unknown component: ${name}. Run syntari list to see available names.`);
  const target=resolve(output),runtime=join(target,'runtime');
  let existing=false;try{await access(target);existing=true}catch{}
  if(existing){let version;try{version=JSON.parse(await readFile(join(target,'syntari.json'),'utf8')).version}catch{throw Error('The destination already exists and is not an Syntari installation. Choose a new --dir.')}if(version!=='0.2.1')throw Error('This destination contains another Syntari version. Choose a new --dir.');}
  for(const name of names)for(const extension of ['.js','.html']){try{await access(join(target,name+extension));throw Error(`${name}${extension} already exists. Your changes have been preserved.`)}catch(error){if(error.code!=='ENOENT')throw error;}}
  if(!existing){await mkdir(target,{recursive:true});await cp(join(kit,'runtime'),runtime,{recursive:true,errorOnExist:true,force:false});await writeFile(join(target,'syntari.json'),JSON.stringify({version:'0.2.1'},null,2));}
  for(const name of names) {
    await cp(join(kit,'components',name+'.js'),join(target,name+'.js'),{errorOnExist:true,force:false});
    await cp(join(kit,'components',name+'.html'),join(target,name+'.html'),{errorOnExist:true,force:false});
  }
  console.log(`Added ${names.join(', ')} to ${target}\n\nImport { mount } from './${names[0]}.js' in your page's module script.\nRun await mount('#preview') to insert the interactive example.\nThe HTML files are editable manual-install templates; runtime/ contains shared source.`);
} catch(error) {console.error(`Syntari: ${error.message}`);process.exitCode=1;}
