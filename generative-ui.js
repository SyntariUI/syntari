import { render, validate, renderableSlugs } from './ir.js';
import { setTheme } from './syntari.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

const screen = (title, layout, children) => ({ version: 'syntari-ir-1', type: 'screen', layout, title, children });
const samples = [
  {
    name: 'Approval request',
    spec: screen('Release check', 'stack', [
      { component: 'syntari.banner', props: { message: 'Build 4281 passed', detail: '128 tests in 42s. No regressions since 4279.', tone: 'success', icon: 'circlecheck' } },
      { component: 'syntari.tool-approval', props: { title: 'Run the migration?', question: 'Apply three schema changes to the billing database in production.', scope: 'billing-production · write access', hint: 'A snapshot is taken first. Reversible for 24 hours.', icon: 'terminal', approveLabel: 'Run migration', rejectLabel: 'Not now' } },
      { component: 'syntari.activity-list', props: { items: [
        { icon: 'check', title: 'Tests passed', detail: '128 tests in 42s.', time: '2m ago' },
        { icon: 'file', title: 'Snapshot created', detail: 'billing-production · 8.4 GB', time: '1m ago' },
        { icon: 'clock', title: 'Waiting for a decision', detail: 'Nothing runs until you approve.', time: 'now' }
      ] } }
    ])
  },
  {
    name: 'Weekly report',
    spec: screen('Weekly report', 'two-column', [
      { component: 'syntari.metric-and-sparkline', props: {
        chartLabel: 'Agent runs by day',
        stats: [
          { label: 'Agent runs', value: '1,284', badge: '+18.6%', tone: 'success' },
          { label: 'Approvals', value: '96', badge: '−4.1%', tone: 'warning' }
        ],
        series: [
          { label: 'Mon', value: 41 }, { label: 'Tue', value: 58 }, { label: 'Wed', value: 47 },
          { label: 'Thu', value: 66 }, { label: 'Fri', value: 52 }, { label: 'Sat', value: 74 }
        ]
      } },
      { component: 'syntari.card', props: { title: 'Highest-risk tool', body: 'write_files ran twelve times this week. A person approved every run.', badge: 'Review', badgeTone: 'warning', action: 'Open the log' } },
      { component: 'syntari.table', props: {
        caption: 'Tools the agents asked to run',
        columns: [{ label: 'Tool' }, { label: 'Runs' }, { label: 'Approved' }],
        rows: [['read_workspace', '412', '412'], ['write_files', '12', '12'], ['send_email', '3', '2']]
      } },
      { component: 'syntari.metadata-list', props: { items: [
        { label: 'Workspace', value: 'Syntari Studio' },
        { label: 'Window', value: 'Sep 7 – Sep 13' },
        { label: 'Prepared by', value: 'Weekly report agent' }
      ] } }
    ])
  },
  {
    name: 'Unsupported input',
    spec: screen('Repair, do not guess', 'stack', [
      { component: 'syntari.wizard-hat', props: { sparkle: true } },
      { component: 'syntari.banner', props: { message: 'Nothing was written', tone: 'danger', dismissible: true } },
      { component: 'syntari.card', props: { title: 'Two nodes above failed', body: 'The registry decided what could be drawn. The rest kept their place with a labelled fallback.', badge: 'Repaired', badgeTone: 'warning' } }
    ])
  }
];

let instance = null;
let busy = false;

function paintDiagnostics(diagnostics) {
  const list = $('[data-ir-diagnostics]');
  list.innerHTML = diagnostics.length
    ? diagnostics.map(item => `<li data-severity="${esc(item.severity)}"><code>${esc(item.code)}</code><span>${esc(item.path || 'spec')} — ${esc(item.message)}</span></li>`).join('')
    : '<li class="ir-clean">No diagnostics. Every node matches its contract.</li>';
}

async function paint(text) {
  if (busy) return;
  busy = true;
  let spec;
  try { spec = JSON.parse(text); }
  catch (error) { paintDiagnostics([{ severity: 'error', code: 'invalid-json', path: 'spec', message: error.message }]); $('[data-ir-summary]').textContent = 'The spec is not valid JSON.'; busy = false; return; }
  instance?.destroy();
  instance = await render(spec, $('[data-ir-output]'));
  const drawn = instance.element.querySelectorAll('[data-ir-component]').length;
  const blocked = instance.element.querySelectorAll('[data-ir-status=fallback]').length;
  $('[data-ir-summary]').textContent = blocked ? `${drawn} components rendered · ${blocked} replaced by a fallback` : `${drawn} components rendered`;
  paintDiagnostics(instance.diagnostics);
  busy = false;
}

function load(index) {
  const sample = samples[index];
  $('#ir-spec').value = JSON.stringify(sample.spec, null, 2);
  document.querySelectorAll('[data-ir-sample]').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  return paint($('#ir-spec').value);
}

$('[data-ir-render]').addEventListener('click', () => paint($('#ir-spec').value));
const sampleGroup = $('.ir-page-samples');
sampleGroup.innerHTML = samples.map((sample, i) => `<button type="button" class="button small" data-ir-sample="${i}" aria-pressed="${i === 0 ? 'true' : 'false'}">${esc(sample.name)}</button>`).join('');
sampleGroup.addEventListener('click', event => { const button = event.target.closest('[data-ir-sample]'); if (button) load(Number(button.dataset.irSample)); });

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
load(0).then(paintThemeButton);
renderableSlugs().then(slugs => { document.body.dataset.irSupported = slugs.join(' '); });
