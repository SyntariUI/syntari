import {getComponents, mount} from './syntari.js';
import {copyText} from './workspace.js';
export function initHomepage() {
  const $ = selector => document.querySelector(selector);
  const result=$('[data-home-result]'), inspector=$('[data-home-inspector]');
  let mode, trigger;
  function closePanel(){inspector.hidden=true;mode=null;document.querySelectorAll('[data-panel-open]').forEach(b=>b.setAttribute('aria-expanded','false'));trigger?.focus();}
  function openPanel(next,button){if(mode===next){closePanel();return;}mode=next;trigger=button;inspector.hidden=false;document.querySelectorAll('[data-inspector-panel]').forEach(p=>p.hidden=p.dataset.inspectorPanel!==next);document.querySelectorAll('[data-panel-open]').forEach(b=>b.setAttribute('aria-expanded',String(b.dataset.panelOpen===next)));$('[data-panel-title]').textContent={logic:'Why this interface?',ir:'Screen IR',components:'Components'}[next];$('[data-home-close]').focus();}
  document.querySelectorAll('[data-panel-open]').forEach(b=>b.addEventListener('click',()=>openPanel(b.dataset.panelOpen,b)));
  $('[data-home-close]').addEventListener('click',closePanel);
  inspector.addEventListener('keydown',e=>{if(e.key==='Escape')closePanel();});
  const reveal=()=>{result.hidden=false;result.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});};
  $('[data-intent-form]').addEventListener('submit',()=>{if($('[data-intent-input]').value.trim())reveal();});
  $('[data-intent-examples]').addEventListener('click',e=>{if(e.target.closest('button'))reveal();});
  const theme=$('[data-home-theme]');
  const label=()=>theme.setAttribute('aria-label',`Switch to ${document.documentElement.dataset.theme==='dark'?'light':'dark'} theme`);
  theme.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('syntari-theme',next)}catch{}label();});label();
  loadGallery().catch(error=>{$('[data-home-gallery]').textContent=`Previews unavailable. Explore the components in System. ${error.message}`;}).finally(()=>$('[data-home-gallery]').setAttribute('aria-busy','false'));
  return {openPanel,closePanel,closeNav(){}};
}
async function loadGallery(){
  const response=await fetch('/registry/index.json');if(!response.ok)throw new Error('The registry could not load.');
  const registry=await response.json();document.querySelector('[data-home-count]').textContent=`${registry.components.length} components`;
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
    const preview=document.createElement('div');preview.className='home-card-stage';preview.dataset.homePreview=slug;preview.setAttribute('aria-label',`${c.name} live preview`);
    const info=document.createElement('div');info.className='home-card-info';const link=document.createElement('a');link.href=`/system/#${slug}`;link.append(document.createTextNode(c.name));const arrow=document.createElement('span');arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');link.append(arrow);
    info.append(link);article.append(preview,info);grid.append(article);observer.observe(preview);
  }
}
