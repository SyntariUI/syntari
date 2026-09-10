export default async page=>{
 const checks=[],check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label)};
 await page.goto('http://127.0.0.1:4318/gallery.html');
 await page.locator('[data-category="Form controls"]').click();
 const checkbox=page.getByRole('checkbox',{name:'Include all team members'});await checkbox.uncheck();await checkbox.focus();await page.keyboard.press('Space');check(await checkbox.isChecked(),'Styled checkbox retains keyboard behavior');
 await page.getByRole('radio',{name:'Only me',exact:true}).check();check(await page.getByRole('radio',{name:'Only me',exact:true}).isChecked(),'Styled radio retains exclusive selection');
 check(await page.locator('.ds-date>.control-trigger>.lucide').count()===1,'Date field displays Lucide calendar');
 await page.getByRole('button',{name:'Start date',exact:true}).click();await page.getByRole('button',{name:'Sep 15, 2026',exact:true}).click();check((await page.locator('[data-date-label]').innerText()).includes('Sep 15'),'Custom date remains selectable');
 const zone=page.locator('[data-drop-zone]');
 await zone.locator('input').setInputFiles({name:'orbit-attachment.txt',mimeType:'text/plain',buffer:Buffer.from('Orbit test attachment')});check((await zone.innerText()).includes('orbit-attachment.txt'),'File selection displays local attachment');
 await zone.evaluate(el=>{const input=el.querySelector('input');input.click=()=>{el.dataset.pickerRequests=Number(el.dataset.pickerRequests||0)+1}});await zone.click();await zone.getByRole('button',{name:'Select assets',exact:true}).focus();await page.keyboard.press('Enter');await page.keyboard.press('Space');check(await zone.getAttribute('data-picker-requests')==='3','Click, Enter and Space invoke picker');
 await zone.evaluate(el=>{const data=new DataTransfer();data.items.add(new File(['drop'],'dropped.txt',{type:'text/plain'}));el.dispatchEvent(new DragEvent('dragover',{bubbles:true,dataTransfer:data}));el.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:data}))});check((await zone.innerText()).includes('dropped.txt'),'Drop displays local file');
 check(await zone.locator('input').isHidden(),'Native file button stays hidden');
 await page.locator('[data-category="Overlay"]').click();
 for(const theme of ['Light theme','Dark theme']){await page.getByRole('button',{name:theme,exact:true}).click();await page.getByRole('button',{name:'Show toast',exact:true}).click();check(await page.locator('#toast').evaluate(el=>getComputedStyle(el).backgroundColor)==='rgb(20, 20, 31)',`${theme}: actual toast remains dark`);check(await page.locator('.toast-preview').evaluate(el=>getComputedStyle(el).backgroundColor)==='rgb(20, 20, 31)',`${theme}: toast specimen remains dark`)}
 await page.getByRole('button',{name:'Light theme',exact:true}).click();await page.locator('.sidebar [data-view="gallery"]').click();return checks;
}
