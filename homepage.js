import {getComponents, mount} from './syntari.js';
import {copyText} from './workspace.js';
export function initHomepage() {
  const theme=document.querySelector('[data-home-theme]');
  const label=()=>theme.setAttribute('aria-label',`Switch to ${document.documentElement.dataset.theme==='dark'?'light':'dark'} theme`);
  theme.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('syntari-theme',next)}catch{}label();});label();
  loadGallery().catch(error=>{document.querySelector('[data-home-gallery]').textContent=`Previews unavailable. Explore the components in System. ${error.message}`;}).finally(()=>document.querySelector('[data-home-gallery]').setAttribute('aria-busy','false'));
}
async function loadGallery(){
  const response=await fetch('/registry/index.json');if(!response.ok)throw new Error('The registry could not load.');
  const registry=await response.json();if(document.querySelector('[data-home-count]'))document.querySelector('[data-home-count]').textContent=`${registry.components.length} components`;
  const command=document.querySelector('[data-home-command]');command.textContent='npx syntari-ui add app-shell';
  const copy=document.querySelector('[data-home-copy]');copy.disabled=false;copy.addEventListener('click',()=>copyText(command.textContent,document.querySelector('[data-home-copy-status]')));
  const catalog=await getComponents();const grid=document.querySelector('[data-home-gallery]');grid.replaceChildren();
  // Five curated live scenes: open, generous stages rather than repeated cards.
  const featured=[
    {slug:'chart-bars',size:'hero',eyebrow:'Data visualisation',caption:'Measure what matters'},
    {slug:'session-card',size:'side',eyebrow:'Activity',caption:'A more considered surface'},
    {slug:'expandable-dock',size:'side',eyebrow:'Navigation',caption:'Explore the interaction'},
    {slug:'tool-approval',size:'wide',eyebrow:'Agent decisions',caption:'Control before action'},
    {slug:'command-palette',size:'wide',eyebrow:'Productivity',caption:'Find anything, quickly'}
  ];
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      observer.unobserve(entry.target);
      const slug=entry.target.dataset.homePreview;
      mount(slug,entry.target,{configure:slug==='tool-approval'?root=>{
        const approval=root.querySelector('[data-agent-kind="approval"]');
        approval?.querySelector('p.hint')?.remove();
        if(approval)approval.dataset.showResetPreview='false';
      }:undefined}).catch(()=>{entry.target.textContent='Preview unavailable — explore this component in System.';});
    }
  },{rootMargin:'250px'});
  for(const item of featured){
    const component=catalog.find(entry=>entry.slug===item.slug);
    if(!component)continue;
    const article=document.createElement('article');article.className='home-card home-card--'+item.size;article.dataset.feature=item.slug;
    const stage=document.createElement('div');
    stage.className='home-card-stage';stage.dataset.homePreview=item.slug;stage.setAttribute('data-ui','');
    stage.setAttribute('role','group');stage.setAttribute('aria-label',component.name+' live preview');
    const info=document.createElement('div');info.className='home-card-info';
    const caption=document.createElement('div');caption.className='home-card-caption';
    const eyebrow=document.createElement('span');eyebrow.className='home-card-eyebrow';eyebrow.textContent=item.eyebrow;
    const title=document.createElement('strong');title.textContent=item.caption;caption.append(eyebrow,title);
    const link=document.createElement('a');link.href='/system/#'+encodeURIComponent(item.slug);
    link.textContent='Explore '+component.name+' ↗';
    link.setAttribute('aria-label','Inspect '+component.name+' in the component library');
    info.append(caption,link);article.append(stage,info);grid.append(article);
    observer.observe(stage);
  }
}
if(document.body.classList.contains('landing-body'))initHomepage();
