import {statesFor, contractFor, commonAPI, guideLinks, sourceFor} from '../docs-data.js';
import {guideContent} from '../docs-guides.js';
import {copyText} from '../workspace.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=selector=>document.querySelector(selector);
const files=new Map();
let component, version, manager='npm', currentState='default', revision=0, activeGuide='getting-started';
export function command(slug,pm=manager){
 const pkg=`https://syntariui.giovanitier.com/downloads/syntari-ui-${version}.tgz`;
 return {npm:`npm exec --yes --package=${pkg} -- syntari add ${slug}`,pnpm:`pnpm dlx --package=${pkg} syntari add ${slug}`,yarn:`yarn dlx -p ${pkg} syntari add ${slug}`,bun:`bunx -p ${pkg} syntari add ${slug}`}[pm];
}
function snippet(text,title){return `<div class="sys-snippet"><header><span>${esc(title)}</span><button data-reference-copy aria-label="Copy ${esc(title)}">Copy</button></header><pre tabindex="0"><code>${esc(text)}</code></pre><p role="status" class="workspace-message"></p></div>`;}
function apiTable(rows){return `<div class="sys-api-table"><table><thead><tr><th>Name</th><th>Type / default</th><th>Description</th></tr></thead><tbody>${rows.map(([name,type,value,description])=>`<tr><td><code>${esc(name)}</code></td><td><code>${esc(type)}</code><small>${esc(value)}</small></td><td>${esc(description)}</td></tr>`).join('')}</tbody></table></div>`;}
export function usage(){
 const state=statesFor(component).find(s=>s.id===currentState);
 return `<div id="example"></div>\n\n<script type="module">\n  import { mount } from './components/syntari/${component.slug}.js';\n\n  const instance = await mount('#example'${state?.code?`, {\n    configure(root) {\n${state.code.split('\n').map(line=>'      '+line).join('\n')}\n    }\n  }`:''});\n\n  // Connect your application data and actions here.\n  // Call instance.destroy() when removing this screen.\n</script>`;
}
export function renderReference(c,release,state){
 component=c;version=release;currentState=state;revision++;
 $('[data-dependencies]').textContent='Loading registry dependencies…';
 $('[data-accessibility-contract]').textContent='Loading contract…';
 $('[data-usage-content]').innerHTML=`<h2>How to use</h2><p>Install this component, then mount it in your page. This example follows the selected preview state.</p>${snippet(usage(),'Usage example')}<h2>Interaction and states</h2>${statesFor(c).map(s=>`<details ${s.id===state?'open':''}><summary>${esc(s.label)}</summary><p>${esc(s.description)}</p></details>`).join('')}<h2>Accessibility</h2><p>Keep the template’s accessible labels, focus treatment, and native keyboard behavior. Shared motion respects reduced-motion preferences. Connect and authorize real service actions in your application.</p>`;
 $('[data-api-content]').innerHTML=`<h2>Mount options</h2><p>These options belong to the installed JavaScript mount function.</p>${apiTable(commonAPI)}<h2>Element contract</h2><p>Native attributes and data values in this component’s HTML. Update them through configure(root) or the editable template.</p>${apiTable(contractFor(c))}<h2>Mounted instance</h2>${apiTable([['element','Element','—','The live component root.'],['reset()','Promise<void>','—','Recreate the template and run configure again.'],['destroy()','void','—','Remove the component and its listeners.']])}<div data-ir-api></div>`;
 updateInstall();
 const runtimeFile=c.html.includes('data-extra-kind')?'extras.js':sourceFor(c.slug);
 $('[data-runtime-file]').value=runtimeFile;
 $('[data-style-file]').value=runtimeFile.replace('app.js','styles.css').replace(/\.js$/,'.css');
 renderGuide(activeGuide);
}
export function manifestReference(manifest){
 $('[data-dependencies]').textContent=manifest.dependencies?.length?manifest.dependencies.map(d=>typeof d==='string'?d:JSON.stringify(d)).join(', '):'Shared Syntari runtime, included by the installer. No additional component dependencies declared.';
 const props=manifest.props?.properties || manifest.props || {};
 $('[data-ir-api]').innerHTML=manifest.ir?`<h2>Screen IR props</h2><p>Validated against this component’s authored registry contract.</p>${snippet(JSON.stringify(props,null,2),'Prop schema')}`:'<h2>Screen IR</h2><p>A Screen IR contract has not been authored for this component yet. Use its editable source and native DOM API.</p>';
 $('[data-accessibility-contract]').textContent=manifest.accessibility?.keyboard?.length?manifest.accessibility.keyboard.join(' · '):'See Usage for interaction states and shared accessibility guidance.';
}
function updateInstall(){
 $('[data-install-command]').textContent=command(component.slug);
 document.querySelectorAll('[data-package-manager]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.packageManager===manager)));
 $('[data-download-source]').href=`/downloads/syntari-ui-${version}.tgz`;
 $('[data-download-source]').textContent=`Download Syntari ${version} source`;
 $('[data-install-details]').innerHTML=`<h2>What gets installed</h2>${snippet(`components/syntari/\n  ${component.slug}.js\n  ${component.slug}.html\n  syntari.json\n  runtime/   # shared styles, interactions, fonts, and registry`,'Installed files')}<p>The runtime is shared across components. Existing customized files are preserved; choose a new directory when upgrading.</p><h2>Manual setup</h2><p>Extract the archive. Copy package/kit/runtime to components/syntari/runtime and package/kit/components/${esc(component.slug)}.js and .html next to it. Serve your project over HTTP, then use the Usage example.</p><h2>Verify the installation</h2>${snippet(`npm exec --yes --package=https://syntariui.giovanitier.com/downloads/syntari-ui-${version}.tgz -- syntari doctor --dir ./components/syntari`,'Doctor command')}<p>Use the CLI diagnostics to check your local setup. The versioned archive is the available distribution path while npm publication is pending.</p>`;
}
export function renderGuide(id){
 activeGuide=guideLinks.some(([key])=>key===id)?id:'getting-started';
 $('[data-guide-select]').value=activeGuide;
 const guide=guideContent(activeGuide,{code:snippet,command,apiTable,commonAPI});
 $('[data-guide-content]').innerHTML=`<h2>${esc(guide.title)}</h2><p>${esc(guide.description)}</p>${guide.body}`;
}
export async function codeSource(mode,manifest){
 const token=++revision,c=component;
 const file=mode==='interactions'?$('[data-runtime-file]').value:mode==='styles'?$('[data-style-file]').value:null;
 $('[data-code-file]').textContent=file||`${c.slug}.${mode==='manifest'?'json':mode==='module'?'js':'html'}`;
 const node=$('[data-source]');
 if(!file){node.textContent=mode==='manifest'?JSON.stringify(manifest??{status:'loading'},null,2):mode==='module'?`import { mount as mountPattern } from './runtime/syntari.js';\n\nexport function mount(target, options = {}) {\n  return mountPattern('${c.slug}', target, options);\n}\n\nexport { prepare, setTheme } from './runtime/syntari.js';`:c.html;return;}
 node.textContent='Loading shared source…';
 try{if(!files.has(file)){const response=await fetch('/'+file);if(!response.ok)throw new Error(`Could not load ${file}`);files.set(file,await response.text());}if(token===revision)node.textContent=files.get(file);}catch(error){if(token===revision)node.textContent=error.message;}
}
export function initReference(workspace){
 $('[data-guide-select]').innerHTML=guideLinks.map(([id,name])=>`<option value="${id}">${esc(name)}</option>`).join('');
 $('[data-guide-select]').addEventListener('change',event=>{renderGuide(event.target.value);history.replaceState(null,'',`/system/?guide=${event.target.value}#${component.slug}`);});
 document.querySelectorAll('[data-package-manager]').forEach(b=>b.addEventListener('click',()=>{manager=b.dataset.packageManager;if(!component)return;updateInstall();$('[data-copy-status]').textContent='';}));
 document.addEventListener('click',event=>{
  const copy=event.target.closest('[data-reference-copy]');if(copy){const block=copy.closest('.sys-snippet');copyText(block.querySelector('code').textContent,block.querySelector('[role=status]'));}
  const link=event.target.closest('a[href]');if(!link||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
  const url=new URL(link.href);if(url.origin!==location.origin)return;
  const guide=url.pathname.match(/^\/guides\/([^/]+)/)?.[1]||url.searchParams.get('guide');
  if(guide&&component){event.preventDefault();renderGuide(guide);workspace.closeNav();if(document.querySelector('[data-workspace]').dataset.panel!=='guide')workspace.openPanel('guide',link);history.replaceState(null,'',`/system/?guide=${guide}#${component.slug}`);}
 });
}
