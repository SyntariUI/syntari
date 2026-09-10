import { test, expect } from '@playwright/test';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
const exec=promisify(execFile);
test('documented archive installs and runs in a clean project',async({page})=>{
 const temp=await mkdtemp(join(tmpdir(),'orbit-install-check-'));let server;
 try{
  const {stdout}=await exec('npm',['exec','--yes','--package=http://127.0.0.1:4318/downloads/orbit-ui-0.2.1.tgz','--','orbit','add','button','slider','--dir',join(temp,'components/orbit')],{cwd:temp,timeout:60000});expect(stdout).toContain('Added button, slider');
  const entry=join(temp,'components/orbit/button.js');await writeFile(entry,(await readFile(entry,'utf8'))+'\n// A local customization.\n');
  const duplicate=await exec(process.execPath,['cli.mjs','add','button','--dir',join(temp,'components/orbit')],{cwd:process.cwd()}).then(()=>null,e=>e);expect(duplicate.stderr).toContain('already exists');expect(await readFile(entry,'utf8')).toContain('A local customization');
  const unknown=await exec(process.execPath,['cli.mjs','add','../../outside','--dir',join(temp,'invalid')],{cwd:process.cwd()}).then(()=>null,e=>e);expect(unknown.stderr).toContain('Unknown component');expect(await access(join(temp,'invalid')).then(()=>true,()=>false)).toBe(false);
  await writeFile(join(temp,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fresh Orbit project</title></head><body><main><div id="action"></div><div id="events"></div><output id="result"></output></main><script type="module">import {mount as button} from './components/orbit/button.js';import {mount as slider} from './components/orbit/slider.js';window.button=await button('#action',{configure(root){root.querySelector('.primary').textContent='Save changes';},onAction(event){if(event.target.closest('.primary'))document.querySelector('#result').textContent='Saved';}});window.slider=await slider('#events',{onInput(event){document.querySelector('#result').textContent=event.target.value;}});</script></body></html>`);
  server=createServer(async(req,res)=>{try{const path=resolve(temp,'.'+new URL(req.url,'http://localhost').pathname);const file=path===temp?join(temp,'index.html'):path;if(!file.startsWith(temp))throw Error('Path');const body=await readFile(file);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[extname(file)]||'application/octet-stream'}).end(body)}catch{res.writeHead(404).end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.locator('#result')).toHaveText('Saved');
  await page.getByRole('slider',{name:'Monthly events'}).fill('20000');await expect(page.locator('#result')).toHaveText('20000');await expect(page.locator('[data-range-value]')).toHaveText('20,000');
  await page.evaluate(()=>window.slider.reset());await expect(page.getByRole('slider',{name:'Monthly events'})).toHaveValue('10000');await page.evaluate(()=>window.slider.destroy());await expect(page.locator('#events')).toBeEmpty();expect(errors).toEqual([]);
 }finally{if(server)await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true});}
});
