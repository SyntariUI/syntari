import { render } from '../../ir.js';
import { setTheme } from '../../syntari.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const screen = (title, layout, children) => ({ version: 'syntari-ir-1', type: 'screen', layout, title, children });

const examples = {
  q2: {
    prompt: 'Generate Q2 report analytics',
    label: 'Q2 analytics',
    spec: screen('Q2 Performance', 'stack', [
      { component: 'syntari.banner', props: { message: 'Q2 closed above plan', detail: 'Revenue finished 12.8% above Q1 while time to value improved by 0.8 days.', tone: 'success', icon: 'circlecheck' } },
      { component: 'syntari.stat-row', props: { stats: [
        { label: 'Revenue', value: '$2.42M', badge: '+12.8%', note: 'vs Q1', tone: 'success' },
        { label: 'Customers', value: '1,240', badge: '+8.4%', note: 'active accounts', tone: 'success' },
        { label: 'Conversion', value: '4.8%', badge: '+0.9pp', note: 'vs Q1', tone: 'success' },
        { label: 'Time to value', value: '3.2d', badge: '-0.8d', note: 'faster onboarding', tone: 'success' }
      ] } },
      { component: 'syntari.area-chart', props: {
        title: 'Revenue trend',
        note: 'Jan–Jun 2026',
        chartLabel: 'Revenue index across the first six months of 2026, ending at 92 after a softer March.',
        points: [
          { label: 'Jan', value: 48 }, { label: 'Feb', value: 60 }, { label: 'Mar', value: 58 },
          { label: 'Apr', value: 72 }, { label: 'May', value: 78 }, { label: 'Jun', value: 92 }
        ]
      } },
      { type: 'region', label: 'Evidence and interpretation', children: [
        { component: 'syntari.metadata-list', props: { items: [
          { label: 'Main growth driver', value: 'Core-to-Pro upgrades and stronger June enterprise expansion.' },
          { label: 'Watch next', value: 'March softness has not repeated, but acquisition efficiency should be checked before spend increases.' },
          { label: 'Operating signal', value: 'Time to value improved to 3.2 days after onboarding changes shipped in Q1.' }
        ] } },
        { component: 'syntari.source-list', props: { sources: [
          { name: 'Core', share: 46 }, { name: 'Pro', share: 31 }, { name: 'Teams', share: 16 }, { name: 'Enterprise', share: 7 }
        ] } }
      ] }
    ])
  },

  project: {
    prompt: 'Generate project management brief',
    label: 'Project brief',
    spec: screen('Project Atlas · Delivery brief', 'stack', [
      { component: 'syntari.banner', props: { message: 'On track, with one dependency at risk', detail: 'Design and frontend are inside plan. The data migration owner needs a decision before Thursday.', tone: 'info', icon: 'list' } },
      { component: 'syntari.stat-row', props: { stats: [
        { label: 'Progress', value: '68%', badge: '+11%', note: 'this week', tone: 'success' },
        { label: 'Open tasks', value: '24', badge: '-8', note: 'since Monday', tone: 'success' },
        { label: 'Blockers', value: '1', badge: 'needs owner', note: 'data migration', tone: 'warning' },
        { label: 'Target', value: 'Oct 18', badge: 'on track', note: 'launch date', tone: 'success' }
      ] } },
      { component: 'syntari.process-ledger', props: {
        total: '68%',
        budget: 'delivery plan',
        stages: [
          { title: 'Product definition', detail: 'Scope, requirements and success measures', time: '100%', mark: 'check', state: 'done' },
          { title: 'Design and prototype', detail: 'Core flows approved and documented', time: '92%', mark: 'check', state: 'done' },
          { title: 'Implementation', detail: 'Frontend and API work in progress', time: '64%', mark: 'code', state: 'current' },
          { title: 'Data migration', detail: 'Decision required on ownership and fallback', time: '42%', mark: 'info', state: 'current' },
          { title: 'Launch readiness', detail: 'QA, rollout and enablement', time: '18%', mark: 'clock', state: 'pending' }
        ]
      } },
      { component: 'syntari.comparison-table', props: {
        caption: 'Current plan compared with the launch target',
        optionA: 'Current',
        optionB: 'Target',
        rows: [
          { metric: 'Scope complete', a: '68%', b: '75%', advantage: '7% gap' },
          { metric: 'Critical blockers', a: '1', b: '0', advantage: 'Resolve' },
          { metric: 'QA start', a: 'Oct 7', b: 'Oct 7', advantage: 'Aligned' },
          { metric: 'Launch', a: 'Oct 18', b: 'Oct 18', advantage: 'Aligned' }
        ]
      } },
      { component: 'syntari.metadata-list', props: { items: [
        { label: 'Decision needed', value: 'Assign one accountable owner for migration rollback by Thursday.' },
        { label: 'Next milestone', value: 'Feature-complete build for QA on October 7.' },
        { label: 'Owner', value: 'Maya Chen · Product' },
        { label: 'Confidence', value: 'Medium-high; schedule holds if the migration dependency is resolved this week.' }
      ] } }
    ])
  },

  team: {
    prompt: 'Generate team brief before meeting',
    label: 'Team brief',
    spec: screen('Team brief · Product & Design sync', 'stack', [
      { component: 'syntari.banner', props: { message: 'Three decisions are worth the room', detail: 'Most updates can stay async. Use the meeting for rollout, research scope and the Atlas dependency.', tone: 'info', icon: 'info' } },
      { component: 'syntari.stat-row', props: { stats: [
        { label: 'Decisions', value: '3', badge: 'today', note: 'need alignment', tone: 'warning' },
        { label: 'Blockers', value: '1', badge: 'Atlas', note: 'migration owner', tone: 'warning' },
        { label: 'Async updates', value: '7', badge: 'ready', note: 'no discussion', tone: 'success' },
        { label: 'Meeting', value: '30m', badge: 'focused', note: 'proposed agenda', tone: 'success' }
      ] } },
      { component: 'syntari.process-ledger', props: {
        total: '30m',
        budget: 'meeting plan',
        stages: [
          { title: 'Decide rollout', detail: 'Choose 25% or 50% initial exposure', time: '8m', mark: 'star', state: 'current' },
          { title: 'Resolve Atlas ownership', detail: 'Assign migration rollback owner', time: '8m', mark: 'info', state: 'current' },
          { title: 'Set research scope', detail: 'Approve five interviews for onboarding', time: '7m', mark: 'list', state: 'pending' },
          { title: 'Close with owners', detail: 'State decisions, dates and follow-ups', time: '7m', mark: 'check', state: 'pending' }
        ]
      } },
      { component: 'syntari.metadata-list', props: { items: [
        { label: 'Ana · Design', value: 'Prototype is ready. Needs a rollout decision, not more design feedback.' },
        { label: 'Marco · Engineering', value: 'Implementation is on plan; waiting on the Atlas migration owner.' },
        { label: 'Lea · Research', value: 'Recommends five onboarding interviews before expanding the experiment.' },
        { label: 'You should leave with', value: 'Three named decisions, three owners and no unresolved meeting-only updates.' }
      ] } },
      { component: 'syntari.source-list', props: { sources: [
        { name: 'Rollout decision', share: 32 }, { name: 'Atlas dependency', share: 29 }, { name: 'Research scope', share: 23 }, { name: 'Other updates', share: 16 }
      ] } }
    ])
  }
};

const phases = ['understand', 'registry', 'compose', 'render'];
const phaseCopy = {
  understand: ['Understanding the request…', 'Reading the job and information hierarchy'],
  registry: ['Selecting Syntari components…', 'Checking authored components and their contracts'],
  compose: ['Composing a screen spec…', 'Structuring the view from registered parts'],
  render: ['Rendering the interface…', 'Mounting validated Syntari components']
};

let activeKey = null;
let activeInstance = null;
let runId = 0;
let currentSpec = null;

function setSelected(key) {
  $$('[data-prompt]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.prompt === key)));
}

function identifyPrompt(value) {
  const text = value.toLowerCase();
  if (/q2|quarter|analytics|revenue|performance|report/.test(text)) return 'q2';
  if (/project|roadmap|delivery|status|management|milestone/.test(text)) return 'project';
  if (/team|meeting|sync|brief|agenda|people/.test(text)) return 'team';
  return null;
}

function resetPhases() {
  $$('.agent-phase').forEach(node => node.classList.remove('is-active', 'is-done'));
}

function activatePhase(name) {
  const index = phases.indexOf(name);
  phases.forEach((phase, i) => {
    const node = document.querySelector(`[data-phase="${phase}"]`);
    node.classList.toggle('is-done', i < index);
    node.classList.toggle('is-active', i === index);
  });
  $('[data-agent-title]').textContent = phaseCopy[name][0];
  $('[data-agent-state]').textContent = phaseCopy[name][1];
}

function finishPhases() {
  $$('.agent-phase').forEach(node => {
    node.classList.remove('is-active');
    node.classList.add('is-done');
  });
}

function skeletonSpan(className = '') {
  return `<span class="skeleton ${className}"></span>`;
}

function skeletonRows(count = 4) {
  return Array.from({ length: count }, () => `
    <div class="sui-loading-list-row">
      ${skeletonSpan()}
      ${skeletonSpan()}
    </div>`).join('');
}

function skeletonForNode(node) {
  if (node?.type === 'region') {
    return `<div class="sui-loading-region">${skeletonSpan()}<span class="sui-loading-region-chevron"></span></div>`;
  }

  const slug = String(node?.component || '').replace(/^syntari\./, '');
  if (slug === 'banner') {
    return `<div class="sui-loading-component sui-loading-banner">
      ${skeletonSpan('circle')}
      <div class="sui-loading-copy">${skeletonSpan()}${skeletonSpan()}</div>
    </div>`;
  }

  if (slug === 'stat-row') {
    const count = Math.max(1, Math.min(4, node?.props?.stats?.length || 4));
    return `<div class="sui-loading-stat-row" style="--loading-columns:${count}">
      ${Array.from({ length: count }, () => `<div class="sui-loading-component sui-loading-stat">
        ${skeletonSpan('loading-label')}
        ${skeletonSpan('loading-value')}
        ${skeletonSpan('loading-note')}
      </div>`).join('')}
    </div>`;
  }

  if (slug === 'area-chart' || slug === 'chart-bars') {
    return `<div class="sui-loading-component sui-loading-chart">
      <div class="sui-loading-chart-head">
        <div>${skeletonSpan('loading-heading')}${skeletonSpan('loading-subheading')}</div>
        ${skeletonSpan()}
      </div>
      <div class="sui-loading-plot">
        <div class="sui-loading-plot-grid"><span></span><span></span><span></span><span></span></div>
        <svg class="sui-loading-chart-svg" viewBox="0 0 640 160" preserveAspectRatio="none" aria-hidden="true">
          <path d="M8 128 C70 114 88 84 150 92 S246 124 304 83 S402 56 454 67 S548 36 632 28"></path>
          <circle cx="8" cy="128" r="5"></circle><circle cx="150" cy="92" r="5"></circle><circle cx="304" cy="83" r="5"></circle><circle cx="454" cy="67" r="5"></circle><circle cx="632" cy="28" r="5"></circle>
        </svg>
        <div class="sui-loading-axis">${skeletonSpan()}${skeletonSpan()}${skeletonSpan()}${skeletonSpan()}${skeletonSpan()}</div>
      </div>
    </div>`;
  }

  if (slug === 'process-ledger') {
    const count = Math.max(3, Math.min(5, node?.props?.stages?.length || 4));
    return `<div class="sui-loading-component sui-loading-ledger">
      ${Array.from({ length: count }, () => `<div class="sui-loading-row">
        ${skeletonSpan('circle')}
        <div class="sui-loading-row-copy">${skeletonSpan()}${skeletonSpan()}</div>
        ${skeletonSpan()}
      </div>`).join('')}
    </div>`;
  }

  if (slug === 'comparison-table') {
    const rows = Math.max(3, Math.min(5, node?.props?.rows?.length || 4));
    return `<div class="sui-loading-component sui-loading-table">
      <div class="sui-loading-table-head">${skeletonSpan()}${skeletonSpan()}${skeletonSpan()}${skeletonSpan()}</div>
      ${Array.from({ length: rows }, () => `<div class="sui-loading-table-row">${skeletonSpan()}${skeletonSpan()}${skeletonSpan()}${skeletonSpan()}</div>`).join('')}
    </div>`;
  }

  if (slug === 'metadata-list' || slug === 'source-list') {
    const source = node?.props?.items || node?.props?.sources || [];
    const count = Math.max(3, Math.min(5, source.length || 4));
    return `<div class="sui-loading-component sui-loading-list">${skeletonRows(count)}</div>`;
  }

  return `<div class="sui-loading-component sui-loading-list">${skeletonRows(3)}</div>`;
}

function paintSkeleton(spec) {
  const target = $('[data-generation-skeleton]');
  const children = Array.isArray(spec?.children) ? spec.children : [];
  target.innerHTML = `
    <div class="sui-loading-screen">
      <div class="sui-loading-title">${skeletonSpan()}</div>
      <div class="sui-loading-stack">${children.map(skeletonForNode).join('')}</div>
    </div>`;
}

function showSkeleton() {
  $('[data-generation-skeleton]').hidden = false;
  const output = $('[data-ir-output]');
  output.classList.remove('is-visible');
  output.style.display = 'none';
}

function showOutput() {
  $('[data-generation-skeleton]').hidden = true;
  const output = $('[data-ir-output]');
  output.style.display = '';
  requestAnimationFrame(() => output.classList.add('is-visible'));
}

function setBusy(busy) {
  $$('[data-prompt]').forEach(button => { button.disabled = busy; });
  $('.composer-send').disabled = busy;
  $('[data-regenerate]').disabled = busy || !activeKey;
  $('[data-spec-toggle]').disabled = busy || !currentSpec;
}

async function generate(key, promptText = examples[key].prompt) {
  const token = ++runId;
  activeKey = key;
  currentSpec = examples[key].spec;
  setSelected(key);
  setBusy(true);
  resetPhases();

  $('[data-conversation]').hidden = false;
  $('[data-user-message]').textContent = promptText;
  $('[data-runtime-label]').textContent = 'Agent run started';
  $('[data-validation-label]').textContent = 'Checking the request before anything is rendered.';
  $('[data-component-count]').textContent = '';
  $('[data-spec-output]').textContent = JSON.stringify(currentSpec, null, 2);
  $('[data-spec-panel]').hidden = true;
  $('[data-spec-toggle]').textContent = 'Inspect spec';
  paintSkeleton(currentSpec);
  showSkeleton();

  $('[data-conversation]').scrollIntoView({ behavior: 'smooth', block: 'start' });
  activatePhase('understand');
  await sleep(520);
  if (token !== runId) return;

  activatePhase('registry');
  $('[data-runtime-label]').textContent = 'Reading component contracts';
  await sleep(650);
  if (token !== runId) return;

  activatePhase('compose');
  $('[data-runtime-label]').textContent = 'Building Syntari IR';
  await sleep(720);
  if (token !== runId) return;

  activatePhase('render');
  $('[data-runtime-label]').textContent = 'Validating and mounting';
  activeInstance?.destroy();
  $('[data-ir-output]').replaceChildren();

  try {
    activeInstance = await render(currentSpec, $('[data-ir-output]'));
    if (token !== runId) {
      activeInstance.destroy();
      return;
    }
    const components = activeInstance.element.querySelectorAll('[data-ir-component]').length;
    const fallbacks = activeInstance.element.querySelectorAll('[data-ir-status=fallback]').length;
    finishPhases();
    $('[data-agent-title]').textContent = 'View generated';
    $('[data-agent-state]').textContent = fallbacks ? 'Rendered with fallbacks' : 'Ready';
    $('[data-runtime-label]').textContent = `${examples[key].label} · Syntari IR`;
    $('[data-validation-label]').textContent = fallbacks
      ? `${fallbacks} node${fallbacks === 1 ? '' : 's'} could not match the registry and were replaced safely.`
      : 'Validated against the registry before rendering.';
    $('[data-component-count]').textContent = `${components} component${components === 1 ? '' : 's'} mounted`;
    showOutput();
    $('[data-ir-output]').focus({ preventScroll: true });
    $('[data-announcement]').textContent = `${examples[key].label} generated with ${components} Syntari components.`;
  } catch (error) {
    finishPhases();
    $('[data-agent-title]').textContent = 'Generation stopped';
    $('[data-agent-state]').textContent = 'Renderer error';
    $('[data-runtime-label]').textContent = 'Could not mount the view';
    $('[data-validation-label]').textContent = error.message;
  } finally {
    if (token === runId) setBusy(false);
  }
}

$$('[data-prompt]').forEach(button => {
  button.addEventListener('click', () => generate(button.dataset.prompt));
});

$('[data-composer]').addEventListener('submit', event => {
  event.preventDefault();
  const input = $('#playground-prompt');
  const value = input.value.trim();
  if (!value) return;
  const key = identifyPrompt(value);
  if (!key) {
    $('[data-composer-hint]').textContent = 'This local playground currently supports Q2 analytics, project briefs, and team meeting briefs.';
    input.focus();
    return;
  }
  $('[data-composer-hint]').textContent = 'Matched to a supported demo intent and rendered through the same Syntari registry.';
  generate(key, value);
});

$('[data-regenerate]').addEventListener('click', () => {
  if (activeKey) generate(activeKey, $('[data-user-message]').textContent);
});

$('[data-spec-toggle]').addEventListener('click', event => {
  const panel = $('[data-spec-panel]');
  const open = panel.hidden;
  panel.hidden = !open;
  event.currentTarget.textContent = open ? 'Hide spec' : 'Inspect spec';
});

const themeButton = $('[data-theme-toggle]');
function paintThemeButton() {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeButton.innerHTML = window.SyntariIcon?.(dark ? 'sun' : 'moon') ?? (dark ? '☀' : '☾');
  themeButton.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
}
themeButton.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(next);
  try { localStorage.setItem('syntari-theme', next); } catch {}
  paintThemeButton();
});
paintThemeButton();
