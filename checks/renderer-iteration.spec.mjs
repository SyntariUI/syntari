import { test, expect } from '@playwright/test';
import { serveRenderer, openRenderer, script, prompts, ask, settled, screenIR, nodesById, shown } from './renderer-harness.mjs';

serveRenderer(test);

/* ---------- Scripted answers ---------- */
const absenteeism = {
  version: 'syntari-ir-1', type: 'screen',
  meta: { job: 'Understand why absence rose at Acme SL', audience: 'HR lead', decision: 'none', outline: [{ node: 'headline-metric' }, { section: 'How absence moved month by month', layout: 'stack', nodes: ['area-chart', 'text-block'] }, { section: 'Where absence comes from', layout: 'two-column', nodes: ['breakdown', 'table'] }] },
  title: 'Absenteeism at Acme SL rose to 4.8% in the last 3 months, up from 3.6%', layout: 'stack',
  children: [
    { component: 'syntari.headline-metric', props: { metrics: [{ label: 'Absence rate, latest month', value: '4.8%', total: 'of days', delta: '+1.2 pts', direction: 'up' }] }, provenance: { reason: 'The number the report is about.' } },
    { type: 'section', heading: 'How absence moved month by month', children: [
      { component: 'syntari.area-chart', props: { title: 'Weekly absence rate, last 13 weeks', note: 'Share of scheduled days lost, %', chartLabel: 'Weekly absence rose from 3.6% to 4.8% over 13 weeks', points: [{ label: 'W1', value: 3.6 }, { label: 'W3', value: 3.7 }, { label: 'W5', value: 3.6 }, { label: 'W7', value: 4.1 }, { label: 'W9', value: 4.3 }, { label: 'W11', value: 4.6 }, { label: 'W13', value: 4.8 }] }, provenance: { reason: 'Shows when the rise began.' } },
      { component: 'syntari.text-block', props: { body: 'Absence was flat for six weeks, then climbed. The increase tracks short sick leave and sits in Customer Support and Operations.' }, provenance: { reason: 'Explains the trend.' } }
    ] },
    { type: 'section', heading: 'Where absence comes from', layout: 'two-column', children: [
      { component: 'syntari.breakdown', props: { title: 'Absent days by reason', total: '1,240 days', segments: [{ label: 'Short sick leave', value: '620 days', share: 50 }, { label: 'Long-term leave', value: '400 days', share: 32 }, { label: 'Other', value: '220 days', share: 18 }] }, provenance: { reason: 'What the absence is made of.' } },
      { component: 'syntari.table', props: { caption: 'Absence rate by department', columns: [{ label: 'Department' }, { label: 'Absence rate' }, { label: 'Change' }], rows: [['Customer Support', '7.1%', '+2.4 pts'], ['Operations', '5.9%', '+1.8 pts'], ['Sales', '3.8%', '+0.5 pts']] }, provenance: { reason: 'Where it is concentrated.' } }
    ] }
  ]
};
const turnover = {
  version: 'syntari-ir-1', type: 'screen', meta: { job: 'See staff turnover at Acme SL', audience: 'HR lead', decision: 'none', outline: [{ node: 'headline-metric' }, { node: 'text-block' }] },
  title: 'Turnover at Acme SL is 11% a year, highest in Customer Support', layout: 'stack',
  children: [
    { component: 'syntari.headline-metric', props: { metrics: [{ label: 'Annual turnover', value: '11%', total: 'of staff', delta: '+2 pts', direction: 'up' }] }, provenance: { reason: 'The headline figure.' } },
    { component: 'syntari.text-block', props: { body: 'Most leavers come from Customer Support, within their first year.' }, provenance: { reason: 'Where turnover concentrates.' } }
  ]
};
const ops = (operations, extra = {}) => JSON.stringify({ version: 'syntari-ops-1', base: '{{BASE}}', ...extra, operations });
const employeeSection = { id: 'employee-absence', type: 'section', heading: 'Absence by employee', children: [{ id: 'employee-absence-table', component: 'syntari.table', props: { caption: 'Absence days by employee, last 3 months', columns: [{ label: 'Employee' }, { label: 'Department' }, { label: 'Absence days' }], rows: [['Marta Keller', 'Customer Support', '9'], ['Daniel Osei', 'Operations', '8'], ['Priya Raman', 'Customer Support', '7']] }, provenance: { reason: 'The person asked for employees under the chart.' } }] };
const addEmployees = ops([{ op: 'insert', parent: 'section-how-absence-moved-month', after: 'area-chart', node: employeeSection, reason: 'Requested: a table of employees under the chart' }], { summary: 'Add a table of employees under the chart' });
const renameEmployees = ops([{ op: 'replace', target: 'employee-absence', set: { heading: 'Employees with the most absence' }, reason: 'Requested: a new title for the new table' }], { summary: 'Rename the employee table' });
const removeEmployees = ops([{ op: 'remove', target: 'employee-absence', reason: 'Requested: delete the employee table' }], { summary: 'Remove the employee table' });

async function createAbsenteeism(p) {
  await p.locator('[data-bar-new]').click();
  await expect(p.locator('[data-composer-context] .mode-chip')).toHaveText('New screen');
  await script(p, JSON.stringify(absenteeism));
  await p.locator('[data-prompt]').fill('Create a report on absenteeism at Acme SL for the last 3 months, with metrics, a chart and tables');
  await p.locator('[data-generate]').click();
  await settled(p);
  await expect(p.locator('[data-context-title]')).toHaveText(absenteeism.title);
}

test('1. a new report is created as its own screen: stable ids, labelled demonstration data, version 1', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await expect(p.locator('[data-bar-mode]')).toHaveText(/^Editing · Q4 access review/);
  await createAbsenteeism(p);
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v1 · Claude/);
  await expect(p.locator('.canvas .ir-data-note')).toContainText('Demonstration data');
  expect(await p.$$eval('.canvas [data-ir-id]', nodes => nodes.map(node => node.dataset.irId))).toEqual(['headline-metric', 'section-how-absence-moved-month', 'area-chart', 'text-block', 'section-where-absence-comes-from', 'breakdown', 'table']);
  await expect(p.locator('.canvas .headline-number')).toHaveText('4.8%');
  await expect(p.locator('.canvas [data-ir-component=area-chart]')).toHaveCount(1);
  await expect(p.locator('.canvas [data-ir-component=table] tbody tr')).toHaveCount(3);
  const spec = await screenIR(p);
  expect(spec.meta.data.mode).toBe('demo');
  /* The composer now edits this screen by default. */
  await expect(p.locator('[data-bar-mode]')).toHaveText(/^Editing · Absenteeism at Acme SL/);
  await p.locator('[data-trigger]').click();
  await expect(p.locator('[data-generate]')).toHaveText('Update');
  await p.locator('[data-composer-close]').click();
  /* The bundled example opened at start is still in the session. */
  await p.locator('[data-screens-toggle]').click();
  await expect(p.locator('[data-screens] button')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('2. adding a table streams into place under the chart; everything else stays identical', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await createAbsenteeism(p);
  const before = await screenIR(p), shownBefore = await shown(p);
  await script(p, { text: addEmployees, pauseAfter: '"component":"syntari.table",' });
  await ask(p, 'Añade una tabla de empleados debajo del gráfico');
  /* The bar shows the request being processed, not the one the screen came from. */
  await expect(p.locator('[data-live-request]')).toHaveText('Añade una tabla de empleados debajo del gráfico');
  await expect.poll(() => p.evaluate(() => window.__claude.paused)).toBe(true);
  /* A localized skeleton, right after the chart; the original screen is still there. */
  const slot = p.locator('.canvas [data-edit-slot]');
  await expect(slot).toHaveCount(1);
  expect(await slot.evaluate(node => node.previousElementSibling?.dataset.irId)).toBe('area-chart');
  await expect(slot.locator('.sk-tag')).toHaveText('Adding · section “Absence by employee”');
  await expect(slot.locator('.sk')).toHaveAttribute('data-kind', 'table');
  await expect(p.locator('.canvas .headline-number')).toHaveText('4.8%');
  expect(await shown(p)).toEqual(shownBefore);
  await expect(p.locator('[data-tab=changes]')).toHaveAttribute('aria-selected', 'true');
  await expect(p.locator('[data-changes] .change-card')).toContainText('Applying a change to v1');
  await p.evaluate(() => { window.__claude.released = true; });
  await settled(p);
  /* The new part, in place, and nothing else touched. */
  await expect(p.locator('.canvas [data-ir-id=employee-absence] .ir-section-heading')).toHaveText('Absence by employee');
  expect(await p.locator('.canvas [data-ir-id=employee-absence]').evaluate(node => node.previousElementSibling?.dataset.irId)).toBe('area-chart');
  await expect(p.locator('.canvas [data-ir-id=employee-absence-table] tbody tr')).toHaveCount(3);
  const after = await screenIR(p), byId = nodesById(after), byIdBefore = nodesById(before);
  for (const id of Object.keys(byIdBefore)) expect(byId[id], id).toEqual(byIdBefore[id]);
  expect(Object.keys(byId).filter(id => !byIdBefore[id])).toEqual(['employee-absence', 'employee-absence-table']);
  expect(after.title).toBe(before.title);
  const shownAfter = await shown(p);
  for (const [id, text] of Object.entries(shownBefore)) expect(shownAfter[id], id).toBe(text);
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v2 /);
  /* The composer is empty for the next request. */
  await expect(p.locator('[data-prompt]')).toHaveValue('');
  await expect(p.locator('[data-changes] .change-card')).toContainText('Applied · v1 → v2');
  await expect(p.locator('[data-changes] .proof')).toContainText('Everything else identical: 7 of 7 parts unchanged');
  await expect(p.locator('[data-changes] .proof')).toContainText('No existing value changed');
  await expect(p.locator('[data-changes] .proof')).toContainText('New figures are demonstration values');
  /* Claude was given this screen, its version, and its own conversation. */
  const sent = (await prompts(p)).at(-1);
  expect(sent).toMatch(/CURRENT SCREEN \(version sv-[0-9a-f]{8}; the person sees it as v1\)/);
  expect(sent.match(/CURRENT SCREEN \(version (sv-[0-9a-f]{8})/)[1]).not.toBe('sv-1a2b3c4d');
  expect(sent).toContain('Create a report on absenteeism at Acme SL');
  expect(sent).not.toContain('Q4 access review');
  expect(errors).toEqual([]);
});

test('3. renaming the new table changes only its title', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await createAbsenteeism(p);
  await script(p, addEmployees);
  await ask(p, 'Añade una tabla de empleados debajo del gráfico');
  await settled(p);
  const before = await screenIR(p), shownBefore = await shown(p);
  await script(p, renameEmployees);
  await ask(p, 'Cambia el título de la nueva tabla a «Employees with the most absence»');
  await settled(p);
  await expect(p.locator('.canvas [data-ir-id=employee-absence] .ir-section-heading')).toHaveText('Employees with the most absence');
  const after = await screenIR(p), byId = nodesById(after), byIdBefore = nodesById(before);
  for (const id of Object.keys(byIdBefore)) if (id !== 'employee-absence') expect(byId[id], id).toEqual(byIdBefore[id]);
  expect({ ...byId['employee-absence'], heading: 'Absence by employee' }).toEqual(byIdBefore['employee-absence']);
  expect(await shown(p)).toEqual(shownBefore);
  await expect(p.locator('[data-changes] .change-card')).toContainText('Applied · v2 → v3');
  await expect(p.locator('[data-changes] .before-after')).toHaveText('heading: Absence by employee → Employees with the most absence');
  /* "The new table" was resolvable because the conversation travels with the screen. */
  expect((await prompts(p)).at(-1)).toContain('#employee-absence');
  expect(errors).toEqual([]);
});

test('4. removing the employee table removes only it, and Undo brings it back', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await createAbsenteeism(p);
  await script(p, addEmployees);
  await ask(p, 'Añade una tabla de empleados debajo del gráfico');
  await settled(p);
  const withTable = await screenIR(p);
  await script(p, { text: removeEmployees, pauseAfter: '"target":"employee-absence",' });
  await ask(p, 'Elimina la tabla de empleados');
  await expect.poll(() => p.evaluate(() => window.__claude.paused)).toBe(true);
  /* Marked, still visible, until the change is validated. */
  await expect(p.locator('.canvas [data-ir-id=employee-absence]')).toHaveAttribute('data-edit', 'removing');
  await p.evaluate(() => { window.__claude.released = true; });
  await settled(p);
  await expect(p.locator('.canvas [data-ir-id=employee-absence]')).toHaveCount(0);
  await expect(p.locator('.canvas [data-ir-id=employee-absence-table]')).toHaveCount(0);
  const removed = await screenIR(p);
  const created = nodesById(withTable);
  delete created['employee-absence']; delete created['employee-absence-table'];
  expect(nodesById(removed)).toEqual(created);
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v3 /);
  await p.locator('[data-undo]').click();
  await expect(p.locator('.canvas [data-ir-id=employee-absence] .ir-section-heading')).toHaveText('Absence by employee');
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v2 /);
  expect(await screenIR(p)).toEqual(withTable);
  await expect(p.locator('[data-changes] .change-card')).toContainText('Undo · back to v2');
  await expect(p.locator('[data-changes] .history').last()).toContainText('Undo: back to v2');
  expect(errors).toEqual([]);
});

test('5. a new report is a new screen; the first one comes back with its content and conversation', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await createAbsenteeism(p);
  await script(p, addEmployees);
  await ask(p, 'Añade una tabla de empleados debajo del gráfico');
  await settled(p);
  const absence = await screenIR(p);
  /* Asking for another report while editing is a question, never a silent replacement. */
  await ask(p, 'Haz uno de rotación de personal');
  await expect(p.locator('[data-confirm]')).toBeVisible();
  await expect(p.locator('[data-confirm-text]')).toContainText('reads like a different screen');
  expect((await prompts(p)).length).toBe(2);
  await script(p, JSON.stringify(turnover));
  await p.locator('[data-confirm-actions] button', { hasText: 'Create a new screen' }).click();
  await settled(p);
  await expect(p.locator('[data-context-title]')).toHaveText(turnover.title);
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v1 /);
  /* The turnover prompt carries nothing from the absence screen. */
  const create = (await prompts(p)).at(-1);
  expect(create).toContain('Haz uno de rotación de personal');
  expect(create).not.toContain('Absenteeism at Acme SL');
  expect(create).not.toContain('employee-absence');
  /* Back to the absence report, exactly as it was. */
  await p.locator('[data-screens-toggle]').click();
  await expect(p.locator('[data-screens] button')).toHaveCount(3);
  await p.locator('[data-screens] button', { hasText: 'Absenteeism at Acme SL' }).click();
  await expect(p.locator('[data-context-title]')).toHaveText(absenteeism.title);
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v2 /);
  expect(await screenIR(p)).toEqual(absence);
  await p.locator('[data-tab=changes]').click();
  const conversation = p.locator('[data-changes] .history').last();
  await expect(conversation).toContainText('Create a report on absenteeism at Acme SL');
  await expect(conversation).toContainText('Añade una tabla de empleados debajo del gráfico');
  await expect(conversation).not.toContainText('rotación');
  /* Editing it again sends only its own conversation. */
  await script(p, renameEmployees);
  await ask(p, 'Cambia el título de la nueva tabla a «Employees with the most absence»');
  await settled(p);
  const edit = (await prompts(p)).at(-1);
  expect(edit).toContain('Añade una tabla de empleados');
  expect(edit).not.toContain('rotación');
  expect(edit).not.toContain('Turnover at Acme SL');
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v3 /);
  expect(errors).toEqual([]);
});

test('a change that fails validation is refused whole, corrected once, and the last valid screen stays until then', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await createAbsenteeism(p);
  const before = await screenIR(p), shownBefore = await shown(p);
  const tooMany = { ...employeeSection, children: [{ ...employeeSection.children[0], props: { ...employeeSection.children[0].props, rows: Array.from({ length: 25 }, (_, i) => [`Employee ${i + 1}`, 'Sales', String(i)]) } }] };
  const refused = ops([{ op: 'insert', parent: 'section-how-absence-moved-month', after: 'area-chart', node: tooMany }]);
  /* Refused twice: Syntari asks once more, then stops in a recovery state, with the screen exactly as it was. */
  await script(p, refused, refused);
  await ask(p, 'Añade una tabla con todos los empleados debajo del gráfico');
  await settled(p);
  expect(await screenIR(p)).toEqual(before);
  expect(await shown(p)).toEqual(shownBefore);
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v1 /);
  expect((await prompts(p)).at(-1)).toContain('YOUR PREVIOUS CHANGE FOR THIS REQUEST WAS REFUSED');
  await expect(p.locator('[data-alert]')).toContainText('Syntari couldn’t apply this change. Your screen is unchanged (v1).');
  await expect(p.locator('[data-alert]')).not.toContainText(/JSON|Screen IR/);
  await expect(p.locator('[data-alert] button', { hasText: 'Try again' })).toBeVisible();
  await expect(p.locator('[data-alert] button', { hasText: 'Rephrase' })).toBeVisible();
  /* A refused request stays in the composer, ready to retry or reword. */
  await expect(p.locator('[data-prompt]')).toHaveValue('Añade una tabla con todos los empleados debajo del gráfico');
  await expect(p.locator('[data-changes] .change-card')).toContainText('Refused · the screen stays at v1');
  await expect(p.locator('[data-changes] .change-card')).toContainText('over-item-budget');
  /* Refused once, then corrected: the correction applies, and the change says it took one correction. */
  await script(p, refused, addEmployees);
  await p.locator('[data-alert] button', { hasText: 'Try again' }).click();
  await settled(p);
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v2 /);
  await expect(p.locator('[data-changes] .change-card').first()).toContainText('Applied · v1 → v2 · Claude, briefed by Jev · after one correction');
  expect(errors).toEqual([]);
});

test('stopping a change mid-stream puts the screen back exactly', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await createAbsenteeism(p);
  const before = await screenIR(p), shownBefore = await shown(p);
  const html = await p.locator('.canvas').innerHTML();
  await script(p, { text: addEmployees, pauseAfter: '"component":"syntari.table",' });
  await ask(p, 'Añade una tabla de empleados debajo del gráfico');
  await expect.poll(() => p.evaluate(() => window.__claude.paused)).toBe(true);
  await expect(p.locator('.canvas [data-edit-slot]')).toHaveCount(1);
  await p.locator('[data-run]').click();
  await settled(p);
  await expect(p.locator('.canvas [data-edit-slot]')).toHaveCount(0);
  expect(await screenIR(p)).toEqual(before);
  expect(await shown(p)).toEqual(shownBefore);
  expect(await p.locator('.canvas').innerHTML()).toBe(html);
  await expect(p.locator('[data-status-label]')).toHaveText(/Ready/);
  await expect(p.locator('[data-alert]')).toContainText('Stopped. Nothing was changed: the screen is still v1');
  /* A change that was half applied when stopped is rolled back too. */
  const two = ops([{ op: 'insert', parent: 'section-how-absence-moved-month', after: 'area-chart', node: employeeSection }, { op: 'replace', target: 'screen', set: { title: 'Absenteeism at Acme SL: 4.8% in the last 3 months' } }]);
  await script(p, { text: two, pauseAfter: '{"op":"replace"' });
  await ask(p, 'Añade la tabla de empleados y acorta el título');
  await expect.poll(() => p.evaluate(() => window.__claude.paused)).toBe(true);
  await expect(p.locator('.canvas [data-ir-id=employee-absence]')).toHaveCount(1);
  await p.locator('[data-run]').click();
  await settled(p);
  await expect(p.locator('.canvas [data-ir-id=employee-absence]')).toHaveCount(0);
  expect(await screenIR(p)).toEqual(before);
  expect(await p.locator('.canvas').innerHTML()).toBe(html);
  expect(errors).toEqual([]);
});

test('a change written for an older version is refused, and never paints', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await createAbsenteeism(p);
  const before = await screenIR(p);
  await script(p, { text: addEmployees, base: 'sv-00000000' }, { text: addEmployees, base: 'sv-00000000' });
  await ask(p, 'Añade una tabla de empleados debajo del gráfico');
  await settled(p);
  expect(await screenIR(p)).toEqual(before);
  await expect(p.locator('[data-alert]')).toContainText('older version');
  await expect(p.locator('[data-alert]')).toContainText('Your screen is unchanged (v1)');
  await expect(p.locator('[data-changes] .change-card')).toContainText('stale-base');
  await p.locator('[data-tab=activity]').click();
  await expect(p.locator('[data-activity]')).toContainText('Claude wrote this change for sv-00000000');
  await expect(p.locator('[data-activity]')).toContainText('Correcting the change once');
  expect(errors).toEqual([]);
});

test('an ambiguous request asks first; the model can only ask, never switch screens', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await createAbsenteeism(p);
  const before = await screenIR(p);
  /* No phrase gives it away, so Claude reads it, and asks instead of acting. */
  await script(p, JSON.stringify({ version: 'syntari-ops-1', base: '{{BASE}}', clarify: { kind: 'new-screen', message: 'This asks for a turnover report, not a change to the absence report.' } }));
  await ask(p, 'Ahora quiero ver la rotación de personal de Acme SL');
  await settled(p);
  await expect(p.locator('[data-confirm]')).toBeVisible();
  await expect(p.locator('[data-confirm-text]')).toContainText('This asks for a turnover report');
  expect(await screenIR(p)).toEqual(before);
  await expect(p.locator('[data-status-label]')).toHaveText(/Ready/);
  await expect(p.locator('[data-context-title]')).toHaveText(absenteeism.title);
  /* Choosing to stay keeps editing this screen, with the person's confirmation in the prompt. */
  await script(p, addEmployees);
  await p.locator('[data-confirm-actions] button', { hasText: 'Change “' }).click();
  await settled(p);
  expect((await prompts(p)).at(-1)).toContain('The person confirmed that this request changes the current screen');
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v2 /);
  await p.locator('[data-screens-toggle]').click();
  await expect(p.locator('[data-screens] button')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('existing data changes only with the person’s confirmation', async ({ page: p }) => {
  const errors = await openRenderer(p);
  await createAbsenteeism(p);
  const before = await screenIR(p);
  const raise = ops([{ op: 'replace', target: 'headline-metric', set: { 'props.metrics': [{ label: 'Absence rate, latest month', value: '5.1%', total: 'of days', delta: '+1.5 pts', direction: 'up' }] } }]);
  await script(p, raise);
  await ask(p, 'Pon la tasa de absentismo en 5,1%');
  await settled(p);
  expect(await screenIR(p)).toEqual(before);
  await expect(p.locator('[data-alert]')).toContainText('would modify data already on the screen');
  await expect(p.locator('[data-alert]')).toContainText('4.8% → 5.1%');
  await p.locator('[data-alert] button', { hasText: 'Apply the data change' }).click();
  await expect(p.locator('.canvas .headline-number')).toHaveText('5.1%');
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v2 /);
  await expect(p.locator('[data-changes] .proof')).toContainText('Existing data changed with your approval');
  /* An unrequested data change in the same answer as a requested insert refuses the whole change: Jev briefed one new part,
     so the change to the table is outside the brief, refused before anything paints, and Claude corrects it once. */
  const insert = { op: 'insert', parent: 'section-how-absence-moved-month', after: 'area-chart', node: employeeSection };
  await script(p, ops([insert, { op: 'replace', target: 'table', set: { 'props.rows': [['Customer Support', '9.9%', '+5 pts']] } }]), ops([insert]));
  const tableBefore = nodesById(await screenIR(p)).table;
  await ask(p, 'Añade una tabla de empleados debajo del gráfico');
  await expect(p.locator('[data-context-sub]')).toHaveText(/^v3 /);
  expect((await prompts(p)).at(-1)).toContain('outside-brief');
  expect(nodesById(await screenIR(p)).table).toEqual(tableBefore);
  await expect(p.locator('.canvas [data-ir-id=employee-absence]')).toHaveCount(1);
  expect(errors).toEqual([]);
});
