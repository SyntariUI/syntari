/** Syntari 0.2.2 · HTML, CSS and DOM interactions. No framework runtime required. */
const base = new URL('.', import.meta.url);
let ready;
const scripts = ['motion.js', 'numbers.js', 'app.js', 'controls.js', 'navigation.js', 'starter.js', 'agents.js', 'extras.js'];
const styles = ['tokens.css', 'styles.css', 'motion.css', 'numbers.css', 'controls.css', 'starter.css', 'navigation.css', 'agents.css', 'extras.css'];
export const slugify = name => name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function initialize() {
  return ready ??= (async () => {
    window.SyntariEmbed = true;
    const css = styles.map(file => new Promise((resolve, reject) => {
      if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(link => new URL(link.href).pathname === new URL(file, base).pathname)) { resolve(); return; }
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL(file, base);
      link.onload = resolve; link.onerror = () => reject(new Error(`Could not load ${file}`)); document.head.append(link);
    }));
    let host;
    try {
      const support = await fetch(new URL('support.html', base));
      if (support.ok) {
        host = document.createElement('div'); host.dataset.syntariSupport = ''; host.innerHTML = await support.text(); document.body.append(host);
      }
    } catch {}
    await Promise.all(scripts.map(file => new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = new URL(file, base); script.async = false;
      script.onload = resolve; script.onerror = () => reject(new Error(`Could not load ${file}`)); document.head.append(script);
    })));
    document.querySelectorAll('dialog').forEach(dialog => {
      dialog.addEventListener('cancel', event => { if (!event.defaultPrevented) { event.preventDefault(); window.SyntariMotion.closeDialog(dialog); } });
      dialog.addEventListener('click', event => { const r = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) window.SyntariMotion.closeDialog(dialog); });
    });
    if (host) window.SyntariIcon && host.querySelectorAll('[data-icon]').forEach(el => el.outerHTML = window.SyntariIcon(el.dataset.icon));
    await Promise.all(css);
    return window.SyntariCatalog;
  })();
}
export async function getComponents() { return (await initialize()).map(c => ({ ...c, slug: slugify(c.name) })); }
/** Enhance copied component HTML. Call once for each newly inserted subtree. */
export async function prepare(root) {
  await initialize();
  if (!(root instanceof Element)) throw new TypeError('Syntari prepare() needs an Element.');
  root.classList.add('specimen-body', 'syntari-component');
  const scope = `syntari-${crypto.randomUUID()}`;
  root.querySelectorAll('input[type="radio"][name]').forEach(input => { if (!input.form) input.name = `${scope}-${input.name}`; });
  window.SyntariPrepare(root);
  window.SyntariNumbers.prepare(root);
  window.SyntariMotion.prepare(root);
  return root;
}
/** Mount a working example by slug. Configure its real DOM; connect application services in your handlers. */
export async function mount(slug, target, options = {}) {
  const catalog = await getComponents();
  const component = catalog.find(c => c.slug === slug);
  if (!component) throw new RangeError(`Unknown Syntari component: ${slug}`);
  const container = typeof target === 'string' ? document.querySelector(target) : target;
  if (!(container instanceof Element)) throw new TypeError('Syntari mount() needs a matching selector or Element.');
  let element, controller, destroyed = false;
  async function render() {
    controller?.abort();
    if (element) { element.querySelectorAll('[data-syntari-shell]').forEach(root => window.SyntariNavigation?.destroy(root)); element.remove(); }
    element = document.createElement('div'); element.dataset.syntariComponent = slug; element.innerHTML = component.html;
    container.append(element); await prepare(element);
    if (destroyed) { element.remove(); return; }
    options.configure?.(element);
    controller = new AbortController();
    for (const [event, callback] of [['input', options.onInput], ['change', options.onChange], ['click', options.onAction]]) {
      if (callback) element.addEventListener(event, e => queueMicrotask(() => { if (!destroyed) callback(e, element); }), { signal: controller.signal });
    }
  }
  await render();
  return {
    get element() { return element; },
    async reset() { if (destroyed) throw new Error('Cannot reset a destroyed Syntari component.'); await render(); },
    destroy() { destroyed = true; controller?.abort(); element.querySelectorAll('[data-syntari-shell]').forEach(root => window.SyntariNavigation?.destroy(root)); element.querySelectorAll(':popover-open').forEach(p => p.hidePopover()); element.getAnimations({subtree:true}).forEach(a => a.cancel()); element.remove(); }
  };
}
export function setTheme(theme) {
  if (!['light', 'dark'].includes(theme)) throw new RangeError('Theme must be light or dark.');
  document.documentElement.dataset.theme = theme;
}
