import { render, renderableSlugs } from './ir.js';
import { getComponents, setTheme } from './syntari.js';
import { groups } from './docs-data.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
import { modes } from './screen-recipes.js';

let instance = null;
let busy = false;

function paintDiagnostics(diagnostics) {
  const list = $('[data-ir-diagnostics]');
  list.innerHTML = diagnostics.length
    ? diagnostics.map(item => `<li data-severity="${esc(item.severity)}"><code>${esc(item.code)}</code><span>${esc(item.path || 'spec')} — ${esc(item.message)}</span></li>`).join('')
    : '<li class="ir-clean">No diagnostics. Every node matches its contract.</li>';
}

async function paint(spec) {
  if (busy) return;
  busy = true;
  instance?.destroy();
  instance = await render(spec, $('[data-ir-output]'));
  const drawn = instance.element.querySelectorAll('[data-ir-component]').length;
  const blocked = instance.element.querySelectorAll('[data-ir-status=fallback]').length;
  $('[data-ir-summary]').textContent = blocked ? `${drawn} components rendered · ${blocked} replaced by a fallback` : `${drawn} components rendered`;
  paintDiagnostics(instance.diagnostics);
  busy = false;
}

function load(mode) {
  const current = modes[mode];
  $('[data-ir-intent]').textContent = current.intent;
  $('[data-ir-does]').textContent = current.does;
  $('#ir-spec').value = JSON.stringify(current.spec, null, 2);
  document.querySelectorAll('[data-ir-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.irMode === mode)));
  return paint(current.spec);
}

document.querySelectorAll('[data-ir-mode]').forEach(button => button.addEventListener('click', () => load(button.dataset.irMode)));
$('[data-ir-render]').addEventListener('click', () => {
  try { paint(JSON.parse($('#ir-spec').value)); }
  catch (error) { paintDiagnostics([{ severity: 'error', code: 'invalid-json', path: 'spec', message: error.message }]); $('[data-ir-summary]').textContent = 'The spec is not valid JSON.'; }
});

const specToggle = $('[data-ir-toggle-spec]');
const specField = $('#ir-spec');
specToggle.addEventListener('click', () => {
  const open = specToggle.getAttribute('aria-expanded') !== 'true';
  specToggle.setAttribute('aria-expanded', String(open));
  specToggle.textContent = open ? 'Hide the spec' : 'Show the spec';
  specField.hidden = !open;
  $('[data-ir-spec-label]').hidden = !open;
});

const themeButton = $('[data-ir-theme]');
function paintThemeButton() {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  themeButton.innerHTML = window.SyntariIcon?.(theme === 'dark' ? 'sun' : 'moon') ?? '';
  themeButton.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
}
themeButton.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(next);
  try { localStorage.setItem('syntari-theme', next); } catch {}
  paintThemeButton();
});

/** The catalogue reads the registry, so the grid cannot drift from what renders. */
async function paintCatalogue() {
  const [catalog, supported] = await Promise.all([getComponents(), renderableSlugs()]);
  document.querySelectorAll('[data-ir-count=components]').forEach(node => { node.textContent = String(catalog.length); });
  document.querySelectorAll('[data-ir-count=renderable]').forEach(node => { node.textContent = String(supported.length); });
  $('[data-ir-catalog]').innerHTML = supported.map(slug => {
    const component = catalog.find(entry => entry.slug === slug);
    const icon = groups[component?.category]?.[0] ?? 'square';
    return `<a class="ir-catalog-card" href="components/${esc(slug)}/"><span class="ir-catalog-icon">${window.SyntariIcon?.(icon) ?? ''}</span><span class="ir-catalog-name">${esc(component?.name ?? slug)}</span><span class="ir-catalog-arrow" aria-hidden="true">→</span></a>`;
  }).join('');
  document.body.dataset.irSupported = supported.join(' ');
}

load('static').then(paintThemeButton).then(paintCatalogue);
