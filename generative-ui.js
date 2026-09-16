import { render, renderableSlugs } from './ir.js';
import { setTheme } from './syntari.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const screen = (title, layout, children) => ({ version: 'syntari-ir-1', type: 'screen', layout, title, children });

/**
 * Each scenario is a situation, not a component demo.
 * intent — what the moment is about. does — what the person can decide or understand.
 */
const scenarios = [
  {
    label: 'Production migration',
    intent: 'A migration cannot be undone by the person who has to approve it.',
    does: 'Decide with the blast radius, the evidence, and the recovery path in view.',
    spec: screen('A migration needs your decision', 'stack', [
      { component: 'syntari.banner', props: { message: 'All checks passed', detail: '128 tests in 42s. No regressions since release 4279.', tone: 'success', icon: 'circlecheck' } },
      { component: 'syntari.tool-approval', props: {
        title: 'Run the migration?',
        question: 'Apply three schema changes to the billing database in production.',
        scope: 'billing-production · write access',
        hint: 'Reversible for 24 hours. A verified snapshot is taken first.',
        icon: 'terminal',
        approveLabel: 'Run migration',
        rejectLabel: 'Not now'
      }, provenance: { component: 'planner', reason: 'irreversible change needs human consent' } },
      { component: 'syntari.metadata-list', props: { items: [
        { label: 'Blast radius', value: '3 tables · 1.2M rows' },
        { label: 'Window', value: '04:00–06:00 UTC' },
        { label: 'Snapshot', value: '8.4 GB · verified' },
        { label: 'Owner', value: 'Data platform' }
      ] } },
      { component: 'syntari.activity-list', props: { items: [
        { icon: 'check', title: 'Tests passed', detail: '128 tests in 42s.', time: '2m ago' },
        { icon: 'file', title: 'Snapshot created', detail: 'billing-production · 8.4 GB', time: '1m ago' },
        { icon: 'rotate-ccw', title: 'Dry run completed', detail: 'Rehearsed on a copy. No rows lost.', time: '40s ago' },
        { icon: 'clock', title: 'Waiting for your decision', detail: 'Nothing runs until you approve.', time: 'now' }
      ] } }
    ])
  },
  {
    label: 'Review finished work',
    intent: 'An agent already did the work and needs a person to sign it off.',
    does: 'See what changed, how risky each piece is, and accept it or send it back.',
    spec: screen('Three pages are ready for review', 'stack', [
      { component: 'syntari.approval-card', props: {
        title: 'Review the rewrite',
        summary: 'Homepage, About, and Contact were rewritten for the new voice.',
        detail: 'Homepage, About, Contact',
        hint: 'Nothing is published until you approve.',
        icon: 'circlecheck',
        approveLabel: 'Approve and publish',
        rejectLabel: 'Send back'
      } },
      { component: 'syntari.table', props: {
        caption: 'Pages changed, with the risk of each',
        columns: [{ label: 'Page' }, { label: 'Edits' }, { label: 'Risk' }],
        rows: [['Homepage', '12', 'Low'], ['About', '8', 'Low'], ['Contact', '4', 'Medium']]
      } },
      { component: 'syntari.activity-list', props: { items: [
        { icon: 'edit', title: 'Draft written', detail: 'Three pages, 1,240 words', time: '6m ago' },
        { icon: 'check', title: 'Tone checked', detail: 'Matches the published style guide', time: '4m ago' },
        { icon: 'link', title: 'Links verified', detail: '18 links, no dead ends', time: '2m ago' }
      ] } },
      { component: 'syntari.banner', props: { message: 'Draft only', detail: 'The pages stay unpublished until you approve them.', tone: 'info', icon: 'info' } }
    ])
  },
  {
    label: 'Incident in progress',
    intent: 'Something is degrading and the reader has two minutes, not ten.',
    does: 'Know the current state, who owns it, what was tried, and when the next update lands.',
    spec: screen('Checkout is slow for some users', 'stack', [
      { component: 'syntari.banner', props: { message: 'Degraded · since 14:02', detail: 'Elevated latency on checkout. Payments are unaffected.', tone: 'info', icon: 'bell' } },
      { component: 'syntari.metadata-list', props: { items: [
        { label: 'Impact', value: '4.2% of sessions' },
        { label: 'Region', value: 'EU-West' },
        { label: 'Owner', value: 'Payments on-call' },
        { label: 'Next update', value: '14:35 UTC' }
      ] } },
      { component: 'syntari.card', props: {
        title: 'Suggested next step',
        body: 'Roll back to release 4280. The regression starts at that deploy and nowhere else.',
        badge: 'Ready',
        badgeTone: 'warning',
        action: 'Review the rollback',
        mark: 'gauge'
      } },
      { component: 'syntari.activity-list', props: { items: [
        { icon: 'gauge', title: 'Latency alert fired', detail: 'p95 above 900ms for three minutes', time: '12m ago' },
        { icon: 'rotate-ccw', title: 'Rollback prepared', detail: 'Release 4280 is ready to restore', time: '9m ago' },
        { icon: 'file', title: 'Logs checked', detail: 'No database errors in the window', time: '6m ago' },
        { icon: 'clock', title: 'Waiting on the vendor', detail: 'Support ticket 88231 is open', time: 'now' }
      ] } }
    ])
  },
  {
    label: 'Weekly report',
    intent: 'Numbers are only useful next to the evidence that produced them.',
    does: 'See what moved, by how much, and which tools the change came from.',
    spec: screen('What changed this week', 'two-column', [
      { component: 'syntari.metric-and-sparkline', props: {
        chartLabel: 'Agent runs by day, this week',
        stats: [
          { label: 'Agent runs', value: '1,284', badge: '+18.6%', tone: 'success' },
          { label: 'Approvals', value: '96', badge: '−4.1%', tone: 'warning' }
        ],
        series: [
          { label: 'Mon', value: 41 }, { label: 'Tue', value: 58 }, { label: 'Wed', value: 47 },
          { label: 'Thu', value: 66 }, { label: 'Fri', value: 52 }, { label: 'Sat', value: 74 }
        ]
      } },
      { component: 'syntari.metadata-list', props: { items: [
        { label: 'Window', value: 'Sep 7 – Sep 13' },
        { label: 'Workspace', value: 'Syntari Studio' },
        { label: 'Prepared by', value: 'Weekly report agent' }
      ] } },
      { component: 'syntari.table', props: {
        caption: 'Tools the agents asked to run',
        columns: [{ label: 'Tool' }, { label: 'Runs' }, { label: 'Approved' }],
        rows: [['read_workspace', '412', '412'], ['write_files', '12', '12'], ['send_email', '3', '2']]
      } },
      { component: 'syntari.banner', props: { message: 'One approval is still open', detail: 'send_email waited 41 minutes for a person.', tone: 'info', icon: 'clock' } }
    ])
  },
  {
    label: 'A choice, not a yes/no',
    intent: 'Both options are defensible, and the difference is money and flexibility.',
    does: 'Pick a direction knowing what changes in each case, and what stays the same.',
    spec: screen('Choose how this account is billed', 'stack', [
      { component: 'syntari.approval-card', props: {
        title: 'Two options, one decision',
        summary: 'Annual billing saves 18%. Monthly keeps the account flexible.',
        detail: 'Both options keep the current seat count',
        hint: 'Effective from the next invoice.',
        icon: 'gauge',
        approveLabel: 'Switch to annual',
        rejectLabel: 'Keep monthly'
      } },
      { component: 'syntari.metadata-list', props: { items: [
        { label: 'Annual', value: '€18,240 · saves €3,280' },
        { label: 'Monthly', value: '€1,620 per month' },
        { label: 'Reversible', value: 'At any renewal' },
        { label: 'Seats', value: '24, unchanged' }
      ] } },
      { component: 'syntari.activity-list', props: { items: [
        { icon: 'chart', title: 'Usage reviewed', detail: 'Fourteen months of history', time: '3m ago' },
        { icon: 'check', title: 'Discount checked', detail: '18% is the published rate', time: '2m ago' }
      ] } }
    ])
  },
  {
    label: 'Nothing found',
    intent: 'An empty result is a result. It deserves an explanation, not a blank page.',
    does: 'Understand what was searched, which filter to change, and that nothing was altered.',
    spec: screen('No invoices matched those filters', 'stack', [
      { component: 'syntari.empty-state', props: {
        title: 'Nothing matched',
        body: 'No paid invoice from this vendor in the last ninety days.',
        action: 'Clear the vendor filter',
        icon: 'search'
      } },
      { component: 'syntari.metadata-list', props: { items: [
        { label: 'Searched', value: 'invoices · last 90 days' },
        { label: 'Vendor', value: 'Northwind Traders' },
        { label: 'Status', value: 'Paid' },
        { label: 'Results', value: '0' }
      ] } },
      { component: 'syntari.banner', props: { message: 'Nothing was changed', detail: 'An empty answer is reported as empty, not filled in.', tone: 'info', icon: 'info' } }
    ])
  },
  {
    label: 'Unsupported request',
    intent: 'A model can ask for a component the registry does not have.',
    does: 'See the refusal where the invented component was, while the rest of the screen still renders.',
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
  const scenario = scenarios[index];
  $('[data-ir-intent]').textContent = scenario.intent;
  $('[data-ir-does]').textContent = scenario.does;
  $('#ir-spec').value = JSON.stringify(scenario.spec, null, 2);
  document.querySelectorAll('[data-ir-sample]').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  return paint($('#ir-spec').value);
}

$('[data-ir-render]').addEventListener('click', () => paint($('#ir-spec').value));
const sampleGroup = $('.ir-page-samples');
sampleGroup.innerHTML = scenarios.map((scenario, i) => `<button type="button" class="button small" data-ir-sample="${i}" aria-pressed="${i === 0 ? 'true' : 'false'}">${esc(scenario.label)}</button>`).join('');
sampleGroup.addEventListener('click', event => { const button = event.target.closest('[data-ir-sample]'); if (button) load(Number(button.dataset.irSample)); });

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
load(0).then(paintThemeButton);
renderableSlugs().then(slugs => { document.body.dataset.irSupported = slugs.join(' '); });
