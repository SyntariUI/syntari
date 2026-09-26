import { initialize, getComponents, mount } from '../syntari.js';
import { statesFor } from '../docs-data.js';
import { initWorkspace, copyText } from '../workspace.js';

const $ = (selector, root = document) => root.querySelector(selector);
const workspace = initWorkspace();
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalog = [], registry, selected, activeMount, query = '', swapToken = 0, stateId = 'default', codeMode = 'html';
const manifests = new Map();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function nav() {
  const groups = {};
  for (const c of catalog.filter(c => `${c.name} ${c.category} ${c.description}`.toLowerCase().includes(query.trim().toLowerCase()))) (groups[c.category] ||= []).push(c);
  $('[data-nav]').innerHTML = Object.entries(groups).map(([category,items]) => `<div class="sys-nav-group"><div class="sys-nav-label">${esc(category)}</div>${items.map(c => `<button class="sys-nav-item" data-slug="${c.slug}" aria-current="${selected?.slug === c.slug}"><span>${esc(c.name)}</span></button>`).join('')}</div>`).join('') || '<p class="sys-nav-label">No matching components</p>';
  $('[data-nav]').querySelectorAll('[data-slug]').forEach(button => button.addEventListener('click', () => { workspace.closeNav(); select(button.dataset.slug, true); }));
}
function stateControls() {
  $('[data-states]').replaceChildren(...statesFor(selected).map(state => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = state.label;
    button.setAttribute('aria-pressed',String(state.id === stateId));
    button.addEventListener('click', () => { stateId = state.id; select(selected.slug,false,true); }); return button;
  }));
}
function renderCode(manifest) {
  $('[data-code-file]').textContent = `${selected.slug}.${codeMode === 'manifest' ? 'json' : 'html'}`;
  $('[data-source]').textContent = codeMode === 'manifest' ? JSON.stringify(manifest ?? {status:'loading'},null,2) : selected.html;
  document.querySelectorAll('[data-code-mode]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.codeMode === codeMode)));
}
async function inspector(component, token) {
  $('[data-inspector-kicker]').textContent = component.category;
  $('[data-inspector-title]').textContent = component.name;
  $('[data-description]').textContent = component.description;
  $('[data-registry-id]').textContent = component.slug;
  $('[data-contract-status]').textContent = 'Loading…';
  $('[data-rules]').textContent = 'Loading the component contract…';
  $('[data-ir-support]').textContent = '';
  $('[data-manifest-link]').href = `/registry/components/${component.slug}.json`;
  $('[data-docs-link]').href = `/docs/components/${component.slug}/`;
  $('[data-install-command]').textContent = `npm exec --yes --package=https://syntariui.giovanitier.com/downloads/syntari-ui-${registry.version}.tgz -- syntari add ${component.slug}`;
  $('[data-copy-status]').textContent = '';
  renderCode(manifests.get(component.slug));
  try {
    if (!manifests.has(component.slug)) {
      const response = await fetch(`/registry/components/${component.slug}.json`);
      if (!response.ok) throw new Error('Contract unavailable');
      manifests.set(component.slug,await response.json());
    }
    if (token !== swapToken) return;
    const manifest = manifests.get(component.slug);
    $('[data-contract-status]').textContent = manifest.status === 'authored' ? 'Authored contract' : 'Catalog metadata';
    $('[data-rules]').textContent = manifest.rules?.length ? manifest.rules.join(' · ') : 'Use the editable source and implementation guide for this component.';
    $('[data-ir-support]').textContent = manifest.ir ? 'Screen IR supported. Props are checked against the authored contract.' : 'Available as editable source. A Screen IR contract has not been authored yet.';
    $('[data-tokens]').innerHTML = (manifest.tokens || component.tokens || []).map(token => `<span class="sys-token">${esc(token)}</span>`).join('');
    renderCode(manifest);
  } catch(error) { if (token === swapToken) { $('[data-contract-status]').textContent = 'Unavailable'; $('[data-rules]').textContent = error.message; } }
}
async function select(slug, push = false, preserveState = false) {
  const component = catalog.find(c => c.slug === slug);
  if (!component) { $('[data-status]').textContent = 'Component not found. Choose one from System.'; return; }
  const token = ++swapToken, host = $('[data-component-mount]');
  selected = component;
  if (!preserveState) stateId = 'default';
  nav(); stateControls(); inspector(component,token);
  $('[data-category]').textContent = component.category; $('[data-name]').textContent = component.name;
  document.title = `${component.name} — Syntari System`;
  $('[data-status]').textContent = 'Loading preview…';
  host.setAttribute('aria-busy','true');
  if (!reducedMotion && activeMount) { host.classList.add('is-swapping'); await new Promise(resolve => setTimeout(resolve,120)); }
  if (token !== swapToken) return;
  activeMount?.destroy(); activeMount = null; host.replaceChildren();
  const state = statesFor(component).find(state => state.id === stateId);
  try {
    // State recipes are bundled, authored site code shared with the documentation.
    const next = await mount(slug,host,{configure:state?.code ? new Function('root',state.code) : undefined});
    if (token !== swapToken) { next.destroy(); return; }
    activeMount = next;
    const surface = next.element;
    surface.removeAttribute('data-syntari-delay');
    for (const [property,value] of Object.entries({opacity:'1',visibility:'visible',filter:'none',transform:'none',animation:'none'})) surface.style.setProperty(property,value,'important');
    host.classList.remove('is-wide','is-compact','is-swapping');
    if (/table|list|data|navigation/i.test(component.category) || /table|chart|navigation|calendar/.test(slug)) host.classList.add('is-wide');
    else if (/action|form|feedback/i.test(component.category)) host.classList.add('is-compact');
    $('[data-status]').textContent = '';
    if (push) history.pushState(null,'',`/system/#${slug}`);
    else if (!location.hash && location.pathname.startsWith('/system')) history.replaceState(null,'',`#${slug}`);
  } catch(error) {
    if (token === swapToken) { host.classList.remove('is-swapping'); $('[data-status]').textContent = `Preview unavailable: ${error.message}`; }
  } finally { if (token === swapToken) host.setAttribute('aria-busy','false'); }
}
function routeSlug() {
  return decodeURIComponent(location.hash.slice(1) || location.pathname.match(/^\/components\/([^/]+)/)?.[1] || 'metric-and-sparkline');
}
async function boot() {
  const response = await fetch('/registry/index.json');
  if (!response.ok) throw new Error('The component registry could not load. Reload to try again.');
  registry = await response.json();
  await initialize();
  const ids = new Set(registry.components.map(c => c.id));
  catalog = (await getComponents()).filter(c => ids.has(c.slug)).sort((a,b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  $('[data-component-count]').textContent = catalog.length;
  await select(routeSlug());
  $('[data-search]').addEventListener('input',event => { query = event.target.value; nav(); });
  $('[data-copy-code]').addEventListener('click', () => copyText($('[data-source]').textContent,$('[data-code-copy-status]')));
  $('[data-copy-install]').addEventListener('click', () => copyText($('[data-install-command]').textContent,$('[data-copy-status]')));
  document.querySelectorAll('[data-code-mode]').forEach(button => button.addEventListener('click', () => { codeMode = button.dataset.codeMode; renderCode(manifests.get(selected.slug)); }));
  $('[data-device]').addEventListener('click',event => { const mobile = $('[data-component-mount]').classList.toggle('is-device'); event.currentTarget.setAttribute('aria-pressed',String(mobile)); });
  window.addEventListener('popstate', () => select(routeSlug()));
  window.addEventListener('hashchange', () => { if (routeSlug() !== selected?.slug) select(routeSlug()); });
  window.addEventListener('keydown',event => {
    if (event.key === '/' && !event.target.closest('input,textarea,select,[contenteditable]') && !matchMedia('(max-width: 760px)').matches) { event.preventDefault(); $('[data-search]').focus(); }
  });
  if (!reducedMotion && matchMedia('(pointer:fine)').matches) $('[data-stage]').addEventListener('pointermove',event => {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--mx',`${(event.clientX-box.left)/box.width*100}%`);
    event.currentTarget.style.setProperty('--my',`${(event.clientY-box.top)/box.height*100}%`);
  });
}
boot().catch(error => { $('[data-status]').textContent = error.message; });
