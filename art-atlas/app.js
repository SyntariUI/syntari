
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const img=(name)=>({
  mona:'https://upload.wikimedia.org/wikipedia/commons/6/6a/Mona_Lisa.jpg',
  starry:'https://upload.wikimedia.org/wikipedia/commons/e/ea/The_Starry_Night.JPG',
  meninas:'https://upload.wikimedia.org/wikipedia/commons/9/99/Las_Meninas_01.jpg',
  pearl:'https://upload.wikimedia.org/wikipedia/commons/d/d7/Meisje_met_de_parel.jpg',
  venus:'https://upload.wikimedia.org/wikipedia/commons/1/1c/Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg',
  wave:'https://upload.wikimedia.org/wikipedia/commons/0/0a/The_Great_Wave_off_Kanagawa.jpg',
  kiss:'https://upload.wikimedia.org/wikipedia/commons/4/40/The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg',
  guernica:'https://upload.wikimedia.org/wikipedia/en/7/74/PicassoGuernica.jpg',
  liberty:'https://upload.wikimedia.org/wikipedia/commons/a/a7/Eug%C3%A8ne_Delacroix_-_La_libert%C3%A9_guidant_le_peuple.jpg',
  water:'https://upload.wikimedia.org/wikipedia/commons/3/35/Monet_Water_Lilies_1916.jpg',
  nightwatch:'https://upload.wikimedia.org/wikipedia/commons/2/28/The_Night_Watch_-_HD.jpg',
  milkmaid:'https://upload.wikimedia.org/wikipedia/commons/a/a8/Vermeer_-_The_Milkmaid_-_Google_Art_Project.jpg',
  memory:'https://upload.wikimedia.org/wikipedia/en/d/dd/The_Persistence_of_Memory.jpg',
  scream:'https://upload.wikimedia.org/wikipedia/commons/f/f4/The_Scream.jpg'
})[name];

const museums=[
 {id:'louvre',name:'Musée du Louvre',city:'Paris',country:'France',lat:48.8606,lng:2.3376,works:56,artists:41,description:'A vast collection spanning antiquity to the nineteenth century, home to some of the world’s most recognised works.'},
 {id:'orsay',name:'Musée d’Orsay',city:'Paris',country:'France',lat:48.86,lng:2.3266,works:38,artists:27,description:'A landmark collection of Impressionist and Post-Impressionist art inside a former railway station.'},
 {id:'prado',name:'Museo del Prado',city:'Madrid',country:'Spain',lat:40.4138,lng:-3.6921,works:48,artists:34,description:'A defining collection of European painting, especially Spanish masters including Velázquez and Goya.'},
 {id:'moma',name:'Museum of Modern Art',city:'New York',country:'United States',lat:40.7614,lng:-73.9776,works:44,artists:31,description:'Modern and contemporary art across painting, sculpture, photography, film and design.'},
 {id:'rijks',name:'Rijksmuseum',city:'Amsterdam',country:'Netherlands',lat:52.36,lng:4.8852,works:34,artists:25,description:'Dutch art and history from the Middle Ages to the twentieth century.'},
 {id:'mauritshuis',name:'Mauritshuis',city:'The Hague',country:'Netherlands',lat:52.0801,lng:4.3141,works:18,artists:16,description:'An intimate collection of Dutch and Flemish masterpieces from the Golden Age.'},
 {id:'uffizi',name:'Uffizi Gallery',city:'Florence',country:'Italy',lat:43.7677,lng:11.2553,works:31,artists:23,description:'One of the world’s great Renaissance collections, from Botticelli to Leonardo.'},
 {id:'belvedere',name:'Belvedere',city:'Vienna',country:'Austria',lat:48.1915,lng:16.38,works:19,artists:17,description:'A historic palace museum with a defining collection of Austrian modernism.'},
 {id:'reina',name:'Museo Reina Sofía',city:'Madrid',country:'Spain',lat:40.4086,lng:-3.6946,works:27,artists:20,description:'Spain’s national museum of twentieth-century art.'},
 {id:'nga',name:'National Gallery',city:'London',country:'United Kingdom',lat:51.5089,lng:-0.1283,works:36,artists:29,description:'European painting from the thirteenth to early twentieth centuries.'}
];

const works=[
 {id:'mona',title:'Mona Lisa',artist:'Leonardo da Vinci',year:1503,movement:'Renaissance',period:'1500–1599',museum:'louvre',image:img('mona'),about:'A portrait celebrated for its enigmatic expression, atmospheric landscape and extraordinary control of light.'},
 {id:'starry',title:'The Starry Night',artist:'Vincent van Gogh',year:1889,movement:'Post-Impressionism',period:'1800–1899',museum:'moma',image:img('starry'),about:'A turbulent night sky turns observation into emotion, rhythm and movement.'},
 {id:'meninas',title:'Las Meninas',artist:'Diego Velázquez',year:1656,movement:'Baroque',period:'1600–1699',museum:'prado',image:img('meninas'),about:'A complex meditation on looking, representation and the relationship between viewer, subject and painter.'},
 {id:'pearl',title:'Girl with a Pearl Earring',artist:'Johannes Vermeer',year:1665,movement:'Baroque',period:'1600–1699',museum:'mauritshuis',image:img('pearl'),about:'An intimate tronie whose direct gaze and soft light give the figure an unusual immediacy.'},
 {id:'venus',title:'The Birth of Venus',artist:'Sandro Botticelli',year:1485,movement:'Renaissance',period:'1400–1499',museum:'uffizi',image:img('venus'),about:'Myth, movement and idealised beauty come together in one of the defining images of the Renaissance.'},
 {id:'wave',title:'The Great Wave',artist:'Katsushika Hokusai',year:1831,movement:'Ukiyo-e',period:'1800–1899',museum:'louvre',image:img('wave'),about:'A monumental wave dwarfs Mount Fuji in a composition built from tension, rhythm and scale.'},
 {id:'kiss',title:'The Kiss',artist:'Gustav Klimt',year:1908,movement:'Symbolism',period:'1900–1999',museum:'belvedere',image:img('kiss'),about:'Pattern, gold and intimacy collapse the space between ornament and human figure.'},
 {id:'guernica',title:'Guernica',artist:'Pablo Picasso',year:1937,movement:'Cubism',period:'1900–1999',museum:'reina',image:img('guernica'),about:'A monumental anti-war painting built from fractured bodies, compressed space and stark monochrome.'},
 {id:'liberty',title:'Liberty Leading the People',artist:'Eugène Delacroix',year:1830,movement:'Romanticism',period:'1800–1899',museum:'louvre',image:img('liberty'),about:'A personification of liberty leads a crowd across the barricades in a defining Romantic image.'},
 {id:'water',title:'Water Lilies',artist:'Claude Monet',year:1916,movement:'Impressionism',period:'1900–1999',museum:'orsay',image:img('water'),about:'Surface, reflection and atmosphere dissolve into a field of colour and light.'},
 {id:'nightwatch',title:'The Night Watch',artist:'Rembrandt',year:1642,movement:'Baroque',period:'1600–1699',museum:'rijks',image:img('nightwatch'),about:'A civic guard portrait transformed into theatrical movement through light, gesture and depth.'},
 {id:'milkmaid',title:'The Milkmaid',artist:'Johannes Vermeer',year:1658,movement:'Baroque',period:'1600–1699',museum:'rijks',image:img('milkmaid'),about:'A quiet domestic task becomes monumental through concentration, texture and carefully measured light.'},
 {id:'memory',title:'The Persistence of Memory',artist:'Salvador Dalí',year:1931,movement:'Surrealism',period:'1900–1999',museum:'moma',image:img('memory'),about:'Soft clocks and a barren landscape turn ordinary time into something unstable and dreamlike.'},
 {id:'scream',title:'The Scream',artist:'Edvard Munch',year:1893,movement:'Expressionism',period:'1800–1899',museum:'nga',image:img('scream'),about:'A figure, sky and landscape merge into one vibrating expression of anxiety.'}
];

const state={
 filters:{period:null,movement:null,artist:null,museum:null,country:null,decade:null},
 visitedMuseums:new Set(JSON.parse(localStorage.getItem('atlasVisitedMuseums')||'[]')),
 seenWorks:new Set(JSON.parse(localStorage.getItem('atlasSeenWorks')||'[]')),
 reflections:JSON.parse(localStorage.getItem('atlasReflections')||'{}'),
 moods:JSON.parse(localStorage.getItem('atlasMoods')||'{}'),
 selectedWork:null,
 selectedMuseum:null
};

const museumBy=id=>museums.find(m=>m.id===id);
const workBy=id=>works.find(w=>w.id===id);
const filteredWorks=()=>works.filter(w=>{
 const m=museumBy(w.museum),f=state.filters;
 return (!f.period||w.period===f.period)&&(!f.movement||w.movement===f.movement)&&(!f.artist||w.artist===f.artist)&&(!f.museum||w.museum===f.museum)&&(!f.country||m.country===f.country)&&(!f.decade||Math.floor(w.year/10)*10===Number(f.decade));
});
function persist(){
 localStorage.setItem('atlasVisitedMuseums',JSON.stringify([...state.visitedMuseums]));
 localStorage.setItem('atlasSeenWorks',JSON.stringify([...state.seenWorks]));
 localStorage.setItem('atlasReflections',JSON.stringify(state.reflections));
 localStorage.setItem('atlasMoods',JSON.stringify(state.moods));
}
function toast(msg){
 const t=$('#atlas-toast');$('span',t).textContent=msg;t.hidden=false;
 clearTimeout(window.__atlasToast);window.__atlasToast=setTimeout(()=>t.hidden=true,2200);
}
function redrawIcons(){window.lucide?.createIcons()}
const map=L.map('map',{zoomControl:true,minZoom:2,maxZoom:17,worldCopyJump:true}).setView([46,9],4);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',{maxZoom:19,subdomains:'abcd'}).addTo(map);
const labelLayer=L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',{maxZoom:19,subdomains:'abcd',opacity:.55}).addTo(map);
const markerLayer=L.layerGroup().addTo(map);

function iconHTML(type,item,count){
 if(type==='art') return '<div class="art-marker"><img class="thumb" src="'+item.image+'" alt=""></div>';
 if(type==='museum') return '<div class="art-marker"><span class="museum-dot"></span></div>';
 return '<div class="art-marker"><span class="cluster">'+count+'</span></div>';
}
function renderMarkers(){
 markerLayer.clearLayers();
 const visible=filteredWorks(),zoom=map.getZoom();
 const byMuseum={};
 visible.forEach(w=>(byMuseum[w.museum]??=[]).push(w));
 if(zoom<=4){
   const regions=[
     {lat:48.8,lng:2,count:visible.filter(w=>['louvre','orsay','prado','nga','belvedere'].includes(w.museum)).length},
     {lat:52,lng:4.5,count:visible.filter(w=>['rijks','mauritshuis'].includes(w.museum)).length},
     {lat:41,lng:12,count:visible.filter(w=>['uffizi','reina'].includes(w.museum)).length},
     {lat:40.7,lng:-74,count:visible.filter(w=>w.museum==='moma').length}
   ];
   regions.filter(r=>r.count).forEach(r=>L.marker([r.lat,r.lng],{icon:L.divIcon({html:iconHTML('cluster',null,r.count),className:'',iconSize:[42,42]})}).addTo(markerLayer));
   visible.slice(0,8).forEach(w=>{const m=museumBy(w.museum);L.marker([m.lat+(Math.random()-.5)*.8,m.lng+(Math.random()-.5)*.8],{icon:L.divIcon({html:iconHTML('art',w),className:'',iconSize:[52,60]})}).on('click',()=>openArtwork(w.id)).addTo(markerLayer)});
 } else if(zoom<=8){
   Object.entries(byMuseum).forEach(([id,list])=>{
     const m=museumBy(id),primary=list[0];
     L.marker([m.lat,m.lng],{icon:L.divIcon({html:list.length>1?iconHTML('cluster',null,list.length):iconHTML('art',primary),className:'',iconSize:[52,58]})}).on('click',()=>openMuseum(id)).addTo(markerLayer);
   });
 } else {
   Object.entries(byMuseum).forEach(([id,list])=>{
     const m=museumBy(id);
     L.marker([m.lat,m.lng],{icon:L.divIcon({html:iconHTML('museum',m),className:'',iconSize:[16,16]})}).on('click',()=>openMuseum(id)).addTo(markerLayer);
     list.forEach((w,i)=>L.marker([m.lat+.002*Math.sin(i*2),m.lng+.003*Math.cos(i*2)],{icon:L.divIcon({html:iconHTML('art',w),className:'',iconSize:[52,60]})}).on('click',()=>openArtwork(w.id)).addTo(markerLayer));
   });
 }
 updateNearby();
}
map.on('zoomend moveend',renderMarkers);

function updateNearby(){
 const center=map.getCenter();
 const sorted=[...filteredWorks()].sort((a,b)=>{
   const ma=museumBy(a.museum),mb=museumBy(b.museum);
   return map.distance(center,L.latLng(ma.lat,ma.lng))-map.distance(center,L.latLng(mb.lat,mb.lng));
 });
 $('#nearby-track').innerHTML=sorted.slice(0,8).map(w=>{
   const m=museumBy(w.museum);
   return '<button class="nearby-card" data-work="'+w.id+'"><img src="'+w.image+'" alt=""><span><strong>'+w.title+'</strong><small>'+w.artist+'</small><small>'+m.name+'</small></span></button>';
 }).join('');
 $('#nearby-context').textContent=map.getZoom()>8?(sorted[0]?museumBy(sorted[0].museum).city:'Nearby'):'Around this area';
 $$('#nearby-track [data-work]').forEach(b=>b.onclick=()=>openArtwork(b.dataset.work));
 $('#status-count').textContent=filteredWorks().length+' works';
}

function openMuseum(id){
 const m=museumBy(id);state.selectedMuseum=id;
 const ms=works.filter(w=>w.museum===id);
 $('#museum-name').textContent=m.name;$('#museum-city').textContent=m.city+', '+m.country;
 $('#museum-description').textContent=m.description;$('#museum-works').textContent=m.works;$('#museum-artists').textContent=m.artists;
 $('#museum-art-stack').innerHTML=(ms.length?ms:works.slice(0,3)).slice(0,3).map(w=>'<img src="'+w.image+'" alt="'+w.title+'">').join('');
 $('#visit-museum span').textContent=state.visitedMuseums.has(id)?'Visited':'I’ve been here';
 $('#museum-sheet').hidden=false;
 redrawIcons();
}
function closeMuseum(){ $('#museum-sheet').hidden=true; }
$('#museum-close').onclick=closeMuseum;
$('#visit-museum').onclick=()=>{
 const id=state.selectedMuseum;if(!id)return;
 if(state.visitedMuseums.has(id)){state.visitedMuseums.delete(id);toast('Removed from your passport');}
 else{state.visitedMuseums.add(id);toast(museumBy(id).name+' added to your passport');}
 persist();openMuseum(id);renderPassport();
};
$('#museum-details').onclick=()=>{const id=state.selectedMuseum;if(id)openMuseumView(id)};

function openArtwork(id){
 const w=workBy(id),m=museumBy(w.museum);state.selectedWork=id;
 $('#artwork-image').src=w.image;$('#artwork-image').alt=w.title;
 $('#artwork-kicker').textContent=w.year+' · '+w.movement;
 $('#artwork-title').textContent=w.title;$('#artwork-artist').textContent=w.artist;
 $('#artwork-museum').textContent=m.name+' · '+m.city;
 $('#artwork-facts').innerHTML='<span>'+w.period+'</span><span>'+w.movement+'</span><span>'+m.country+'</span>';
 $('#seen-artwork span').textContent=state.seenWorks.has(id)?'Seen':'I’ve seen this';
 renderArtworkTab('about');
 $('#artwork-dialog').showModal();redrawIcons();
}
$$('[data-dialog-close]').forEach(b=>b.onclick=()=>$('#artwork-dialog').close());
$('#artwork-dialog').addEventListener('click',e=>{if(e.target===$('#artwork-dialog'))$('#artwork-dialog').close()});
$('#artwork-museum').onclick=()=>{const w=workBy(state.selectedWork);$('#artwork-dialog').close();openMuseum(w.museum);map.flyTo([museumBy(w.museum).lat,museumBy(w.museum).lng],12)};
$('#seen-artwork').onclick=()=>{
 const id=state.selectedWork;if(!id)return;
 if(state.seenWorks.has(id)){state.seenWorks.delete(id);toast('Removed from seen works');}
 else{state.seenWorks.add(id);toast(workBy(id).title+' added to your journey');}
 persist();$('#seen-artwork span').textContent=state.seenWorks.has(id)?'Seen':'I’ve seen this';renderPassport();
};
function renderArtworkTab(tab){
 const w=workBy(state.selectedWork);if(!w)return;
 $$('.artwork-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.artTab===tab));
 if(tab==='about') $('#artwork-tab-panel').innerHTML='<p>'+w.about+'</p>';
 if(tab==='reflection'){
   const moods=['Moving','Strange','Calm','Intense','Beautiful','Thoughtful'];
   const active=state.moods[w.id]||[];
   $('#artwork-tab-panel').innerHTML='<div class="reflection-box"><div class="mood-row">'+moods.map(m=>'<button class="'+(active.includes(m)?'active':'')+'" data-mood="'+m+'">'+m+'</button>').join('')+'</div><textarea id="reflection-text" placeholder="What stayed with you?">'+(state.reflections[w.id]||'')+'</textarea><button class="button secondary" id="save-reflection">Save reflection</button></div>';
   $$('#artwork-tab-panel [data-mood]').forEach(b=>b.onclick=()=>{const arr=new Set(state.moods[w.id]||[]);arr.has(b.dataset.mood)?arr.delete(b.dataset.mood):arr.add(b.dataset.mood);state.moods[w.id]=[...arr];persist();renderArtworkTab('reflection')});
   $('#save-reflection').onclick=()=>{state.reflections[w.id]=$('#reflection-text').value.trim();persist();toast('Reflection saved privately');renderJournal()};
 }
 if(tab==='related'){
   const related=works.filter(x=>x.id!==w.id&&(x.artist===w.artist||x.movement===w.movement)).slice(0,3);
   $('#artwork-tab-panel').innerHTML='<div class="related-grid">'+related.map(x=>'<button data-related="'+x.id+'"><img src="'+x.image+'" alt=""><small>'+x.title+'</small></button>').join('')+'</div>';
   $$('#artwork-tab-panel [data-related]').forEach(b=>b.onclick=()=>openArtwork(b.dataset.related));
 }
}
$$('.artwork-tabs button').forEach(b=>b.onclick=()=>renderArtworkTab(b.dataset.artTab));
$('#save-artwork').onclick=()=>toast('Saved to your collection');
$('#share-artwork').onclick=async()=>{const w=workBy(state.selectedWork);if(navigator.share)await navigator.share({title:w.title,text:w.title+' — '+w.artist});else toast('Share link copied')};

function optionsFor(type){
 const vals=type==='period'?works.map(w=>w.period):
 type==='movement'?works.map(w=>w.movement):
 type==='artist'?works.map(w=>w.artist):
 type==='museum'?museums.map(m=>m.name):
 type==='country'?museums.map(m=>m.country):
 [...new Set(works.map(w=>String(Math.floor(w.year/10)*10)))];
 return [...new Set(vals)].sort();
}
function openFilterOptions(type){
 const box=$('#filter-options');box.hidden=false;
 box.innerHTML='<button data-option="">Any</button>'+optionsFor(type).map(v=>'<button data-option="'+v+'" class="'+((state.filters[type]===v)||(type==='museum'&&state.filters[type]&&museumBy(state.filters[type])?.name===v)?'active':'')+'">'+(type==='decade'?v+'s':v)+'</button>').join('');
 $$('[data-option]',box).forEach(b=>b.onclick=()=>{
   let value=b.dataset.option||null;
   if(type==='museum'&&value)value=museums.find(m=>m.name===value)?.id||null;
   state.filters[type]=value;
   box.hidden=true;renderFilterLabels();renderMarkers();
 });
}
$$('[data-filter]').forEach(b=>b.onclick=()=>openFilterOptions(b.dataset.filter));
function renderFilterLabels(){
 Object.keys(state.filters).forEach(k=>{
   const v=state.filters[k],el=$('#filter-'+k+'-label');if(!el)return;
   el.textContent=!v?'Any':k==='museum'?museumBy(v)?.name:v+(k==='decade'?'s':'');
 });
 const active=Object.values(state.filters).filter(Boolean).length;
 $('#filter-summary').textContent=active?active+' active':'All art';
 $('#status-filter').firstChild.textContent=active?active+' filters ':'All art ';
 const years=filteredWorks().map(w=>w.year);$('#status-period').textContent=years.length?Math.min(...years)+'–'+Math.max(...years):'No results';
}
function toggleFilters(force){
 const s=$('#filter-sheet'),open=force??s.hidden;s.hidden=!open;$('#filter-button').setAttribute('aria-expanded',String(open));redrawIcons();
}
$('#filter-button').onclick=()=>toggleFilters();
$('#filter-close').onclick=()=>toggleFilters(false);
$('#status-filter').onclick=()=>toggleFilters(true);
$('#clear-filters').onclick=()=>{Object.keys(state.filters).forEach(k=>state.filters[k]=null);$('#filter-options').hidden=true;renderFilterLabels();renderMarkers()};

function renderPassport(){
 const seen=[...state.seenWorks].map(workBy).filter(Boolean),visited=[...state.visitedMuseums].map(museumBy).filter(Boolean);
 const cities=new Set(visited.map(m=>m.city)),countries=new Set(visited.map(m=>m.country));
 $('#passport-count').textContent=visited.length;
 $('#passport-stats').innerHTML=[
  [visited.length,'Museums'],[cities.size,'Cities'],[countries.size,'Countries'],[seen.length,'Works seen']
 ].map(x=>'<div><strong>'+x[0]+'</strong><span>'+x[1]+'</span></div>').join('');
 $('#museum-stamp-count').textContent=visited.length+' collected';
 $('#stamp-grid').innerHTML=visited.length?visited.map((m,i)=>'<article class="stamp" style="--r:'+(i%2?'-1.5deg':'1.3deg')+'"><small>Visited · '+new Date().getFullYear()+'</small><strong>'+m.name+'</strong><span>'+m.city.toUpperCase()+'</span></article>').join(''):'<p class="muted">Visit a museum and add it to your passport to begin your collection.</p>';
 const artists=[...new Set(works.map(w=>w.artist))].map(a=>{
   const total=works.filter(w=>w.artist===a).length,got=seen.filter(w=>w.artist===a).length,pct=Math.round(got/Math.max(total,1)*100);
   const sample=works.find(w=>w.artist===a);
   const level=pct>=95?'Completionist':pct>=75?'Devotee':pct>=50?'Deep Dive':pct>=30?'Appreciator':pct>=10?'Familiar':'Discovered';
   return {a,total,got,pct,sample,level};
 }).filter(x=>x.got>0).sort((a,b)=>b.pct-a.pct);
 $('#artist-journeys').innerHTML=artists.length?artists.map(x=>'<div class="journey"><img src="'+x.sample.image+'" alt=""><div><strong>'+x.a+'</strong><small>'+x.got+' / '+x.total+' essential works</small><div class="progress" style="margin-top:7px"><span style="width:'+x.pct+'%"></span></div></div><div class="journey-right"><b>'+x.pct+'%</b><span>'+x.level+'</span></div></div>').join(''):'<p class="muted">Mark artworks as seen to start artist journeys.</p>';
}
function renderJournal(){
 const entries=Object.entries(state.reflections).filter(([,v])=>v).map(([id,text])=>({w:workBy(id),text})).filter(x=>x.w);
 $('#journal-list').innerHTML=entries.length?entries.map(({w,text})=>'<article class="journal-entry"><img src="'+w.image+'" alt=""><div><span class="eyebrow">'+w.artist+'</span><h3>'+w.title+'</h3><p>“'+text+'”</p></div></article>').join(''):'<p class="muted">Your private reflections will appear here.</p>';
}
function openPassport(){renderPassport();$('#passport-view').hidden=false;closeMuseum()}
$('#passport-button').onclick=openPassport;$('#passport-close').onclick=()=>$('#passport-view').hidden=true;
$('#journal-close').onclick=()=>$('#journal-view').hidden=true;

function openMuseumView(id){
 const m=museumBy(id),ms=works.filter(w=>w.museum===id);
 $('#view-title').textContent=m.name;$('#view-subtitle').textContent=m.city+', '+m.country+' · '+m.description;
 $('#view-content').innerHTML='<div class="library-grid">'+ms.map(w=>'<button class="library-card" data-work="'+w.id+'"><img src="'+w.image+'" alt=""><strong>'+w.title+'</strong><small>'+w.artist+' · '+w.year+'</small></button>').join('')+'</div>';
 $('#view-overlay').hidden=false;$$('#view-content [data-work]').forEach(b=>b.onclick=()=>openArtwork(b.dataset.work));
}
function openView(type){
 if(type==='map'){$('#view-overlay').hidden=true;return}
 $('#view-title').textContent=type[0].toUpperCase()+type.slice(1);
 if(type==='timeline'){
   $('#view-subtitle').textContent='Move through art history by year and movement.';
   const groups=[...new Set(works.map(w=>Math.floor(w.year/100)*100))].sort();
   $('#view-content').innerHTML='<div class="timeline-list">'+groups.map(y=>{const list=works.filter(w=>Math.floor(w.year/100)*100===y);return '<div class="timeline-item"><div class="timeline-year">'+y+'s</div><div><strong>'+[...new Set(list.map(w=>w.movement))].join(' · ')+'</strong><p>'+list.length+' essential works in the current Atlas</p></div><div class="timeline-thumbs">'+list.slice(0,4).map(w=>'<img src="'+w.image+'" alt="">').join('')+'</div></div>'}).join('')+'</div>';
 } else if(type==='artists'){
   $('#view-subtitle').textContent='Artists represented in the current Atlas.';
   const artists=[...new Set(works.map(w=>w.artist))];
   $('#view-content').innerHTML='<div class="library-grid">'+artists.map(a=>{const w=works.find(x=>x.artist===a);return '<article class="library-card"><img src="'+w.image+'" alt=""><strong>'+a+'</strong><small>'+works.filter(x=>x.artist===a).length+' essential works</small></article>'}).join('')+'</div>';
 } else {
   $('#view-subtitle').textContent='Museums and collections across the world.';
   $('#view-content').innerHTML='<div class="library-grid">'+museums.map(m=>{const w=works.find(x=>x.museum===m.id)||works[0];return '<button class="library-card" data-museum="'+m.id+'"><img src="'+w.image+'" alt=""><strong>'+m.name+'</strong><small>'+m.city+', '+m.country+'</small></button>'}).join('')+'</div>';
   $$('#view-content [data-museum]').forEach(b=>b.onclick=()=>openMuseumView(b.dataset.museum));
 }
 $('#view-overlay').hidden=false;
}
$$('[data-view]').forEach(b=>b.onclick=()=>{$$('[data-view]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-selected',String(x===b))});openView(b.dataset.view)});
$('#view-close').onclick=()=>{$('#view-overlay').hidden=true;$$('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view==='map'))};

$('#global-search').addEventListener('input',e=>{
 const q=e.target.value.trim().toLowerCase(),box=$('#search-results');
 if(!q){box.hidden=true;return}
 const wr=works.filter(w=>(w.title+' '+w.artist+' '+museumBy(w.museum).name+' '+museumBy(w.museum).city).toLowerCase().includes(q)).slice(0,6);
 const mr=museums.filter(m=>(m.name+' '+m.city+' '+m.country).toLowerCase().includes(q)).slice(0,3);
 box.innerHTML=[...wr.map(w=>'<button class="search-result" data-s-work="'+w.id+'"><img src="'+w.image+'" alt=""><span><strong>'+w.title+'</strong><small>'+w.artist+' · '+museumBy(w.museum).city+'</small></span></button>'),...mr.map(m=>'<button class="search-result" data-s-museum="'+m.id+'"><span><strong>'+m.name+'</strong><small>'+m.city+', '+m.country+'</small></span></button>')].join('');
 box.hidden=false;
 $$('[data-s-work]',box).forEach(b=>b.onclick=()=>{box.hidden=true;openArtwork(b.dataset.sWork)});
 $$('[data-s-museum]',box).forEach(b=>b.onclick=()=>{box.hidden=true;const m=museumBy(b.dataset.sMuseum);map.flyTo([m.lat,m.lng],12);openMuseum(m.id)});
});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#global-search').focus()}});
$('#nearby-collapse').onclick=()=>$('#nearby-rail').classList.toggle('collapsed');

$$('[data-mobile-view]').forEach(b=>b.onclick=()=>{
 $$('[data-mobile-view]').forEach(x=>x.classList.toggle('active',x===b));
 const v=b.dataset.mobileView;
 if(v==='explore'){ $('#passport-view').hidden=true;$('#journal-view').hidden=true;$('#view-overlay').hidden=true; }
 if(v==='search'){$('#global-search').focus()}
 if(v==='passport')openPassport();
 if(v==='journal'){renderJournal();$('#journal-view').hidden=false}
});

renderFilterLabels();renderMarkers();renderPassport();renderJournal();redrawIcons();
setTimeout(()=>map.invalidateSize(),100);
