import { setTheme } from './theme.mjs';
export default async page=>{
 const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));const check=(x,label)=>{if(!x)throw Error(label);results.push(label)};
 await page.goto('http://127.0.0.1:4318/gallery.html?v=controls2');await page.locator('[data-category="Form controls"]').click();
 await page.getByRole('button',{name:'Workspace',exact:true}).click();
 check(await page.getByRole('listbox',{name:'Workspaces'}).isVisible(),'Workspace uses shared floating dropdown');
 await page.getByRole('option',{name:'Product team'}).click();check((await page.getByRole('button',{name:'Workspace',exact:true}).innerText()).includes('Product team'),'Workspace selection persists');
 const trigger=page.getByRole('button',{name:'Start date',exact:true});await trigger.click();
 check(await page.getByRole('dialog',{name:'Choose start date'}).isVisible(),'Custom calendar opens');
 await page.getByRole('button',{name:'Sep 10, 2026',exact:true}).press('ArrowRight');await page.keyboard.press('Enter');
 check((await trigger.innerText()).includes('Sep 11, 2026'),'Calendar arrow navigation and Enter select date');
 await trigger.click();await page.getByRole('button',{name:'Next month',exact:true}).click();check(await page.getByRole('heading',{name:'October 2026'}).isVisible(),'Month navigation works');
 await page.getByRole('button',{name:'Oct 31, 2026',exact:true}).focus();await page.keyboard.press('PageDown');check(await page.getByRole('heading',{name:'November 2026'}).isVisible(),'PageDown crosses months');await page.keyboard.press('Enter');check((await trigger.innerText()).includes('Nov 30, 2026'),'Month navigation clamps day correctly');
 await trigger.click();await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'Choose start date'}).waitFor({state:'hidden'});check(await trigger.evaluate(el=>el===document.activeElement),'Escape restores trigger focus');
 const checkbox=page.getByRole('checkbox',{name:'Include all team members'});await checkbox.focus();const was=await checkbox.isChecked();await page.keyboard.press('Space');check(await checkbox.isChecked()!==was,'Checkbox retains Space interaction');
 await page.getByRole('radio',{name:'Only me',exact:true}).check();check(await page.getByRole('radio',{name:'Everyone',exact:true}).isChecked()===false,'Radio group remains exclusive');
 const slider=page.getByRole('slider',{name:'Monthly events'});await slider.focus();await page.keyboard.press('End');check(await slider.inputValue()==='50000','Slider End reaches maximum');check((await slider.evaluate(el=>el.style.getPropertyValue('--range-fill')))==='100%','Slider fill follows value');await page.keyboard.press('Home');check(await slider.inputValue()==='1000','Slider Home reaches minimum');
 const zone=page.locator('[data-drop-zone]');check(await zone.getByRole('button',{name:'Select assets',exact:true}).isVisible(),'Empty-state upload has small asset button');
 await zone.evaluate(el=>{const dt=new DataTransfer();dt.items.add(new File(['asset'],'photo.png',{type:'image/png'}));el.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt}))});check((await zone.innerText()).includes('photo.png'),'Drop still selects a local asset');
 for(const theme of ['Dark theme','Light theme']){await setTheme(page,theme);await page.setViewportSize({width:390,height:844});await trigger.click();const box=await page.locator('.calendar-panel:not([hidden])').boundingBox();check(box.x>=0&&box.x+box.width<=390,`${theme}: calendar fits mobile`);await page.keyboard.press('Escape');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${theme}: controls fit mobile`)}
 await page.setViewportSize({width:1405,height:1000});await page.getByRole('searchbox',{name:'Find a component'}).fill('Select & date');await trigger.click();await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect.getTiming().iterations!==Infinity));await page.screenshot({path:'test-results/controls-preview.png'});await page.keyboard.press('Escape');await page.getByRole('searchbox',{name:'Find a component'}).fill('');
 check(errors.length===0,'No control runtime errors');return results;
}
