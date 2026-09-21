import { slugify } from './syntari.js';
import { groups } from './docs-data.js';

const base = new URL('.', import.meta.url);
const icon = name => window.SyntariIcon(name);
const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));

export function galleryURL({view = 'gallery', category = 'All components', query = '', screen = 'settings'} = {}) {
  const url = new URL('gallery.html', base);
  if (view !== 'gallery') url.searchParams.set('view', view);
  if (view === 'screens') url.searchParams.set('screen', screen);
  if (view === 'gallery' && category !== 'All components') url.searchParams.set('category', category);
  if (view === 'gallery' && query) url.searchParams.set('q', query);
  return url;
}

export function galleryState(url, catalog) {
  const params = url.searchParams;
  return {
    view: ['screens', 'foundations'].includes(params.get('view')) ? params.get('view') : 'gallery',
    category: catalog.some(c => c.category === params.get('category')) ? params.get('category') : 'All components',
    query: params.get('q') || '',
    screen: ['settings', 'team', 'projects', 'onboarding'].includes(params.get('screen')) ? params.get('screen') : 'settings'
  };
}

export function galleryPage(state, catalog) {
  const titles = {gallery: 'Component gallery', screens: 'Starter screens', foundations: 'The details that make it Syntari.'};
  const descriptions = {
    gallery: 'Try the interactions. Find the right building block. Open its docs when you’re ready to build.',
    screens: 'Small details, brought together. Explore the flows behind a whole product.',
    foundations: 'One shared language, from the smallest space to the whole screen.'
  };
  return `<section class="docs-gallery" aria-label="${titles[state.view]}">
    <div class="docs-gallery-intro">
      <div><div class="docs-eyebrow">${icon(state.view === 'gallery' ? 'grid' : state.view === 'screens' ? 'layout' : 'palette')} Syntari library</div>
        <h1>${titles[state.view]}</h1><p class="docs-description">${descriptions[state.view]}</p></div>
      <div class="docs-gallery-actions"><button class="button small" id="replay-motion">${icon('rotate-ccw')} Replay motion</button><button class="button small" id="download">${icon('download')} Export tokens</button></div>
    </div>
    ${state.view === 'gallery' ? `<div class="docs-gallery-toolbar">
      <label class="docs-gallery-search">${icon('search')}<input id="search" type="search" placeholder="Find a component…" aria-label="Find a component" value="${escape(state.query)}"><kbd>/</kbd></label>
      <span>${catalog.length} components <span aria-hidden="true">·</span> Light & dark</span>
    </div>
    <section id="gallery" class="docs-component-gallery"><div class="docs-cursor-grid" aria-hidden="true"></div><div class="section-heading"><h2 id="section-name"></h2><span>Live, interactive examples</span></div><div id="component-grid" class="component-grid"></div>
      <div id="empty" hidden>${icon('search')}<h2>No components found</h2><p>Try a different name or choose another category.</p><button class="button" id="clear-search">Clear search</button></div></section>` : `<section id="${state.view}"></section>`}
  </section>`;
}

function prepareCursorGrid(root) {
  if (!root || root.dataset.cursorGridReady) return;
  const layer = root.querySelector('.docs-cursor-grid');
  if (!layer) return;
  root.dataset.cursorGridReady = '';
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!finePointer) return;
  const updatePoint = event => {
    const rect = root.getBoundingClientRect();
    root.style.setProperty('--cursor-grid-x', `${event.clientX - rect.left}px`);
    root.style.setProperty('--cursor-grid-y', `${event.clientY - rect.top}px`);
    root.dataset.cursorGridActive = '';
  };
  root.addEventListener('pointerenter', updatePoint);
  root.addEventListener('pointermove', updatePoint, {passive: true});
  root.addEventListener('pointerleave', () => root.removeAttribute('data-cursor-grid-active'));
  root.addEventListener('pointerdown', event => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    updatePoint(event);
    const rect = root.getBoundingClientRect();
    const pulse = document.createElement('span');
    pulse.className = 'docs-cursor-pulse';
    pulse.style.left = `${event.clientX - rect.left}px`;
    pulse.style.top = `${event.clientY - rect.top}px`;
    pulse.setAttribute('aria-hidden', 'true');
    root.append(pulse);
    pulse.addEventListener('animationend', () => pulse.remove(), {once: true});
  });
}

export function prepareGallery(state) {
  if (state.view === 'gallery') {
    const root = document.querySelector('#gallery');
    const count = window.SyntariGallery.render({
      root, category: state.category, query: state.query, categoryOrder: Object.keys(groups),
      componentURL: c => new URL(`components/${slugify(c.name)}/`, base).href
    });
    prepareCursorGrid(root);
    return count;
  }
  if (state.view === 'screens') window.SyntariStarter.renderScreen(state.screen, document.querySelector('#screens'));
  else window.SyntariGallery.foundations(document.querySelector('#foundations'));
}
