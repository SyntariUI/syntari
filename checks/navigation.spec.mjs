import {test, expect} from '@playwright/test';
const url = 'http://127.0.0.1:4318/preview.html?screen=projects';

test('sidebar and topbar preserve editing state and navigation preferences', async ({page}) => {
  const errors=[]; page.on('pageerror', error=>errors.push(error.message));
  await page.goto(url);
  const shell = page.locator('[data-syntari-shell]');
  await shell.getByRole('link',{name:'Settings',exact:true}).click();
  const name = page.locator('[data-settings-form] input[name=name]');
  await name.fill('An unsaved name');
  await page.getByRole('button',{name:'Topbar',exact:true}).click();
  await expect(shell).toHaveAttribute('data-layout','topbar');
  await expect(name).toHaveValue('An unsaved name');
  await expect(page.locator('.settings-savebar')).toBeVisible();
  await page.getByRole('button',{name:'Sidebar',exact:true}).click();
  await expect(name).toHaveValue('An unsaved name');
  await shell.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
  await expect(shell).toHaveAttribute('data-collapsed','true');
  await expect(shell.getByRole('link',{name:'People',exact:true})).toBeVisible();
  await shell.getByRole('link',{name:'People',exact:true}).click();
  await expect(page.locator('.product-heading')).toContainText('Your people.');
  await expect(shell).toHaveAttribute('data-collapsed','true');
  await expect(shell.getByRole('button',{name:'Expand sidebar'})).toHaveAttribute('aria-expanded','false');
  await page.reload();
  await expect(shell).toHaveAttribute('data-collapsed','true');
  await shell.getByRole('button',{name:'Expand sidebar'}).click();
  await expect(shell).toHaveAttribute('data-collapsed','false');
  expect(errors).toEqual([]);
});

test('workspace menus, pinned records, search, create and help work in both layouts',async({page})=>{
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);
  const shell=page.locator('[data-syntari-shell]'),dialog=page.locator('#starter-dialog');
  for(const layout of ['Sidebar','Topbar']){
    await page.getByRole('button',{name:layout,exact:true}).click();
    await shell.getByRole('button',{name:'Syntari Studio workspace'}).click();
    await expect(shell.locator('.syntari-workspace-menu')).toBeVisible();
    await shell.getByRole('button',{name:'Workspace settings',exact:true}).press('Escape');
    await expect(shell.locator('.syntari-workspace-menu')).toBeHidden();
    await shell.getByRole('button',{name:'Search',exact:true}).click();
    await expect(page.getByRole('combobox',{name:'Search commands'})).toBeVisible();
    await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
    await shell.locator('[data-nav-action=create]').click();
    await expect(dialog.getByRole('heading',{name:'Create a project'})).toBeVisible();
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click(); await expect(dialog).toBeHidden();
    await shell.getByRole('button',{name:'Help & shortcuts'}).click();
    await expect(dialog).toContainText('Close a menu or drawer');
    await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
  }
  await page.getByRole('button',{name:'Sidebar',exact:true}).click();
  await shell.getByRole('button',{name:'Open Brand refresh',exact:true}).click();
  await expect(dialog.getByRole('heading',{name:'Project details',exact:true})).toBeVisible();
  await expect(dialog.getByRole('textbox',{name:'Project name',exact:true})).toHaveValue('Brand refresh');
  expect(errors).toEqual([]);
});

test('mobile drawer traps focus, closes with Escape and backdrop, and follows navigation',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(url);
  const shell=page.locator('[data-syntari-shell]'),drawer=page.getByRole('dialog',{name:'Workspace navigation',exact:true});
  for(const layout of ['Sidebar','Topbar']){
    await page.getByRole('button',{name:layout,exact:true}).click();
    const trigger=page.getByRole('button',{name:'Open workspace navigation'});
    await trigger.click();
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button',{name:'Close workspace navigation'})).toBeFocused();
    await drawer.getByRole('button',{name:'Account settings for Alex Morgan'}).focus();
    await page.keyboard.press('Tab');
    await expect.poll(()=>drawer.evaluate(el=>el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden(); await expect(trigger).toBeFocused();
    await trigger.click();
    await page.mouse.click(370,420);
    await expect(drawer).toBeHidden(); await expect(trigger).toBeFocused();
    await trigger.click();
    await drawer.getByRole('link',{name:'People',exact:true}).click();
    await expect(drawer).toBeHidden();
    await expect(page.locator('.product-heading')).toContainText('Your people.');
    await expect(shell).toHaveAttribute('data-layout',layout.toLowerCase());
    await expect(shell.locator('.syntari-nav-panel')).toHaveAttribute('inert','');
  }
});

test('navigation fits phones and tablets, and the catalog exposes both layouts',async({page})=>{
  await page.goto(url);
  for(const theme of ['dark','light']){
    if(await page.locator('html').getAttribute('data-theme') !== theme){
      await page.locator('[data-preview-theme]').click();
    }
    for(const width of [320,390,768,1024,1440]){
      await page.setViewportSize({width,height:1000});
      for(const layout of ['Sidebar','Topbar']){
        await page.getByRole('button',{name:layout,exact:true}).click();
        await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      }
    }
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:4318/components/app-shell/');
  const example=page.locator('#live-example');
  await example.getByRole('button',{name:'Topbar',exact:true}).click();
  await example.getByRole('link',{name:'People',exact:true}).click();
  await expect(example.getByRole('heading',{name:'People',exact:true})).toBeVisible();
  await expect(page).toHaveURL(/components\/app-shell\//);
  await page.getByRole('button',{name:'Reset and replay preview'}).click();
  await expect(example.locator('[data-syntari-shell]')).toHaveAttribute('data-layout','sidebar');
});
