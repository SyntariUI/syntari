import { test, expect } from '@playwright/test';
const origin = 'http://127.0.0.1:4398';

/* Render one or more nodes on the Screen IR page and return what the test reads from them. */
async function paint(page, children, read, options = {}) {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  return page.evaluate(async ({ children, read, options }) => {
    const { render } = await import('/ir.js');
    const requests = [];
    const result = await render({ type: 'screen', children }, document.querySelector('[data-ir-output]'), { onActionRequest: request => requests.push(request), ...options });
    await new Promise(resolve => setTimeout(resolve, 100));
    const errors = result.diagnostics.filter(d => d.severity === 'error').map(d => `${d.code} ${d.path}`);
    return { errors, requests, ...(await new Function('root', 'requests', `return (async () => { ${read} })()`)(result.element, requests)) };
  }, { children, read, options });
}

test('a donut chart draws each share where the ones before it end, in its own colour, named in the legend', async ({ page }) => {
  const out = await paint(page, [{ id: 'decisions', component: 'syntari.chart-donut', props: { title: 'Decisions this week', total: '96', unit: 'decisions', segments: [{ label: 'Approved', share: 62 }, { label: 'Waiting', share: 23 }, { label: 'Declined', share: 15 }] } }], `
    const segments = [...root.querySelectorAll('.donut-segment')];
    return {
      offsets: segments.map(s => Number(getComputedStyle(s).strokeDashoffset.match(/-?[\\d.]+/)[0])),
      colours: new Set(segments.map(s => getComputedStyle(s).stroke)).size,
      legend: [...root.querySelectorAll('.donut-legend li')].map(li => li.textContent.trim()),
      centre: [...root.querySelector('.donut-centre').children].map(part => part.textContent).join(' '),
      label: root.querySelector('.donut-wrap svg').getAttribute('aria-label')
    };`);
  expect(out.errors).toEqual([]);
  expect(out.offsets).toEqual([0, -62, -85]);
  expect(out.colours).toBe(3);
  expect(out.legend).toEqual(['Approved62%', 'Waiting23%', 'Declined15%']);
  expect(out.centre).toBe('96 decisions');
  expect(out.label).toBe('Decisions this week');
  const wrong = await paint(page, [{ component: 'syntari.chart-donut', props: { title: 'Split', segments: [{ label: 'A', share: 70 }, { label: 'B', share: 20 }] } }], 'return {};');
  expect(wrong.errors).toEqual(['wrong-sum children[0].props.segments']);
});

test('a heatmap is a table: every value has its row and column, the shade follows the value, and the scale names the range', async ({ page }) => {
  const rows = [{ label: 'Mon', values: [2, 14, 9, 4] }, { label: 'Wed', values: [3, 18, 12, 5] }, { label: 'Fri', values: [1, 6, 5, 1] }];
  const out = await paint(page, [{ id: 'runs', component: 'syntari.heatmap', props: { title: 'Failed runs by day and time', columns: ['Night', 'Morning', 'Afternoon', 'Evening'], rows, unit: 'runs' } }], `
    const table = root.querySelector('table.heat-table');
    const cell = (r, c) => table.tBodies[0].rows[r].cells[c + 1];
    return {
      caption: table.getAttribute('aria-label'),
      columns: [...table.tHead.querySelectorAll('th[scope=col]')].map(th => th.textContent),
      rowHeads: [...table.querySelectorAll('tbody th[scope=row]')].map(th => th.textContent),
      darkest: cell(1, 1).dataset.level, lightest: cell(2, 0).dataset.level, middle: cell(0, 2).dataset.level,
      tooltip: cell(1, 1).title, readout: cell(1, 1).textContent,
      scale: [...root.querySelectorAll('.heat-scale .hint')].map(hint => hint.textContent),
      role: root.querySelector('.heatmap').getAttribute('role')
    };`);
  expect(out.errors).toEqual([]);
  expect(out.caption).toBe('Failed runs by day and time');
  expect(out.columns).toEqual(['Night', 'Morning', 'Afternoon', 'Evening']);
  expect(out.rowHeads).toEqual(['Mon', 'Wed', 'Fri']);
  expect([out.darkest, out.lightest, out.middle]).toEqual(['4', '0', '2']);
  expect(out.tooltip).toBe('Wed · Morning: 18');
  expect(out.readout).toBe('18');
  expect(out.scale).toEqual(['1', '18 runs']);
  expect(out.role, 'a table needs no image role over it').toBeNull();
  const short = await paint(page, [{ component: 'syntari.heatmap', props: { title: 'Runs', columns: ['A', 'B', 'C'], rows: [{ label: 'Mon', values: [1, 2] }] } }], 'return {};');
  expect(short.errors).toEqual(['row-length children[0].props.rows[0].values']);
});

test('a treemap gives every tile the area of its value, keeps groups together, and names the groups', async ({ page }) => {
  const tiles = [{ label: 'EC2', value: 41.2, group: 'Compute' }, { label: 'Lambda', value: 6.1, group: 'Compute' }, { label: 'RDS', value: 18.3, group: 'Data' }, { label: 'S3', value: 12.4, group: 'Storage' }, { label: 'EBS', value: 7.9, group: 'Storage' }, { label: 'Other', value: 4.5 }];
  const out = await paint(page, [{ id: 'spend', component: 'syntari.treemap', props: { title: 'Cloud spend by service', tiles } }], `
    const list = root.querySelector('.treemap');
    const area = tile => parseFloat(tile.style.getPropertyValue('--w')) * parseFloat(tile.style.getPropertyValue('--h'));
    const nodes = [...list.querySelectorAll('.tree-tile')];
    const box = list.getBoundingClientRect();
    return {
      role: list.getAttribute('role'), name: list.getAttribute('aria-label'),
      areas: nodes.map(area), tones: nodes.map(tile => tile.dataset.tone),
      inside: nodes.every(tile => { const r = tile.getBoundingClientRect(); return r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1; }),
      legend: [...root.querySelectorAll('.tree-legend li')].map(li => li.textContent),
      shown: nodes[0].textContent
    };`);
  expect(out.errors).toEqual([]);
  expect(out.role).toBe('list');
  expect(out.name).toBe('Cloud spend by service');
  const total = out.areas.reduce((sum, area) => sum + area, 0);
  const sum = tiles.reduce((s, tile) => s + tile.value, 0);
  out.areas.forEach((area, i) => expect(Math.abs(area / total - tiles[i].value / sum), tiles[i].label).toBeLessThan(0.002));
  expect(out.tones).toEqual(['0', '0', '1', '2', '2', 'none']);
  expect(out.inside).toBe(true);
  expect(out.legend).toEqual(['Compute52%', 'Data20%', 'Storage22%']);
  expect(out.shown).toBe('EC246%');
  const empty = await paint(page, [{ component: 'syntari.treemap', props: { title: 'Spend', tiles: [{ label: 'A', value: 3 }, { label: 'B', value: 0 }] } }], 'return {};');
  expect(empty.errors).toEqual(['below-minimum children[0].props.tiles[1].value']);
});

test('progress, ring, badges, and avatars say what they mean in words, not only in colour', async ({ page }) => {
  const out = await paint(page, [
    { component: 'syntari.progress', props: { bars: [{ label: 'Storage used', value: 68 }, { label: 'Seats assigned', value: 42 }] } },
    { component: 'syntari.score', props: { title: 'Budget used', value: 91, detail: '$45.5k of $50k', tone: 'warning' } },
    { component: 'syntari.badge-and-status', props: { badges: [{ label: 'Failed', tone: 'critical', dot: true }, { label: 'Draft' }] } },
    { component: 'syntari.avatar-and-group', props: { people: [{ name: 'Ada Okafor', initials: 'AO' }, { name: 'Jamie Chen', initials: 'JC' }], others: 3, caption: 'Reviewers' } }
  ], `
    const bars = [...root.querySelectorAll('.progress')];
    const ring = root.querySelector('.ring');
    const badge = root.querySelector('.badge-row .badge');
    const avatars = [...root.querySelectorAll('.avatar-group .avatar')];
    const count = root.querySelector('.avatar-count');
    return {
      bars: bars.map(bar => [bar.getAttribute('aria-label'), bar.getAttribute('aria-valuenow'), Math.round(bar.firstElementChild.getBoundingClientRect().width / bar.getBoundingClientRect().width * 100)]),
      values: [...root.querySelectorAll('.progress-value')].map(v => v.textContent),
      ring: [ring.getAttribute('aria-label'), ring.getAttribute('aria-valuenow'), ring.querySelector('strong').textContent, ring.classList.contains('tone-warning'), ring.style.getPropertyValue('--ring-progress')],
      dot: getComputedStyle(badge.querySelector('.status-dot')).backgroundColor === getComputedStyle(badge).color,
      badgeText: badge.textContent.trim(), plainDot: getComputedStyle(root.querySelectorAll('.badge-row .badge')[1].querySelector('.status-dot')).display,
      people: avatars.map(a => [a.getAttribute('aria-label'), getComputedStyle(a, '::after').content]),
      countLast: count.getBoundingClientRect().left > avatars.at(-1).getBoundingClientRect().left, count: count.textContent,
      group: root.querySelector('.avatars').getAttribute('aria-label')
    };`);
  expect(out.errors).toEqual([]);
  expect(out.bars).toEqual([['Storage used', '68', 68], ['Seats assigned', '42', 42]]);
  expect(out.values).toEqual(['68%', '42%']);
  expect(out.ring).toEqual(['Budget used', '91', '91%', true, '91']);
  expect(out.dot, 'a critical badge never shows a green dot').toBe(true);
  expect(out.badgeText).toBe('Failed');
  expect(out.plainDot).toBe('none');
  expect(out.people).toEqual([['Ada Okafor', '"AO"'], ['Jamie Chen', '"JC"']]);
  expect(out.countLast).toBe(true);
  expect(out.count).toBe('+3');
  expect(out.group).toBe('Reviewers');
});

test('an error state asks the host to retry without running the demo, a plan counts its own tasks, and code keeps its lines', async ({ page }) => {
  const out = await paint(page, [
    { id: 'invoices-error', component: 'syntari.error-and-retry', props: { title: 'Couldn’t load the invoices', message: 'Your filters are kept.', action: 'Try again' } },
    { id: 'plan', component: 'syntari.agent-todo-list', props: { title: 'Migrate the billing tables', open: false, tasks: [{ label: 'Back up', state: 'done' }, { label: 'Copy rows', state: 'done' }, { label: 'Compare counts', state: 'failed' }, { label: 'Switch reads', state: 'skipped' }, { label: 'Clean up' }] } },
    { component: 'syntari.code-block', props: { title: 'deploy.sh', language: 'Shell', code: 'npm run build\nnpx wrangler deploy' } }
  ], `
    const retry = root.querySelector('.retry-demo .button');
    retry.click();
    await new Promise(resolve => setTimeout(resolve, 700));
    const tasks = [...root.querySelectorAll('.agent-tasks li')];
    return {
      retryText: retry.textContent.trim(), stillThere: root.contains(retry),
      count: root.querySelector('[data-todo-count]').textContent, open: root.querySelector('[data-syntari-contract=agent-todo-list] details').open,
      states: tasks.map(li => li.className.trim()), words: tasks.map(li => li.querySelector('small').textContent),
      footer: root.querySelector('[data-syntari-contract=agent-todo-list] .agent-footer'),
      code: root.querySelector('[data-syntari-contract=code-block] code').textContent,
      copy: root.querySelector('[data-syntari-contract=code-block] [data-agent-action=copy-code]')?.hasAttribute('data-syntari-action')
    };`);
  expect(out.errors).toEqual([]);
  expect(out.requests).toEqual([{ component: 'error-and-retry', action: 'retry', id: 'invoices-error', path: 'children[0]', consequential: false }]);
  expect(out.retryText).toBe('Try again');
  expect(out.stillThere).toBe(true);
  expect(out.count).toBe('2 of 5 completed');
  expect(out.open).toBe(false);
  expect(out.states).toEqual(['is-complete', 'is-complete', 'is-failed', 'is-skipped', '']);
  expect(out.words).toEqual(['Completed', 'Completed', 'Failed', 'Skipped', 'Pending']);
  expect(out.footer).toBeNull();
  expect(out.code).toBe('npm run build\nnpx wrangler deploy');
  expect(out.copy, 'copying is local, so the code block keeps its own copy button').toBe(false);
});
