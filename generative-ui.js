import { render, renderableSlugs } from './ir.js';
import { getComponents, setTheme } from './syntari.js';
import { groups } from './docs-data.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const screen = (title, layout, children) => ({ version: 'syntari-ir-1', type: 'screen', layout, title, children });

/** Two render modes of the same renderer: a report to read, and a tool to drive. */
const modes = {
  static: {
    title: 'Static',
    intent: 'A report someone has to trust before they act on it.',
    does: 'Read the measures, compare the two channels, and open the evidence only if the numbers are not enough.',
    spec: screen('Release 4281 is ready to review', 'stack', [
      { component: 'syntari.banner', props: { message: 'All checks passed', detail: '128 tests in 42s. Two approvals are still open.', tone: 'success', icon: 'circlecheck' } },
      { component: 'syntari.stat-row', props: { stats: [
        { label: 'Agent runs', value: '1,284', badge: '+18.6%', note: 'since last week', tone: 'success' },
        { label: 'Approvals', value: '96', badge: '−4.1%', note: 'two still waiting', tone: 'warning' },
        { label: 'p95 latency', value: '820ms', badge: '+40ms', note: 'this week', tone: 'danger' },
        { label: 'Tokens saved', value: '1.9M', badge: '+12%', note: 'versus prompting', tone: 'success' }
      ] } },
      { component: 'syntari.chart-bars', props: {
        title: 'Runs by day',
        note: 'Indexed · this week against last',
        seriesA: 'This week',
        seriesB: 'Last week',
        chartLabel: 'Runs by day: this week compared with last week',
        columns: [
          { label: 'Mon', a: 41, b: 30 }, { label: 'Tue', a: 58, b: 44 }, { label: 'Wed', a: 47, b: 51 },
          { label: 'Thu', a: 66, b: 52 }, { label: 'Fri', a: 52, b: 61 }, { label: 'Sat', a: 74, b: 58 }
        ]
      } },
      { component: 'syntari.comparison-table', props: {
        caption: 'Two release channels measured on the same things',
        optionA: 'Canary',
        optionB: 'Stable',
        rows: [
          { metric: 'Rollback time', a: '1 minute', b: '10 minutes', advantage: 'Canary' },
          { metric: 'Blast radius', a: '5% of traffic', b: 'All traffic', advantage: 'Canary' },
          { metric: 'Verification', a: 'Automatic', b: 'Manual', advantage: 'Canary' },
          { metric: 'Support window', a: 'Standard', b: 'Extended', advantage: 'Stable' }
        ]
      } },
      { type: 'region', label: 'Evidence · 3 stages', children: [
        { component: 'syntari.process-ledger', props: {
          total: '2.4ms',
          budget: 'under the 5ms budget',
          stages: [
            { title: 'Resolve the request', detail: 'Match the intent against the catalogue', time: '0.3ms', mark: 'check', state: 'done' },
            { title: 'Render the parts', detail: 'Five components, eleven props', time: '2.1ms', mark: 'check', state: 'done' },
            { title: 'Scope the styles', detail: 'Runs now', time: '—', mark: 'clock', state: 'current' }
          ]
        } }
      ] }
    ])
  },
  interactive: {
    title: 'Interactive',
    intent: 'A tool someone drives while it runs.',
    does: 'Press play, step through it, change the speed, and watch the run report itself.',
    spec: screen('Render run', 'stack', [
      { component: 'syntari.live-readout', props: {
        title: 'Render run',
        state: 'Ready',
        tone: 'success',
        note: 'Values update while the run is active.',
        values: [
          { label: 'Generation', value: '27' },
          { label: 'Live cells', value: '297' },
          { label: 'Speed', value: '8 fps' },
          { label: 'Elapsed', value: '1m 12s' }
        ]
      } },
      { component: 'syntari.transport-controls', props: { speed: 8, steps: 40 } },
      { component: 'syntari.banner', props: { message: 'Local demonstration', detail: 'Play, step, and change the speed. Nothing leaves the page.', tone: 'info', icon: 'info' } },
      { type: 'region', label: 'Timeline · 3 events', children: [
        { component: 'syntari.activity-list', props: { items: [
          { icon: 'arrow', title: 'Ready to run', detail: 'Step 1 of 40', time: 'now' },
          { icon: 'gauge', title: 'Speed set', detail: '8 frames per second', time: 'now' },
          { icon: 'clock', title: 'Waiting for input', detail: 'Nothing runs until you press play', time: 'now' }
        ] } }
      ] }
    ])
  }
};

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
