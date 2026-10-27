/**
 * Generalization check: a customer support product, unrelated to the advisory benchmark. Halden Support and its customers
 * are fictional. Same two conditions as benchmarks/wealth.js; nothing in the planner knows these scenarios.
 */
const DEMO = { mode: 'demo', label: 'Halden Support is fictional; every ticket and figure is synthetic.' };
const screen = (title, layout, children, plan) => ({ version: 'syntari-ir-1', type: 'screen', title, layout, meta: { data: DEMO, ...(plan ? { plan } : {}) }, children });
const section = (id, heading, children, extra = {}) => ({ id, type: 'section', heading, ...extra, children });
const region = (id, label, children, open = false) => ({ id, type: 'region', label, ...(open ? { open } : {}), children });
const node = (id, component, props) => ({ id, component: `syntari.${component}`, props });

export const support = [
  {
    id: 'support-queue',
    product: 'Halden Support',
    title: 'Agent ticket queue',
    request: 'Build a customer support dashboard for our agents.',
    brief: {
      request: 'Build a customer support dashboard for our agents.',
      user: { role: 'Support agent, first line', frequency: 'continuous' },
      job: { primary: 'answer the tickets closest to breaching their response target first', mode: 'resolve' },
      decisions: ['Which ticket to answer next', 'Whether to escalate a ticket to the second line'],
      information: [
        { id: 'breaches', label: 'Tickets about to breach their target', kind: 'exception', exception: true },
        { id: 'tickets', label: 'Open tickets assigned to the agent', kind: 'pending-item', neededFor: ['choose the next ticket'] },
        { id: 'customer', label: 'The selected ticket’s customer', kind: 'entity-profile' },
        { id: 'conversation', label: 'The selected ticket’s last messages', kind: 'history' },
        { id: 'team', label: 'Team totals for today', kind: 'aggregate-metric', frequency: 'rare' }
      ],
      actions: [{ label: 'Reply to the most urgent ticket', kind: 'primary' }, { label: 'Escalate', kind: 'secondary' }]
    },
    baseline: {
      derivation: 'The request says “dashboard”: Analytics overview and the policy’s dashboard pattern. Headline measures, the principal analysis (tickets over time), then the records.',
      nodes: { tickets: ['tickets'], breaches: ['measures'], team: ['headline'] },
      spec: screen('Support dashboard', 'stack', [
        node('scope', 'filter-bar', { period: 'Today', periods: [{ label: 'Today', value: 'today' }, { label: 'This week', value: 'week' }], filtersLabel: 'Queues', settingsLabel: 'View' }),
        node('headline', 'headline-metric', { metrics: [{ label: 'Open tickets', value: '128', delta: '9.4%', direction: 'up' }, { label: 'First response', value: '2h 14m', delta: '12m', direction: 'down' }] }),
        node('measures', 'metric-strip', { items: [
          { label: 'Satisfaction', icon: 'star', value: '92%', delta: '1.2 pp', direction: 'up', meaning: 'of rated tickets', active: true },
          { label: 'Solved today', icon: 'check', value: '64', delta: '8', direction: 'up', meaning: 'by the team' },
          { label: 'About to breach', icon: 'clock', value: '2', delta: '1', direction: 'up', meaning: 'within 15 minutes' }
        ] }),
        node('trend', 'line-chart', { title: 'New tickets', note: 'Last 14 days', unit: '', chartLabel: 'New tickets per day over 14 days, between 38 and 61.', points: [{ label: 'D1', value: 44 }, { label: 'D2', value: 51 }, { label: 'D3', value: 38 }, { label: 'D4', value: 47 }, { label: 'D5', value: 55 }, { label: 'D6', value: 61 }, { label: 'D7', value: 49 }, { label: 'D8', value: 42 }, { label: 'D9', value: 46 }, { label: 'D10', value: 53 }, { label: 'D11', value: 58 }, { label: 'D12', value: 50 }, { label: 'D13', value: 45 }, { label: 'D14', value: 52 }] }),
        node('tickets', 'table', { caption: 'Recent tickets', sortable: true, columns: [{ label: 'Ticket' }, { label: 'Customer' }, { label: 'Subject' }, { label: 'Status' }], rows: [
          ['#48213', 'Halvorsen Bikes', 'Invoice shows the wrong VAT', 'Open'], ['#48207', 'Mira Café', 'Card reader offline', 'Open'], ['#48199', 'Northfield School', 'Cannot add a user', 'Pending'],
          ['#48188', 'Brightwater', 'Export to CSV fails', 'Open'], ['#48170', 'Okapi Studio', 'Change billing email', 'Pending'], ['#48164', 'Lumen Dental', 'Two-factor code not received', 'Open']
        ] }),
        region('sources', 'Where the numbers come from', [node('method', 'metadata-list', { items: [{ label: 'Counted', value: 'Tickets created in the help desk' }, { label: 'Satisfaction', value: 'Rated tickets, last 7 days' }] })])
      ], { pattern: 'dashboard', purpose: 'How support is doing today.', rationale: 'Measures, trend, then tickets.' })
    },
    intent: {
      nodes: { breaches: ['breach-banner'], tickets: ['tickets'], customer: ['customer'], conversation: ['conversation'], team: ['team-totals'] },
      actionNode: 'reply',
      spec: screen('Your tickets', 'split', [
        section('queue', 'Answer next', [
          node('breach-banner', 'banner', { tone: 'danger', icon: 'clock', message: 'Two tickets breach their response target within 15 minutes', detail: '#48213 Halvorsen Bikes and #48207 Mira Café. Both are first replies.' }),
          node('tickets', 'table', { caption: 'Your open tickets, closest to their target first', sortable: true, columns: [{ label: 'Target in' }, { label: 'Ticket' }, { label: 'Customer' }, { label: 'Priority' }], rows: [
            ['9 min', '#48213 Invoice shows the wrong VAT', 'Halvorsen Bikes', 'High'], ['14 min', '#48207 Card reader offline', 'Mira Café', 'Urgent'], ['1 h 20', '#48188 Export to CSV fails', 'Brightwater', 'Normal'],
            ['2 h 05', '#48164 Two-factor code not received', 'Lumen Dental', 'High'], ['3 h 40', '#48199 Cannot add a user', 'Northfield School', 'Normal'], ['Tomorrow', '#48170 Change billing email', 'Okapi Studio', 'Low']
          ] }),
          node('reply', 'button', { label: 'Reply to #48213', variant: 'primary' }),
          region('team', 'Team today', [node('team-totals', 'metadata-list', { items: [{ label: 'Open', value: '128 tickets, 9% more than yesterday' }, { label: 'First response', value: '2 h 14 m on average' }, { label: 'Satisfaction', value: '92% of rated tickets' }] })])
        ], { emphasis: 'primary' }),
        section('selected', '#48213 · Halvorsen Bikes', [
          node('customer', 'metadata-list', { items: [{ label: 'Plan', value: 'Business, 14 seats' }, { label: 'Waiting', value: '3 h 51 m, first reply' }, { label: 'Previous tickets', value: '2 this year, both billing' }] }),
          node('conversation', 'activity-list', { items: [{ icon: 'file', title: 'Invoice INV-2291 attached', detail: 'VAT at 25% instead of 12%', time: '08:14' }, { icon: 'info', title: 'Customer wrote', detail: '“Our accountant needs a corrected invoice today.”', time: '08:12' }] }),
          node('escalate', 'button', { label: 'Escalate to billing', variant: 'secondary' })
        ], { surface: 'panel' })
      ])
    },
    observations: [
      'Baseline: the agent’s screen leads with the team’s satisfaction and volume; their own tickets are “recent”, in no order a reply depends on.',
      'Intent-aware: breaches first, then the agent’s tickets by time to target, with the customer and last messages of the selected ticket beside them.'
    ]
  },
  {
    id: 'support-settings',
    product: 'Halden Support',
    title: 'Targets and routing settings',
    request: 'Settings for response targets and ticket routing.',
    brief: {
      request: 'Settings for response targets and ticket routing.',
      user: { role: 'Support team lead', frequency: 'occasional' },
      job: { primary: 'set response targets and how new tickets reach agents', mode: 'configure' },
      decisions: ['Response targets per priority', 'How new tickets are assigned'],
      information: [
        { id: 'targets', label: 'Response targets', kind: 'setting', frequency: 'often' },
        { id: 'routing', label: 'Routing', kind: 'setting', frequency: 'often' },
        { id: 'automation', label: 'Ticket automation', kind: 'setting', frequency: 'rare' }
      ],
      actions: [{ label: 'Save', kind: 'primary' }]
    },
    baseline: {
      derivation: 'No settings pattern exists; the registry’s decision role recommends Selectable cards, and a form section sends every field at once. Every setting is visible in one form.',
      nodes: { targets: ['urgent', 'high', 'normal'], routing: ['assignment', 'escalation'], automation: ['rules'] },
      spec: screen('Support settings', 'stack', [
        node('note', 'banner', { tone: 'info', icon: 'info', message: 'Changes apply to every queue', detail: 'Agents see new targets on their next ticket.' }),
        section('form', 'Settings', [
          node('assignment', 'selectable-cards', { question: 'How are new tickets assigned?', name: 'assignment', options: [{ title: 'Round robin', description: 'Each agent in turn', selected: true }, { title: 'Least busy', description: 'The agent with fewest open tickets' }, { title: 'Manual', description: 'A lead assigns each ticket' }] }),
          node('urgent', 'number-stepper', { label: 'Urgent: first reply within (minutes)', name: 'urgent', min: 5, max: 240, step: 5, value: 30 }),
          node('high', 'number-stepper', { label: 'High: first reply within (minutes)', name: 'high', min: 15, max: 480, step: 15, value: 120 }),
          node('normal', 'number-stepper', { label: 'Normal: first reply within (hours)', name: 'normal', min: 1, max: 72, step: 1, value: 8 }),
          node('rules', 'switch', { label: 'Rules', items: [{ label: 'Pause targets outside business hours', checked: true }, { label: 'Reopen solved tickets on reply', checked: true }, { label: 'Merge duplicate tickets automatically' }, { label: 'Close solved tickets after 7 days', checked: true }] }),
          node('escalation', 'searchable-select', { label: 'Escalation team', name: 'escalation', options: ['Billing', 'Hardware', 'Second line'], value: 'Second line' })
        ], { submit: 'Save settings' })
      ], { pattern: 'transaction', purpose: 'Support settings.', rationale: 'One form with every setting.' })
    },
    intent: {
      nodes: { targets: ['targets'], routing: ['routing'], automation: ['automation-form'] },
      spec: screen('Targets and routing', 'stack', [
        section('targets', 'Response targets', [
          node('urgent', 'number-stepper', { label: 'Urgent, first reply within (minutes)', name: 'urgent', min: 5, max: 240, step: 5, value: 30 }),
          node('high', 'number-stepper', { label: 'High, first reply within (minutes)', name: 'high', min: 15, max: 480, step: 15, value: 120 }),
          node('normal', 'number-stepper', { label: 'Normal, first reply within (hours)', name: 'normal', min: 1, max: 72, step: 1, value: 8, hint: 'Targets pause outside business hours.' })
        ], { submit: 'Save targets', layout: 'row' }),
        section('routing', 'Routing', [
          node('assignment', 'radio', { label: 'Assign new tickets', name: 'assignment', options: [{ label: 'To each agent in turn', value: 'round-robin', checked: true }, { label: 'To the least busy agent', value: 'least-busy' }, { label: 'Manually, by a lead', value: 'manual' }] }),
          node('escalation', 'searchable-select', { label: 'Escalate to', name: 'escalation', options: ['Billing', 'Hardware', 'Second line'], value: 'Second line' })
        ], { submit: 'Save routing' }),
        region('automation', 'Ticket automation', [
          section('automation-form', 'Automation', [
            node('rules', 'switch', { label: 'Automatically', items: [{ label: 'Reopen solved tickets on reply', checked: true }, { label: 'Merge duplicate tickets' }, { label: 'Close solved tickets after 7 days', checked: true }] })
          ], { submit: 'Save automation' })
        ])
      ])
    },
    observations: [
      'Baseline: assignment choices as cards, targets and rarely changed automation in one long form, one save for all.',
      'Intent-aware: targets and routing as two groups with their own saves; automation one step away.'
    ]
  }
];
