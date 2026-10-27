import {statesFor, contractFor, commonAPI, guideLinks, sourceFor} from '../docs-data.js';
import {guideContent} from '../docs-guides.js';
import {copyText} from '../workspace.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=selector=>document.querySelector(selector);
const files=new Map();
let component, version, manager='npm', currentState='default', revision=0, activeGuide='getting-started';
const runners={npm:'npx syntari-ui',pnpm:'pnpm dlx syntari-ui',yarn:'yarn dlx syntari-ui',bun:'bunx syntari-ui'};
export function command(slug,pm=manager){return `${runners[pm]} add ${slug}`;}
function snippet(text,title){return `<div class="sys-snippet"><header><span>${esc(title)}</span><button data-reference-copy aria-label="Copy ${esc(title)}">Copy</button></header><pre tabindex="0"><code>${esc(text)}</code></pre><p role="status" class="workspace-message"></p></div>`;}
function apiTable(rows){return `<div class="sys-api-table"><table><thead><tr><th>Name</th><th>Type / default</th><th>Description</th></tr></thead><tbody>${rows.map(([name,type,value,description])=>`<tr><td><code>${esc(name)}</code></td><td><code>${esc(type)}</code><small>${esc(value)}</small></td><td>${esc(description)}</td></tr>`).join('')}</tbody></table></div>`;}
export function usage(){
 const state=statesFor(component).find(s=>s.id===currentState);
 return `<div id="example"></div>\n\n<script type="module">\n  import { mount } from './components/syntari/${component.slug}.js';\n\n  const instance = await mount('#example'${state?.code?`, {\n    configure(root) {\n${state.code.split('\n').map(line=>'      '+line).join('\n')}\n    }\n  }`:''});\n\n  // Pass { props, onActionRequest } to configure it and receive its requests.\n  // Call instance.destroy() when removing this screen.\n</script>`;
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
/**
 * The component's guidance, from its manifest: when to use it, when not and what instead, its states, what to do and not do,
 * how to write its words, and its keyboard. A component without guidance keeps the panel as it was.
 */
export function renderGuidance(manifest,nameOf=slug=>slug){
 const box=$('[data-guidance]'),g=manifest?.guidance;
 box.hidden=!g;
 $('[data-accessibility-block]').hidden=Boolean(g);
 if(!g){box.replaceChildren();return;}
 const block=(title,body,attrs='')=>`<section class="sys-info-block sys-guide-block"${attrs}><h3>${esc(title)}</h3>${body}</section>`;
 const list=items=>`<ul class="sys-guide-list">${items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`;
 const avoid=g.avoidWhen.map(item=>`<li>${esc(item.text)}${item.instead?` <a class="sys-guide-alt" href="/system/#${esc(item.instead)}">Use ${esc(nameOf(item.instead))}</a>`:''}</li>`).join('');
 /* How a state comes about is code when it names a prop or a call, such as disabled: true; otherwise it is a sentence. */
 const how=text=>/^[a-z][\w.]*: |\(\)/i.test(text)?`<code>${esc(text)}</code>`:`<span class="sys-guide-how"><span>How:</span> ${esc(text)}</span>`;
 const states=g.states.map(state=>`<div><dt>${esc(state.label)}</dt><dd><p>${esc(state.description)}</p>${how(state.how)}</dd></div>`).join('');
 /* A do is a check and a don't a cross, in green and red: the shape says it without the colour, and screen readers hear the word. */
 const mark={do:'<path d="m9 12 2 2 4-4"/>',dont:'<path d="m15 9-6 6"/><path d="m9 9 6 6"/>'};
 const rule=(kind,label,item)=>`<li class="sys-guide-rule" data-kind="${kind}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/>${mark[kind]}</svg><strong><span class="sr-only">${label}: </span>${esc(item.title)}</strong><p>${esc(item.description)}</p></li>`;
 const keys=g.accessibility.keyboard.length?`<dl class="sys-guide-keys">${g.accessibility.keyboard.map(key=>`<div><dt>${key.keys.split(/ (and|or) /).map(part=>/^(and|or)$/.test(part)?` ${part} `:`<kbd>${esc(part)}</kbd>`).join('')}</dt><dd>${esc(key.action)}</dd></div>`).join('')}</dl>`:'<p class="sys-guide-note">Takes no focus and needs no keys.</p>';
 box.innerHTML=[
  block('When to use',list(g.useWhen),' data-guide="use"'),
  block('When not to use',`<ul class="sys-guide-list sys-guide-avoid">${avoid}</ul>`,' data-guide="avoid"'),
  block('States',`<dl class="sys-guide-states">${states}</dl>`,' data-guide="states"'),
  block('Do and don’t',`<ul class="sys-guide-rules" data-guide="do">${g.dos.map(item=>rule('do','Do',item)).join('')}</ul><ul class="sys-guide-rules" data-guide="dont">${g.donts.map(item=>rule('dont','Don’t',item)).join('')}</ul>`,' data-guide="rules"'),
  g.content?.length?block('Writing',list(g.content),' data-guide="content"'):'',
  block('Accessibility',`${keys}${list(g.accessibility.notes)}`,' data-guide="accessibility"')
 ].join('');
}
export function manifestReference(manifest){
 $('[data-dependencies]').textContent=manifest.dependencies?.length?manifest.dependencies.map(d=>typeof d==='string'?d:JSON.stringify(d)).join(', '):'Shared Syntari runtime, included by the installer. No additional component dependencies declared.';
 const props=manifest.props?.properties || manifest.props || {};
 const actions=Object.keys(manifest.actions??{});
 const indent=(text,pad)=>text.split('\n').map((line,i)=>i?pad+line:line).join('\n');
 const propsUsage=manifest.sample?`<h2>Mount with props</h2><p>This component has a contract, so you can mount one configured instance. The same contract validates Screen IR.${actions.length?` Declared actions arrive in onActionRequest: ${actions.join(', ')}.`:''}</p>${snippet(`import { mount } from './components/syntari/${manifest.id}.js';\n\nawait mount('#example', {\n  props: ${indent(JSON.stringify(manifest.sample.props,null,2),'  ')}${actions.length?`,\n  onActionRequest(request) {\n    // request.action is ${actions.map(a=>JSON.stringify(a)).join(' or ')}. Nothing has run yet: decide in your code.\n  }`:''}\n});`,'Props example')}`:'';
 $('[data-ir-api]').innerHTML=manifest.ir?`${propsUsage}<h2>Screen IR props</h2><p>Validated against this component’s authored registry contract.</p>${snippet(JSON.stringify(props,null,2),'Prop schema')}`:'<h2>Screen IR</h2><p>A Screen IR contract has not been authored for this component yet. Use its editable source and native DOM API.</p>';
 $('[data-accessibility-contract]').textContent=manifest.accessibility?.keyboard?.length?manifest.accessibility.keyboard.join(' · '):'See Usage for interaction states and shared accessibility guidance.';
}
function updateInstall(){
 $('[data-install-command]').textContent=command(component.slug);
 const hint=$('[data-install-hint]');hint.textContent=manager==='yarn'?'Needs Yarn 2 or later. With Yarn 1, use the npm command.':'';hint.hidden=!hint.textContent;
 document.querySelectorAll('[data-package-manager]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.packageManager===manager)));
 $('[data-download-source]').href=`/downloads/syntari-ui-${version}.tgz`;
 $('[data-download-source]').textContent=`Download Syntari ${version} source`;
 $('[data-install-details]').innerHTML=`<h2>What gets installed</h2>${snippet(`components/syntari/\n  ${component.slug}.js\n  ${component.slug}.html\n  syntari.json\n  runtime/   # shared styles, interactions, fonts, and registry`,'Installed files')}<p>The runtime is shared across components. Existing customized files are preserved; choose a new directory when upgrading.</p><h2>Use it</h2><p>Serve your project over HTTP, then mount the component. Pass <code>props</code> to configure one instance and <code>onActionRequest</code> to receive what a person asks for; nothing runs until your code decides.</p>${snippet(usage(),'Usage example')}<h2>Manual setup</h2><p>Download the source archive above and extract it. Copy <code>package/kit/runtime</code> to <code>components/syntari/runtime</code>, and <code>package/kit/components/${esc(component.slug)}.js</code> and <code>.html</code> into <code>components/syntari</code>.</p><h2>Verify the installation</h2>${snippet(`${runners[manager]} doctor --dir ./components/syntari`,'Doctor command')}<p>Checks Node.js, the runtime files, and the version the CLI recorded. A manual setup has no version record; doctor notes it without failing.</p>`;
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
