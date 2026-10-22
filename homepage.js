import {getComponents, mount} from './syntari.js';
import {copyText} from './workspace.js';
import {render,validate} from './ir.js';
export function initHomepage() {
  const theme=document.querySelector('[data-home-theme]');
  const label=()=>theme.setAttribute('aria-label',`Switch to ${document.documentElement.dataset.theme==='dark'?'light':'dark'} theme`);
  theme.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('syntari-theme',next)}catch{}label();});label();
  initLandingRenderer().catch(error=>{const output=document.querySelector('[data-home-output]'); if(output){output.textContent='The Renderer is unavailable: '+error.message; output.dataset.loading='false';output.setAttribute('aria-busy','false');} const status=document.querySelector('[data-home-status]');if(status)status.textContent='Open the full Renderer to retry.';setHomeValidation('Unavailable','error');});
  loadGallery().catch(error=>{document.querySelector('[data-home-gallery]').textContent=`Previews unavailable. Explore the components in System. ${error.message}`;}).finally(()=>document.querySelector('[data-home-gallery]').setAttribute('aria-busy','false'));
}
async function loadGallery(){
  const response=await fetch('/registry/index.json');if(!response.ok)throw new Error('The registry could not load.');
  const registry=await response.json();if(document.querySelector('[data-home-count]'))document.querySelector('[data-home-count]').textContent=`${registry.components.length} components`;
  const command=document.querySelector('[data-home-command]');command.textContent=`npm exec --yes --package=https://syntariui.giovanitier.com/downloads/syntari-ui-${registry.version}.tgz -- syntari add app-shell`;
  const copy=document.querySelector('[data-home-copy]');copy.disabled=false;copy.addEventListener('click',()=>copyText(command.textContent,document.querySelector('[data-home-copy-status]')));
  const catalog=await getComponents();const grid=document.querySelector('[data-home-gallery]');grid.replaceChildren();
  const slugs=['metric-and-sparkline','button','tool-approval','chart-bars','tabs','otp-input'];
    const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;observer.unobserve(entry.target);const slug=entry.target.dataset.homePreview;mount(slug,entry.target,{configure:slug==='otp-input'?root=>{
      root.querySelector('.agent-heading')?.remove();
      const note=root.querySelector('p'),form=root.querySelector('[data-otp-form]'),group=form?.querySelector('.otp-group');
      if(note&&form&&group){note.textContent='Use 123456';note.classList.add('home-otp-note');form.dataset.homeCompact='true';form.insertBefore(note,group);}
    }:slug==='chart-bars'?root=>{
      const chart=root.querySelector('.chart-bars-modern');
      chart?.classList.add('home-compact-chart');
      chart?.querySelector('figcaption')?.remove();
      chart?.querySelectorAll('.column-value').forEach(value=>value.remove());
    }:slug==='tool-approval'?root=>{
      const approval=root.querySelector('[data-agent-kind="approval"]');
      approval?.querySelector('p.hint')?.remove();
      if(approval)approval.dataset.showResetPreview='false';
    }:undefined}).catch(()=>{entry.target.textContent='Open this component in System to explore it.';});}},{rootMargin:'200px'});
  for(const slug of slugs){
    const c=catalog.find(item=>item.slug===slug);if(!c)continue;
    const article=document.createElement('article');article.className='home-card';
    const preview=document.createElement('div');preview.className='home-card-stage';preview.dataset.homePreview=slug;preview.setAttribute('role','group');preview.setAttribute('aria-label',`${c.name} live preview`);
    const info=document.createElement('div');info.className='home-card-info';const link=document.createElement('a');link.href=`/system/#${slug}`;link.append(document.createTextNode(c.name));const arrow=document.createElement('span');arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');link.append(arrow);
    info.append(link);article.append(preview,info);grid.append(article);observer.observe(preview);
  }
}
if(document.body.classList.contains('landing-body'))initHomepage();


// Homepage Renderer uses exactly the same registry, validator, and Screen IR runtime as /renderer/.
const homeRenderState={patterns:[],screens:null,mounted:null,selected:null,sequence:0};
const homeEl=selector=>document.querySelector(selector);
function setHomeValidation(message,kind){
  const element=homeEl('[data-home-validation]');
  if(element){element.textContent=message;element.dataset.state=kind;}
}
function homeDecision(prompt){
  const words=new Set(prompt.toLowerCase().match(/[a-z0-9]+/g)||[]);
  const candidates=homeRenderState.patterns.map(pattern=>({pattern,cues:(pattern.keywords||[]).filter(word=>words.has(word))})).sort((a,b)=>b.cues.length-a.cues.length||a.pattern.id.localeCompare(b.pattern.id));
  const matched=candidates[0].cues.length>0;
  const selected=matched?candidates[0]:candidates.find(item=>item.pattern.id==='release-review')||candidates[0];
  return {selected,candidates,matched};
}
function homeTraceLine(label,value){
  const row=document.createElement('div');row.className='home-trace-row';
  const dt=document.createElement('dt');dt.textContent=label;
  const dd=document.createElement('dd');dd.textContent=value;
  row.append(dt,dd);return row;
}
function homeShowTrace(prompt,choice,result){
  const match=choice.selected,other=choice.candidates.filter(item=>item.pattern.id!==match.pattern.id).slice(0,2);
  homeEl('[data-home-trace]').replaceChildren(
    homeTraceLine('Intent',prompt),
    homeTraceLine('Pattern selected',match.pattern.name),
    homeTraceLine('Decision',choice.matched?'Matched '+match.cues.join(', ')+'. '+match.cues.length+' keyword cues.':'No keyword match. Showing a validated bundled example.'),
    homeTraceLine('Other candidates',other.map(item=>item.pattern.name+' ('+item.cues.length+')').join(', ')||'None'),
    homeTraceLine('Composition',match.pattern.dependencies.join(' · ')),
    homeTraceLine('Rules applied','Registry component IDs, prop contracts, layout and node budgets.'),
    homeTraceLine('Validation',result.ok?'Passed · '+result.diagnostics.length+' diagnostics':'Blocked · '+result.diagnostics.length+' diagnostics')
  );
}
async function homeRenderIntent(prompt){
  const seq=++homeRenderState.sequence,output=homeEl('[data-home-output]'),submit=homeEl('[data-home-render]'),status=homeEl('[data-home-status]');
  submit.disabled=true;output.dataset.loading='true';output.setAttribute('aria-busy','true');
  setHomeValidation('Choosing pattern','working');status.textContent='Selecting a trusted pattern…';
  try{
    const choice=homeDecision(prompt),spec=structuredClone(homeRenderState.screens[choice.selected.pattern.screenMode]);
    if(choice.matched)spec.title=prompt.slice(0,80);
    setHomeValidation('Validating','working');status.textContent='Checking component contracts…';
    const result=await validate(spec);
    if(seq!==homeRenderState.sequence)return;
    homeShowTrace(prompt,choice,result);
    if(!result.ok){setHomeValidation('Validation blocked','error');status.textContent='Validation blocked this render. Open the workspace to see diagnostics.';return;}
    setHomeValidation('Rendering','working');status.textContent='Composing trusted components…';
    const stage=document.createElement('div');stage.className='home-render-stage';
    const instance=await render(spec,stage);
    if(seq!==homeRenderState.sequence){instance.destroy();return;}
    homeRenderState.mounted?.destroy();homeRenderState.mounted=instance;homeRenderState.selected=choice.selected.pattern.id;
    output.replaceChildren(stage);output.scrollTop=0;
    homeEl('[data-home-pattern]').textContent=choice.selected.pattern.name+' · '+choice.selected.pattern.dependencies.length+' component types';
    setHomeValidation('Validated','success');
    status.textContent=choice.matched?'Validated composition. Deterministic local pattern selection; no AI model was called.':'No supported keyword matched; showing a validated example instead.';
    document.querySelectorAll('[data-home-example]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.patternId===homeRenderState.selected)));
    try{sessionStorage.setItem('syntari-intent',prompt)}catch{}
  }catch(error){if(seq===homeRenderState.sequence){status.textContent='Could not render: '+error.message;setHomeValidation('Could not render','error');}}
  finally{if(seq===homeRenderState.sequence){submit.disabled=false;output.dataset.loading='false';output.setAttribute('aria-busy','false');}}
}
async function initLandingRenderer(){
  const responses=await Promise.all([fetch('/registry/patterns/index.json'),fetch('/registry/patterns/screens.json')]);
  if(responses.some(response=>!response.ok))throw new Error('Pattern registry unavailable.');
  const [index,screens]=await Promise.all(responses.map(response=>response.json()));
  homeRenderState.screens=screens;
  homeRenderState.patterns=index.patterns.filter(pattern=>pattern.screenMode&&screens[pattern.screenMode]);
  if(!homeRenderState.patterns.length)throw new Error('No renderable patterns found.');
  const examples=homeEl('[data-home-examples]');examples.replaceChildren();
  for(const pattern of homeRenderState.patterns.slice(0,4)){
    const button=document.createElement('button');button.type='button';button.className='home-example';
    button.dataset.homeExample=pattern.examples?.[0]||pattern.name;button.dataset.patternId=pattern.id;
    button.setAttribute('aria-pressed','false');button.textContent=pattern.name;
    button.addEventListener('click',()=>{homeEl('[data-home-intent]').value=button.dataset.homeExample;homeRenderIntent(button.dataset.homeExample);});
    examples.append(button);
  }
  homeEl('[data-home-intent-form]').addEventListener('submit',event=>{event.preventDefault();const prompt=homeEl('[data-home-intent]').value.trim();if(prompt)homeRenderIntent(prompt);});
  homeEl('[data-home-intent]').addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.metaKey||event.ctrlKey)){event.preventDefault();homeEl('[data-home-intent-form]').requestSubmit();}});
  document.querySelectorAll('[data-open-renderer]').forEach(link=>link.addEventListener('click',()=>{try{sessionStorage.setItem('syntari-intent',homeEl('[data-home-intent]').value.trim())}catch{}}));
  await homeRenderIntent(homeEl('[data-home-intent]').value.trim());
}
