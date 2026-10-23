import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
export async function catalog() {
  /* The names people search for, kept in one file for every search: System, the command palette, the CLI, and agents. */
  const aliases=JSON.parse(await readFile('registry/aliases.json','utf8'));
  const context = vm.createContext({ console, URLSearchParams, location:{search:''}, localStorage:{getItem:()=>null}, document:{addEventListener(){},querySelectorAll:()=>[]}, addEventListener(){}, setInterval(){}, setTimeout(){}, clearTimeout(){}, clearInterval(){} });
  context.window=context;
  let app=await readFile('app.js','utf8');
  vm.runInContext(app.slice(0, app.indexOf('const categoryIcons'))+'\nconst categoryIcons={};function renderGallery(){};function hydrate(){};',context);
  vm.runInContext('window.SyntariIcon=icon;',context);
  for(const name of ['navigation','starter','agents','extras']) {
    let source=await readFile(name+'.js','utf8');
    if(name==='starter')source=source.replace(' init();',' register();');
    if(name==='extras')source=source.slice(0,source.indexOf(' renderGallery();'))+'})();';
    vm.runInContext(source, context, {filename:name+'.js'});
  }
  return JSON.parse(vm.runInContext('JSON.stringify(components)',context)).map(c=>({...c,slug:c.id??c.name.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),aliases:aliases[c.id]??[]}));
}
