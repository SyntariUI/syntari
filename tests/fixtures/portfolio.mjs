/**
 * The portfolio regression case. FLAWED reproduces the screen that failed review: every figure written by hand, a 38%
 * liquidity headline over holdings that add up to 48% for D0–D30, a liquidity chart that puts the day-30 bond in the wrong
 * bucket, a "risk" chart that is the allocation relabeled, and three single bars standing in for every analysis.
 * CANONICAL is the same portfolio with its rows in screen data and every figure bound to them.
 * Both are illustrative: no real holdings.
 */
export const HOLDINGS = [
  { asset: 'Cuenta remunerada', assetClass: 'Liquidez', weight: 6, value: 600000, liquidityDays: 0, risk: 0.1 },
  { asset: 'Fondo monetario EUR', assetClass: 'Liquidez', weight: 9, value: 900000, liquidityDays: 1, risk: 0.4 },
  { asset: 'Letras del Tesoro 6M', assetClass: 'Renta fija', weight: 7, value: 700000, liquidityDays: 2, risk: 0.5 },
  { asset: 'ETF MSCI World', assetClass: 'Renta variable', weight: 14, value: 1400000, liquidityDays: 3, risk: 28 },
  { asset: 'Bono corporativo IG 2029', assetClass: 'Renta fija', weight: 12, value: 1200000, liquidityDays: 30, risk: 6 },
  { asset: 'Fondo RV Europa', assetClass: 'Renta variable', weight: 13, value: 1300000, liquidityDays: 35, risk: 24 },
  { asset: 'Fondo high yield', assetClass: 'Renta fija', weight: 10, value: 1000000, liquidityDays: 60, risk: 8 },
  { asset: 'Hedge fund multiestrategia', assetClass: 'Alternativos', weight: 8, value: 800000, liquidityDays: 90, risk: 7 },
  { asset: 'Inmobiliario directo', assetClass: 'Alternativos', weight: 10, value: 1000000, liquidityDays: 180, risk: 9 },
  { asset: 'Private equity Fund III', assetClass: 'Alternativos', weight: 11, value: 1100000, liquidityDays: 365, risk: 17 }
];
export const PERFORMANCE = [
  { month: 'Ene', portfolio: 0.8, benchmark: 0.6 }, { month: 'Feb', portfolio: 1.5, benchmark: 1.2 }, { month: 'Mar', portfolio: 0.9, benchmark: 1 },
  { month: 'Abr', portfolio: -0.6, benchmark: -0.2 }, { month: 'May', portfolio: 0.7, benchmark: 0.5 }, { month: 'Jun', portfolio: 2.1, benchmark: 1.4 },
  { month: 'Jul', portfolio: 2.9, benchmark: 2 }, { month: 'Ago', portfolio: 2.4, benchmark: 1.8 }, { month: 'Sep', portfolio: 3.6, benchmark: 2.7 }
];
const pct = n => `${String(n).replace('.', ',')} %`;
const days = n => `${n} d`;

/** As the failed screen showed it: literals everywhere, three single bars, and numbers that disagree. */
export const FLAWED = {
  version: 'syntari-ir-1',
  type: 'screen',
  layout: 'stack',
  title: 'Resumen de la cartera de Familia Ortega',
  meta: { job: 'Revisar la cartera del trimestre', audience: 'Gestor patrimonial', decision: 'none', data: { mode: 'demo', label: 'Cartera de demostración: valores ilustrativos.' } },
  children: [
    { id: 'kpis', component: 'syntari.stat-row', props: { stats: [
      { label: 'Patrimonio', value: '10 M€', note: 'A 30 de septiembre' },
      { label: 'Rentabilidad YTD', value: '+3,6 %', badge: '+0,9 pp', note: 'Frente al benchmark' },
      { label: 'Liquidez D0–D30', value: '38 %', note: 'Disponible en 30 días', tone: 'warning' }
    ] }, provenance: { reason: 'Las cifras principales.' } },
    { id: 'total-headline', component: 'syntari.headline-metric', props: { metrics: [{ label: 'Patrimonio', value: '10 M€', total: 'EUR' }] }, provenance: { reason: 'El patrimonio total.' } },
    { id: 'section-asignacion', type: 'section', heading: 'Asignación', children: [
      { id: 'allocation', component: 'syntari.breakdown', props: { title: 'Asignación por clase de activo', total: '10 M€', segments: [
        { label: 'Liquidez', value: '15 %', share: 15 }, { label: 'Renta fija', value: '29 %', share: 29 }, { label: 'Renta variable', value: '27 %', share: 27 }, { label: 'Alternativos', value: '29 %', share: 29 }
      ] }, provenance: { reason: 'Cómo se reparte la cartera.' } }
    ] },
    { id: 'section-liquidez', type: 'section', heading: 'Liquidez', children: [
      { id: 'liquidity', component: 'syntari.breakdown', props: { title: 'Liquidez por plazo', total: '100 %', segments: [
        { label: 'D0', value: '6 %', share: 6 }, { label: 'D1–7', value: '30 %', share: 30 }, { label: 'D8–30', value: '2 %', share: 2 }, { label: 'D31–90', value: '41 %', share: 41 }, { label: '>D90', value: '21 %', share: 21 }
      ] }, provenance: { reason: 'Cuánto se puede vender y cuándo.' } }
    ] },
    { id: 'section-riesgo', type: 'section', heading: 'Riesgo', children: [
      { id: 'risk', component: 'syntari.breakdown', props: { title: 'Contribución al riesgo', total: '100 %', segments: [
        { label: 'Liquidez', value: '15 %', share: 15 }, { label: 'Renta fija', value: '29 %', share: 29 }, { label: 'Renta variable', value: '27 %', share: 27 }, { label: 'Alternativos', value: '29 %', share: 29 }
      ] }, provenance: { reason: 'De dónde viene el riesgo.' } }
    ] },
    { id: 'section-posiciones', type: 'section', heading: 'Posiciones', children: [
      { id: 'holdings', component: 'syntari.table', props: { caption: 'Posiciones de la cartera', columns: [{ label: 'Activo' }, { label: 'Clase' }, { label: 'Peso' }, { label: 'Liquidez' }, { label: 'Riesgo' }],
        rows: HOLDINGS.map(row => [row.asset, row.assetClass, pct(row.weight), days(row.liquidityDays), pct(row.risk)]) }, provenance: { reason: 'El detalle de cada posición.' } }
    ] },
    { id: 'summary', component: 'syntari.text-block', props: { body: 'La cartera tiene una liquidez del 38 % a 30 días y un riesgo repartido entre las cuatro clases de activo.' }, provenance: { reason: 'Resume lo anterior.' } }
  ]
};

export const DATA = {
  mode: 'demo',
  label: 'Cartera de demostración: valores ilustrativos, no posiciones reales.',
  currency: 'EUR',
  locale: 'es-ES',
  asOf: '2026-09-30',
  tables: {
    holdings: {
      label: 'Posiciones', key: 'asset',
      fields: {
        asset: { type: 'text', label: 'Activo' },
        assetClass: { type: 'category', label: 'Clase de activo', order: ['Liquidez', 'Renta fija', 'Renta variable', 'Alternativos'] },
        weight: { type: 'percent', label: 'Peso', total: 100, role: 'allocation' },
        value: { type: 'currency', label: 'Valor' },
        liquidityDays: { type: 'days', label: 'Liquidez', role: 'liquidity' },
        risk: { type: 'percent', label: 'Contribución al riesgo', total: 100, role: 'risk-contribution' }
      },
      rows: HOLDINGS
    },
    performance: {
      label: 'Rentabilidad acumulada 2026',
      fields: { month: { type: 'period', label: 'Mes' }, portfolio: { type: 'percent', label: 'Cartera', role: 'return' }, benchmark: { type: 'percent', label: 'Benchmark', role: 'benchmark' } },
      rows: PERFORMANCE
    }
  },
  measures: {
    totalValue: { label: 'Patrimonio', sum: 'holdings.value', format: 'compact-currency', digits: 0 },
    liquid30: { label: 'Liquidez D0–D30', sum: 'holdings.weight', where: { liquidityDays: { max: 30 } }, format: 'percent', digits: 0 },
    ytd: { label: 'Rentabilidad YTD', last: 'performance.portfolio', format: 'signed-percent' },
    ytdBenchmark: { label: 'Benchmark YTD', last: 'performance.benchmark', format: 'signed-percent' },
    excess: { label: 'Frente al benchmark', formula: 'ytd - ytdBenchmark', format: 'points' }
  },
  groups: {
    allocation: { label: 'Asignación por clase', table: 'holdings', by: 'assetClass', value: 'weight' },
    liquidity: { label: 'Escalera de liquidez', table: 'holdings', by: 'liquidityDays', value: 'weight', buckets: [{ label: 'D0', max: 0 }, { label: 'D1–7', max: 7 }, { label: 'D8–30', max: 30 }, { label: 'D31–90', max: 90 }, { label: '>D90' }] },
    riskVsWeight: { label: 'Peso frente a riesgo', table: 'holdings', by: 'assetClass', values: ['weight', 'risk'] }
  }
};

/** The same portfolio composed as a dashboard: summary, principal analysis, supporting comparisons, then positions. */
export const CANONICAL = {
  version: 'syntari-ir-1',
  type: 'screen',
  layout: 'stack',
  title: 'La cartera Ortega gana un 3,6 % este año, 0,9 puntos por encima de su benchmark',
  meta: { job: 'Revisar la cartera del trimestre', audience: 'Gestor patrimonial', decision: 'none', plan: { pattern: 'dashboard', purpose: 'Saber cómo va la cartera, cuánto se puede mover y de dónde viene el riesgo.', questions: ['¿Cómo va frente al benchmark?', '¿Cuánto es líquido a 30 días?', '¿De dónde viene el riesgo?'] } },
  data: DATA,
  children: [
    { id: 'summary-kpis', component: 'syntari.stat-row', props: { stats: [
      { label: 'Patrimonio', value: { $data: 'measures.totalValue' }, note: 'A 30 de septiembre', tone: 'neutral' },
      { label: 'Rentabilidad YTD', value: { $data: 'measures.ytd' }, badge: { $data: 'measures.excess' }, note: 'Frente al benchmark' },
      { label: 'Liquidez D0–D30', value: { $data: 'measures.liquid30' }, note: 'Disponible en 30 días', tone: 'neutral' }
    ] }, provenance: { reason: 'Las tres medidas que abren la revisión.' } },
    { id: 'performance', component: 'syntari.line-chart', props: { title: 'Rentabilidad acumulada frente al benchmark', note: 'Enero a septiembre', unit: '%', seriesA: 'Cartera', seriesB: 'Benchmark',
      chartLabel: 'La cartera acumula un 3,6 % frente al 2,7 % del benchmark; solo abril quedó por debajo de cero.',
      points: { $data: 'tables.performance', map: { label: 'month', value: 'portfolio', compare: 'benchmark' } } }, provenance: { reason: 'La historia principal: cómo va frente a su referencia.' } },
    { id: 'section-structure', type: 'section', heading: 'Dónde está el dinero y cuándo se puede mover', layout: 'two-column', children: [
      { id: 'allocation', component: 'syntari.breakdown', props: { title: 'Asignación por clase de activo', total: { $data: 'measures.totalValue' }, segments: { $data: 'groups.allocation', map: { label: 'label', share: 'share', value: { field: 'value', format: 'percent', digits: 0 } } } }, provenance: { reason: 'Partes de un todo.' } },
      { id: 'liquidity-ladder', component: 'syntari.chart-bars', props: { title: 'Escalera de liquidez', note: 'Peso por plazo de venta', orientation: 'vertical', unit: '%', seriesA: 'Peso',
        chartLabel: 'Peso por plazo de liquidez: D0 6 %, D1–7 30 %, D8–30 12 %, D31–90 31 %, más de 90 días 21 %.',
        columns: { $data: 'groups.liquidity', map: { label: 'label', a: 'value' } } }, provenance: { reason: 'Buckets ordenados por plazo.' } }
    ] },
    { id: 'risk-vs-weight', component: 'syntari.chart-bars', props: { title: 'Peso frente a contribución al riesgo', note: 'Por clase de activo', unit: '%', seriesA: 'Peso', seriesB: 'Riesgo',
      chartLabel: 'La renta variable pesa un 27 % y aporta el 52 % del riesgo; la liquidez pesa un 15 % y apenas aporta riesgo.',
      columns: { $data: 'groups.riskVsWeight', map: { label: 'label', a: 'weight', b: 'risk' } } }, provenance: { reason: 'El riesgo comparado con el peso, no el peso con otro nombre.' } },
    { id: 'section-positions', type: 'section', heading: 'Posiciones', children: [
      { id: 'holdings', component: 'syntari.table', props: { caption: 'Posiciones de la cartera', sortable: true, columns: [{ label: 'Activo' }, { label: 'Clase' }, { label: 'Peso' }, { label: 'Valor' }, { label: 'Liquidez' }, { label: 'Riesgo' }],
        rows: { $data: 'tables.holdings', sort: { by: 'weight', dir: 'desc' }, cells: ['asset', 'assetClass', { field: 'weight', format: 'percent' }, { field: 'value', format: 'compact-currency' }, { field: 'liquidityDays', format: 'days' }, { field: 'risk', format: 'percent' }] } }, provenance: { reason: 'El detalle, al final y ordenable.' } }
    ] }
  ]
};
