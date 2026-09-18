import { render, renderableSlugs } from './ir.js';
import { getComponents, setTheme } from './syntari.js';
import { groups } from './docs-data.js';
import { buildScenario } from './renderer-scenarios.js';
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
    intent: 'The north-star screen: a report a product team opens every morning.',
    does: 'Scope the period, choose the measure, compare against the previous one, and open the sources behind the number.',
    spec: screen('Product overview', 'stack', [
      { component: 'syntari.filter-bar', props: {
        period: 'Last 30 days',
        periods: [{ label: 'Last 7 days', value: 'Last 7 days' }, { label: 'Last 30 days', value: 'Last 30 days' }, { label: 'Last 90 days', value: 'Last 90 days' }],
        filtersLabel: 'Filters',
        settingsLabel: 'Chart view'
      } },
      { component: 'syntari.headline-metric', props: { metrics: [
        { label: 'Recommendation share', value: '45.4%', delta: '3.3 pp', direction: 'up' },
        { label: 'Lost questions', value: '12', total: '/ 12', delta: '50.0%', direction: 'down' }
      ] } },
      { component: 'syntari.metric-strip', props: { items: [
        { label: 'Mention rate', icon: 'eye', value: '45.4%', delta: '3.3 pp', direction: 'up', meaning: 'of sampled answers', active: true },
        { label: 'Citations', icon: 'link', value: '1,155', delta: '5.2%', direction: 'up', meaning: 'distinct sources' },
        { label: 'AI referrals', icon: 'globe', value: '54', delta: '3.8%', direction: 'up', meaning: 'sessions from answers' },
        { label: 'Leads', icon: 'star', value: '2', delta: '50.0%', direction: 'down', meaning: 'converted from AI traffic' }
      ] } },
      { component: 'syntari.chart-toolbar', props: {
        compareLabel: 'Compare with the prior 30 days',
        compare: false,
        viewLabel: 'View daily numbers',
        viewActive: false,
        legend: 'Mention rate'
      } },
      { component: 'syntari.area-chart', props: {
        title: 'Mention rate',
        note: 'Last 30 days',
        chartLabel: 'Mention rate over the last 30 days: it runs between 39 and 58 percent, ending near 48 percent.',
        points: [
          { label: 'D1', value: 43 },
          { label: 'D2', value: 41 },
          { label: 'D3', value: 39 },
          { label: 'D4', value: 40 },
          { label: 'D5', value: 46 },
          { label: 'D6', value: 48 },
          { label: 'D7', value: 44 },
          { label: 'D8', value: 41 },
          { label: 'D9', value: 39 },
          { label: 'D10', value: 42 },
          { label: 'D11', value: 46 },
          { label: 'D12', value: 48 },
          { label: 'D13', value: 44 },
          { label: 'D14', value: 41 },
          { label: 'D15', value: 40 },
          { label: 'D16', value: 45 },
          { label: 'D17', value: 50 },
          { label: 'D18', value: 52 },
          { label: 'D19', value: 47 },
          { label: 'D20', value: 44 },
          { label: 'D21', value: 42 },
          { label: 'D22', value: 48 },
          { label: 'D23', value: 53 },
          { label: 'D24', value: 57 },
          { label: 'D25', value: 58 },
          { label: 'D26', value: 55 },
          { label: 'D27', value: 49 },
          { label: 'D28', value: 45 },
          { label: 'D29', value: 42 },
          { label: 'D30', value: 48 }
        ]
      } },
      { type: 'region', label: 'Where the numbers come from', children: [
        { component: 'syntari.source-list', props: { sources: [
          { name: 'ChatGPT', share: 42 },
          { name: 'Perplexity', share: 26 },
          { name: 'Google AI', share: 18 },
          { name: 'Copilot', share: 9 },
          { name: 'Others', share: 5 }
        ] } },
        { component: 'syntari.metadata-list', props: { items: [
          { label: 'Window', value: '30 days · 2,548 answers' },
          { label: 'Compared with', value: 'The prior 30 days' },
          { label: 'Sampled by', value: 'The daily question set' }
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
  const buttons = document.querySelectorAll('[data-scenario], [data-scenario-controls] button, [data-ir-mode], [data-ir-render]');
  buttons.forEach(button => { button.disabled = true; });
  try {
  instance?.destroy();
  instance = await render(spec, $('[data-ir-output]'));
  const drawn = instance.element.querySelectorAll('[data-ir-component]').length;
  const blocked = instance.element.querySelectorAll('[data-ir-status=fallback]').length;
  $('[data-ir-summary]').textContent = blocked ? `${drawn} components rendered · ${blocked} replaced by a fallback` : `${drawn} components rendered`;
  paintDiagnostics(instance.diagnostics);
  paintThemeButton();
  } finally { busy = false; buttons.forEach(button => { button.disabled = false; }); }
}

let request = null;
let selection = 0;
async function loadScenario(name, period = '') {
  const ticket = ++selection;
  request?.abort();
  request = new AbortController();
  const status = $('[data-request-status]');
  const stage = $('[data-ir-output]');
  status.textContent = 'Requesting example data…';
  stage.setAttribute('aria-busy', 'true');
  document.querySelectorAll('[data-scenario]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scenario === name)));
  try {
    const response = await fetch(new URL(`assets/renderer/${name}.json`, import.meta.url), { signal: request.signal });
    if (!response.ok) throw new Error('The example data could not be loaded.');
    const data = await response.json();
    if (ticket !== selection) return;
    const chosen = period || data.periods.at(-1);
    const spec = buildScenario(name, data, chosen);
    $('[data-ir-intent]').textContent = data.question;
    $('[data-ir-does]').textContent = data.description;
    $('#ir-spec').value = JSON.stringify(spec, null, 2);
    document.querySelectorAll('[data-ir-mode]').forEach(button => button.setAttribute('aria-pressed', 'false'));
    const controls = $('[data-scenario-controls]');
    controls.hidden = false;
    controls.replaceChildren();
    for (const value of data.periods) {
      const button = document.createElement('button');
      button.className = `button small${value === chosen ? ' primary' : ''}`;
      button.textContent = value;
      button.setAttribute('aria-pressed', String(value === chosen));
      button.addEventListener('click', () => loadScenario(name, value));
      controls.append(button);
    }
    await paint(spec);
    if (ticket === selection) status.textContent = `Illustrative data · ${chosen} · Open the evidence below to inspect the sources.`;
  } catch (error) {
    if (error.name !== 'AbortError' && ticket === selection) {
      status.textContent = `${error.message} Select the question again to retry.`;
    }
  } finally {
    if (ticket === selection) stage.removeAttribute('aria-busy');
  }
}
document.querySelectorAll('[data-scenario]').forEach(button => button.addEventListener('click', () => loadScenario(button.dataset.scenario)));

function load(mode) {
  ++selection;
  request?.abort();
  $('[data-scenario-controls]').hidden = true;
  $('[data-ir-output]').removeAttribute('aria-busy');
  $('[data-request-status]').textContent = 'Explore a prepared renderer specification.';
  document.querySelectorAll('[data-scenario]').forEach(button => button.setAttribute('aria-pressed', 'false'));
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

paintThemeButton();
/** Auto-render the static report on load (the scenario prompts stay available above).
 *  Keeps the tested contract: a rendered screen is present without interaction. */
load('static').then(paintCatalogue).then(paintThemeButton).catch(error => { $('[data-request-status]').textContent = error.message; });
