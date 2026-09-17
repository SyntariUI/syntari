import { getComponents, mount, slugify, setTheme } from './syntari.js';
import { groups, guideLinks, statesFor, sourceFor, contractFor, commonAPI, wideStage } from './docs-data.js';
import { guideContent } from './docs-guides.js';
import { galleryURL, galleryState, galleryPage, prepareGallery } from './docs-gallery.js';
const base=new URL('.',import.meta.url), archive=new URL('downloads/syntari-ui-0.2.1.tgz',base).href, libraryURL=new URL('library.html',base).href;
// Keep relative links stable when history changes the current route.
const baseElement=document.querySelector('base')||document.head.insertBefore(document.createElement('base'),document.head.firstChild);
baseElement.href=base.href;
const $=s=>document.querySelector(s);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalog=[],current=null,instance=null,mainTab='preview',installTab='cli',manager='npm',stateId='default',sourceTab='html',routeGeneration=0,previewGeneration=0,routePath=location.pathname+location.search;
const codeValues=new Map(),sourceCache=new Map(); let codeIndex=0;
const ic=n=>window.SyntariIcon?.(n)||'';
const componentURL=c=>new URL(`components/${c.slug}/`,base).href;
const guideURL=id=>new URL(`guides/${id}/`,base).href;
let browsing=null,lastGalleryURL=history.state?.syntariGallery||galleryURL().href,lastDocumentURL=libraryURL;
const galleryPlaces=new Map();
if('scrollRestoration' in history)history.scrollRestoration='manual';
function syncViews(){
 const gallery=$('#view-gallery'),docs=$('#view-documentation');
 gallery.href=lastGalleryURL;docs.href=lastDocumentURL;
 for(const [link,active]of [[gallery,!!browsing],[docs,!browsing]]){if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 $('.docs-search').hidden=!!browsing;
}
function filterGallery(value){
 if(browsing?.view!=='gallery')return;
 browsing.query=value;const url=galleryURL(browsing);
 history.replaceState({...history.state,syntariGallery:url.href},'',url);routePath=location.pathname+location.search;lastGalleryURL=url.href;
 const count=prepareGallery(browsing);syncViews();
 $('#docs-announcement').textContent=`${count} ${count===1?'component':'components'} found.`;
}

function highlight(text){return text.split(/("[^"\n]*"|'[^'\n]*'|`[^`]*`|\/\/[^\n]*|<!--[^]*?-->|\b(?:import|from|export|const|let|await|function|return|if|new|true|false|async)\b)/g).map(piece=>{const escaped=esc(piece);return /^(\/\/|<!--)/.test(piece)?`<span class="code-comment">${escaped}</span>`:/^["'`]/.test(piece)?`<span class="code-string">${escaped}</span>`:/^(import|from|export|const|let|await|function|return|if|new|true|false|async)$/.test(piece)?`<span class="code-keyword">${escaped}</span>`:escaped}).join('')}
function code(text,filename,language='js',extra=''){
 const id='code-'+(++codeIndex);codeValues.set(id,text);const long=text.split('\n').length>12||text.length>1600;
 return `<div class="docs-code ${long?'is-long':''}"><div class="docs-code-heading"><span>${ic('file')} ${esc(filename)}</span>${extra}<button class="docs-copy" data-doc-copy="${id}" aria-label="Copy ${esc(filename)}">${ic('copy')}</button></div><pre tabindex="0" aria-label="${esc(filename)} source"><code class="language-${language}">${highlight(text)}</code></pre>${long?`<div class="docs-expand-wrap"><button class="button small" data-expand-code aria-expanded="false">Expand code ${ic('down')}</button></div>`:''}</div>`;
}
function command(slug,pm=manager){
 const pkg=JSON.stringify(archive);
 return {npm:`npm exec --yes --package=${pkg} -- syntari add ${slug}`,pnpm:`pnpm --package=${pkg} dlx syntari add ${slug}`,yarn:`yarn dlx -p ${pkg} syntari add ${slug}`,bun:`bunx --package ${pkg} syntari add ${slug}`}[pm];
}
function apiTable(rows){return `<div class="docs-api"><table><thead><tr><th scope="col">Name</th><th scope="col">Type & description</th><th scope="col">Default</th></tr></thead><tbody>${rows.map(([name,type,value,description])=>`<tr><td><code>${esc(name)}</code></td><td><code>${esc(type)}</code><small>${esc(description)}</small></td><td><code>${esc(value)}</code></td></tr>`).join('')}</tbody></table></div>`}
function tabset(items,active,kind,label){return `<div class="docs-tabs" role="tablist" aria-label="${label}">${items.map(([id,name])=>`<button role="tab" data-doc-tab="${kind}" data-value="${id}" id="tab-${kind}-${id}" aria-selected="${id===active}" aria-controls="panel-${kind}" tabindex="${id===active?0:-1}">${name}</button>`).join('')}</div>`}
function focusNavigation(){const target=$('.docs-search').hidden?$('#docs-navigation [aria-current=page]')||$('#docs-navigation a'):$('#docs-search');target?.focus();}
function syncNavigation(){const open=document.body.classList.contains('nav-open');$('.docs-sidebar').inert=innerWidth<=700&&!open;$('#docs-menu').setAttribute('aria-controls','docs-navigation');$('#docs-menu').setAttribute('aria-label',open?'Close library navigation':'Open library navigation');$('.skip').href=location.pathname+'#docs-main';}
function iconize(){document.querySelectorAll('[data-doc-icon]').forEach(el=>el.innerHTML=ic(el.dataset.docIcon))}
function setDocumentTheme(theme){setTheme(theme);try{localStorage.setItem('syntari-theme',theme)}catch{}const button=$('#docs-theme');button.innerHTML=ic(theme==='dark'?'sun':'moon');button.setAttribute('aria-label',`Switch to ${theme==='dark'?'light':'dark'} theme`);if(browsing?.view==='foundations')prepareGallery(browsing)}
function renderNavigation(){
 const term=$('#docs-search').value.trim().toLowerCase(),route=location.pathname;
 const link=(url,title,icon='',badge='',active=new URL(url).pathname===route,attributes='')=>`<a class="docs-nav-link" href="${esc(url)}" ${active?'aria-current="page"':''} ${attributes}>${icon?ic(icon):''}${esc(title)}${badge?`<span class="docs-nav-badge">${badge}</span>`:''}</a>`;
 let html=`<div class="docs-nav-group"><h2>Workspace</h2>${link(base.href,'Home','external','',false,'data-nav-route')}${link(libraryURL,'Overview','grid')}${link(galleryURL(),'Component gallery','layers','',browsing?.view==='gallery','data-view="gallery"')}${link(galleryURL({view:'screens'}),'Starter screens','layout','',browsing?.view==='screens','data-view="screens"')}${link(galleryURL({view:'foundations'}),'Foundations','palette','',browsing?.view==='foundations','data-view="foundations"')}${link(new URL('generative-ui.html',base).href,'Renderer','bot')}</div>`;
 if(browsing){
  html+=`<div class="docs-nav-group"><h2>Components<span>${catalog.length}</span></h2>${link(galleryURL(),'All components','',String(catalog.length),browsing.view==='gallery'&&browsing.category==='All components')}${Object.entries(groups).map(([name,[icon]])=>link(galleryURL({category:name}),name,icon,String(catalog.filter(c=>c.category===name).length),browsing.view==='gallery'&&browsing.category===name,`data-category="${esc(name)}"`)).join('')}</div>`;
 }
 if(!term||browsing)html+=`<div class="docs-nav-group"><h2>Guides</h2>${guideLinks.map(([id,name,icon])=>link(guideURL(id),name,icon,id==='migration'?'0.2':'')).join('')}</div>`;
 if(!browsing){
  let found=0;
  for(const [name]of Object.entries(groups)){
   const items=catalog.filter(c=>c.category===name&&`${c.name} ${c.category} ${c.description}`.toLowerCase().includes(term)).sort((a,b)=>a.name.localeCompare(b.name));
   found+=items.length;if(items.length)html+=`<div class="docs-nav-group"><h2>${name}<span>${items.length}</span></h2>${items.map(c=>link(componentURL(c),c.name)).join('')}</div>`;
  }
  if(!found)html+='<p class="docs-result-empty">No components found. Try “input”, “card”, or “agent”.</p>';
 }
 $('#docs-navigation').innerHTML=html;
}
function usage(c){
 const state=statesFor(c).find(s=>s.id===stateId)||statesFor(c)[0];
 return `<div id="example"></div>\n\n<script type="module">\n  import { mount } from './components/syntari/${c.slug}.js';\n\n  const component = await mount('#example'${state.code?`, {\n    configure(root) {\n${state.code.split('\n').map(l=>'      '+l).join('\n')}\n    }\n  }`:''});\n\n  // Access the live DOM with component.element.\n  // Call component.destroy() when leaving this page.\n</script>`;
}
function markup(c){return c.html.replace(/></g,'>\n<');}
function sourceEntry(c){return `import { mount as mountPattern } from './runtime/syntari.js';\n\nexport function mount(target, options = {}) {\n  return mountPattern('${c.slug}', target, options);\n}\n\nexport { prepare, setTheme } from './runtime/syntari.js';`}
function instructions(c){
 const doc=new DOMParser().parseFromString(c.html,'text/html');
 const actions=[...doc.querySelectorAll('button,summary')].filter(b=>!b.disabled&&!b.closest('[hidden]')).map(b=>(b.getAttribute('aria-label')||b.textContent).replace(/\s+/g,' ').trim()).filter(Boolean);
 const names=[...new Set(actions)].slice(0,3);
 return names.length?`Try ${names.map(n=>'“'+n+'”').join(', ')} to explore the ${c.variants.toLowerCase()} behavior.`:'Compare the examples and switch layouts to see how the content adapts.';
}
function componentPage(c){
 const index=catalog.indexOf(c),prev=catalog[(index-1+catalog.length)%catalog.length],next=catalog[(index+1)%catalog.length];
 return `<div class="docs-content-layout"><article class="docs-article"><div class="docs-eyebrow">${ic(groups[c.category]?.[0]||'layers')}${c.category}</div><div class="docs-title-row"><h1>${esc(c.name)}</h1><span class="docs-file-tag">${c.slug}.js</span></div><p class="docs-description">${esc(c.description)}</p><div class="docs-meta-row"><span class="badge accent">0.2</span><span>${esc(c.variants)}</span><span>Light & dark</span></div><section class="docs-preview-section" id="preview"><div class="docs-preview-toolbar">${tabset([['preview','Preview'],['usage','Usage'],['code','Code']],mainTab,'main','Component example')}<button class="docs-replay" data-doc-reset aria-label="Reset and replay preview">${ic('rotate-ccw')} Reset preview</button></div><div id="panel-main" role="tabpanel" aria-labelledby="tab-main-${mainTab}"></div></section><section class="docs-section" id="installation"><h2>Installation</h2><p>Add the source to your project and make it yours.</p>${tabset([['cli','CLI'],['manual','Manual']],installTab,'install','Installation method')}<div id="panel-install" role="tabpanel" aria-labelledby="tab-install-${installTab}"></div></section><section class="docs-section" id="api-reference"><h2>API reference</h2><p>Import <code>mount</code> from <code>${c.slug}.js</code>. The returned instance gives you access to the real DOM.</p>${apiTable(commonAPI)}<h3 class="docs-api-subtitle">Element contract</h3><p class="docs-prose">These are native attributes or data values from this component’s template. Modify them through <code>configure(root)</code> or the copied HTML.</p><div style="margin-top:14px">${apiTable(contractFor(c))}</div><p class="docs-install-note">The instance exposes <code>element</code>, <code>reset()</code>, and <code>destroy()</code>. <a href="${guideURL('api')}">Read the runtime API ${ic('arrow')}</a></p></section><section class="docs-section" id="guidelines"><h2>Guidelines</h2><div class="docs-guidance"><div><h3>Behavior</h3><p>${esc(instructions(c))} Choose a state beneath the preview to compare its treatment.</p></div><div><h3>Accessibility</h3><p>${docAccessibility(c)}</p></div><div><h3>Make it yours</h3><p>Keep the component’s structure and accessible labels. Adjust the shared tokens, replace sample content, and connect your application’s own actions.</p></div><div><h3>Motion</h3><p>State changes use Syntari’s restrained timing. Reduced-motion preferences remove decorative travel while preserving clear feedback.</p></div></div><div class="docs-token-list">${c.tokens.map(t=>`<span class="docs-token">${t}</span>`).join('')}</div></section><nav class="docs-related" aria-label="Adjacent components"><a href="${componentURL(prev)}"><div><small>Previous component</small>${prev.name}</div>${ic('arrow').replace('<svg','<svg style="transform:rotate(180deg)"')}</a><a href="${componentURL(next)}"><div><small>Next component</small>${next.name}</div>${ic('arrow')}</a></nav></article><aside class="docs-toc" aria-label="On this page"><p>On this page</p><a href="${componentURL(c)}#preview">Preview & states</a><a href="${componentURL(c)}#installation">Installation</a><a href="${componentURL(c)}#api-reference">API reference</a><a href="${componentURL(c)}#guidelines">Guidelines</a><div class="docs-toc-note"><span class="status-dot"></span> Built with Syntari<br>Editable source.<br>Shared foundations.<br>A little less setup.</div><a href="${guideURL('composition')}" style="margin-top:14px">Composition guide ${ic('arrow')}</a></aside></div>`;
}
function docAccessibility(c){
 if(c.category==='Overlay')return'Open with Enter or Space. Dismiss modal surfaces with Escape. Keep a clear title, a visible close action, and focus restoration to the trigger.';
 if(/select|picker|tabs|navigation/.test(c.slug))return'Keep the control’s accessible name and selected or expanded state. Try arrow keys and Escape alongside pointer interaction.';
 if(c.category==='Form controls')return'Keep a persistent label on every field. Use the native input semantics and associated error text; do not rely on color alone.';
 if(c.category==='Agents')return'Keep progress and decisions available as text. Give stop, approval, and retry actions clear names. Announce outcomes without moving focus unexpectedly.';
 return'Preserve the semantic elements and accessible names from the source. Keep focus visible, and use text alongside color to communicate meaning.';
}
async function renderPreview(){
 const generation=++previewGeneration;instance?.destroy();instance=null;
 const panel=$('#panel-main');if(!panel||!current)return;
 panel.setAttribute('aria-labelledby','tab-main-'+mainTab);
 if(mainTab==='usage'){panel.innerHTML=code(usage(current),'example.html','html');window.SyntariMotion.panel(panel);return;}
 if(mainTab==='code'){
  panel.innerHTML=`${tabset([['html','HTML'],['module','Module'],['interactions','Interactions'],['styles','Styles']],sourceTab,'source','Source file')}<div id="panel-source" role="tabpanel" aria-labelledby="tab-source-${sourceTab}" style="margin-top:15px"></div>`;
  let text=sourceTab==='html'?markup(current):sourceTab==='module'?sourceEntry(current):'';
  const filename=sourceTab==='html'?current.slug+'.html':sourceTab==='module'?current.slug+'.js':sourceTab==='styles'?sourceFor(current.slug).replace('.js','.css'):sourceFor(current.slug);
  if(!text){try{const url=new URL(filename==='app.css'?'styles.css':filename,base).href;if(!sourceCache.has(url))sourceCache.set(url,fetch(url).then(response=>{if(!response.ok)throw Error('Source unavailable');return response.text()}));text=await sourceCache.get(url)}catch{ text='Source could not be loaded. Download the source archive from Installation.';}}
  if(generation!==previewGeneration)return;
  $('#panel-source').innerHTML=code(text,filename==='app.css'?'styles.css':filename,sourceTab==='styles'?'css':'js');window.SyntariMotion.panel(panel);return;
 }
 const states=statesFor(current),state=states.find(s=>s.id===stateId)||states[0];stateId=state.id;
 const wide=wideStage.test(current.slug);
 panel.innerHTML=`<div class="docs-stage ${wide?'is-wide':''}"><div class="docs-stage-body"><div id="live-example" style="display:contents"></div></div><div class="docs-stage-foot"><div class="docs-state-picker" role="group" aria-label="Component states">${states.map(s=>`<button data-doc-state="${s.id}" aria-pressed="${s.id===stateId}">${s.label}</button>`).join('')}</div><span class="docs-state-note">Interactive preview</span></div></div><p class="docs-preview-caption">${esc(state.description)}</p>`;
 // Recipes are local, authored component examples, never user-provided expressions.
 const configure=state.code?new Function('root',state.code):undefined;
 const mounted=await mount(current.slug,$('#live-example'),{configure});
 if(generation!==previewGeneration){mounted.destroy();return;}
 instance=mounted;
 if(stateId!=='default')window.SyntariMotion.panel(instance.element);
}
function renderInstall(){
 const panel=$('#panel-install');if(!panel||!current)return;
 panel.setAttribute('aria-labelledby','tab-install-'+installTab);
 if(installTab==='cli'){
  const text=command(current.slug),id='code-'+(++codeIndex);codeValues.set(id,text);
  panel.innerHTML=`<div class="docs-code"><div class="docs-code-heading"><div class="docs-command-tabs" role="tablist" aria-label="Package manager">${['npm','pnpm','yarn','bun'].map(pm=>`<button role="tab" data-doc-manager="${pm}" id="tab-manager-${pm}" aria-selected="${pm===manager}" tabindex="${pm===manager?0:-1}" aria-controls="panel-command">${pm}</button>`).join('')}</div><button class="docs-copy" data-doc-copy="${id}" aria-label="Copy install command">${ic('copy')}</button></div><pre id="panel-command" role="tabpanel" aria-labelledby="tab-manager-${manager}" tabindex="0"><code>${highlight(text)}</code></pre></div><p class="docs-install-note">Versioned source archive · Node.js 22+ · installs to <code>./components/syntari</code><br>Includes shared runtime, styles, and fonts. <a href="${guideURL('installation')}">Installation guide ${ic('arrow')}</a></p>`;
 }else panel.innerHTML=`<div class="docs-manual-steps"><div><p class="docs-step-label"><span>1</span>Download the source</p><a href="${archive}" download class="button small docs-download">${ic('download')} Download Syntari 0.2.1 <span class="muted">.tgz</span></a><p class="docs-install-note">Extract the archive. Copy <code>package/kit/runtime</code> into <code>components/syntari/runtime</code>.</p></div><div><p class="docs-step-label"><span>2</span>Add the component entry</p><p class="docs-prose">Copy <code>package/kit/components/${current.slug}.js</code> and its HTML file into <code>components/syntari/</code>.</p>${code(sourceEntry(current),current.slug+'.js','js')}</div><div><p class="docs-step-label"><span>3</span>Use it in your page</p>${code(usage(current),'example.html','html')}<p class="docs-install-note">Serve the project over HTTP. To work directly with copied HTML, use <code>prepare(root)</code> from the runtime. <a href="${guideURL('installation')}">Read the manual guide</a>.</p></div></div>`;
}
function overview(){
 const featured=['button','card-and-project-folder','agent-todo-list','slider','data-table','floating-navigation'];
 return `<div class="docs-index-intro"><div class="docs-eyebrow"><span class="status-dot"></span> Syntari UI · Version 0.2.1</div><h1>Small details.<br>Whole products.</h1><p>A quiet, considered library for whatever you’re building.<br>Explore the interactions. Understand the details. Make them yours.</p><div class="docs-index-actions"><a class="button primary" href="${guideURL('getting-started')}">Get started ${ic('arrow')}</a><a class="button" href="${galleryURL()}">Explore components ${ic('grid')}</a></div></div><div class="docs-index-heading"><h2>A few good places to start</h2><span>${catalog.length} components · 4 starter screens</span></div><div class="docs-index-grid">${featured.map(slug=>{const c=catalog.find(c=>c.slug===slug);return `<a class="docs-index-card" href="${componentURL(c)}"><span>${ic(groups[c.category][0])}</span><h3>${c.name}</h3><p>${groups[c.category][1]}</p><small>${c.variants} ${ic('arrow')}</small></a>`}).join('')}</div><div class="docs-index-heading"><h2>The whole library</h2><span>One shared design language</span></div><div class="docs-library-list">${[...catalog].sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<a href="${componentURL(c)}">${c.name}${ic('arrow')}</a>`).join('')}</div>`;
}
async function renderRoute(){routePath=location.pathname+location.search;
 $('#docs-main').getAnimations().forEach(animation=>animation.cancel());
 const generation=++routeGeneration;++previewGeneration;instance?.destroy();instance=null;current=null;codeValues.clear();
 mainTab='preview';stateId='default';sourceTab='html';
 const pathname=decodeURI(location.pathname).slice(base.pathname.length).replace(/^\/|\/$/g,'');const parts=pathname.split('/');
 $('#docs-crumb').textContent='Overview';browsing=null;
 if(parts[0]==='gallery.html'){
  browsing=galleryState(new URL(location.href),catalog);lastGalleryURL=location.href;
  $('#docs-main').innerHTML=galleryPage(browsing,catalog);prepareGallery(browsing);
  $('#docs-crumb').textContent={gallery:'Component gallery',screens:'Starter screens',foundations:'Foundations'}[browsing.view];
  document.title=`${$('#docs-crumb').textContent} — Syntari UI`;
 }else if(parts[0]==='components'){
  current=catalog.find(c=>c.slug===parts[1]);
  if(current){$('#docs-main').innerHTML=componentPage(current);$('#docs-crumb').textContent=current.name;document.title=`${current.name} — Syntari UI`;renderInstall();await renderPreview();}
  else $('#docs-main').innerHTML=`<h1>Component not found.</h1><p class="docs-description" style="margin-top:20px">That component isn’t in this version of Syntari.</p><a class="button" href="${base}" style="margin-top:24px">Back to the library ${ic('arrow')}</a>`;
 }else if(parts[0]==='guides'){
  const page=guideContent(parts[1],{code,command,apiTable,commonAPI});
  if(page){$('#docs-main').innerHTML=`<article class="docs-guide"><div class="docs-eyebrow">${ic('file')} Guides</div><h1>${page.title}</h1><p class="docs-description">${page.description}</p>${page.body}</article>`;$('#docs-crumb').textContent=guideLinks.find(g=>g[0]===parts[1])?.[1]||'Guide';document.title=`${$('#docs-crumb').textContent} — Syntari UI`;}
  else $('#docs-main').innerHTML='<h1>Guide not found.</h1>';
 }else{$('#docs-main').innerHTML=overview();document.title='Syntari — Component library';}
 if(generation!==routeGeneration)return;
 if(!browsing)lastDocumentURL=location.href;
 syncViews();renderNavigation();iconize();syncNavigation();$('#docs-main').querySelectorAll('.docs-gallery-intro,.docs-gallery-toolbar,.section-heading,.docs-section,.docs-index-grid,.docs-library-list,.screens-heading,.screen-picker,#screen-stage,.foundation-section,.docs-related').forEach(el=>el.dataset.syntariReveal='');window.SyntariMotion.prepare($('#docs-main'));$('#docs-announcement').textContent=`${$('#docs-crumb').textContent} loaded.`;
 // Animate the heading; each live specimen handles its own entrance. A full
 // gallery transform promotes a very tall layer and can disrupt hit testing.
 if(!browsing)window.SyntariMotion.panel($('.docs-title-row')||$('.docs-index-intro')||$('.docs-guide h1'));
}
async function navigate(url,{restore=false,preserveGallery=false}={}){
 const target=new URL(url,base);
 if(!catalog.length)catalog=await getComponents();
 if(!restore){
  const place={scroll:scrollY,focus:document.activeElement?.closest('a')?.href};
  history.replaceState({...history.state,syntariPlace:place,syntariGallery:lastGalleryURL},'',location.href);
  if(browsing?.view==='gallery')galleryPlaces.set(location.pathname+location.search,place);
  if(target.href!==location.href)history.pushState({syntariGallery:lastGalleryURL},'',target);
 }
 document.body.classList.remove('nav-open');$('#docs-menu').setAttribute('aria-expanded','false');
 const generation=routeGeneration+1;await renderRoute();if(generation!==routeGeneration)return;
 const place=restore?history.state?.syntariPlace:preserveGallery?galleryPlaces.get(location.pathname+location.search):null;
 const anchor=target.hash?document.getElementById(decodeURIComponent(target.hash.slice(1))):null;
 if(anchor)anchor.scrollIntoView();else window.scrollTo({top:place?.scroll||0,behavior:'instant'});
 const focus=place?.focus&&[...document.querySelectorAll('#docs-main a')].find(link=>link.href===place.focus);
 (focus||$('#docs-main')).focus({preventScroll:true});
}
document.addEventListener('click',async e=>{
 const link=e.target.closest('a');
 if(link?.closest('.docs-view-switch')&&link.hasAttribute('aria-current')&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey&&e.button===0){e.preventDefault();return;}
if(link&&!link.hasAttribute('data-nav-route')&&(!link.target||link.target==='_self')&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey&&e.button===0&&!link.hasAttribute('download')){const url=new URL(link.href);if(url.origin===base.origin&&url.pathname.startsWith(base.pathname)){const path=url.pathname.slice(base.pathname.length);if((!url.hash||url.pathname!==location.pathname)&&(!path||path==='library.html'||path==='gallery.html'||/^(components|guides)\/[^/]+\/?$/.test(path))){e.preventDefault();navigate(url,{preserveGallery:link.id==='view-gallery'});return;}}}
 const b=e.target.closest('button');if(!b)return;
 if(b.id==='replay-motion'){window.SyntariMotion.replay();return;}
 if(b.id==='download'){window.SyntariGallery.exportTokens(new URL('tokens.css',base));return;}
 if(b.id==='clear-search'){$('#search').value='';filterGallery('');$('#search').focus();return;}
 if(b.dataset.docTab){const kind=b.dataset.docTab;b.parentElement.querySelectorAll('[role=tab]').forEach(t=>{t.setAttribute('aria-selected',String(t===b));t.tabIndex=t===b?0:-1});if(kind==='main'){mainTab=b.dataset.value;await renderPreview()}else if(kind==='install'){installTab=b.dataset.value;renderInstall()}else if(kind==='source'){sourceTab=b.dataset.value;await renderPreview();}return;}
 if(b.dataset.docState){stateId=b.dataset.docState;await renderPreview();renderInstall();$('#panel-main').querySelector(`[data-doc-state="${stateId}"]`)?.focus({preventScroll:true});return;}
 if(b.hasAttribute('data-doc-reset')){stateId='default';await renderPreview();return;}
 if(b.dataset.docManager){manager=b.dataset.docManager;renderInstall();$(`[data-doc-manager="${manager}"]`)?.focus({preventScroll:true});return;}
 if(b.hasAttribute('data-expand-code')){const expanded=b.closest('.docs-code').classList.toggle('expanded');b.setAttribute('aria-expanded',expanded);b.innerHTML=(expanded?'Collapse code':'Expand code')+ic('down');return;}
 if(b.dataset.docCopy){try{await navigator.clipboard.writeText(codeValues.get(b.dataset.docCopy));b.innerHTML=ic('check');$('#docs-announcement').textContent='Copied to clipboard.';setTimeout(()=>{if(b.isConnected)b.innerHTML=ic('copy')},1800)}catch{$('#docs-announcement').textContent='Clipboard unavailable. Select the code and copy it manually.';}return;}
 if(b.id==='docs-theme')setDocumentTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
 if(b.id==='docs-menu'){const open=document.body.classList.toggle('nav-open');b.setAttribute('aria-expanded',open);syncNavigation();if(open)focusNavigation();}
});
document.addEventListener('keydown',e=>{
 if(e.key==='/'&&!e.target.closest('input,textarea,select')&&!document.querySelector('dialog[open]')){e.preventDefault();if(browsing){if(browsing.view==='gallery')$('#search').focus();else navigate(galleryURL()).then(()=>$('#search')?.focus());return;}if(innerWidth<=700){document.body.classList.add('nav-open');$('#docs-menu').setAttribute('aria-expanded','true');syncNavigation()}$('#docs-search').focus()}
 if(e.key==='Escape'&&document.body.classList.contains('nav-open')){document.body.classList.remove('nav-open');$('#docs-menu').setAttribute('aria-expanded','false');syncNavigation();$('#docs-menu').focus();}
 const group=e.target.closest('.docs-tabs,.docs-command-tabs');if(group&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const tabs=[...group.querySelectorAll('[role=tab]')],i=tabs.indexOf(e.target);const n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length;tabs[n].focus();tabs[n].click();}
});
$('#docs-search').addEventListener('input',renderNavigation);
document.addEventListener('input',e=>{if(e.target.id==='search')filterGallery(e.target.value)});
window.addEventListener('popstate',()=>{if(location.pathname+location.search!==routePath)navigate(location.href,{restore:true});});window.addEventListener('resize',syncNavigation);
window.addEventListener('syntari:navigate',e=>{const d=e.detail;if(d.component){const c=catalog.find(c=>c.name===d.component);if(c)navigate(componentURL(c));}else if(['gallery','screens','foundations'].includes(d.view))navigate(galleryURL({view:d.view,category:d.category,screen:d.screen}));});
try{catalog=await getComponents();iconize();setDocumentTheme(document.documentElement.dataset.theme||'dark');await renderRoute();}
catch(error){console.error(error);$('#docs-main').innerHTML='<h1>Couldn’t load the library.</h1><p class="docs-description" style="margin-top:20px">Refresh to try again. Make sure the site’s component assets are available.</p>';}
