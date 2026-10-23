import {getComponents, mount} from './syntari.js';
import {copyText} from './workspace.js';

export const featuredComponents = [
  {slug:'simple-data-table',size:'wide'},
  {slug:'session-card'},
  {slug:'expandable-dock'},
  {slug:'tool-approval'},
  {slug:'selectable-cards'},
  {slug:'otp-input'},
  {slug:'metric-and-sparkline'},
  {slug:'command-palette'},
  {slug:'button',size:'wide'}
];

export function initHomepage() {
  const theme = document.querySelector('[data-home-theme]');
  const label = () => theme.setAttribute('aria-label', `Switch to ${document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'} theme`);
  theme.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('syntari-theme', next); } catch {}
    label();
  });
  label();
  let feedbackTimeout;
  document.querySelector('[data-agent-copy]').addEventListener('click', async () => {
    const feedback = document.querySelector('[data-home-feedback]');
    await copyText(document.querySelector('[data-agent-command]').textContent, document.querySelector('[data-copy-feedback]'));
    clearTimeout(feedbackTimeout);
    feedback.hidden = false;
    feedbackTimeout = setTimeout(() => { feedback.hidden = true; }, 4000);
  });
  initScrollMotion();
  loadGallery().catch(() => {
    const message = document.createElement('p');
    message.className = 'home-preview-error';
    message.textContent = 'The collection could not load. Explore the components in System.';
    document.querySelector('[data-home-gallery]').replaceChildren(message);
  }).finally(() => document.querySelector('[data-home-gallery]').setAttribute('aria-busy', 'false'));
}

async function loadGallery() {
  const catalog = await getComponents();
  initCatalogCount(catalog.length);
  const grid = document.querySelector('[data-home-gallery]');
  grid.replaceChildren();
  const previews = [];
  for (const item of featuredComponents) {
    const component = catalog.find(entry => entry.slug === item.slug);
    if (!component) throw new Error(`Missing catalog component: ${item.slug}`);
    const article = document.createElement('article');
    article.className = 'home-card' + (item.size ? ' home-card--' + item.size : '');
    article.dataset.feature = item.slug;
    const stage = document.createElement('div');
    stage.className = 'home-card-stage';
    stage.dataset.homePreview = item.slug;
    stage.setAttribute('role', 'group');
    stage.setAttribute('aria-label', component.name + ' live preview');
    const info = document.createElement('div');
    info.className = 'home-card-info';
    const caption = document.createElement('div');
    caption.className = 'home-card-caption';
    const title = document.createElement('strong');
    title.textContent = component.name;
    const category = document.createElement('span');
    category.className = 'home-card-eyebrow';
    category.textContent = component.category;
    caption.append(title, category);
    const link = document.createElement('a');
    link.className = 'icon-button';
    link.href = '/system/#' + encodeURIComponent(item.slug);
    link.textContent = '↗';
    link.setAttribute('aria-label', 'Inspect ' + component.name + ' in System');
    info.append(caption, link);
    article.append(stage, info);
    grid.append(article);
    // The tool approval keeps its demo behaviour but drops the demonstration hint and reset preview on the landing.
    const configure = item.slug === 'tool-approval' ? root => {
      const approval = root.querySelector('[data-agent-kind="approval"]');
      approval?.querySelector('p.hint')?.remove();
      if (approval) approval.dataset.showResetPreview = 'false';
    } : undefined;
    previews.push(mount(item.slug, stage, {configure}).catch(reason => {
      console.error(`Syntari preview ${item.slug}:`, reason);
      const error = document.createElement('p');
      error.className = 'home-preview-error';
      error.textContent = 'Preview unavailable. Open this component in System.';
      stage.replaceChildren(error);
    }));
  }
  await Promise.all(previews);
  document.querySelectorAll('.home-card').forEach((card, index) => revealOnView(card, (index % 3) * 70));
}
function initCatalogCount(total) {
  const count = document.querySelector('[data-component-count]');
  count.textContent = total;
  count.parentElement.setAttribute('aria-label', `${total} components. And counting.`);
  if (!reducedMotion.matches && motionObserver) {
    count.dataset.countTarget = total;
    motionObserver.observe(count);
  }
}

function animateCount(element) {
  const target = Number(element.dataset.countTarget);
  const start = performance.now();
  function frame(now) {
    const progress = Math.min((now - start) / 1400, 1);
    element.textContent = Math.round(target * (1 - Math.pow(1 - progress, 3)));
    if (progress < 1 && !reducedMotion.matches) requestAnimationFrame(frame);
    else element.textContent = target;
  }
  requestAnimationFrame(frame);
}

// Animate landing wrappers only; component internals remain owned by the DS.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const motionObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const element = entry.target;
    element.classList.add('is-visible');
    if (element.dataset.countTarget) animateCount(element);
    if (element.dataset.typeOnView !== undefined) {
      const chars = element.querySelectorAll('.home-typed-char');
      chars.forEach((char, index) => {
        const animation = char.animate([{opacity:0},{opacity:1}], {
          duration:180, delay:reducedMotion.matches ? 0 : index * Math.min(24, 1100 / chars.length), fill:'both'
        });
        animation.onfinish = () => { char.classList.add('is-written'); animation.cancel(); };
      });
    }
    motionObserver.unobserve(element);
  }
}, {threshold:0.08, rootMargin:'0px 0px -30px 0px'}) : null;

function revealOnView(element, delay = 0) {
  if (reducedMotion.matches || !motionObserver) return;
  element.classList.add('home-reveal');
  element.style.setProperty('--reveal-delay', `${delay}ms`);
  motionObserver.observe(element);
}

function initScrollMotion() {
  if (reducedMotion.matches || !motionObserver) return;
  document.querySelectorAll('.home-hero h1, .home-section-head h2, .home-collection h2').forEach(element => {
    element.setAttribute('aria-label', element.textContent);
    element.dataset.typeOnView = '';
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const fragment = document.createDocumentFragment();
      for (const character of node.textContent) {
        const span = document.createElement('span');
        span.className = 'home-typed-char';
        span.setAttribute('aria-hidden', 'true');
        span.textContent = character;
        fragment.append(span);
      }
      node.replaceWith(fragment);
    }
    motionObserver.observe(element);
  });
  document.querySelectorAll('.home-eyebrow, .home-hero > p, .home-agent-install, .home-hero-explore, .home-section-head p, .home-inline-link, .home-collection-actions, .home-footer').forEach(element => revealOnView(element));
}
if (document.body.classList.contains('landing-body')) initHomepage();
