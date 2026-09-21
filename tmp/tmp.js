import { render } from '../ir.js';
import { initialize, mount, setTheme } from '../syntari.js';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = ms => new Promise(resolve => setTimeout(resolve, reducedMotion ? 0 : ms));
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

const scenarios = {
  q2: {
    prompt: 'Compare Q2 revenue with Q1 and explain why costs increased.',
    title: 'Performance comparison',
    pattern: 'Performance comparison',
    patternConfidence: .91,
    decisions: [
      ['intent','analytics',.98],
      ['representation','trend + comparison',.91],
      ['comparison','required',.97],
      ['evidence','required',.84],
      ['reasoning','required',.88],
      ['risk','read-only',.99]
    ],
    rules: ['Registry components only','Evidence remains inspectable','Read-only task requires no approval'],
    spec: {
      version:'syntari-ir-1', type:'screen', layout:'stack', title:'Q2 performance',
      children:[
        {component:'syntari.stat-row',props:{stats:[
          {label:'Revenue',value:'€1.84M',badge:'+18.6%',note:'versus Q1',tone:'success'},
          {label:'Operating costs',value:'€712k',badge:'+12.4%',note:'versus Q1',tone:'warning'},
          {label:'Margin',value:'61.3%',badge:'+2.1 pp',note:'versus Q1',tone:'success'}
        ]}},
        {component:'syntari.streaming-response',props:{author:'Analysis agent',status:'Reasoning complete',text:'Costs increased 12.4% quarter over quarter, led by infrastructure and contractor spend. Revenue grew faster than costs, so margin still improved by 2.1 percentage points.',action:'Regenerate',icon:'bot'}},
        {component:'syntari.area-chart',props:{title:'Revenue trend',note:'Indexed · Q2',chartLabel:'Revenue rises through Q2 and ends at its strongest point in the period.',points:[
          {label:'W1',value:52},{label:'W2',value:58},{label:'W3',value:55},{label:'W4',value:63},{label:'W5',value:61},{label:'W6',value:68},
          {label:'W7',value:72},{label:'W8',value:69},{label:'W9',value:76},{label:'W10',value:81},{label:'W11',value:79},{label:'W12',value:88}
        ]}},
        {component:'syntari.comparison-table',props:{caption:'Q1 and Q2 measured on the same business outcomes',optionA:'Q1',optionB:'Q2',rows:[
          {metric:'Revenue',a:'€1.55M',b:'€1.84M',advantage:'Q2'},
          {metric:'Operating costs',a:'€633k',b:'€712k',advantage:'Q1'},
          {metric:'Margin',a:'59.2%',b:'61.3%',advantage:'Q2'}
        ]}},
        {type:'region',label:'Evidence · 3 sources',open:false,children:[
          {component:'syntari.source-list',props:{sources:[
            {name:'Billing warehouse',share:58},{name:'Finance ledger',share:27},{name:'CRM',share:15}
          ]}}
        ]}
      ]
    }
  },
  brief: {
    prompt: 'Prepare a project brief before the weekly product meeting.',
    title: 'Project brief',
    pattern: 'Decision-ready project summary',
    patternConfidence: .89,
    decisions: [
      ['intent','workflow',.94],
      ['representation','summary',.89],
      ['comparison','not needed',.92],
      ['evidence','required',.79],
      ['reasoning','required',.95],
      ['risk','read-only',.99]
    ],
    rules: ['Summarize before details','Keep provenance available','No destructive actions'],
    spec: {
      version:'syntari-ir-1', type:'screen', layout:'stack', title:'Project brief',
      children:[
        {component:'syntari.stat-row',props:{stats:[
          {label:'Open work',value:'18',badge:'5 priority',note:'current sprint',tone:'neutral'},
          {label:'Decisions needed',value:'3',badge:'meeting',note:'one blocks release',tone:'warning'},
          {label:'Blockers',value:'2',badge:'active',note:'need owners',tone:'danger'}
        ]}},
        {component:'syntari.streaming-response',props:{author:'Briefing agent',status:'Synthesized',text:'The team is shipping the renderer validation work, but two blockers remain. The meeting needs one decision: how low-confidence routing should fall back before Syntari composes the final interface.',action:'Regenerate',icon:'bot'}},
        {component:'syntari.metadata-list',props:{items:[
          {label:'Focus',value:'Renderer validation and decision-provider fallback'},
          {label:'Decision',value:'Choose behavior below the confidence threshold'},
          {label:'Owners',value:'Product · Design engineering · Platform'},
          {label:'Meeting',value:'Weekly product review'}
        ]}},
        {type:'region',label:'Sources · 4 project records',open:false,children:[
          {component:'syntari.source-list',props:{sources:[
            {name:'Project tasks',share:42},{name:'Decision log',share:28},{name:'GitHub activity',share:19},{name:'Meeting notes',share:11}
          ]}}
        ]}
      ]
    }
  },
  delete: {
    prompt: 'Delete the 37 inactive users in this workspace.',
    title: 'Protected action',
    pattern: 'Human approval gate',
    patternConfidence: .99,
    decisions: [
      ['intent','action',.99],
      ['representation','approval',.98],
      ['comparison','not needed',.99],
      ['evidence','not needed',.87],
      ['reasoning','not needed',.94],
      ['risk','destructive',.99]
    ],
    rules: ['Destructive action requires confirmation','Consequence must be explicit','Irreversible scope must be visible'],
    spec: {
      version:'syntari-ir-1', type:'screen', layout:'stack', title:'Workspace action',
      children:[
        {component:'syntari.tool-approval',props:{
          title:'Approval required',
          question:'Delete 37 inactive users from this workspace?',
          scope:'37 users · access, history, and ownership may be affected',
          hint:'This operation is destructive and cannot be undone automatically.',
          icon:'triangle-alert',
          approveLabel:'Approve deletion',
          rejectLabel:'Cancel'
        }}
      ]
    }
  }
};

let activeRender = null;
let activeScenario = 'q2';
let runId = 0;

function chooseScenario(text) {
  const input = String(text || '').toLowerCase();
  if (/(delete|remove|inactive|destroy|purge)/.test(input)) return 'delete';
  if (/(brief|meeting|project|summary|prepare)/.test(input)) return 'brief';
  return 'q2';
}

function componentsFromSpec(spec) {
  const found = [];
  const walk = nodes => (nodes || []).forEach(node => {
    if (node.component) found.push(node.component.replace(/^syntari\./,''));
    if (node.children) walk(node.children);
  });
  walk(spec.children);
  return [...new Set(found)];
}

function paintInspector(scenario, diagnostics) {
  $('[data-pattern-name]').textContent = scenario.pattern;
  $('[data-pattern-confidence]').textContent = Math.round(scenario.patternConfidence * 100) + '%';
  $('[data-render-title]').textContent = scenario.title;

  $('[data-decision-list]').innerHTML = scenario.decisions.map(item =>
    '<div class="decision-row"><span>' + esc(item[0]) + '</span><strong>' + esc(item[1]) + '</strong><span class="confidence">' + Math.round(item[2] * 100) + '%</span></div>'
  ).join('');

  const components = componentsFromSpec(scenario.spec);
  $('[data-component-count]').textContent = components.length + ' selected';
  $('[data-component-list]').innerHTML = components.map((slug,index) =>
    '<a class="component-row" href="../components/' + esc(slug) + '/"><span class="component-icon">' + String(index + 1).padStart(2,'0') + '</span><div><strong>syntari.' + esc(slug) + '</strong><span>registry component</span></div></a>'
  ).join('');

  $('[data-ir-code]').textContent = JSON.stringify(scenario.spec,null,2);

  const issues = diagnostics || [];
  const clean = [
    ['Registry','All selected components exist in the registry'],
    ['Props','Values match declared component contracts'],
    ['Composition','The screen stays inside Syntari IR'],
    ['Policy',scenario.rules[0]]
  ];
  if (!issues.length) {
    $('[data-validation-count]').textContent = '0 issues';
    $('[data-validation-list]').innerHTML = clean.map(item =>
      '<div class="validation-row"><span class="validation-mark">✓</span><div><strong>' + esc(item[0]) + '</strong><br><span>' + esc(item[1]) + '</span></div></div>'
    ).join('');
  } else {
    $('[data-validation-count]').textContent = issues.length + (issues.length === 1 ? ' issue' : ' issues');
    $('[data-validation-list]').innerHTML = issues.map(item =>
      '<div class="validation-row is-' + esc(item.severity) + '"><span class="validation-mark">!</span><div><strong>' + esc(item.code) + '</strong><br><span>' + esc(item.message) + '</span></div></div>'
    ).join('');
  }
}

function resetSteps() {
  $$('.runtime-step').forEach(step => step.classList.remove('is-active','is-complete'));
}

async function advanceStep(name, status, id) {
  if (id !== runId) return false;
  $$('.runtime-step').forEach(step => step.classList.remove('is-active'));
  const step = $('[data-step="' + name + '"]');
  step.classList.add('is-active');
  $('[data-render-status]').textContent = status;
  await sleep(260);
  if (id !== runId) return false;
  step.classList.remove('is-active');
  step.classList.add('is-complete');
  return true;
}

async function runRenderer(forcedScenario) {
  const id = ++runId;
  const prompt = $('#renderer-prompt').value.trim();
  const key = forcedScenario || chooseScenario(prompt);
  const scenario = scenarios[key];
  activeScenario = key;
  resetSteps();
  $('[data-render-output]').innerHTML = '<div class="render-placeholder"><span class="spinner-mark" aria-hidden="true"></span><strong>Understanding intent…</strong><p>Matching the request to Syntari patterns.</p></div>';
  paintInspector(scenario, []);

  if (!await advanceStep('ask','Understanding intent…',id)) return;
  if (!await advanceStep('decide','Selecting pattern…',id)) return;
  if (!await advanceStep('compose','Composing trusted primitives…',id)) return;
  if (!await advanceStep('verify','Validating against the registry…',id)) return;

  activeRender?.destroy();
  activeRender = await render(scenario.spec, $('[data-render-output]'));
  paintInspector(scenario, activeRender.diagnostics);
  if (!await advanceStep('render','Rendered with Syntari',id)) return;
  $('[data-render-status]').textContent = activeRender.diagnostics.some(item => item.severity === 'error') ? 'Rendered with fallbacks' : 'Validated · rendered';
}

$$('[data-scenario]').forEach(button => button.addEventListener('click', () => {
  const key = button.dataset.scenario;
  $$('.prompt-chip').forEach(chip => chip.classList.toggle('is-selected', chip === button));
  $('#renderer-prompt').value = scenarios[key].prompt;
  runRenderer(key);
}));

$('[data-render-button]').addEventListener('click', () => {
  $$('.prompt-chip').forEach(chip => chip.classList.remove('is-selected'));
  runRenderer();
});

$('#renderer-prompt').addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') runRenderer();
});

$$('[data-tab]').forEach(tab => tab.addEventListener('click', () => {
  const name = tab.dataset.tab;
  $$('[data-tab]').forEach(button => button.setAttribute('aria-selected', String(button === tab)));
  $$('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== name; });
}));

$('[data-copy-ir]').addEventListener('click', async event => {
  try {
    await navigator.clipboard.writeText($('[data-ir-code]').textContent);
    const original = event.currentTarget.textContent;
    event.currentTarget.textContent = 'Copied';
    setTimeout(() => { event.currentTarget.textContent = original; }, 1200);
  } catch {}
});

const themeButton = $('[data-theme-toggle]');
const themeIcons = {
  light:'<svg class="icon lucide" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
  dark:'<svg class="icon lucide" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>'
};
function paintTheme() {
  const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  themeButton.innerHTML = themeIcons[current === 'dark' ? 'light' : 'dark'];
  themeButton.setAttribute('aria-label','Switch to ' + (current === 'dark' ? 'light' : 'dark') + ' theme');
}
themeButton.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(next);
  try { localStorage.setItem('syntari-theme',next); } catch {}
  paintTheme();
});

async function mountGalleryCard(card) {
  if (card.dataset.mounted) return;
  card.dataset.mounted = 'true';
  try { await mount(card.dataset.gallerySlug, $('.preview-mount', card)); }
  catch { card.classList.add('is-unavailable'); }
}

async function start() {
  await initialize();
  paintTheme();
  const cards = $$('.component-preview');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      mountGalleryCard(entry.target);
    }), {rootMargin:'120px'});
    cards.forEach(card => observer.observe(card));
  } else {
    cards.forEach(mountGalleryCard);
  }
  runRenderer('q2');
}
start();