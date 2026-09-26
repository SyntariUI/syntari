const screen = (title, layout, children) => ({ version: 'syntari-ir-1', type: 'screen', layout, title, children });

/** Two render modes of the same renderer: a report to read, and a tool to drive. */
export const modes = {
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

modes.approval = {
  title: 'Approval',
  intent: 'A consequential change needs a clear review before a person authorizes it.',
  does: 'Show the proposed action, affected scope, and the evidence a reviewer needs.',
  spec: screen('Review before applying changes', 'stack', [
    { component: 'syntari.banner', props: { message: 'Approval needed', detail: 'The agent has prepared a change and is waiting for a decision.', tone: 'info', icon: 'circlecheck' } },
    { component: 'syntari.tool-approval', props: { title: 'Run the migration?', question: 'Apply three schema changes to the billing database.', scope: 'Billing production · write access', hint: 'Review the plan and scope before authorizing.' } },
    { component: 'syntari.metadata-list', props: { items: [
      { label: 'Requested by', value: 'Migration assistant' },
      { label: 'Environment', value: 'Production' },
      { label: 'Change', value: 'Three schema changes' }
    ] } }
  ])
};
