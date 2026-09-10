/* Orbit motion: progressive enhancement; content never depends on animation. */
(() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Set();
  const timers = new WeakMap();
  const ease = 'cubic-bezier(.22, 1, .36, 1)';
  const seen = new WeakSet();
  const observed = new Set();
  function animate(el, frames, duration = 240, extra = {}) {
    if (!el || preference.matches || !el.animate) return null;
    const a = el.animate(frames, {duration, easing: ease, ...extra});
    active.add(a);
    a.finished.catch(() => {}).finally(() => active.delete(a));
    return a;
  }
  preference.addEventListener('change', () => { if (preference.matches) {active.forEach(a => a.cancel());document.querySelectorAll('details[data-motion-target]').forEach(el=>{el.open=el.dataset.motionTarget==='open';delete el.dataset.motionTarget;el.style.overflow=''});} });
  function enter(el, delay = 0) {
    animate(el, [{opacity: 0, transform: 'translateY(6px)'}, {opacity: 1, transform: 'translateY(0)'}], 280, {delay});
  }
  function chart(el) {
    window.OrbitNumbers?.reveal(el);
    el.querySelectorAll('.chart path[stroke]').forEach(p => {
      const length = p.getTotalLength();
      animate(p, [{strokeDasharray: `${length} ${length}`, strokeDashoffset: length}, {strokeDasharray: `${length} ${length}`, strokeDashoffset: 0}], 650);
    });
    el.querySelectorAll('.progress>span').forEach(p => {p.style.transformOrigin = 'left';animate(p, [{transform:'scaleX(0)'},{transform:'scaleX(1)'}], 500)});
    el.querySelectorAll('.ring circle:last-child').forEach(p => animate(p, [{strokeDasharray:'0 220'}, {strokeDasharray:'204 220'}], 650));
    el.querySelectorAll('.funnel').forEach(p => animate(p, [{opacity:0},{opacity:1}], 500));
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(({target,isIntersecting}) => {
      if (!isIntersecting) return;
      observer.unobserve(target);observed.delete(target);
      enter(target);
      chart(target);
    });
  }, {threshold:.08});
  const groups = '.segmented, .dock, .theme-toggle, .view-tabs, .tabs';
  function indicator(group, instant = false, from = null) {
    const selected = group.querySelector('button.active');
    if (!selected || !group.getClientRects().length) return;
    let marker = group.querySelector(':scope > .selection-indicator');
    if (!marker) {
      marker = document.createElement('span');marker.className='selection-indicator';marker.setAttribute('aria-hidden','true');
      group.prepend(marker);group.classList.add('has-indicator');instant=true;
    }
    const previous = from || marker.getBoundingClientRect();
    const box = selected.getBoundingClientRect(), parent = group.getBoundingClientRect();
    marker.getAnimations().forEach(a=>a.cancel());
    Object.assign(marker.style,{left:`${box.left-parent.left-group.clientLeft}px`,top:`${box.top-parent.top-group.clientTop}px`,width:`${box.width}px`,height:`${box.height}px`});
    if (!instant && previous.width && box.width) animate(marker,[{transform:`translate(${previous.left-box.left}px, ${previous.top-box.top}px) scale(${previous.width/box.width}, ${previous.height/box.height})`},{transform:'translate(0,0) scale(1,1)'}],260);
  }
  function prepare(root = document) {
    // Discard detached nodes after search/category replacement.
    observed.forEach(card=>{if(!card.isConnected){observer.unobserve(card);observed.delete(card)}});
    document.querySelectorAll('.specimen').forEach(card=>{if(!seen.has(card)){seen.add(card);observed.add(card);observer.observe(card)}});
    root.querySelectorAll(groups).forEach(group => indicator(group,true));
  }
  function refresh() { document.querySelectorAll(groups).forEach(group=>indicator(group,true)); }
  const resize = new ResizeObserver(refresh);
  addEventListener('DOMContentLoaded', () => {
    resize.observe(document.querySelector('.page'));
    document.fonts.ready.then(refresh);
    enter(document.querySelector('.intro'));
    prepare();
    document.querySelectorAll('dialog').forEach(dialog => {
      dialog.addEventListener('cancel',e => {
        if (e.defaultPrevented || document.querySelector('[data-menu-toggle][aria-expanded="true"]')) return;
        e.preventDefault();closeDialog(dialog);
      });
      dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(dialog)});
    });
  });
  // Capture old selection geometry; update after the existing action has run.
  document.addEventListener('click', e => {
    const button=e.target.closest('button');if(!button)return;
    const group=button.closest(groups);
    if(group){const previous=group.querySelector('.selection-indicator')?.getBoundingClientRect();requestAnimationFrame(()=>indicator(group,false,previous));}
    if(button.hasAttribute('aria-pressed')&&!group)requestAnimationFrame(()=>animate(button.querySelector('.icon'),[{transform:'scale(.88)'},{transform:'scale(1)'}],200));
  },true);
  function showDialog(dialog) {
    clearTimeout(timers.get(dialog));dialog.classList.remove('is-closing');
    dialog.getAnimations().forEach(a=>a.cancel());
    if(!dialog.open)dialog.showModal();
    animate(dialog,[{opacity:0,transform:'translateY(8px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],280);
    prepare(dialog);
  }
  function closeDialog(dialog) {
    if(!dialog.open||dialog.classList.contains('is-closing'))return;
    if(preference.matches){dialog.close();return}
    dialog.classList.add('is-closing');
    const a=animate(dialog,[{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(4px) scale(.99)'}],140);
    const finish=()=>{dialog.close();dialog.classList.remove('is-closing')};
    if(a)a.finished.then(finish,finish);else finish();
  }
  function visibility(el,visible) {
    clearTimeout(timers.get(el));el.getAnimations().forEach(a=>a.cancel());
    if(visible){el.hidden=false;el.inert=false;animate(el,[{opacity:0,translate:'0 4px'},{opacity:1,translate:'0 0'}],200)}
    else {el.inert=true;if(preference.matches){el.hidden=true;return}animate(el,[{opacity:1,translate:'0 0'},{opacity:0,translate:'0 3px'}],120);timers.set(el,setTimeout(()=>{el.hidden=true;el.inert=false},120))}
  }
  function panel(el) {el?.getAnimations().forEach(a=>a.cancel());enter(el)}
  function replay() {
    document.querySelectorAll('.specimen').forEach(el=>{const r=el.getBoundingClientRect();if(r.top<innerHeight&&r.bottom>0){enter(el);chart(el)}});
  }
  // Native disclosure semantics are preserved during an interruptible height transition.
  document.addEventListener('click',e=>{
    const summary=e.target.closest('summary');if(!summary||preference.matches)return;
    const details=summary.parentElement;e.preventDefault();
    const from=details.getBoundingClientRect().height;
    const opening=details.dataset.motionTarget ? details.dataset.motionTarget!=='open' : !details.open;
    details.getAnimations().forEach(a=>a.cancel());details.open=true;
    details.dataset.motionTarget=opening?'open':'closed';
    const to=opening?details.scrollHeight:summary.getBoundingClientRect().height;
    details.style.overflow='hidden';
    const a=animate(details,[{height:`${from}px`},{height:`${to}px`}],240);
    if(a)a.finished.then(()=>{details.open=opening;delete details.dataset.motionTarget;details.style.overflow=''},()=>{});
  });
  window.OrbitMotion={prepare,panel,showDialog,closeDialog,visibility,replay,animate,indicator,enter};
})();
