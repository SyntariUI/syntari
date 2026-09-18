// Prepared data becomes a registry-validated screen; no report markup is authored here.
const node = (name, props) => ({ component: `syntari.${name}`, props });
export function buildScenario(name, data, period) {
  const current = data.views[period];
  if (!current) throw new Error('This period is not available.');
  const children = [node('stat-row', { stats: current.stats.map(stat => ({ badge: '', tone: 'neutral', ...stat })) })];
  if (current.rows) children.push(node('comparison-table', {
    caption: current.caption, optionA: current.optionA, optionB: current.optionB, rows: current.rows
  }));
  if (current.columns) children.push(node('chart-bars', {
    title: current.chartTitle, note: 'Illustrative data · values on the same scale',
    seriesA: current.seriesA, seriesB: current.seriesB,
    chartLabel: `${current.chartTitle}: Operations, Sales and Engineering`,
    columns: current.columns.map(column => ({ ...column, label: ({ Operations: 'Ops', Engineering: 'Eng' })[column.label] || column.label }))
  }));
  children.push({ type: 'region', label: name === 'policies' ? 'Read the policy clauses' : 'Findings and next steps', open: true,
    children: [node('metadata-list', { items: current.findings })] });
  children.push({ type: 'region', label: 'Sources and methodology', children: [node('metadata-list', { items: data.sources })] });
  return { version: 'syntari-ir-1', type: 'screen', title: current.title, layout: 'stack', children };
}
