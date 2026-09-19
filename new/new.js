const money = new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0});
const integer = new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function animateNumber(el,to,formatter,{duration=720,initial=false}={}){
  if(!el)return;
  const from=initial?0:Number(el.dataset.rawValue??to);
  el.dataset.rawValue=String(to);
  el.setAttribute('aria-label',formatter(to));
  if(reduced.matches||from===to){el.textContent=formatter(to);return}
  el.getAnimations().forEach(animation=>animation.cancel());
  const start=performance.now();
  const frame=now=>{
    const t=Math.min(1,(now-start)/duration);
    const eased=1-Math.pow(1-t,3);
    const current=from+(to-from)*eased;
    el.textContent=formatter(current);
    if(t<1)requestAnimationFrame(frame);
    else el.textContent=formatter(to);
  };
  requestAnimationFrame(frame);
}

function beginLoading(root){
  root.dataset.loading='true';
  root.setAttribute('aria-busy','true');
}
function finishLoading(root){
  root.dataset.loading='false';
  root.setAttribute('aria-busy','false');
  root.classList.remove('is-revealing');
  void root.offsetWidth;
  root.classList.add('is-revealing');
  setTimeout(()=>root.classList.remove('is-revealing'),450);
}

const commandRoot=document.querySelector('[data-command-palette]');
if(commandRoot){
  const input=commandRoot.querySelector('[data-command-input]');
  const status=commandRoot.querySelector('[data-command-status]');
  const allItems=[...commandRoot.querySelectorAll('.command-item')];
  let visibleItems=allItems;
  let activeIndex=0;

  const setActive=index=>{
    if(!visibleItems.length)return;
    activeIndex=(index+visibleItems.length)%visibleItems.length;
    allItems.forEach(item=>{item.classList.remove('is-active');item.setAttribute('aria-selected','false')});
    const item=visibleItems[activeIndex];
    item.classList.add('is-active');
    item.setAttribute('aria-selected','true');
    item.scrollIntoView({block:'nearest'});
  };
  const filter=()=>{
    const term=input.value.trim().toLowerCase();
    allItems.forEach(item=>{item.hidden=!!term&&!item.dataset.commandValue.toLowerCase().includes(term)});
    commandRoot.querySelectorAll('[data-command-group]').forEach(group=>{
      group.hidden=![...group.querySelectorAll('.command-item')].some(item=>!item.hidden);
    });
    visibleItems=allItems.filter(item=>!item.hidden);
    setActive(0);
  };
  input.addEventListener('input',filter);
  input.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'){event.preventDefault();setActive(activeIndex+1)}
    if(event.key==='ArrowUp'){event.preventDefault();setActive(activeIndex-1)}
    if(event.key==='Enter'&&visibleItems.length){event.preventDefault();visibleItems[activeIndex].click()}
    if(event.key==='Escape'){input.value='';filter();input.blur()}
  });
  allItems.forEach(item=>item.addEventListener('click',()=>{
    status.textContent=item.dataset.commandValue+' selected.';
    setActive(visibleItems.indexOf(item));
  }));
  document.addEventListener('keydown',event=>{
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();input.focus();input.select()}
  });
}

const revenueRoot=document.querySelector('[data-revenue-card]');
if(revenueRoot){
  const datasets={
    '7d':{total:7860,delta:'+6.1%',last:1320,labels:['Sep 11','Sep 13','Sep 14','Sep 16','Sep 17'],points:[32,49,38,61,44,67,58,76,63,87,72,92]},
    '30d':{total:24532,delta:'+12.4%',last:2840,labels:['Aug 20','Aug 27','Sep 3','Sep 10','Sep 17'],points:[18,34,42,31,29,19,36,40,57,47,39,51,68,73,64,79,66,52,61,83,92,86,100]},
    '90d':{total:68920,delta:'+18.7%',last:4920,labels:['Jun 20','Jul 12','Aug 3','Aug 25','Sep 17'],points:[25,38,31,49,55,46,34,51,63,48,59,72,65,43,52,69,61,78,70,85,74,66,82,91,86,100]}
  };
  const select=revenueRoot.querySelector('[data-revenue-period]');
  const value=revenueRoot.querySelector('[data-revenue-value]');
  const delta=revenueRoot.querySelector('[data-revenue-delta]');
  const line=revenueRoot.querySelector('[data-revenue-line]');
  const area=revenueRoot.querySelector('[data-revenue-area]');
  const point=revenueRoot.querySelector('[data-revenue-point]');
  const tooltip=revenueRoot.querySelector('[data-revenue-tooltip]');
  const axis=revenueRoot.querySelector('[data-revenue-axis]');
  const width=624,startX=8,bottom=198,height=170;
  let firstRender=true;

  const pointsFor=data=>data.map((v,i)=>[startX+(width*i/(data.length-1)),bottom-(v/100)*height]);
  const smooth=pts=>{
    if(!pts.length)return'';
    let d='M '+pts[0][0].toFixed(2)+' '+pts[0][1].toFixed(2);
    for(let i=0;i<pts.length-1;i++){
      const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
      const c1x=p1[0]+(p2[0]-p0[0])/6,c1y=p1[1]+(p2[1]-p0[1])/6;
      const c2x=p2[0]-(p3[0]-p1[0])/6,c2y=p2[1]-(p3[1]-p1[1])/6;
      d+=' C '+c1x.toFixed(2)+' '+c1y.toFixed(2)+', '+c2x.toFixed(2)+' '+c2y.toFixed(2)+', '+p2[0].toFixed(2)+' '+p2[1].toFixed(2);
    }
    return d;
  };
  const animateChart=()=>{
    if(reduced.matches)return;
    line.getAnimations().forEach(animation=>animation.cancel());
    area.getAnimations().forEach(animation=>animation.cancel());
    point.getAnimations().forEach(animation=>animation.cancel());
    const length=line.getTotalLength();
    line.style.strokeDasharray=String(length);
    line.style.strokeDashoffset=String(length);
    const draw=line.animate([{strokeDashoffset:String(length)},{strokeDashoffset:'0'}],{duration:850,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
    draw.onfinish=()=>{line.style.strokeDashoffset='0'};
    area.animate([{opacity:0,clipPath:'inset(0 100% 0 0)'},{opacity:1,clipPath:'inset(0 0 0 0)'}],{duration:760,delay:70,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});
    point.animate([{opacity:0,transform:'scale(.45)'},{opacity:1,transform:'scale(1)'}],{duration:260,delay:650,easing:'cubic-bezier(.34,1.56,.64,1)',fill:'both'});
  };
  const render=()=>{
    const data=datasets[select.value];
    const pts=pointsFor(data.points);
    const lineD=smooth(pts);
    const first=pts[0],last=pts[pts.length-1];
    animateNumber(value,data.total,n=>money.format(Math.round(n)),{initial:firstRender,duration:780});
    delta.textContent=data.delta;
    line.setAttribute('d',lineD);
    area.setAttribute('d',lineD+' L '+last[0].toFixed(2)+' '+bottom+' L '+first[0].toFixed(2)+' '+bottom+' Z');
    point.setAttribute('cx',last[0]);
    point.setAttribute('cy',last[1]);
    tooltip.textContent=money.format(data.last);
    axis.innerHTML=data.labels.map(label=>'<span>'+label+'</span>').join('');
    requestAnimationFrame(animateChart);
    firstRender=false;
  };
  const refresh=async()=>{
    beginLoading(revenueRoot);
    await wait(reduced.matches?0:260);
    render();
    await wait(reduced.matches?0:180);
    finishLoading(revenueRoot);
  };
  select.addEventListener('change',refresh);
  render();
  setTimeout(()=>finishLoading(revenueRoot),reduced.matches?0:430);
}

const reportRoot=document.querySelector('[data-team-report]');
if(reportRoot){
  const periods={
    week:{efficiency:84,delta:'+9.8%',time:126,cost:8420,rows:[['Atlas',91,'42h','€3.2k'],['Pulse',78,'31h','€2.1k'],['Nova',86,'27h','€1.8k'],['Orbit',81,'26h','€1.3k']]},
    month:{efficiency:81,delta:'+6.4%',time:438,cost:27900,rows:[['Atlas',88,'148h','€9.8k'],['Pulse',74,'101h','€6.4k'],['Nova',84,'96h','€6.1k'],['Orbit',79,'93h','€5.6k']]},
    quarter:{efficiency:86,delta:'+11.2%',time:1284,cost:82600,rows:[['Atlas',93,'412h','€27.1k'],['Pulse',80,'298h','€18.9k'],['Nova',87,'316h','€20.6k'],['Orbit',83,'258h','€16.0k']]}
  };
  const select=reportRoot.querySelector('[data-report-period]');
  const rows=reportRoot.querySelector('[data-report-rows]');
  const efficiency=reportRoot.querySelector('[data-efficiency]');
  const timeSaved=reportRoot.querySelector('[data-time-saved]');
  const costSaved=reportRoot.querySelector('[data-cost-saved]');
  let firstRender=true;

  const animateBars=()=>{
    if(reduced.matches)return;
    [...rows.querySelectorAll('.progress>span')].forEach((bar,index)=>{
      const target=bar.style.width;
      bar.style.width='0%';
      requestAnimationFrame(()=>setTimeout(()=>{bar.style.width=target},index*45));
    });
  };
  const render=()=>{
    const data=periods[select.value];
    animateNumber(efficiency,data.efficiency,n=>Math.round(n)+'%',{initial:firstRender});
    reportRoot.querySelector('[data-efficiency-delta]').textContent=data.delta;
    animateNumber(timeSaved,data.time,n=>integer.format(Math.round(n))+'h',{initial:firstRender});
    animateNumber(costSaved,data.cost,n=>money.format(Math.round(n)),{initial:firstRender,duration:820});
    rows.innerHTML=data.rows.map(row=>'<tr><td>'+row[0]+'</td><td><span class="efficiency-cell"><span>'+row[1]+'%</span><span class="progress" aria-label="'+row[0]+' efficiency '+row[1]+' percent"><span style="width:'+row[1]+'%"></span></span></span></td><td>'+row[2]+'</td><td>'+row[3]+'</td></tr>').join('');
    requestAnimationFrame(animateBars);
    firstRender=false;
  };
  const refresh=async()=>{
    beginLoading(reportRoot);
    await wait(reduced.matches?0:260);
    render();
    await wait(reduced.matches?0:180);
    finishLoading(reportRoot);
  };
  select.addEventListener('change',refresh);
  render();
  setTimeout(()=>finishLoading(reportRoot),reduced.matches?0:430);
}
