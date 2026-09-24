import { test, expect } from '@playwright/test';
import { catalog as readCatalog } from '../scripts/catalog.mjs';
import { readFile } from 'node:fs/promises';
const origin='http://127.0.0.1:4318';
const packageVersion=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
test('documentation routes, examples, source, installation and navigation',async({page,context})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.goto(origin+'/components/card-and-project-folder/');await expect(page.locator('h1')).toHaveText('Card & project folder');
 await page.getByRole('button',{name:'Expanded',exact:true}).click();await expect(page.locator('.project-folder')).toHaveAttribute('open','');
 await page.locator('.docs-toc').getByRole('link',{name:'API reference',exact:true}).click();await expect(page).toHaveURL(/card-and-project-folder\/#api-reference$/);await expect(page.locator('.project-folder')).toHaveAttribute('open','');
 await page.locator('.project-folder').getByRole('button',{name:'Identity',exact:true}).click();await expect(page.locator('[data-extra-status]')).toContainText('Identity selected');
 await page.getByRole('tab',{name:'Usage',exact:true}).click();await expect(page.locator('#panel-main pre')).toContainText('details.open = true');
 await page.locator('#panel-main [data-doc-copy]').click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('card-and-project-folder.js');
 await page.getByRole('tab',{name:'Code',exact:true}).click();await expect(page.locator('#panel-source pre')).toContainText('project-folder');
 await page.getByRole('tab',{name:'Interactions',exact:true}).click();await expect(page.locator('#panel-source pre')).toContainText('folder-file');await page.locator('#panel-source [data-expand-code]').click();await expect(page.locator('#panel-source .docs-code')).toHaveClass(/expanded/);
 await page.getByRole('tab',{name:'Styles',exact:true}).click();await expect(page.locator('#panel-source pre')).toContainText('.project-folder');
 await page.getByRole('tab',{name:'pnpm',exact:true}).click();await expect(page.locator('#panel-command')).toContainText('pnpm --package=');
 await page.getByRole('tab',{name:'Manual',exact:true}).click();await expect(page.getByRole('link',{name:new RegExp(`Download Syntari ${packageVersion}`)})).toHaveAttribute('href',new RegExp(`syntari-ui-${packageVersion.replaceAll('.', '\\.') }\\.tgzimport { test, expect } from '@playwright/test';
import { catalog as readCatalog } from '../scripts/catalog.mjs';
import { readFile } from 'node:fs/promises';
const origin='http://127.0.0.1:4318';
const packageVersion=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
test('documentation routes, examples, source, installation and navigation',async({page,context})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.goto(origin+'/components/card-and-project-folder/');await expect(page.locator('h1')).toHaveText('Card & project folder');
 await page.getByRole('button',{name:'Expanded',exact:true}).click();await expect(page.locator('.project-folder')).toHaveAttribute('open','');
 await page.locator('.docs-toc').getByRole('link',{name:'API reference',exact:true}).click();await expect(page).toHaveURL(/card-and-project-folder\/#api-reference$/);await expect(page.locator('.project-folder')).toHaveAttribute('open','');
 await page.locator('.project-folder').getByRole('button',{name:'Identity',exact:true}).click();await expect(page.locator('[data-extra-status]')).toContainText('Identity selected');
 await page.getByRole('tab',{name:'Usage',exact:true}).click();await expect(page.locator('#panel-main pre')).toContainText('details.open = true');
 await page.locator('#panel-main [data-doc-copy]').click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('card-and-project-folder.js');
 await page.getByRole('tab',{name:'Code',exact:true}).click();await expect(page.locator('#panel-source pre')).toContainText('project-folder');
 await page.getByRole('tab',{name:'Interactions',exact:true}).click();await expect(page.locator('#panel-source pre')).toContainText('folder-file');await page.locator('#panel-source [data-expand-code]').click();await expect(page.locator('#panel-source .docs-code')).toHaveClass(/expanded/);
 await page.getByRole('tab',{name:'Styles',exact:true}).click();await expect(page.locator('#panel-source pre')).toContainText('.project-folder');
 await page.getByRole('tab',{name:'pnpm',exact:true}).click();await expect(page.locator('#panel-command')).toContainText('pnpm --package=');
 await page.getByRole('tab',{name:'Manual',exact:true}).click();));
 await expect(page.locator('#api-reference')).toContainText('configure');
 await page.getByRole('searchbox',{name:'Search documentation'}).fill('agent todo');await page.locator('#docs-navigation').getByRole('link',{name:'Agent todo list',exact:true}).click();await expect(page).toHaveURL(/components\/agent-todo-list\/$/);
 await page.getByRole('button',{name:'Completed',exact:true}).click();await expect(page.locator('[data-run-status]')).toHaveText('All tasks completed');
 await page.getByRole('button',{name:'Running',exact:true}).click();await page.getByRole('button',{name:'Stop plan'}).click();await expect(page.locator('[data-run-status]')).toContainText('Plan stopped');
 await page.getByRole('button',{name:'Switch to light theme'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#docs-menu')).toBeVisible();await page.locator('#docs-menu').click();await expect(page.locator('body')).toHaveClass(/nav-open/);await page.getByRole('searchbox',{name:'Search documentation'}).fill('');await page.locator('#docs-navigation').getByRole('link',{name:'Theming',exact:true}).click();await expect(page.locator('h1')).toHaveText('One shared language.');await expect(page.locator('body')).not.toHaveClass(/nav-open/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goBack();await expect(page.locator('h1')).toHaveText('Agent todo list');await page.reload();await expect(page.locator('.syntari-component')).toBeVisible();expect(errors).toEqual([]);
});
test('all component pages and every authored preview state load without errors',async({page,request})=>{
 const catalog=await readCatalog();for(const c of catalog){const r=await request.get(origin+`/components/${c.slug}/`);expect(r.status(),c.slug).toBe(200);}
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/components/button/');await page.locator('.syntari-component').waitFor();
 const result=await page.evaluate(async()=>{
  const {getComponents,mount}=await import('/syntari.js');const {statesFor}=await import('/docs-data.js');const catalog=await getComponents();const errors=[];let states=0;
  document.querySelector('#docs-main').innerHTML='<div id="state-check"></div>';const target=document.querySelector('#state-check');
  for(const c of catalog)for(const state of statesFor(c)){
   let instance;try{instance=await mount(c.slug,target,{configure:state.code?new Function('root',state.code):undefined});if(!instance.element.children.length)throw Error('Empty example');states++;}catch(error){errors.push(c.slug+'/'+state.id+': '+error.message)}finally{instance?.destroy();target.replaceChildren();}
  }
  return{count:catalog.length,states,errors};
 });
 console.log(result);expect(result.count).toBe(catalog.length);expect(result.states).toBeGreaterThan(catalog.length * 2 - 10);expect(result.errors).toEqual([]);expect(errors).toEqual([]);
});
