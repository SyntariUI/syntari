import { test, expect } from '@playwright/test';
const origin='http://127.0.0.1:4318';
async function open(page,slug){await page.goto(`${origin}/components/${slug}/`);await page.locator('.orbit-component').waitFor();}
const live=page=>page.locator('.orbit-component');

test('simple table sorts typed values in both directions and preserves focus',async({page})=>{
 await open(page,'simple-data-table');
 const root=live(page);
 for(const key of ['name','status','progress','budget','updated']){
  const heading=root.locator(`[data-simple-sort=${key}]`);
  for(const dir of [1,-1]){
   await heading.click();
   await expect(heading).toBeFocused();
   await expect(heading.locator('..')).toHaveAttribute('aria-sort',dir===1?'ascending':'descending');
   const values=await root.locator('tbody tr').evaluateAll((rows,k)=>rows.map(r=>r.dataset[k]),key);
   const sorted=[...values].sort((a,b)=>(['progress','budget'].includes(key)?Number(a)-Number(b):a.localeCompare(b,'en',{numeric:true}))*dir);
   expect(values).toEqual(sorted);
  }
 }
 await root.getByRole('button',{name:'Open Brand refresh'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(root.getByRole('button',{name:'Open Brand refresh'})).toBeFocused();
});

test('folder disclosure, field containment, empty state and range keyboard regressions',async({page})=>{
 await open(page,'file-tree');
 const tree=live(page);const summary=tree.locator('summary').filter({hasText:'Components'});
 await expect(summary.locator('.icon-folder')).toHaveCSS('transform','none');
 await summary.click();await expect(tree.getByRole('button',{name:'Button.html',exact:true})).not.toBeVisible();
 await summary.click();await tree.getByRole('button',{name:'Button.html',exact:true}).click();await expect(tree.locator('[data-tree-status]')).toContainText('Shared actions');
 await expect(summary.locator('.icon-folder')).toHaveCSS('transform','none');
 await open(page,'empty-state');expect(await live(page).locator('.button').evaluate(el=>el.offsetWidth<el.parentElement.offsetWidth*.9)).toBe(true);
 await open(page,'password-field');await page.setViewportSize({width:390,height:844});
 await live(page).getByLabel('Password',{exact:true}).fill('A-long-local-example');
 await live(page).getByRole('button',{name:'Show password'}).click();
 expect(await live(page).locator('.password-control').evaluate(el=>{const r=el.getBoundingClientRect(),b=el.querySelector('button').getBoundingClientRect();return b.right<=r.right&&el.scrollWidth<=el.clientWidth})).toBe(true);
 await open(page,'range-slider');const min=live(page).getByRole('slider',{name:'Minimum budget'});await min.focus();await page.keyboard.press('End');
 await expect(min).toHaveValue('1000');await expect(live(page).getByRole('slider',{name:'Maximum budget'})).toHaveValue('1000');await expect(live(page).locator('[data-range-output]')).toHaveText('$1000 – $1000');
 await expect(min).toHaveCSS('appearance','none');
});

test('visible state transitions: notifications, export, scheduler, upload and local file',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await open(page,'notification-stack');await live(page).getByRole('button',{name:'Add notification'}).click();await expect(live(page).locator('.notification-item')).toHaveCount(3);
 await live(page).getByRole('button',{name:'Dismiss workspace update'}).click();await expect(live(page).locator('.notification-item')).toHaveCount(2);await expect(live(page).locator('.agent-heading')).toContainText('2 unread');
 await open(page,'action-swap');await live(page).getByRole('button',{name:'Prepare export'}).click();await expect(live(page).getByRole('button',{name:'Preparing…'})).toHaveAttribute('aria-busy','true');await expect(live(page).getByRole('button',{name:'Prepare again'})).toBeEnabled();await expect(live(page).getByRole('status')).toContainText('Export ready');
 await open(page,'availability-scheduler');await live(page).getByRole('button',{name:'Tue',exact:true}).click();await live(page).getByRole('button',{name:'14:00',exact:true}).click();await live(page).getByRole('button',{name:'Confirm time'}).click();await expect(live(page).getByRole('button',{name:'Confirmed',exact:true})).toBeDisabled();await live(page).getByRole('button',{name:'Mon',exact:true}).click();await expect(live(page).getByRole('button',{name:'Confirm time'})).toBeDisabled();
 await open(page,'upload-progress');await live(page).getByRole('button',{name:'Start upload'}).click();await expect(live(page).getByRole('button',{name:'Cancel',exact:true})).toBeEnabled();await expect(live(page).getByRole('status')).toHaveText('Upload complete');await expect(live(page).getByRole('button',{name:'Cancel',exact:true})).not.toBeVisible();await live(page).getByRole('button',{name:'Upload again'}).click();await live(page).getByRole('button',{name:'Cancel',exact:true}).click();await expect(live(page).getByRole('status')).toHaveText('Upload cancelled');
 await open(page,'file-input');await live(page).locator('input[type=file]').setInputFiles({name:'sample.txt',mimeType:'text/plain',buffer:Buffer.from('Local preview')});await expect(live(page)).toContainText('Asset selected');await live(page).getByRole('button',{name:'Remove selected file'}).click();await expect(live(page)).toContainText('No assets selected');
 expect(errors).toEqual([]);
});

test('modal bodies scroll independently and keep actions reachable on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:700});
 for(const [slug,trigger] of [['command-palette','[data-open-command]'],['bottom-sheet','[data-open-sheet]'],['date-range-picker','[data-date-range]'],['time-picker','[data-time-picker]']]){
  await open(page,slug);await live(page).locator(trigger).click();const dialog=page.locator('#starter-dialog');await expect(dialog).toBeVisible();
  await expect.poll(()=>dialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})).toBe(true);
  if(slug==='command-palette'){
   await page.keyboard.press('ArrowDown');await expect(dialog.getByRole('combobox')).toHaveAttribute('aria-activedescendant','command-1');
   await dialog.locator('#command-results').evaluate(el=>el.scrollTop=el.scrollHeight);
   expect(await dialog.evaluate(el=>el.querySelector('#command-results').getBoundingClientRect().bottom<=el.querySelector('.starter-layer-body>.hint').getBoundingClientRect().top)).toBe(true);
  }
  if(slug==='date-range-picker'){await expect(dialog.getByRole('button',{name:'Apply range'})).toBeInViewport();}
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(live(page).locator(trigger)).toBeFocused();
 }
});

test('pointer motion runs normally and reduced motion preserves final states',async({page})=>{
 await open(page,'tilt-card');const card=live(page).locator('.orbit-tilt');await card.hover({position:{x:20,y:20}});await expect.poll(()=>card.evaluate(el=>el.style.transform)).toContain('perspective');
 await page.mouse.move(10,10);await expect.poll(()=>card.evaluate(el=>el.style.transform)).toBe('');
 await page.emulateMedia({reducedMotion:'reduce'});await card.hover();await expect(card).toHaveCSS('transform','none');
 await open(page,'action-swap');await live(page).getByRole('button',{name:'Prepare export'}).click();await expect(live(page).getByRole('button',{name:'Prepare again'})).toBeEnabled();expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
 await open(page,'otp-input');await live(page).getByRole('textbox').fill('123456');await live(page).getByRole('button',{name:'Verify code'}).click();await expect(live(page).getByRole('button',{name:'Verified'})).toBeDisabled();await live(page).getByRole('textbox').fill('111111');await expect(live(page).getByRole('button',{name:'Verify code'})).toBeEnabled();
});

test('every default component fits its documentation preview in both themes at three widths',async({page})=>{
 await open(page,'button');await page.emulateMedia({reducedMotion:'reduce'});
 const failures=[];
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});
  for(const theme of ['light','dark']){
   const result=await page.evaluate(async({theme})=>{
    const {getComponents,mount,setTheme}=await import('/orbit.js');setTheme(theme);const catalog=await getComponents(),fail=[];
    const stage=document.querySelector('.docs-stage'),container=document.querySelector('#live-example');container.replaceChildren();
    for(const c of catalog){stage.classList.toggle('is-wide',/table|chat-workspace|app-shell|masonry-grid|agent-questions/.test(c.slug));const instance=await mount(c.slug,container);const root=instance.element;
     if(root.scrollWidth>root.clientWidth+2)fail.push({slug:c.slug,width:root.clientWidth,scroll:root.scrollWidth});
     instance.destroy();
    }return fail;
   },{theme});failures.push(...result.map(r=>({...r,theme,viewport:width})));
  }
 }
 console.log('Preview overflow audit:',failures);expect(failures).toEqual([]);
});

test('mounted form names support review and confirmation and repeated save bar changes',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page,'agent-questions');
 await live(page).getByRole('radio',{name:'Accessibility',exact:true}).check();await live(page).getByRole('textbox').fill('Keep keyboard access');await live(page).getByRole('button',{name:'Review response'}).click();await expect(live(page).getByRole('status')).toContainText('accessibility');await live(page).getByRole('button',{name:'Confirm response'}).click();await expect(live(page).getByRole('status')).toContainText('saved');
 await open(page,'unsaved-changes');const input=live(page).getByRole('textbox');await input.fill('New name');await expect(live(page).getByRole('button',{name:'Save',exact:true})).toBeVisible();await input.fill('Orbit Studio');await input.fill('New name again');await expect(live(page).getByRole('button',{name:'Save',exact:true})).toBeEnabled();await live(page).getByRole('button',{name:'Save',exact:true}).click();await expect(live(page).locator('.unsaved-bar')).not.toBeVisible();await expect(input).toBeFocused();expect(errors).toEqual([]);
});

test('editing a simple table record updates its cell and retains sort direction',async({page})=>{
 await open(page,'simple-data-table');await live(page).locator('[data-simple-sort=name]').click();await live(page).getByRole('button',{name:'Open Brand refresh'}).click();await page.getByRole('dialog').getByLabel('Project name').fill('Zebra project');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(live(page).getByRole('button',{name:'Open Zebra project'})).toBeVisible();await expect(live(page).locator('tbody tr').last()).toContainText('Zebra project');await expect(live(page).locator('[data-simple-sort=name]').locator('..')).toHaveAttribute('aria-sort','ascending');
});
