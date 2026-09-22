import { initialize, getComponents, mount } from "../syntari.js";

const page = document.body.dataset.newPage;
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

function escapeHTML(value){
  return String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[char]);
}

function themeIcon(theme){
  return theme === "dark"
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
}

function setupTheme(){
  $$("[data-theme-toggle]").forEach(button => {
    const paint = () => {
      const theme = document.documentElement.dataset.theme || "dark";
      button.innerHTML = themeIcon(theme);
      button.setAttribute("aria-label", "Switch to " + (theme === "dark" ? "light" : "dark") + " theme");
    };
    button.addEventListener("click", () => {
      const next = (document.documentElement.dataset.theme || "dark") === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("syntari-theme", next); } catch {}
      paint();
    });
    paint();
  });
}

function setupMagnetic(){
  if(matchMedia("(pointer:coarse)").matches || reduced.matches) return;
  $$("[data-magnetic]").forEach(button => {
    button.addEventListener("pointermove", event => {
      const rect = button.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width/2) * .08;
      const y = (event.clientY - rect.top - rect.height/2) * .1;
      button.style.transform = `translate3d(${x}px,${y}px,0)`;
    });
    button.addEventListener("pointerleave", () => { button.style.transform = ""; });
  });
}

function setupSoftCursor(stage){
  if(!stage || matchMedia("(pointer:coarse)").matches || reduced.matches) return;
  const cursor = $("[data-soft-cursor]", stage);
  if(!cursor) return;
  let tx=-40,ty=-40,x=-40,y=-40,raf=0;
  const loop = () => {
    x += (tx-x)*.19;
    y += (ty-y)*.19;
    cursor.style.transform = `translate3d(${x-12}px,${y-12}px,0)`;
    raf = requestAnimationFrame(loop);
  };
  stage.addEventListener("pointerenter", () => {
    cursor.classList.add("is-visible");
    if(!raf) loop();
  });
  stage.addEventListener("pointerleave", () => cursor.classList.remove("is-visible"));
  stage.addEventListener("pointermove", event => {
    const rect = stage.getBoundingClientRect();
    tx = event.clientX - rect.left + stage.scrollLeft;
    ty = event.clientY - rect.top + stage.scrollTop;
    cursor.classList.toggle("is-hot", !!event.target.closest("button,a,input,textarea,select,[role=button]"));
  });
}

async function copyText(text, button){
  try { await navigator.clipboard.writeText(text); } catch { return; }
  if(!button) return;
  const label = button.querySelector("span") || button;
  const original = button.dataset.copyLabel || label.textContent;
  button.dataset.copyLabel = original;
  label.textContent = "Copied";
  setTimeout(() => { label.textContent = original; }, 1000);
}

setupTheme();
setupMagnetic();

/* Standalone command palette composition */
if (document.querySelector("[data-command-palette]") && !document.body.dataset.newPage) {
  const palette=document.querySelector("[data-command-palette]");
  const input=palette.querySelector("[data-command-input]");
  const status=palette.querySelector("[data-command-status]");
  const items=[...palette.querySelectorAll(".command-item")];
  let visible=[];
  let active=0;

  const paintActive=()=>{
    visible.forEach((item,index)=>{
      const selected=index===active;
      item.classList.toggle("is-active",selected);
      item.setAttribute("aria-selected",String(selected));
    });
  };

  const filter=()=>{
    const query=input.value.trim().toLowerCase();
    visible=[];
    items.forEach(item=>{
      const matches=!query || (item.dataset.commandValue||item.textContent).toLowerCase().includes(query);
      item.hidden=!matches;
      if(matches) visible.push(item);
    });
    palette.querySelectorAll("[data-command-group]").forEach(group=>{
      group.hidden=!group.querySelector(".command-item:not([hidden])");
    });
    palette.querySelectorAll(".command-divider").forEach(divider=>{
      const before=divider.previousElementSibling;
      const after=divider.nextElementSibling;
      divider.hidden=!!before?.hidden || !!after?.hidden;
    });
    active=0;
    paintActive();
  };

  const choose=item=>{
    if(!item) return;
    const value=item.dataset.commandValue||item.textContent.trim();
    if(status) status.textContent=value+" selected.";
  };

  input?.addEventListener("input",filter);
  input?.addEventListener("keydown",event=>{
    if(!visible.length) return;
    if(event.key==="ArrowDown"){event.preventDefault();active=(active+1)%visible.length;paintActive();visible[active].scrollIntoView({block:"nearest"});}
    if(event.key==="ArrowUp"){event.preventDefault();active=(active-1+visible.length)%visible.length;paintActive();visible[active].scrollIntoView({block:"nearest"});}
    if(event.key==="Enter"){event.preventDefault();choose(visible[active]);}
  });
  items.forEach(item=>item.addEventListener("click",()=>choose(item)));
  filter();
}

/* Standalone analytics compositions */
{
  const revenueCard=document.querySelector("[data-revenue-card]");
  if(revenueCard && !document.body.dataset.newPage){
    const revenueSeries={
      "7d":{value:"€8,940",delta:"+6.8%",points:[28,42,35,55,49,66,74]},
      "30d":{value:"€24,532",delta:"+12.4%",points:[22,28,35,31,44,50,47,58,64,60,71,76]},
      "90d":{value:"€68,920",delta:"+18.7%",points:[18,24,21,32,29,41,38,52,48,61,57,69,66,78]}
    };
    const line=revenueCard.querySelector("[data-revenue-line]");
    const area=revenueCard.querySelector("[data-revenue-area]");
    const point=revenueCard.querySelector("[data-revenue-point]");
    const valueNode=revenueCard.querySelector("[data-revenue-value]");
    const deltaNode=revenueCard.querySelector("[data-revenue-delta]");
    const overlay=revenueCard.querySelector("[data-loading-overlay]");
    let updateTimer=0;

    const pathFor=points=>{
      const width=624,height=154,left=8,top=34;
      const min=Math.min(...points),max=Math.max(...points);
      const x=i=>left+i*((width-left)/Math.max(1,points.length-1));
      const y=v=>top+(max-v)/Math.max(1,max-min)*height;
      return points.map((v,i)=>(i?"L":"M")+x(i).toFixed(1)+","+y(v).toFixed(1)).join(" ");
    };
    const paint=(key)=>{
      const data=revenueSeries[key]||revenueSeries["30d"];
      const d=pathFor(data.points);
      line?.setAttribute("d",d);
      if(area) area.setAttribute("d",d+" L632,212 L8,212 Z");
      if(point){
        const last=data.points.length-1;
        const parts=d.trim().split(" ");
        const xy=parts[last].slice(1).split(",");
        point.setAttribute("cx",xy[0]); point.setAttribute("cy",xy[1]);
      }
      if(valueNode) valueNode.textContent=data.value;
      if(deltaNode) deltaNode.textContent=data.delta;
    };
    const busy=value=>{
      revenueCard.dataset.loading=String(value);
      revenueCard.setAttribute("aria-busy",String(value));
      if(overlay) overlay.setAttribute("aria-hidden",String(!value));
    };

    paint("30d");
    busy(false);
    document.addEventListener("click",event=>{
      const option=event.target.closest("[data-revenue-period] [data-option]");
      if(!option) return;
      const key=option.dataset.value||"30d";
      clearTimeout(updateTimer);
      busy(true);
      updateTimer=setTimeout(()=>{paint(key);busy(false);},260);
    });
  }

  const report=document.querySelector("[data-team-report]");
  if(report && !document.body.dataset.newPage){
    const data={
      week:{efficiency:"84%",delta:"+9.8%",time:"126h",cost:"€8,420"},
      month:{efficiency:"81%",delta:"+6.4%",time:"438h",cost:"€27,900"},
      quarter:{efficiency:"86%",delta:"+11.2%",time:"1,284h",cost:"€82,600"}
    };
    const overlay=report.querySelector("[data-loading-overlay]");
    let updateTimer=0;
    const busy=value=>{
      report.dataset.loading=String(value);
      report.setAttribute("aria-busy",String(value));
      if(overlay) overlay.setAttribute("aria-hidden",String(!value));
    };
    const paint=key=>{
      const current=data[key]||data.week;
      report.querySelector("[data-efficiency]").textContent=current.efficiency;
      report.querySelector("[data-efficiency-delta]").textContent=current.delta;
      report.querySelector("[data-time-saved]").textContent=current.time;
      report.querySelector("[data-cost-saved]").textContent=current.cost;
    };
    paint("week");
    busy(false);
    document.addEventListener("click",event=>{
      const option=event.target.closest("[data-report-period] [data-option]");
      if(!option) return;
      const key=option.dataset.value||"week";
      clearTimeout(updateTimer);
      busy(true);
      updateTimer=setTimeout(()=>{paint(key);busy(false);},260);
    });
  }
}

/* ---------------- Renderer ---------------- */
if(page === "renderer"){
  const scenarios = {
    dashboard:{
      label:"Revenue health",
      prompt:"Create a calm revenue health dashboard for a finance lead. Show ARR, month-over-month trend, channel contribution and anomalies.",
      intent:"Revenue health dashboard for a finance lead, prioritising ARR and the evidence behind change.",
      pattern:"Metric overview",
      confidence:94,
      slugs:["headline-metric","metric-strip","area-chart","source-list"],
      validation:[
        "Hierarchy has one dominant metric.",
        "Every comparison names its period.",
        "Chart values remain available as text.",
        "Semantic state is never color-only."
      ]
    },
    onboarding:{
      label:"Workspace setup",
      prompt:"Create a workspace setup review with progress, owners, completed steps and the next action.",
      intent:"A setup review that makes progress, ownership and the next action immediately legible.",
      pattern:"Guided setup review",
      confidence:91,
      slugs:["progress-and-score","selectable-cards","metadata-list","activity-list"],
      validation:[
        "Progress has a textual equivalent.",
        "Next action remains explicit.",
        "Completed work stays visible.",
        "Interactive choices expose focus state."
      ]
    },
    review:{
      label:"Project review",
      prompt:"Create a project decision screen that summarizes status, evidence, recent activity and the next decision.",
      intent:"Project review focused on evidence, current state and a clear next decision.",
      pattern:"Decision workspace",
      confidence:89,
      slugs:["banner","stat-row","activity-list","tabs"],
      validation:[
        "Decision context appears before actions.",
        "Status is written, not implied.",
        "Activity uses chronological labels.",
        "Secondary actions remain visually quiet."
      ]
    },
    verification:{
      label:"Verification",
      prompt:"Create a secure one-time-code verification step with a clear error state and recovery path.",
      intent:"A focused verification step with obvious completion, error and recovery states.",
      pattern:"Verification step",
      confidence:96,
      slugs:["otp-input","text-input","banner","button"],
      validation:[
        "Code slots expose focus state.",
        "Error state is announced in text.",
        "Recovery action remains reachable.",
        "No hidden destructive action."
      ]
    }
  };

  let catalog=[];
  let mounted=[];
  let activeScenario="dashboard";
  let rendering=false;

  const componentBySlug = slug => catalog.find(component => component.slug === slug);
  const exists = slug => !!componentBySlug(slug);

  function fallback(index, used){
    const preferred=["headline-metric","metric-and-sparkline","card","progress-and-score","metadata-list","activity-list","text-input","switch"];
    for(const slug of preferred){
      if(exists(slug) && !used.includes(slug)) return slug;
    }
    const component = catalog.find(item => !used.includes(item.slug));
    return component?.slug || catalog[index % Math.max(1,catalog.length)]?.slug || null;
  }

  function destroyMounted(){
    mounted.forEach(instance => { try{ instance.destroy(); }catch{} });
    mounted=[];
  }

  function resolveSlugs(scenario){
    const resolved=[];
    scenario.slugs.forEach((slug,index) => {
      const candidate = exists(slug) ? slug : fallback(index,resolved);
      if(candidate && !resolved.includes(candidate)) resolved.push(candidate);
    });
    while(resolved.length < 4){
      const candidate=fallback(resolved.length,resolved);
      if(!candidate || resolved.includes(candidate)) break;
      resolved.push(candidate);
    }
    return resolved;
  }

  function renderTrace(scenario,resolved){
    $("[data-output-title]").textContent=scenario.label;
    $("[data-trace-intent]").textContent=scenario.intent;
    $("[data-trace-pattern]").textContent=scenario.pattern;
    $("[data-trace-confidence]").textContent=scenario.confidence+"%";
    $("[data-confidence-fill]").style.width=scenario.confidence+"%";
    $("[data-component-count]").textContent=resolved.length+" primitives";

    $("[data-trace-components]").innerHTML=resolved.map((slug,index)=>{
      const component=componentBySlug(slug);
      return `<div class="trace-component"><i>0${index+1}</i><div><strong>${escapeHTML(component?.name||slug)}</strong><span>${escapeHTML(component?.category||"Primitive")}</span></div></div>`;
    }).join("");

    $("[data-validation-list]").innerHTML=scenario.validation.map(item =>
      `<div class="validation-item"><i></i><span>${escapeHTML(item)}</span></div>`
    ).join("");

    const ir={
      version:"0.2",
      intent:scenario.intent,
      pattern:scenario.pattern,
      confidence:scenario.confidence/100,
      composition:resolved.map((slug,index)=>({
        slot:index===0?"primary":index===2?"evidence":"support-"+index,
        component:slug
      })),
      rules:[
        "dominant-metric-first",
        "explicit-comparison-period",
        "no-color-only-meaning"
      ],
      validation:{status:"pass",blockingIssues:0}
    };
    $("[data-ir-code]").textContent=JSON.stringify(ir,null,2);
  }

  async function renderScenario(scenario,{animate=true}={}){
    if(rendering) return;
    rendering=true;
    const frame=$("[data-runtime]");
    const screen=$("[data-render-screen]");
    const loading=$("[data-render-loading]");
    const loadingLabel=$("[data-loading-label]");
    const steps=["ask","decide","compose","verify","render"];
    const labels=["Understanding intent","Selecting a valid pattern","Composing trusted primitives","Validating against Syntari","Rendering interface"];

    frame.classList.add("is-running");
    screen.classList.add("is-leaving");
    loading.hidden=false;
    $$("[data-runtime-step]").forEach(node=>node.classList.remove("is-active","is-complete"));

    if(animate && !reduced.matches){
      for(let i=0;i<steps.length;i++){
        const node=$(`[data-runtime-step="${steps[i]}"]`);
        node.classList.add("is-active");
        loadingLabel.textContent=labels[i];
        await wait(i===0?240:310);
        node.classList.remove("is-active");
        node.classList.add("is-complete");
      }
    }else{
      $$("[data-runtime-step]").forEach(node=>node.classList.add("is-complete"));
    }

    destroyMounted();
    screen.innerHTML="";
    const resolved=resolveSlugs(scenario);

    for(let i=0;i<resolved.length;i++){
      const cell=document.createElement("div");
      cell.className="render-cell"+(i===2?" wide":"");
      screen.append(cell);
      try{
        const instance=await mount(resolved[i],cell);
        mounted.push(instance);
      }catch{
        cell.innerHTML=`<div class="trace-component"><i>UI</i><div><strong>${escapeHTML(resolved[i])}</strong><span>Trusted primitive</span></div></div>`;
      }
    }

    renderTrace(scenario,resolved);
    screen.classList.remove("is-leaving");
    loading.hidden=true;
    $$("[data-runtime-step]").forEach(node=>node.classList.add("is-complete"));
    $$(".render-cell",screen).forEach((cell,index)=>{
      setTimeout(()=>cell.classList.add("is-in"),80+index*90);
    });
    setTimeout(()=>frame.classList.remove("is-running"),600);
    rendering=false;
  }

  function selectScenario(key){
    if(!scenarios[key]) return;
    activeScenario=key;
    $("[data-intent]").value=scenarios[key].prompt;
    $$("[data-scenario]").forEach(button => button.setAttribute("aria-pressed",button.dataset.scenario===key?"true":"false"));
  }

  async function bootRenderer(){
    await initialize();
    catalog=await getComponents();
    setupSoftCursor($("[data-render-viewport]"));

    $$("[data-scenario]").forEach(button=>button.addEventListener("click",()=>selectScenario(button.dataset.scenario)));

    $("[data-intent-form]").addEventListener("submit",event=>{
      event.preventDefault();
      const scenario={...scenarios[activeScenario]};
      const prompt=$("[data-intent]").value.trim();
      if(prompt){ scenario.prompt=prompt; scenario.intent=prompt; }
      renderScenario(scenario,{animate:true});
    });

    $("[data-replay-render]").addEventListener("click",()=>renderScenario(scenarios[activeScenario],{animate:true}));

    $$("[data-trace-tab]").forEach((button,index)=>{
      button.addEventListener("click",()=>{
        $$("[data-trace-tab]").forEach(item=>item.setAttribute("aria-selected","false"));
        button.setAttribute("aria-selected","true");
        $(".rail-tab-indicator").style.setProperty("--tab-x",(index*100)+"%");
        $$("[data-trace-view]").forEach(view=>{ view.hidden=view.dataset.traceView!==button.dataset.traceTab; });
      });
    });

    $("[data-copy-ir]").addEventListener("click",event=>copyText($("[data-ir-code]").textContent,event.currentTarget));

    document.addEventListener("keydown",event=>{
      if((event.metaKey||event.ctrlKey)&&event.key==="Enter"){
        event.preventDefault();
        $("[data-intent-form]").requestSubmit();
      }
    });

    await renderScenario(scenarios.dashboard,{animate:false});
  }

  bootRenderer().catch(error=>{
    console.error(error);
    const screen=$("[data-render-screen]");
    if(screen) screen.innerHTML='<div class="render-cell wide is-in"><div><strong>Syntari runtime unavailable</strong><p>Reload to reconnect the component registry.</p></div></div>';
  });
}

/* ---------------- Components ---------------- */
if(page === "components"){
  let catalog=[];
  let selected=null;
  let selectedIndex=0;
  let activeMount=null;
  let query="";

  function tokensFor(component){
    if(Array.isArray(component.tokens)&&component.tokens.length) return component.tokens.slice(0,10);
    const matches=String(component.html||"").match(/var\(--[a-z0-9-]+\)/g)||[];
    return [...new Set(matches.map(token=>token.slice(4,-1)))].slice(0,10);
  }

  function groupsFor(items){
    const groups={};
    items.forEach(component=>{
      const category=component.category||"Other";
      (groups[category] ||= []).push(component);
    });
    return groups;
  }

  function renderNav(){
    const term=query.trim().toLowerCase();
    const visible=catalog.filter(component=>{
      const haystack=(component.name+" "+component.category+" "+(component.description||"")).toLowerCase();
      return !term||haystack.includes(term);
    });
    const groups=groupsFor(visible);
    let html="";
    Object.keys(groups).sort().forEach(category=>{
      html+=`<div class="nav-category">${escapeHTML(category)}</div>`;
      groups[category].forEach(component=>{
        const active=selected?.slug===component.slug;
        html+=`<button class="nav-component" type="button" data-component-slug="${escapeHTML(component.slug)}" aria-current="${active?"true":"false"}"><span>${escapeHTML(component.name)}</span><span>↗</span></button>`;
      });
    });
    $("[data-component-nav]").innerHTML=html||'<div class="nav-category">No matches</div>';
    $$("[data-component-slug]").forEach(button=>button.addEventListener("click",()=>selectComponent(button.dataset.componentSlug,{animate:true})));
  }

  function renderDocs(component){
    $("[data-docs-category]").textContent=String(component.category||"Component").toUpperCase();
    $("[data-docs-title]").textContent=component.name;
    $("[data-docs-description]").textContent=component.description||"A trusted Syntari primitive.";
    $("[data-registry-id]").textContent=component.slug;
    $("[data-code-title]").textContent=component.name;
    $("[data-code-file]").textContent=component.slug+".html";
    $("[data-component-code]").textContent=component.html||"<!-- Component markup is provided by the Syntari runtime. -->";
    $("[data-runtime-snippet]").textContent=`await mount("${component.slug}", "#target")`;
    $("[data-install-command]").textContent=`npx syntari add ${component.slug}`;

    const tokens=tokensFor(component);
    $("[data-token-list]").innerHTML=tokens.length
      ? tokens.map(token=>`<div class="docs-token-item"><code>${escapeHTML(token)}</code><span style="--token-color:var(${escapeHTML(token)})"></span></div>`).join("")
      : '<p>No component-specific tokens. Uses the shared semantic layer.</p>';

    const docs=$("[data-docs-scroll]");
    if(docs?.animate && !reduced.matches){
      docs.animate(
        [{opacity:.38,transform:"translateY(7px)"},{opacity:1,transform:"none"}],
        {duration:420,easing:"cubic-bezier(.16,1,.3,1)"}
      );
    }
  }

  async function selectComponent(slug,{animate=true}={}){
    const component=catalog.find(item=>item.slug===slug);
    if(!component) return;
    selected=component;
    selectedIndex=catalog.indexOf(component);
    renderNav();
    renderDocs(component);
    closeCode();
    closeInstall();

    const host=$("[data-component-mount]");
    if(animate&&!reduced.matches) host.classList.add("is-changing");
    await wait(animate&&!reduced.matches?210:0);

    if(activeMount){ try{activeMount.destroy();}catch{} activeMount=null; }
    host.innerHTML="";
    try{
      activeMount=await mount(component.slug,host);
      $("[data-preview-status]").textContent="Live preview";
    }catch{
      host.innerHTML=`<div class="docs-meta-grid"><div><span>Preview</span><strong>${escapeHTML(component.name)}</strong></div><div><span>Status</span><strong>Unavailable</strong></div></div>`;
      $("[data-preview-status]").textContent="Preview unavailable";
    }

    if(animate&&!reduced.matches) setTimeout(()=>host.classList.remove("is-changing"),360);
    try{ history.replaceState(null,"","#"+component.slug); }catch{}
  }

  function openCode(){
    $("[data-docs-rail]").classList.add("is-code-open");
    $("[data-code-sheet]").setAttribute("aria-hidden","false");
  }
  function closeCode(){
    $("[data-docs-rail]")?.classList.remove("is-code-open");
    $("[data-code-sheet]")?.setAttribute("aria-hidden","true");
  }

  function openInstall(){
    const cluster=$("[data-install-cluster]");
    cluster.dataset.open="true";
    $("[data-install-toggle]").setAttribute("aria-expanded","true");
    $("[data-install-expanded]").setAttribute("aria-hidden","false");
  }
  function closeInstall(){
    const cluster=$("[data-install-cluster]");
    if(!cluster) return;
    cluster.dataset.open="false";
    $("[data-install-toggle]").setAttribute("aria-expanded","false");
    $("[data-install-expanded]").setAttribute("aria-hidden","true");
  }

  function renderCommand(term=""){
    const q=term.toLowerCase();
    const items=catalog.filter(component=>!q||(component.name+" "+component.category).toLowerCase().includes(q)).slice(0,18);
    $("[data-command-results]").innerHTML=items.map(component=>
      `<button class="command-result" type="button" data-command-slug="${escapeHTML(component.slug)}"><span>${escapeHTML(component.name)}</span><span>${escapeHTML(component.category||"")}</span></button>`
    ).join("");
    $$("[data-command-slug]").forEach(button=>button.addEventListener("click",()=>{
      selectComponent(button.dataset.commandSlug,{animate:true});
      closeCommand();
    }));
  }
  function openCommand(){
    const palette=$("[data-command-palette]");
    palette.hidden=false;
    const input=$("[data-command-input]");
    input.value="";
    renderCommand("");
    requestAnimationFrame(()=>input.focus());
  }
  function closeCommand(){ $("[data-command-palette]").hidden=true; }

  function toggleFocus(){ $("[data-component-frame]").classList.toggle("is-focused"); }

  async function bootComponents(){
    await initialize();
    catalog=(await getComponents()).slice().sort((a,b)=>
      (a.category||"").localeCompare(b.category||"")||a.name.localeCompare(b.name)
    );
    $("[data-total-components]").textContent=catalog.length;
    renderNav();

    let initial=location.hash?location.hash.slice(1):"otp-input";
    if(!catalog.some(item=>item.slug===initial)) initial=catalog[0]?.slug||"";
    if(initial) await selectComponent(initial,{animate:false});

    setupSoftCursor($("[data-preview-stage]"));

    $("[data-component-search]").addEventListener("input",event=>{ query=event.target.value; renderNav(); });

    $$("[data-open-code]").forEach(button=>button.addEventListener("click",openCode));
    $("[data-close-code]").addEventListener("click",closeCode);

    $("[data-install-toggle]").addEventListener("click",()=>{
      $("[data-install-cluster]").dataset.open==="true"?closeInstall():openInstall();
    });
    $("[data-install-close]").addEventListener("click",closeInstall);
    $("[data-copy-install]").addEventListener("click",event=>copyText($("[data-install-command]").textContent,event.currentTarget));
    $("[data-copy-runtime]").addEventListener("click",event=>copyText($("[data-runtime-snippet]").textContent,event.currentTarget));
    $("[data-copy-code]").addEventListener("click",event=>copyText($("[data-component-code]").textContent,event.currentTarget));

    $("[data-replay-component]").addEventListener("click",()=>selected&&selectComponent(selected.slug,{animate:true}));
    $("[data-focus-preview]").addEventListener("click",toggleFocus);

    $("[data-command-input]").addEventListener("input",event=>renderCommand(event.target.value));
    $("[data-command-palette]").addEventListener("click",event=>{ if(event.target===event.currentTarget) closeCommand(); });

    document.addEventListener("keydown",event=>{
      const typing=event.target.matches("input,textarea,select");
      if(event.key==="Escape"){
        if(!$("[data-command-palette]").hidden) closeCommand();
        else if($("[data-docs-rail]").classList.contains("is-code-open")) closeCode();
        else if($("[data-install-cluster]").dataset.open==="true") closeInstall();
        else $("[data-component-frame]").classList.remove("is-focused");
        return;
      }
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){
        event.preventDefault(); openCommand(); return;
      }
      if(event.key==="/"&&!typing){
        event.preventDefault(); $("[data-component-search]").focus(); return;
      }
      if(!typing&&event.altKey&&event.key==="ArrowRight"&&selected){
        event.preventDefault();
        const next=(selectedIndex+1)%catalog.length;
        selectComponent(catalog[next].slug,{animate:true});
      }
      if(!typing&&event.altKey&&event.key==="ArrowLeft"&&selected){
        event.preventDefault();
        const prev=(selectedIndex-1+catalog.length)%catalog.length;
        selectComponent(catalog[prev].slug,{animate:true});
      }
    });
  }

  bootComponents().catch(error=>{
    console.error(error);
    $("[data-component-nav]").innerHTML='<div class="nav-category">Runtime unavailable</div>';
  });
}


/* ---------------- Gallery ---------------- */
if(page === "gallery"){
  let instances=[];

  async function bootGallery(){
    await initialize();
    const cards=$$("[data-gallery-slug]");
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(async entry=>{
        if(!entry.isIntersecting) return;
        const card=entry.target;
        observer.unobserve(card);
        const host=$("[data-gallery-mount]",card);
        try{
          const instance=await mount(card.dataset.gallerySlug,host);
          instances.push(instance);
          card.classList.add("is-entering");
          setTimeout(()=>card.classList.remove("is-entering"),760);
        }catch{
          host.innerHTML='<div class="docs-meta-grid"><div><span>Component</span><strong>'+escapeHTML(card.dataset.gallerySlug)+'</strong></div><div><span>Status</span><strong>Preview unavailable</strong></div></div>';
        }
      });
    },{rootMargin:"180px 0px",threshold:.08});

    cards.forEach(card=>observer.observe(card));
  }

  bootGallery().catch(error=>{
    console.error(error);
    $$("[data-gallery-mount]").forEach(host=>{
      host.innerHTML='<div class="docs-meta-grid"><div><span>Gallery</span><strong>Runtime unavailable</strong></div></div>';
    });
  });
}
