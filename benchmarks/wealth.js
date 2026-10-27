/**
 * Benchmark: a financial advisory workspace, inspired by the kind of product Sherpas builds. Cairn Advisory, its advisors,
 * and its households are fictional; every figure is synthetic.
 *
 * Each scenario holds the same request, data, and tasks under two conditions:
 *   - baseline: composed by following Syntari's guidance before intent-aware composition (AGENT-GUIDE.md, the composition
 *     policy's patterns and roles, the authored pattern screens). `derivation` says which pattern and rules it follows.
 *     It is not degraded on purpose: it validates, and it applies the old advice.
 *   - intent: composed from plan_screen's plan for the brief, with the plan's information mapped to node ids.
 * Both are hand-composed Screen IR. They show what each set of rules leads an agent to; they are not model output.
 */
const DEMO = { mode: 'demo', label: 'Cairn Advisory is fictional; every household and figure is synthetic.' };
const screen = (title, layout, children, plan) => ({ version: 'syntari-ir-1', type: 'screen', title, layout, meta: { data: DEMO, ...(plan ? { plan } : {}) }, children });
const section = (id, heading, children, extra = {}) => ({ id, type: 'section', heading, ...extra, children });
const region = (id, label, children, open = false) => ({ id, type: 'region', label, ...(open ? { open } : {}), children });
const node = (id, component, props) => ({ id, component: `syntari.${component}`, props });
const user = { role: 'Financial advisor at Cairn Advisory', frequency: 'daily' };

export const wealth = [
  {
    id: 'advisor-overview',
    product: 'Cairn Advisory',
    title: 'Advisor overview',
    request: 'Build a financial advisor dashboard for Cairn Advisory.',
    brief: {
      request: 'Build a financial advisor dashboard for Cairn Advisory.',
      user,
      job: { primary: 'start the day by clearing the client items waiting on them, most urgent first', mode: 'resolve' },
      decisions: ['Which client item to handle first', 'Whether a late item needs a call instead of an email'],
      information: [
        { id: 'overdue', label: 'Overdue client items', kind: 'exception', exception: true },
        { id: 'queue', label: 'Client items waiting on the advisor', kind: 'pending-item', neededFor: ['choose which item to handle first'] },
        { id: 'selected', label: 'The household behind the selected item', kind: 'entity-profile' },
        { id: 'meetings', label: 'Today’s client meetings', kind: 'records' },
        { id: 'book', label: 'Book of business totals', kind: 'aggregate-metric', frequency: 'rare' },
        { id: 'activity', label: 'Recent activity across households', kind: 'history', frequency: 'rare' }
      ],
      actions: [{ label: 'Open the most urgent item', kind: 'primary' }]
    },
    baseline: {
      derivation: 'The request says “dashboard”: the Renderer’s pattern match and search_components both lead to Analytics overview, and the composition policy’s dashboard pattern orders headline measures, one principal analysis, then records. The advisor’s pending items are records, so they go last; sources go in a closed region, as the agent guide asks.',
      nodes: { queue: ['pending-table'], overdue: ['measures'], book: ['headline'] },
      spec: screen('Advisor dashboard', 'stack', [
        node('scope', 'filter-bar', { period: 'This quarter', periods: [{ label: 'This month', value: 'month' }, { label: 'This quarter', value: 'quarter' }, { label: 'This year', value: 'year' }], filtersLabel: 'Households', settingsLabel: 'View' }),
        node('headline', 'headline-metric', { metrics: [{ label: 'Assets under management', value: '€184.2M', delta: '2.1%', direction: 'up' }, { label: 'Households', value: '42', delta: '1', direction: 'up' }] }),
        node('measures', 'metric-strip', { items: [
          { label: 'Net flows', icon: 'arrow-up', value: '+€3.1M', delta: '12%', direction: 'up', meaning: 'this quarter', active: true },
          { label: 'Pending items', icon: 'clock', value: '7', delta: '2', direction: 'up', meaning: 'waiting on you' },
          { label: 'Reviews due', icon: 'calendar', value: '9', delta: '3', direction: 'down', meaning: 'plans this quarter' },
          { label: 'Overdue', icon: 'info', value: '2', delta: '1', direction: 'up', meaning: 'past their due date' }
        ] }),
        node('chart-options', 'chart-toolbar', { compareLabel: 'Compare with last year', compare: false, viewLabel: 'View monthly figures', viewActive: false, legend: 'Assets under management' }),
        node('aum-chart', 'line-chart', { title: 'Assets under management', note: '€ millions, last 12 months', unit: '', chartLabel: 'Assets under management over the last 12 months, rising from 168 to 184 million euros.', points: [
          { label: 'Apr', value: 168 }, { label: 'May', value: 170 }, { label: 'Jun', value: 169 }, { label: 'Jul', value: 172 }, { label: 'Aug', value: 174 }, { label: 'Sep', value: 173 },
          { label: 'Oct', value: 176 }, { label: 'Nov', value: 178 }, { label: 'Dec', value: 177 }, { label: 'Jan', value: 180 }, { label: 'Feb', value: 182 }, { label: 'Mar', value: 184 }
        ] }),
        node('pending-table', 'table', { caption: 'Pending client items', sortable: true, columns: [{ label: 'Household' }, { label: 'Item' }, { label: 'Status' }], rows: [
          ['Okoro', 'Approve retirement plan update', 'Ready for review'], ['Haddad', 'Sign account transfer form', 'Waiting on client'], ['Lindqvist', 'Reconcile March statement', '3 differences'],
          ['Brennan-Díaz', 'Rebalance proposal', 'Drift above band'], ['Watanabe', 'Chase beneficiary form', 'Requested'], ['Moreau', 'Review risk questionnaire', 'Submitted'], ['Ilunga', 'Annual review preparation', 'Not started']
        ] }),
        region('sources', 'Where the numbers come from', [
          node('custodians', 'source-list', { sources: [{ name: 'Northgate Securities', share: 62 }, { name: 'Albion Custody', share: 27 }, { name: 'Held away', share: 11 }] }),
          node('method', 'metadata-list', { items: [{ label: 'Valued at', value: 'Close of business, 31 March' }, { label: 'Compared with', value: 'The same quarter last year' }] })
        ])
      ], { pattern: 'dashboard', purpose: 'A recurring view of the advisor’s book of business.', questions: ['How is the book doing?', 'What is pending?'], rationale: 'Headline measures first, then the trend in assets, then the pending records.' })
    },
    intent: {
      nodes: { overdue: ['overdue-banner'], queue: ['queue-table'], selected: ['selected-profile'], meetings: ['meetings-list'], book: ['book-totals'], activity: ['activity-list'] },
      actionNode: 'open-next',
      spec: screen('Your work today', 'split', [
        section('work', 'Waiting on you', [
          node('overdue-banner', 'banner', { tone: 'warning', icon: 'clock', message: 'Two items are past their due date', detail: 'The Okoro plan approval is three days late and the Haddad transfer form one day. Start with the plan.' }),
          node('queue-table', 'table', { caption: 'Client items waiting on you, most urgent first', sortable: true, columns: [{ label: 'Due' }, { label: 'Household' }, { label: 'What is needed' }, { label: 'Status' }], rows: [
            ['3 days late', 'Okoro', 'Approve retirement plan update', 'Ready for review'], ['1 day late', 'Haddad', 'Sign account transfer form', 'Waiting on client'],
            ['Today', 'Lindqvist', 'Reconcile March statement', '3 values differ'], ['Today', 'Brennan-Díaz', 'Decide on rebalancing', 'Drift above band'],
            ['Tomorrow', 'Watanabe', 'Chase beneficiary form', 'Asked 12 days ago'], ['Friday', 'Moreau', 'Review risk questionnaire', 'Submitted'], ['Next week', 'Ilunga', 'Prepare annual review', 'Not started']
          ] }),
          node('open-next', 'button', { label: 'Open the Okoro plan', variant: 'primary' }),
          section('meetings', 'Meetings today', [
            node('meetings-list', 'metadata-list', { items: [{ label: '10:30', value: 'Lindqvist · annual review' }, { label: '14:00', value: 'Watanabe · beneficiary update' }, { label: '16:15', value: 'Ferreira · first meeting' }] })
          ]),
          region('book', 'Book of business · 42 households', [
            node('book-totals', 'metadata-list', { items: [{ label: 'Assets under management', value: '€184.2M, up 2.1% this quarter' }, { label: 'Net flows', value: '+€3.1M this quarter' }, { label: 'Plans due for review', value: '9 this quarter' }] })
          ]),
          region('activity', 'Recent activity · last 7 days', [
            node('activity-list', 'activity-list', { items: [
              { icon: 'file', title: 'Lindqvist statement received', detail: 'Northgate · March', time: 'Today' },
              { icon: 'check', title: 'Moreau questionnaire submitted', detail: 'Risk profile: balanced', time: 'Yesterday' },
              { icon: 'calendar', title: 'Ferreira meeting booked', detail: 'Referral from the Okoros', time: 'Mon' }
            ] })
          ])
        ], { emphasis: 'primary' }),
        section('selected', 'Okoro household', [
          node('selected-profile', 'metadata-list', { items: [{ label: 'Item', value: 'Retirement plan update, version 4' }, { label: 'Waiting since', value: 'Friday, prepared by Dana Ruiz' }, { label: 'Assets', value: '€2.84M across 4 accounts' }, { label: 'Last contact', value: 'Email, 6 days ago' }] }),
          node('selected-why', 'text-block', { body: 'Rui’s career change lowers what the household can save until 2027. The update moves retirement two years later to keep their income goal; it needs your approval before the clients sign.' })
        ], { surface: 'panel' })
      ])
    },
    observations: [
      'Baseline: the first screen is measures about the book; the work waiting on the advisor is the last part, after a chart nobody acts on.',
      'Intent-aware: the overdue items lead, then the queue ordered by due date with the next action, and the selected household beside it. Totals and activity are one click away.'
    ]
  },
  {
    id: 'work-queue',
    product: 'Cairn Advisory',
    title: 'Work queue',
    request: 'Show the advisor’s work queue with every open client task.',
    brief: {
      request: 'Show the advisor’s work queue with every open client task.',
      user,
      job: { primary: 'work through every open client task, filtering by what can be done now', mode: 'resolve' },
      decisions: ['Which task to do next', 'Which tasks to hand to the associate'],
      information: [
        { id: 'tasks', label: 'Open client tasks', kind: 'pending-item', neededFor: ['choose the next task'] },
        { id: 'task-context', label: 'The selected task’s context', kind: 'explanation' },
        { id: 'done', label: 'Tasks completed this week', kind: 'history', frequency: 'rare' }
      ],
      actions: [{ label: 'Hand selected tasks to the associate', kind: 'secondary' }]
    },
    baseline: {
      derivation: 'The composition policy’s workspace pattern (“records a person scans, filters, and works through”): scope, records, detail. Each task is a record that can be opened, so the registry’s Card (“hold one record or one idea”) shows the tasks a person acts on, with the full list as a table below.',
      nodes: { tasks: ['task-okoro', 'task-haddad', 'task-lindqvist', 'task-table'], done: ['done-list'] },
      spec: screen('Work queue', 'stack', [
        node('scope', 'filter-bar', { period: 'All open', periods: [{ label: 'All open', value: 'open' }, { label: 'Due this week', value: 'week' }, { label: 'Overdue', value: 'overdue' }], filtersLabel: 'Households', settingsLabel: 'Columns' }),
        node('summary', 'stat-row', { stats: [{ label: 'Open tasks', value: '11', note: 'across 9 households' }, { label: 'Due this week', value: '6', note: 'of 11 open' }, { label: 'Overdue', value: '2', badge: '+1', tone: 'danger', note: 'since Monday' }] }),
        section('priority', 'Priority tasks', [
          node('task-okoro', 'card', { title: 'Okoro plan approval', body: 'Retirement plan update, version 4, ready for your review.', badge: 'Overdue', badgeTone: 'danger', action: 'Open task', mark: 'file' }),
          node('task-haddad', 'card', { title: 'Haddad transfer form', body: 'Client signature needed on the account transfer.', badge: 'Overdue', badgeTone: 'danger', action: 'Open task', mark: 'file' }),
          node('task-lindqvist', 'card', { title: 'Lindqvist statement', body: 'Three values differ from the household record.', badge: 'Due today', badgeTone: 'warning', action: 'Open task', mark: 'file' })
        ], { layout: 'grid' }),
        node('task-table', 'table', { caption: 'All open tasks', sortable: true, columns: [{ label: 'Household' }, { label: 'Task' }, { label: 'Owner' }, { label: 'Due' }], rows: [
          ['Okoro', 'Approve plan update', 'You', '3 days late'], ['Haddad', 'Collect transfer signature', 'You', '1 day late'], ['Lindqvist', 'Reconcile statement', 'You', 'Today'],
          ['Brennan-Díaz', 'Decide on rebalancing', 'You', 'Today'], ['Watanabe', 'Chase beneficiary form', 'Associate', 'Tomorrow'], ['Moreau', 'Review questionnaire', 'You', 'Friday'],
          ['Ilunga', 'Prepare annual review', 'Associate', 'Next week'], ['Ferreira', 'Send welcome pack', 'Associate', 'Next week']
        ] }),
        region('done', 'Completed this week', [
          node('done-list', 'activity-list', { items: [{ icon: 'check', title: 'Moreau questionnaire reviewed', detail: 'Balanced profile confirmed', time: 'Tue' }, { icon: 'check', title: 'Kaur plan signed', detail: 'Version 2', time: 'Mon' }] })
        ])
      ], { pattern: 'workspace', purpose: 'Every open task, to work through.', rationale: 'Scope, then the priority tasks, then all records.' })
    },
    intent: {
      nodes: { tasks: ['task-table'], 'task-context': ['task-notes'], done: ['done-list'] },
      spec: screen('Open client tasks', 'split', [
        section('queue', 'Eleven open tasks, most urgent first', [
          node('scope', 'filter-bar', { period: 'All open', periods: [{ label: 'All open', value: 'open' }, { label: 'Due this week', value: 'week' }, { label: 'Mine', value: 'mine' }], filtersLabel: 'Households', settingsLabel: 'Columns' }),
          node('task-table', 'table', { caption: 'Open client tasks, most urgent first', sortable: true, columns: [{ label: 'Due' }, { label: 'Household' }, { label: 'Task' }, { label: 'Owner' }], rows: [
            ['3 days late', 'Okoro', 'Approve plan update', 'You'], ['1 day late', 'Haddad', 'Collect transfer signature', 'You'], ['Today', 'Lindqvist', 'Reconcile statement', 'You'],
            ['Today', 'Brennan-Díaz', 'Decide on rebalancing', 'You'], ['Tomorrow', 'Watanabe', 'Chase beneficiary form', 'Associate'], ['Friday', 'Moreau', 'Review questionnaire', 'You'],
            ['Next week', 'Ilunga', 'Prepare annual review', 'Associate'], ['Next week', 'Ferreira', 'Send welcome pack', 'Associate']
          ] }),
          region('done', 'Completed this week · 2', [
            node('done-list', 'activity-list', { items: [{ icon: 'check', title: 'Moreau questionnaire reviewed', detail: 'Balanced profile confirmed', time: 'Tue' }, { icon: 'check', title: 'Kaur plan signed', detail: 'Version 2', time: 'Mon' }] })
          ])
        ], { emphasis: 'primary' }),
        section('task', 'Okoro · approve plan update', [
          node('task-notes', 'metadata-list', { items: [{ label: 'Prepared by', value: 'Dana Ruiz, Friday' }, { label: 'Blocks', value: 'Client signature and new transfers' }, { label: 'Takes', value: 'About 10 minutes' }] }),
          node('handoff', 'button', { label: 'Hand to the associate', variant: 'secondary' })
        ], { surface: 'panel' })
      ])
    },
    observations: [
      'Baseline: the three most urgent tasks appear twice, as cards and as rows; counts above them repeat what the table shows.',
      'Intent-aware: one sortable list, due date first, with the selected task’s context beside it. Fewer boxes, the same tasks.'
    ]
  },
  {
    id: 'household-overview',
    product: 'Cairn Advisory',
    title: 'Household overview',
    request: 'Show the Lindqvist household before today’s annual review.',
    brief: {
      request: 'Show the Lindqvist household before today’s annual review.',
      user,
      subject: 'entity',
      job: { primary: 'prepare for the Lindqvist annual review and see what is still open on the household', mode: 'review' },
      decisions: ['What to raise in the review', 'Whether the plan still fits the household’s goals'],
      information: [
        { id: 'profile', label: 'Household profile', kind: 'entity-profile', neededFor: ['orient before the review'] },
        { id: 'open-items', label: 'Open items on the household', kind: 'pending-item', neededFor: ['decide what to raise in the review'] },
        { id: 'allocation', label: 'Allocation against target', kind: 'category-comparison' },
        { id: 'goals', label: 'Progress towards goals', kind: 'aggregate-metric' },
        { id: 'accounts', label: 'Members and accounts', kind: 'records', frequency: 'rare' },
        { id: 'history', label: 'Recent activity', kind: 'history', frequency: 'rare' }
      ],
      actions: [{ label: 'Open the statement reconciliation', kind: 'primary' }]
    },
    baseline: {
      derivation: 'A record with many facets: the agent guide asks for sections (finding, evidence, decision) and labelled regions for skippable detail; Card holds “one record or one idea”, Stat row the measures that matter. The household’s figures lead, each facet gets its own card or region.',
      nodes: { profile: ['stats'], 'open-items': ['card-plan', 'card-statement', 'card-beneficiary'], allocation: ['allocation'], goals: ['goal-bars'], accounts: ['accounts-table'], history: ['history-list'] },
      spec: screen('Lindqvist household', 'stack', [
        node('summary-banner', 'banner', { tone: 'info', icon: 'info', message: 'Annual review today at 10:30', detail: 'This page brings together everything about the Lindqvist household.' }),
        node('stats', 'stat-row', { stats: [{ label: 'Total assets', value: '€3.12M', badge: '+4.2%', tone: 'success', note: 'since last review' }, { label: 'Accounts', value: '5', note: 'at 2 custodians' }, { label: 'Risk profile', value: 'Balanced', note: 'reviewed 2025' }, { label: 'Open items', value: '3', note: 'before the review' }] }),
        section('facets', 'Household', [
          node('card-plan', 'card', { title: 'Retirement plan', body: 'Retire in 2031 with €7,200 a month. On track.', badge: 'On track', badgeTone: 'success', action: 'Open plan', mark: 'file' }),
          node('card-statement', 'card', { title: 'March statement', body: 'Three values differ from the household record.', badge: 'Needs review', badgeTone: 'warning', action: 'Reconcile', mark: 'file' }),
          node('card-beneficiary', 'card', { title: 'Beneficiary form', body: 'Anna’s pension beneficiary is not confirmed.', badge: 'Waiting', badgeTone: 'warning', action: 'Chase', mark: 'file' })
        ], { layout: 'grid' }),
        section('portfolio', 'Portfolio', [
          node('allocation', 'breakdown', { title: 'Allocation', total: '€3.12M', segments: [{ label: 'Equities', value: '€1.84M', share: 59 }, { label: 'Bonds', value: '€0.97M', share: 31 }, { label: 'Cash', value: '€0.31M', share: 10 }] }),
          node('allocation-text', 'text-block', { body: 'The household holds 59% in equities, 31% in bonds and 10% in cash, against a balanced target of 55%, 35% and 10%. Equities are slightly above target after a strong quarter.' })
        ], { layout: 'two-column' }),
        region('goals', 'Goals', [node('goal-bars', 'progress', { bars: [{ label: 'Retirement income', value: 82 }, { label: 'Cash reserve', value: 100 }, { label: 'Education fund', value: 64 }] })], true),
        region('accounts', 'Members and accounts', [node('accounts-table', 'table', { caption: 'Accounts', columns: [{ label: 'Account' }, { label: 'Owner' }, { label: 'Value' }], rows: [['Joint brokerage', 'Erik and Anna', '€1.92M'], ['Pension', 'Anna', '€0.61M'], ['Pension', 'Erik', '€0.44M'], ['Education', 'Ella', '€0.09M'], ['Cash', 'Joint', '€0.06M']] })]),
        region('history', 'Recent activity', [node('history-list', 'activity-list', { items: [{ icon: 'file', title: 'March statement received', detail: 'Northgate', time: 'Today' }, { icon: 'calendar', title: 'Review booked', detail: 'By Anna', time: '2 weeks ago' }] })])
      ], { pattern: 'report', purpose: 'Everything about the household before the review.', rationale: 'Headline figures, the household’s facets, then portfolio, goals, and details.' })
    },
    intent: {
      nodes: { profile: ['profile'], 'open-items': ['open-items'], allocation: ['allocation'], goals: ['goals'], accounts: ['accounts-table'], history: ['history-list'] },
      actionNode: 'open-reconciliation',
      spec: screen('Lindqvist household', 'split', [
        section('review', 'Before the 10:30 review', [
          node('profile', 'metadata-list', { items: [{ label: 'Stage', value: 'Annual review today' }, { label: 'Assets', value: '€3.12M in 5 accounts' }, { label: 'Plan', value: 'Retire in 2031, balanced risk' }, { label: 'Client since', value: '2017' }] }),
          node('open-items', 'checklist', { title: 'Still open on the household', items: [
            { title: 'Reconcile the March statement', detail: 'Three values differ from the record', time: 'Today' },
            { title: 'Confirm Anna’s pension beneficiary', detail: 'Form asked for 12 days ago', time: 'Overdue' },
            { title: 'Agree the education fund top-up', detail: 'Raise in the review', time: 'Review' }
          ] }),
          node('open-reconciliation', 'button', { label: 'Open the reconciliation', variant: 'primary' }),
          region('accounts', 'Members and accounts · 3 people, 5 accounts', [node('accounts-table', 'table', { caption: 'Accounts', columns: [{ label: 'Account' }, { label: 'Owner' }, { label: 'Value' }], rows: [['Joint brokerage', 'Erik and Anna', '€1.92M'], ['Pension', 'Anna', '€0.61M'], ['Pension', 'Erik', '€0.44M'], ['Education', 'Ella', '€0.09M'], ['Cash', 'Joint', '€0.06M']] })]),
          region('history', 'Recent activity', [node('history-list', 'activity-list', { items: [{ icon: 'file', title: 'March statement received', detail: 'Northgate', time: 'Today' }, { icon: 'calendar', title: 'Review booked', detail: 'By Anna', time: '2 weeks ago' }] })])
        ], { emphasis: 'primary' }),
        section('context', 'For the conversation', [
          node('allocation', 'chart-bars', { title: 'Allocation against target', note: 'Share of €3.12M', orientation: 'horizontal', unit: '%', seriesA: 'Now', seriesB: 'Target', chartLabel: 'Equities 59% against a 55% target, bonds 31% against 35%, cash 10% against 10%.', columns: [{ label: 'Equities', a: 59, b: 55 }, { label: 'Bonds', a: 31, b: 35 }, { label: 'Cash', a: 10, b: 10 }] }),
          node('goals', 'progress', { bars: [{ label: 'Retirement income', value: 82 }, { label: 'Cash reserve', value: 100 }, { label: 'Education fund', value: 64 }] })
        ])
      ])
    },
    observations: [
      'Baseline: a banner explains the page, four measures and three cards come before what is open; the allocation is drawn and then restated in a paragraph.',
      'Intent-aware: orientation and what is still open lead; allocation against target and goals sit beside them for the conversation; accounts and activity wait in regions.'
    ]
  },
  {
    id: 'plan-approval',
    product: 'Cairn Advisory',
    title: 'Plans and approvals',
    request: 'Review the Okoro retirement plan update and approve it.',
    brief: {
      request: 'Review the Okoro retirement plan update and approve it.',
      user,
      job: { primary: 'decide whether to approve the proposed retirement plan for the Okoros or send it back', mode: 'decide' },
      decisions: ['Approve the proposed plan or keep the current one'],
      information: [
        { id: 'plans', label: 'Current and proposed plan', kind: 'alternative', neededFor: ['approve or keep the current plan'] },
        { id: 'why', label: 'Why the update was proposed', kind: 'explanation', priority: 'supporting' },
        { id: 'consequences', label: 'What approving changes', kind: 'impact', neededFor: ['approve or keep the current plan'] },
        { id: 'assumptions', label: 'Assumptions both plans share', kind: 'records', frequency: 'rare' }
      ],
      actions: [{ label: 'Approve and send for signature', kind: 'primary', consequential: true }, { label: 'Send back to the planner', kind: 'secondary' }]
    },
    baseline: {
      derivation: 'The composition policy’s transaction pattern (“a consequential change a person reviews and authorizes: what will happen, the evidence, then one decision”) and the Approval review screen: a banner, the evidence, then the approval card.',
      nodes: { plans: ['plan-compare'], why: ['summary'], assumptions: ['assumption-list'] },
      spec: screen('Okoro retirement plan update', 'stack', [
        node('status', 'banner', { tone: 'info', icon: 'info', message: 'Approval needed', detail: 'Dana Ruiz has prepared a plan update and is waiting for your decision.' }),
        node('plan-stats', 'stat-row', { stats: [{ label: 'Retirement age', value: '64', badge: '+2 years', tone: 'warning', note: 'was 62' }, { label: 'Chance of success', value: '88%', badge: '+17 pp', tone: 'success', note: 'was 71%' }, { label: 'Monthly saving', value: '€1,850', badge: '−€550', tone: 'success', note: 'was €2,400' }] }),
        node('plan-compare', 'comparison-table', { caption: 'Current plan against the proposed update', optionA: 'Current', optionB: 'Proposed', rows: [
          { metric: 'Retirement age', a: '62', b: '64', advantage: 'Current' }, { metric: 'Monthly saving', a: '€2,400', b: '€1,850', advantage: 'Proposed' },
          { metric: 'Chance of meeting goals', a: '71%', b: '88%', advantage: 'Proposed' }, { metric: 'Income in retirement', a: '€6,100 a month', b: '€6,900 a month', advantage: 'Proposed' }
        ] }),
        node('summary', 'text-block', { body: 'The proposed plan moves retirement from 62 to 64, lowers the monthly saving from €2,400 to €1,850 and raises the chance of meeting goals from 71% to 88%. Several parts of the plan change if it is approved.' }),
        node('approve', 'approval-card', { title: 'Plan update, version 4', summary: 'Approve the proposed retirement plan for Rui and Ana Okoro.', detail: 'Prepared by Dana Ruiz on Friday.', approveLabel: 'Approve', rejectLabel: 'Send back' }),
        region('assumptions', 'Assumptions', [node('assumption-list', 'metadata-list', { items: [{ label: 'Inflation', value: '2.5% a year' }, { label: 'Returns', value: 'Balanced model, 4.8% a year' }, { label: 'State pension', value: 'From 67' }] })])
      ], { pattern: 'transaction', purpose: 'Approve the Okoro plan update.', rationale: 'What will happen, the evidence, then one decision.' })
    },
    intent: {
      nodes: { plans: ['plan-compare'], why: ['why'], consequences: ['consequences'], assumptions: ['assumption-list'] },
      actionNode: 'approve',
      spec: screen('Okoro retirement plan, version 4', 'stack', [
        section('differ', 'How the plans differ', [
          node('plan-compare', 'comparison-table', { caption: 'Current plan against the proposed update', optionA: 'Current', optionB: 'Proposed', rows: [
            { metric: 'Retirement age', a: '62', b: '64', advantage: 'Current' }, { metric: 'Monthly saving', a: '€2,400', b: '€1,850', advantage: 'Proposed' },
            { metric: 'Chance of meeting goals', a: '71%', b: '88%', advantage: 'Proposed' }, { metric: 'Income in retirement', a: '€6,100 a month', b: '€6,900 a month', advantage: 'Proposed' }
          ] }),
          node('why', 'text-block', { body: 'Rui’s career change lowers what the household can save until 2027. Retiring two years later keeps their income goal without raising risk.' })
        ], { emphasis: 'primary' }),
        section('approval', 'What approving changes', [
          node('consequences', 'value-diff', { caption: 'Changes that start when the clients sign', fromLabel: 'Now', toLabel: 'After signature', rows: [
            { field: 'Standing transfer', from: '€2,400 on the 1st', to: '€1,850 on the 1st' },
            { field: 'Equity glide path starts', from: '2026', to: '2028' },
            { field: 'Next plan review', from: 'March 2027', to: 'September 2026' }
          ] }),
          node('approve', 'tool-approval', { title: 'Approve the plan update?', question: 'Send version 4 to Rui and Ana Okoro to sign. Nothing changes until both sign.', scope: 'Okoro household · plan and standing transfer', approveLabel: 'Approve and send', rejectLabel: 'Send back' })
        ]),
        region('assumptions', 'Assumptions both plans share', [node('assumption-list', 'metadata-list', { items: [{ label: 'Inflation', value: '2.5% a year' }, { label: 'Returns', value: 'Balanced model, 4.8% a year' }, { label: 'State pension', value: 'From 67' }] })])
      ])
    },
    observations: [
      'Baseline: the same four differences appear three times (measures, table, and a paragraph); the approval card says “several parts of the plan change” without naming them.',
      'Intent-aware: the differences once, why in two sentences, and the specific consequences of approving beside a decision that says exactly what happens.'
    ]
  },
  {
    id: 'portfolio-review',
    product: 'Cairn Advisory',
    title: 'Portfolio review',
    request: 'Review the Brennan-Díaz portfolio.',
    brief: {
      request: 'Review the Brennan-Díaz portfolio.',
      user,
      job: { primary: 'decide whether the Brennan-Díaz portfolio needs rebalancing now', mode: 'decide' },
      decisions: ['Rebalance now or wait for the quarterly review'],
      information: [
        { id: 'finding', label: 'How far the portfolio has drifted', kind: 'explanation', neededFor: ['rebalance now or wait'] },
        { id: 'allocation', label: 'Allocation against target', kind: 'category-comparison', neededFor: ['rebalance now or wait'] },
        { id: 'trades', label: 'What the trades change', kind: 'impact', neededFor: ['rebalance now or wait'] },
        { id: 'performance', label: 'Performance against the benchmark', kind: 'trend' },
        { id: 'holdings', label: 'Holdings', kind: 'records', frequency: 'rare' }
      ],
      actions: [{ label: 'Send trades for approval', kind: 'primary', consequential: true }]
    },
    baseline: {
      derivation: 'The composition policy’s dashboard pattern for a portfolio: headline measures, one principal analysis (allocation as parts of a whole takes a breakdown), supporting comparisons, then positions; the decision as an approval card.',
      nodes: { finding: ['advice'], allocation: ['allocation'], performance: ['performance'], holdings: ['holdings-table'] },
      spec: screen('Brennan-Díaz portfolio', 'stack', [
        node('stats', 'stat-row', { stats: [{ label: 'Portfolio value', value: '€1.80M', badge: '+6.4%', tone: 'success', note: 'this year' }, { label: 'Return', value: '+6.4%', badge: '+0.9 pp', tone: 'success', note: 'against the benchmark' }, { label: 'Equity drift', value: '+7 pp', badge: 'Above band', tone: 'danger', note: 'band is ±5 pp' }, { label: 'Positions', value: '9', note: 'in 2 accounts' }] }),
        node('allocation', 'breakdown', { title: 'Allocation', total: '€1.80M', segments: [{ label: 'Equities', value: '€1.21M', share: 67 }, { label: 'Bonds', value: '€0.45M', share: 25 }, { label: 'Cash', value: '€0.14M', share: 8 }] }),
        node('performance', 'line-chart', { title: 'Return against the benchmark', note: 'Last 12 months', unit: '%', seriesA: 'Portfolio', seriesB: 'Benchmark', chartLabel: 'The portfolio returned 6.4% over 12 months against 5.5% for its benchmark.', points: [{ label: 'Apr', value: 0.4, compare: 0.3 }, { label: 'Jun', value: 1.2, compare: 1.1 }, { label: 'Aug', value: 2.1, compare: 2.4 }, { label: 'Oct', value: 3.3, compare: 3.0 }, { label: 'Dec', value: 4.6, compare: 4.1 }, { label: 'Feb', value: 5.8, compare: 5.0 }, { label: 'Mar', value: 6.4, compare: 5.5 }] }),
        node('advice', 'text-block', { body: 'Equities are at 67% against a 60% target, a drift of 7 points, above the ±5 point band. Bonds are at 25% against 32%. Rebalancing is recommended.' }),
        node('approve', 'approval-card', { title: 'Rebalancing proposal', summary: 'Rebalance the Brennan-Díaz portfolio back to target.', detail: 'Two trades in the joint account.', approveLabel: 'Approve', rejectLabel: 'Not now' }),
        region('holdings', 'Holdings', [node('holdings-table', 'table', { caption: 'Holdings', sortable: true, columns: [{ label: 'Fund' }, { label: 'Value' }, { label: 'Weight' }], rows: [['Global equity fund', '€1,206,000', '67%'], ['Euro government bonds', '€450,000', '25%'], ['Cash', '€144,000', '8%']] })])
      ], { pattern: 'dashboard', purpose: 'Review the portfolio.', rationale: 'Measures, allocation, performance, then the proposal.' })
    },
    intent: {
      nodes: { finding: ['finding'], allocation: ['allocation'], trades: ['trades'], performance: ['performance'], holdings: ['holdings-table'] },
      actionNode: 'approve',
      spec: screen('Brennan-Díaz portfolio', 'stack', [
        section('finding-section', 'Rebalancing is due', [
          node('finding', 'text-block', { body: 'Equities rose past the ±5 point band after the March rally. Two trades in the joint account bring the portfolio back to target; waiting for the June review leaves it outside the band for ten weeks.' }),
          node('allocation', 'chart-bars', { title: 'Allocation against target', note: 'Share of €1.80M', orientation: 'horizontal', unit: '%', seriesA: 'Now', seriesB: 'Target', chartLabel: 'Equities 67% against a 60% target, bonds 25% against 32%, cash 8% against 8%.', columns: [{ label: 'Equities', a: 67, b: 60 }, { label: 'Bonds', a: 25, b: 32 }, { label: 'Cash', a: 8, b: 8 }] })
        ], { emphasis: 'primary' }),
        section('act', 'What the trades change', [
          node('trades', 'value-diff', { caption: 'Joint account ••2210, after both trades settle', fromLabel: 'Now', toLabel: 'After trades', rows: [
            { field: 'Global equity fund', from: '€1,206,000', to: '€1,080,000' },
            { field: 'Euro government bonds', from: '€450,000', to: '€576,000' },
            { field: 'Estimated cost', from: '—', to: '€310 in fees' }
          ] }),
          node('approve', 'tool-approval', { title: 'Send two trades for approval?', question: 'Sell €126,000 of the equity fund and buy the same amount of the bond fund.', scope: 'Brennan-Díaz joint account ••2210 · settles in 2 days', approveLabel: 'Send for approval', rejectLabel: 'Wait for review' })
        ]),
        section('performance-section', 'Performance', [
          node('performance', 'line-chart', { title: 'Return against the benchmark', note: 'Last 12 months', unit: '%', seriesA: 'Portfolio', seriesB: 'Benchmark', chartLabel: 'The portfolio returned 6.4% over 12 months against 5.5% for its benchmark.', points: [{ label: 'Apr', value: 0.4, compare: 0.3 }, { label: 'Jun', value: 1.2, compare: 1.1 }, { label: 'Aug', value: 2.1, compare: 2.4 }, { label: 'Oct', value: 3.3, compare: 3.0 }, { label: 'Dec', value: 4.6, compare: 4.1 }, { label: 'Feb', value: 5.8, compare: 5.0 }, { label: 'Mar', value: 6.4, compare: 5.5 }] })
        ]),
        region('holdings', 'Holdings · 3 funds', [node('holdings-table', 'table', { caption: 'Holdings', sortable: true, columns: [{ label: 'Fund' }, { label: 'Value' }, { label: 'Weight' }], rows: [['Global equity fund', '€1,206,000', '67%'], ['Euro government bonds', '€450,000', '25%'], ['Cash', '€144,000', '8%']] })])
      ])
    },
    observations: [
      'Baseline: allocation as parts of a whole hides the target the decision depends on; the paragraph restates the figures; the proposal names no trades.',
      'Intent-aware: the finding in words, allocation against target on one scale, then the exact trades and their cost beside the decision. Performance supports, holdings wait.'
    ]
  },
  {
    id: 'statement-reconciliation',
    product: 'Cairn Advisory',
    title: 'Statement reconciliation',
    request: 'Reconcile the Lindqvist brokerage statement for March.',
    brief: {
      request: 'Reconcile the Lindqvist brokerage statement for March.',
      user,
      job: { primary: 'confirm the values read from the March Northgate statement before they update the household record', mode: 'review' },
      decisions: ['Which value to save for each difference', 'Whether to save the corrections now'],
      information: [
        { id: 'statement', label: 'Northgate March statement', kind: 'source-document', neededFor: ['which value to save'] },
        { id: 'differences', label: 'Values that differ from the record', kind: 'discrepancy', neededFor: ['which value to save'] },
        { id: 'impact', label: 'What saving changes', kind: 'impact', neededFor: ['save the corrections now'] },
        { id: 'matched', label: 'Values that match', kind: 'extracted-value', frequency: 'rare' },
        { id: 'extraction', label: 'How the statement was read', kind: 'history', frequency: 'rare' }
      ],
      actions: [{ label: 'Save corrections', kind: 'primary', consequential: true }, { label: 'Flag for operations', kind: 'secondary' }]
    },
    baseline: {
      derivation: 'The Release review screen (“a report someone has to trust before they act on it”) and the transaction pattern: a banner with the outcome, headline measures, the comparison, a text block that says what the numbers mean, the decision, and the evidence in labelled regions.',
      nodes: { statement: ['source-lines'], differences: ['compare'], matched: ['matched-list'], extraction: ['log-list'] },
      spec: screen('Lindqvist statement · March', 'stack', [
        node('status', 'banner', { tone: 'info', icon: 'info', message: 'Statement processed', detail: 'The March statement from Northgate was read and compared with the household record.' }),
        node('stats', 'stat-row', { stats: [{ label: 'Values read', value: '17', note: 'from 3 pages' }, { label: 'Matching', value: '14', note: 'of 17' }, { label: 'Different', value: '3', badge: 'Review', tone: 'warning', note: 'need a decision' }] }),
        node('compare', 'comparison-table', { caption: 'Household record against the statement', optionA: 'Record', optionB: 'Statement', rows: [
          { metric: 'Cash and sweep', a: '€42,180.00', b: '€38,940.55', advantage: 'Statement' }, { metric: 'Municipal bond fund', a: '1,200 units', b: '1,250 units', advantage: 'Statement' }, { metric: 'Advisory fee rate', a: '0.85%', b: '0.90%', advantage: 'Record' }
        ] }),
        node('what-changed', 'text-block', { body: 'What changed: several values in the household record differ from the statement. Saving the corrections will update the household’s balances and related figures, and may affect planning.' }),
        node('approve', 'approval-card', { title: 'Apply statement corrections', summary: 'Update the Lindqvist record with the values from the March statement.', detail: '3 values differ.', approveLabel: 'Apply', rejectLabel: 'Reject' }),
        region('source', 'Source document', [node('source-lines', 'metadata-list', { items: [{ label: 'Issuer', value: 'Northgate Securities' }, { label: 'Account', value: '••4471' }, { label: 'Pages', value: '6' }, { label: 'Period', value: 'March 2026' }] })]),
        region('matched', 'Matching values', [node('matched-list', 'metadata-list', { items: [{ label: 'Equity index fund', value: '3,410 units' }, { label: 'Global bond fund', value: '2,100 units' }, { label: 'Opening balance', value: '€1,204,330.18' }] })]),
        region('log', 'Extraction log', [node('log-list', 'activity-list', { items: [{ icon: 'file', title: 'Statement read', detail: '17 values from 3 pages', time: '08:12' }, { icon: 'check', title: 'Compared with the record', detail: '3 differences', time: '08:12' }] })])
      ], { pattern: 'transaction', purpose: 'Apply the March statement to the household record.', rationale: 'Outcome, evidence, decision, then provenance.' })
    },
    intent: {
      nodes: { statement: ['statement'], differences: ['differences'], impact: ['impact'], matched: ['matched-list'], extraction: ['extraction-list'] },
      actionNode: 'save',
      spec: screen('Lindqvist · March statement', 'split', [
        section('review', 'Three values differ from the record', [
          node('differences', 'value-diff', { caption: 'Northgate statement against the household record', fromLabel: 'In the record', toLabel: 'On the statement', choosable: true, useLabel: 'Use statement', keepLabel: 'Keep record', rows: [
            { field: 'Cash and sweep', from: '€42,180.00', to: '€38,940.55', note: 'Page 2 · line 14', ref: 'cash' },
            { field: 'Municipal bond fund', from: '1,200 units', to: '1,250 units', note: 'Page 3 · line 6', ref: 'muni' },
            { field: 'Advisory fee rate', from: '0.85%', to: '0.90%', note: 'Page 1 · line 22', ref: 'fee', status: 'conflict', keep: true }
          ] }),
          section('impact-section', 'What saving changes', [
            node('impact', 'value-diff', { caption: 'With the two statement values and the contract fee kept', fromLabel: 'Now', toLabel: 'After saving', rows: [
              { field: 'Household net worth', from: '€3,124,400', to: '€3,124,080' },
              { field: 'Cash reserve goal', from: '7.1 months covered', to: '6.5 months covered' },
              { field: 'Operations queue', from: 'No open flags', to: 'Fee rate flagged for review' }
            ] })
          ]),
          node('save', 'tool-approval', { title: 'Save two corrections?', question: 'Update cash and the bond fund from the statement, keep the contract fee rate, and flag it to operations.', scope: 'Lindqvist household record · balances and goals', approveLabel: 'Save corrections', rejectLabel: 'Not yet' }),
          region('matched', 'Values that match · 14', [node('matched-list', 'metadata-list', { items: [{ label: 'Opening balance', value: '€1,204,330.18' }, { label: 'Equity index fund', value: '3,410 units' }, { label: 'Global bond fund', value: '2,100 units' }, { label: 'Dividends received', value: '€1,812.40' }, { label: 'Closing balance', value: '€1,212,861.40' }, { label: 'and 9 more', value: 'Positions under €10,000' }] })]),
          region('extraction', 'How the statement was read', [node('extraction-list', 'activity-list', { items: [{ icon: 'file', title: 'Statement read', detail: '17 values from 3 pages', time: '08:12' }, { icon: 'check', title: 'Compared with the record', detail: '3 differences', time: '08:12' }] })])
        ], { emphasis: 'primary' }),
        section('source', 'Source', [
          node('statement', 'source-excerpt', { title: 'Northgate Securities · March 2026 statement', meta: 'Account ••4471 · pages 1 to 3', lines: [
            { label: 'Advisory fee rate', value: '0.90%', ref: 'fee', flagged: true },
            { label: 'Opening balance', value: '€1,204,330.18' },
            { label: 'Cash and sweep', value: '€38,940.55', ref: 'cash', flagged: true },
            { label: 'Equity index fund', value: '3,410 units' },
            { label: 'Municipal bond fund', value: '1,250 units', ref: 'muni', flagged: true },
            { label: 'Global bond fund', value: '2,100 units' },
            { label: 'Closing balance', value: '€1,212,861.40' }
          ] })
        ])
      ])
    },
    observations: [
      'Baseline: the statement is a list of its metadata in a closed region, the difference is a comparison table whose “advantage” column cannot say which value will be saved, and the summary says only that “several values” change.',
      'Intent-aware: the statement lines beside the three differences, linked both ways; a choice per value; the exact downstream changes; a decision that names what is saved and what is flagged.'
    ]
  },
  {
    id: 'firm-settings',
    product: 'Cairn Advisory',
    title: 'Firm settings',
    request: 'Build the firm settings page for Cairn Advisory.',
    brief: {
      request: 'Build the firm settings page for Cairn Advisory.',
      user: { role: 'Operations lead at Cairn Advisory', frequency: 'occasional' },
      job: { primary: 'adjust how the firm reviews plans and communicates with clients', mode: 'configure' },
      decisions: ['How often plans are reviewed', 'What clients are told automatically'],
      information: [
        { id: 'communication', label: 'Client communication', kind: 'setting', frequency: 'often' },
        { id: 'reviews', label: 'Reviews and approvals', kind: 'setting', frequency: 'often' },
        { id: 'advanced', label: 'Data retention and custodian sync', kind: 'setting', frequency: 'rare' }
      ],
      actions: [{ label: 'Save', kind: 'primary' }]
    },
    baseline: {
      derivation: 'The composition policy has no settings pattern; the transaction pattern lists form-and-configuration, and the registry’s decision role recommends Selectable cards. One form holds every setting, choices as option cards, with a banner explaining the scope.',
      nodes: { communication: ['toggles', 'meeting'], reviews: ['cadence', 'threshold'], advanced: ['retention'] },
      spec: screen('Firm settings', 'stack', [
        node('scope-note', 'banner', { tone: 'info', icon: 'info', message: 'These settings apply to every advisor', detail: 'Changes take effect for all households after you save.' }),
        section('settings', 'Settings', [
          node('cadence', 'selectable-cards', { question: 'How often are plans reviewed?', name: 'cadence', options: [{ title: 'Annually', description: 'One review a year', selected: true }, { title: 'Twice a year', description: 'Every six months' }, { title: 'Quarterly', description: 'Every three months' }] }),
          node('meeting', 'selectable-cards', { question: 'Default meeting format', name: 'meeting', options: [{ title: 'Video', description: 'A link is sent with the invite', selected: true }, { title: 'In person', description: 'At the Cairn office' }, { title: 'Client chooses', description: 'Asked when booking' }] }),
          node('toggles', 'switch', { label: 'Notifications and rules', items: [
            { label: 'Monthly summary email to clients', checked: true }, { label: 'Notify clients when a document is requested', checked: true }, { label: 'Share plan drafts before approval' },
            { label: 'Second approver for fee changes', checked: true }, { label: 'Sync with custodians nightly', checked: true }, { label: 'Delete closed household data after the retention period' }
          ] }),
          node('threshold', 'number-stepper', { label: 'Second approval above (€ thousands)', name: 'secondApproval', min: 0, max: 5000, step: 50, value: 250 }),
          node('retention', 'searchable-select', { label: 'Keep client documents for', name: 'retention', options: ['5 years', '7 years', '10 years'], value: '7 years' })
        ], { submit: 'Save settings' })
      ], { pattern: 'transaction', purpose: 'Firm settings.', rationale: 'One form with every setting.' })
    },
    intent: {
      nodes: { communication: ['communication'], reviews: ['reviews'], advanced: ['advanced-form'] },
      spec: screen('Firm settings', 'stack', [
        section('communication', 'Client communication', [
          node('client-emails', 'switch', { label: 'Tell clients automatically', items: [
            { label: 'Monthly summary email', description: 'Balances and next steps, on the 2nd of each month', checked: true },
            { label: 'Document requests', description: 'When an advisor asks for a form or statement', checked: true },
            { label: 'Plan drafts', description: 'Before an advisor approves them' }
          ] }),
          node('meeting', 'radio', { label: 'Default meeting format', name: 'meeting', options: [{ label: 'Video', value: 'video', checked: true }, { label: 'In person', value: 'office' }, { label: 'Client chooses when booking', value: 'choice' }] })
        ], { submit: 'Save communication' }),
        section('reviews', 'Reviews and approvals', [
          node('cadence', 'radio', { label: 'Plan review cadence', name: 'cadence', options: [{ label: 'Annually', value: 'year', checked: true }, { label: 'Twice a year', value: 'half' }, { label: 'Quarterly', value: 'quarter' }], hint: 'Households with a pending change are reviewed sooner.' }),
          node('threshold', 'number-stepper', { label: 'Second approval above (€ thousands)', name: 'secondApproval', min: 0, max: 5000, step: 50, value: 250, hint: 'Trades and transfers above this need a second advisor.' })
        ], { submit: 'Save review rules' }),
        region('advanced', 'Data retention and custodian sync', [
          section('advanced-form', 'Retention and sync', [
            node('retention', 'searchable-select', { label: 'Keep client documents for', name: 'retention', options: ['5 years', '7 years', '10 years'], value: '7 years', hint: 'Regulation requires at least 5 years.' }),
            node('sync', 'switch', { label: 'Custodian data', items: [{ label: 'Sync with custodians nightly', checked: true }, { label: 'Delete closed household data after the retention period' }] })
          ], { submit: 'Save data settings' })
        ])
      ])
    },
    observations: [
      'Baseline: every setting at once in one form, choices as bordered option cards, and a banner explaining scope; a rarely used deletion rule sits beside the monthly email.',
      'Intent-aware: two groups people change, each with its own save and the consequence in a hint; retention and sync one step away.'
    ]
  }
];
