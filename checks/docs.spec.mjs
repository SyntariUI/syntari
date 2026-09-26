import { test, expect } from '@playwright/test';
import { catalog as readCatalog } from '../scripts/catalog.mjs';
const origin='http://127.0.0.1:4398';
test('implementation lives beside the component, with legacy routes preserved',async({page,context})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.goto(origin+'/docs/components/card-and-project-folder/');
 await expect(page).toHaveURL(/system\/\?panel=usage#card-and-project-folder$/);
 await expect(page.locator('[data-usage-content]')).toContainText('How to use');
 await page.getByRole('button',{name:'Close panel'}).click();
 await page.locator('[data-states]').getByRole('button',{name:'Expanded',exact:true}).click();
 await expect(page.locator('.project-folder')).toHaveAttribute('open','');
 const instance=await page.locator('[data-component-mount] > div').elementHandle();
 await page.getByRole('button',{name:'Inspect component'}).click();
 await page.getByRole('button',{name:'Usage',exact:true}).click();
 await expect(page.locator('[data-usage-content] pre')).toContainText('details.open = true');
 await page.getByRole('button',{name:'Copy Usage example',exact:true}).click();
 expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('card-and-project-folder.js');
 await page.getByRole('button',{name:'API',exact:true}).click();
 await expect(page.locator('[data-api-content]')).toContainText('configure');
 await page.getByRole('button',{name:'Source',exact:true}).click();
 await page.getByRole('button',{name:'Interactions',exact:true}).click();
 await expect(page.locator('[data-source]')).toContainText('folder-file');
 await page.getByRole('button',{name:'Styles',exact:true}).click();
 await expect(page.locator('[data-source]')).toContainText('.project-folder');
 await page.getByRole('button',{name:'Installation',exact:true}).click();
 for(const pm of ['pnpm','yarn','bun','npm']){await page.getByRole('button',{name:pm,exact:true}).click();await expect(page.locator('[data-install-command]')).toContainText(pm);}
 await expect(page.locator('[data-install-details]')).toContainText('doctor --dir ./components/syntari');
 await expect(page.locator('[data-download-source]')).toHaveAttribute('href',/syntari-ui-0.2.2.tgz$/);
 expect(await page.evaluate(el=>el===document.querySelector('[data-component-mount] > div'),instance)).toBe(true);
 await page.getByRole('button',{name:'Guides',exact:true}).click();await page.locator('[data-guide-select]').selectOption('theming');
 await expect(page.locator('[data-guide-content]')).toContainText('One shared language.');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.reload();await expect(page.locator('[data-guide-content]')).toBeVisible();await expect(page.locator('[data-guide-select]')).toHaveValue('theming');
 await page.goto(origin+'/guides/installation/');await expect(page).toHaveURL(/system\/\?guide=installation#button$/);await expect(page.locator('[data-guide-content]')).toContainText('Your source. Your project.');
 expect(errors).toEqual([]);
});
test('all component pages and every authored preview state load without errors',async({page,request})=>{
 const catalog=await readCatalog();for(const c of catalog){const r=await request.get(origin+`/docs/components/${c.slug}/`);expect(r.status(),c.slug).toBe(200);}
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/docs/components/button/');await page.locator('.syntari-component').waitFor();
 const result=await page.evaluate(async()=>{
  const {getComponents,mount}=await import('/syntari.js');const {statesFor}=await import('/docs-data.js');const catalog=await getComponents();const errors=[];let states=0;
  document.querySelector('[data-component-mount]').innerHTML='<div id="state-check"></div>';const target=document.querySelector('#state-check');
  for(const c of catalog)for(const state of statesFor(c)){
   let instance;try{instance=await mount(c.slug,target,{configure:state.code?new Function('root',state.code):undefined});if(!instance.element.children.length)throw Error('Empty example');states++;}catch(error){errors.push(c.slug+'/'+state.id+': '+error.message)}finally{instance?.destroy();target.replaceChildren();}
  }
  return{count:catalog.length,states,errors};
 });
 console.log(result);expect(result.count).toBe(catalog.length);expect(result.states).toBeGreaterThan(catalog.length * 2 - 10);expect(result.errors).toEqual([]);expect(errors).toEqual([]);
});
