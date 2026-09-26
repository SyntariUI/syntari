import { test, expect } from '@playwright/test';
const origin='http://127.0.0.1:4398';

test('tmp component workspace mounts a visible Syntari component', async ({page}) => {
  const errors=[]; const consoles=[]; const failed=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',msg=>consoles.push(msg.type()+': '+msg.text()));
  page.on('requestfailed',request=>failed.push(request.url()+' :: '+request.failure()?.errorText));

  await page.goto(origin+'/tmp/components.html#button');
  await page.waitForTimeout(1800);

  const moduleProbe=await page.evaluate(async()=>{
    try {
      const mod=await import('/tmp/tmp.js?probe=1');
      return {ok:true,exports:Object.keys(mod)};
    } catch(error) {
      return {ok:false,name:error?.name,message:error?.message,stack:error?.stack};
    }
  });

  const debug=await page.evaluate(()=>{
    const host=document.querySelector('[data-component-mount]');
    const mounted=host?.querySelector('[data-syntari-component]');
    const buttons=host ? [...host.querySelectorAll('.button')] : [];
    const box=mounted?.getBoundingClientRect();
    const hostBox=host?.getBoundingClientRect();
    const wrap=document.querySelector('.preview-component-wrap')?.getBoundingClientRect();
    return {
      title:document.querySelector('[data-docs-title]')?.textContent,
      total:document.querySelector('[data-total-components]')?.textContent,
      hostHTML:host?.innerHTML?.slice(0,1200),
      mounted: mounted?.dataset?.syntariComponent || null,
      mountedClasses: mounted?.className || null,
      buttonCount:buttons.length,
      buttonTexts:buttons.map(b=>b.textContent.trim()),
      mountedBox:box?{x:box.x,y:box.y,width:box.width,height:box.height}:null,
      hostBox:hostBox?{x:hostBox.x,y:hostBox.y,width:hostBox.width,height:hostBox.height}:null,
      wrap:wrap?{x:wrap.x,y:wrap.y,width:wrap.width,height:wrap.height}:null,
      previewStatus:document.querySelector('[data-preview-status]')?.textContent,
      output:document.querySelector('[data-preview-output]')?.textContent
    };
  });

  console.log('TMP MODULE PROBE',JSON.stringify(moduleProbe));
  console.log('TMP COMPONENT DEBUG',JSON.stringify(debug));
  console.log('TMP PAGE ERRORS',JSON.stringify(errors));
  console.log('TMP CONSOLE',JSON.stringify(consoles));
  console.log('TMP FAILED REQUESTS',JSON.stringify(failed));

  expect(moduleProbe.ok).toBe(true);
  expect(errors).toEqual([]);
  expect(debug.title).toBe('Button');
  expect(debug.mounted).toBe('button');
  expect(debug.buttonCount).toBeGreaterThanOrEqual(4);
  expect(debug.mountedBox?.width || 0).toBeGreaterThan(250);
  expect(debug.mountedBox?.height || 0).toBeGreaterThan(180);
});