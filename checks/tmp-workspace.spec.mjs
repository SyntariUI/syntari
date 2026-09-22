import { test, expect } from '@playwright/test';
const origin='http://127.0.0.1:4318';

test('tmp component workspace mounts a visible Syntari component', async ({page}) => {
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/tmp/components.html#button');
  await page.locator('[data-docs-title]').waitFor();
  await expect(page.locator('[data-docs-title]')).toHaveText('Button');
  await page.waitForTimeout(1400);

  const debug=await page.evaluate(()=>{
    const host=document.querySelector('[data-component-mount]');
    const mounted=host?.querySelector('[data-syntari-component]');
    const buttons=host ? [...host.querySelectorAll('.button')] : [];
    const box=mounted?.getBoundingClientRect();
    const hostBox=host?.getBoundingClientRect();
    const wrap=document.querySelector('.preview-component-wrap')?.getBoundingClientRect();
    return {
      hostHTML: host?.innerHTML?.slice(0,1200),
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
  console.log('TMP COMPONENT DEBUG',JSON.stringify(debug));
  console.log('TMP PAGE ERRORS',JSON.stringify(errors));

  expect(errors).toEqual([]);
  expect(debug.mounted).toBe('button');
  expect(debug.buttonCount).toBeGreaterThanOrEqual(4);
  expect(debug.mountedBox?.width || 0).toBeGreaterThan(250);
  expect(debug.mountedBox?.height || 0).toBeGreaterThan(180);
});