/**
 * The portfolio regression case. FLAWED reproduces the screen that failed review: every figure written by hand, a 38%
 * liquidity headline over holdings that add up to 48% for D0–D30, a liquidity chart that puts the day-30 bond in the wrong
 * bucket, a "risk" chart that is the allocation relabeled, and three single bars standing in for every analysis.
 * CANONICAL is the same portfolio with its rows in screen data and every figure bound to them.
 * Both are illustrative: no real holdings.
 */
export const HOLDINGS = [
  { asset: 'Interest-bearing account', assetClass: 'Cash', weight: 6, value: 600000, liquidityDays: 0, risk: 0.1 },
  { asset: 'Money market fund', assetClass: 'Cash', weight: 9, value: 900000, liquidityDays: 1, risk: 0.4 },
  { asset: '6-month Treasury bills', assetClass: 'Fixed income', weight: 7, value: 700000, liquidityDays: 2, risk: 0.5 },
  { asset: 'MSCI World ETF', assetClass: 'Equities', weight: 14, value: 1400000, liquidityDays: 3, risk: 28 },
  { asset: 'IG corporate bond 2029', assetClass: 'Fixed income', weight: 12, value: 1200000, liquidityDays: 30, risk: 6 },
  { asset: 'European equity fund', assetClass: 'Equities', weight: 13, value: 1300000, liquidityDays: 35, risk: 24 },
  { asset: 'High yield fund', assetClass: 'Fixed income', weight: 10, value: 1000000, liquidityDays: 60, risk: 8 },
  { asset: 'Multi-strategy hedge fund', assetClass: 'Alternatives', weight: 8, value: 800000, liquidityDays: 90, risk: 7 },
  { asset: 'Direct real estate', assetClass: 'Alternatives', weight: 10, value: 1000000, liquidityDays: 180, risk: 9 },
  { asset: 'Private equity Fund III', assetClass: 'Alternatives', weight: 11, value: 1100000, liquidityDays: 365, risk: 17 }
];
export const PERFORMANCE = [
  { month: 'Jan', portfolio: 0.8, benchmark: 0.6 }, { month: 'Feb', portfolio: 1.5, benchmark: 1.2 }, { month: 'Mar', portfolio: 0.9, benchmark: 1 },
  { month: 'Apr', portfolio: -0.6, benchmark: -0.2 }, { month: 'May', portfolio: 0.7, benchmark: 0.5 }, { month: 'Jun', portfolio: 2.1, benchmark: 1.4 },
  { month: 'Jul', portfolio: 2.9, benchmark: 2 }, { month: 'Aug', portfolio: 2.4, benchmark: 1.8 }, { month: 'Sep', portfolio: 3.6, benchmark: 2.7 }
];
const pct = n => `${n}%`;
const days = n => `${n} d`;

/** As the failed screen showed it: literals everywhere, three single bars, and numbers that disagree. */
export const FLAWED = {
  version: 'syntari-ir-1',
  type: 'screen',
  layout: 'stack',
  title: 'Ortega family portfolio summary',
  meta: { job: 'Review the quarter’s portfolio', audience: 'Wealth manager', decision: 'none', data: { mode: 'demo', label: 'Demonstration portfolio: illustrative values.' } },
  children: [
    { id: 'kpis', component: 'syntari.stat-row', props: { stats: [
      { label: 'Total assets', value: '$10M', note: 'As of September 30' },
      { label: 'YTD return', value: '+3.6%', badge: '+0.9 pp', note: 'Against the benchmark' },
      { label: 'Liquidity D0–D30', value: '38%', note: 'Available within 30 days', tone: 'warning' }
    ] }, provenance: { reason: 'The headline figures.' } },
    { id: 'total-headline', component: 'syntari.headline-metric', props: { metrics: [{ label: 'Total assets', value: '$10M', total: 'USD' }] }, provenance: { reason: 'The total value.' } },
    { id: 'section-allocation', type: 'section', heading: 'Allocation', children: [
      { id: 'allocation', component: 'syntari.breakdown', props: { title: 'Allocation by asset class', total: '$10M', segments: [
        { label: 'Cash', value: '15%', share: 15 }, { label: 'Fixed income', value: '29%', share: 29 }, { label: 'Equities', value: '27%', share: 27 }, { label: 'Alternatives', value: '29%', share: 29 }
      ] }, provenance: { reason: 'How the portfolio is split.' } }
    ] },
    { id: 'section-liquidity', type: 'section', heading: 'Liquidity', children: [
      { id: 'liquidity', component: 'syntari.breakdown', props: { title: 'Liquidity by horizon', total: '100%', segments: [
        { label: 'D0', value: '6%', share: 6 }, { label: 'D1–7', value: '30%', share: 30 }, { label: 'D8–30', value: '2%', share: 2 }, { label: 'D31–90', value: '41%', share: 41 }, { label: '>D90', value: '21%', share: 21 }
      ] }, provenance: { reason: 'How much can be sold, and when.' } }
    ] },
    { id: 'section-risk', type: 'section', heading: 'Risk', children: [
      { id: 'risk', component: 'syntari.breakdown', props: { title: 'Risk contribution', total: '100%', segments: [
        { label: 'Cash', value: '15%', share: 15 }, { label: 'Fixed income', value: '29%', share: 29 }, { label: 'Equities', value: '27%', share: 27 }, { label: 'Alternatives', value: '29%', share: 29 }
      ] }, provenance: { reason: 'Where the risk comes from.' } }
    ] },
    { id: 'section-positions', type: 'section', heading: 'Positions', children: [
      { id: 'holdings', component: 'syntari.table', props: { caption: 'Portfolio positions', columns: [{ label: 'Asset' }, { label: 'Class' }, { label: 'Weight' }, { label: 'Liquidity' }, { label: 'Risk' }],
        rows: HOLDINGS.map(row => [row.asset, row.assetClass, pct(row.weight), days(row.liquidityDays), pct(row.risk)]) }, provenance: { reason: 'The detail of each position.' } }
    ] },
    { id: 'summary', component: 'syntari.text-block', props: { body: 'The portfolio has 38% liquidity within 30 days, and its risk is spread across the four asset classes.' }, provenance: { reason: 'Sums up the above.' } }
  ]
};

export const DATA = {
  mode: 'demo',
  label: 'Demonstration portfolio: illustrative values, not real positions.',
  currency: 'USD',
  locale: 'en-US',
  asOf: '2026-09-30',
  tables: {
    holdings: {
      label: 'Positions', key: 'asset',
      fields: {
        asset: { type: 'text', label: 'Asset' },
        assetClass: { type: 'category', label: 'Asset class', order: ['Cash', 'Fixed income', 'Equities', 'Alternatives'] },
        weight: { type: 'percent', label: 'Weight', total: 100, role: 'allocation' },
        value: { type: 'currency', label: 'Value' },
        liquidityDays: { type: 'days', label: 'Liquidity', role: 'liquidity' },
        risk: { type: 'percent', label: 'Risk contribution', total: 100, role: 'risk-contribution' }
      },
      rows: HOLDINGS
    },
    performance: {
      label: '2026 cumulative return',
      fields: { month: { type: 'period', label: 'Month' }, portfolio: { type: 'percent', label: 'Portfolio', role: 'return' }, benchmark: { type: 'percent', label: 'Benchmark', role: 'benchmark' } },
      rows: PERFORMANCE
    }
  },
  measures: {
    totalValue: { label: 'Total assets', sum: 'holdings.value', format: 'compact-currency', digits: 0 },
    liquid30: { label: 'Liquidity D0–D30', sum: 'holdings.weight', where: { liquidityDays: { max: 30 } }, format: 'percent', digits: 0 },
    ytd: { label: 'YTD return', last: 'performance.portfolio', format: 'signed-percent' },
    ytdBenchmark: { label: 'Benchmark YTD', last: 'performance.benchmark', format: 'signed-percent' },
    excess: { label: 'Against the benchmark', formula: 'ytd - ytdBenchmark', format: 'points' }
  },
  groups: {
    allocation: { label: 'Allocation by class', table: 'holdings', by: 'assetClass', values: ['weight', 'value'] },
    liquidity: { label: 'Liquidity ladder', table: 'holdings', by: 'liquidityDays', value: 'weight', buckets: [{ label: 'D0', max: 0 }, { label: 'D1–7', max: 7 }, { label: 'D8–30', max: 30 }, { label: 'D31–90', max: 90 }, { label: '>D90' }] },
    riskVsWeight: { label: 'Weight against risk', table: 'holdings', by: 'assetClass', values: ['weight', 'risk'] }
  }
};

/** The same portfolio composed as a dashboard: summary, principal analysis, supporting comparisons, then positions. */
export const CANONICAL = {
  version: 'syntari-ir-1',
  type: 'screen',
  layout: 'stack',
  title: 'The Ortega portfolio is up 3.6% this year, 0.9 points ahead of its benchmark',
  meta: { job: 'Review the quarter’s portfolio', audience: 'Wealth manager', decision: 'none', plan: { pattern: 'dashboard', purpose: 'Know how the portfolio is doing, how much of it can move, and where the risk comes from.', questions: ['How is it doing against the benchmark?', 'How much is liquid within 30 days?', 'Where does the risk come from?'] } },
  data: DATA,
  children: [
    { id: 'summary-kpis', component: 'syntari.stat-row', props: { stats: [
      { label: 'Total assets', value: { $data: 'measures.totalValue' }, note: 'As of September 30', tone: 'neutral' },
      { label: 'YTD return', value: { $data: 'measures.ytd' }, badge: { $data: 'measures.excess' }, note: 'Against the benchmark' },
      { label: 'Liquidity D0–D30', value: { $data: 'measures.liquid30' }, note: 'Available within 30 days', tone: 'neutral' }
    ] }, provenance: { reason: 'The three measures the review opens with.' } },
    { id: 'performance', component: 'syntari.line-chart', props: { title: 'Cumulative return against the benchmark', note: 'January to September', unit: '%', seriesA: 'Portfolio', seriesB: 'Benchmark',
      chartLabel: 'The portfolio is up 3.6% against 2.7% for the benchmark; only April dipped below zero.',
      points: { $data: 'tables.performance', map: { label: 'month', value: 'portfolio', compare: 'benchmark' } } }, provenance: { reason: 'The main story: how it is doing against its reference.' } },
    { id: 'section-structure', type: 'section', heading: 'Where the money is and when it can move', layout: 'two-column', children: [
      { id: 'allocation', component: 'syntari.breakdown', props: { title: 'Allocation by asset class', total: { $data: 'measures.totalValue' }, segments: { $data: 'groups.allocation', map: { label: 'label', share: 'share', value: { field: 'value', format: 'compact-currency' } } } }, provenance: { reason: 'Parts of one whole.' } },
      { id: 'liquidity-ladder', component: 'syntari.chart-bars', props: { title: 'Liquidity ladder', note: 'Weight by time to sell', orientation: 'vertical', unit: '%', seriesA: 'Weight',
        chartLabel: 'Weight by liquidity horizon: D0 6%, D1–7 30%, D8–30 12%, D31–90 31%, over 90 days 21%.',
        columns: { $data: 'groups.liquidity', map: { label: 'label', a: 'value' } } }, provenance: { reason: 'Buckets in their order of time.' } }
    ] },
    { id: 'risk-vs-weight', component: 'syntari.chart-bars', props: { title: 'Weight against risk contribution', note: 'By asset class', unit: '%', seriesA: 'Weight', seriesB: 'Risk',
      chartLabel: 'Equities weigh 27% and bring 52% of the risk; cash weighs 15% and brings almost none.',
      columns: { $data: 'groups.riskVsWeight', map: { label: 'label', a: 'weight', b: 'risk' } } }, provenance: { reason: 'Risk compared with weight, not weight under another name.' } },
    { id: 'section-positions', type: 'section', heading: 'Positions', children: [
      { id: 'holdings', component: 'syntari.table', props: { caption: 'Portfolio positions', sortable: true, columns: [{ label: 'Asset' }, { label: 'Class' }, { label: 'Weight' }, { label: 'Value' }, { label: 'Liquidity' }, { label: 'Risk' }],
        rows: { $data: 'tables.holdings', sort: { by: 'weight', dir: 'desc' }, cells: ['asset', 'assetClass', { field: 'weight', format: 'percent' }, { field: 'value', format: 'compact-currency' }, { field: 'liquidityDays', format: 'days' }, { field: 'risk', format: 'percent' }] } }, provenance: { reason: 'The detail, last and sortable.' } }
    ] }
  ]
};
