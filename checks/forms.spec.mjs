import { test, expect } from '@playwright/test';
const origin = 'http://127.0.0.1:4398';

/* Render a screen on the Screen IR page, run a script against it, and return what the script read and every action request. */
async function paint(page, children, read) {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
  return page.evaluate(async ({ children, read }) => {
    const { render } = await import('/ir.js');
    const requests = [];
    const result = await render({ type: 'screen', children }, document.querySelector('[data-ir-output]'), { onActionRequest: request => requests.push(request) });
    await new Promise(resolve => setTimeout(resolve, 100));
    const errors = result.diagnostics.filter(d => d.severity === 'error').map(d => `${d.code} ${d.path}`);
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    return { errors, requests, ...(await new Function('root', 'requests', 'wait', `return (async () => { ${read} })()`)(result.element, requests, wait)) };
  }, { children, read });
}

const fields = [
  { id: 'email', component: 'syntari.text-input', props: { label: 'Work email', type: 'email', value: 'ana@example.com', required: true, hint: 'The invite is sent here.' } },
  { id: 'role', component: 'syntari.radio', props: { label: 'Role', options: [{ label: 'Viewer', value: 'viewer' }, { label: 'Editor', value: 'editor', checked: true }] } },
  { id: 'topics', component: 'syntari.checkbox', props: { label: 'Notify me about', options: [{ label: 'Mentions', checked: true }, { label: 'Comments' }] } },
  { id: 'alerts', component: 'syntari.switch', props: { items: [{ label: 'Weekly digest', checked: true }, { label: 'Product updates' }] } },
  { id: 'events', component: 'syntari.slider', props: { label: 'Monthly events', min: 0, max: 100, step: 10, value: 40, unit: '%' } },
  { id: 'budget', component: 'syntari.range-slider', props: { label: 'Budget', min: 0, max: 1000, step: 10, low: 200, high: 800, unit: '$' } },
  { id: 'seats', component: 'syntari.number-stepper', props: { label: 'Seats', min: 1, max: 20, value: 1 } },
  { id: 'owner', component: 'syntari.searchable-select', props: { label: 'Assign to', options: ['Alex Morgan', 'Jamie Chen', 'Sam Rivera'], value: 'Jamie Chen' } },
  { id: 'labels', component: 'syntari.multiselect', props: { label: 'Labels', options: ['Design', 'Research', 'Engineering'], values: ['Design', 'Research'] } },
  { id: 'period', component: 'syntari.date-range-picker', props: { label: 'Period', start: '2026-09-01', end: '2026-09-30' } },
  { id: 'note', component: 'syntari.text-area', props: { label: 'Note', value: 'Hi', maxLength: 140 } }
];
const form = (children, extra = {}) => [{ id: 'invite', type: 'section', heading: 'Invite a teammate', submit: 'Send invite', ...extra, children }];

test('a form section sends every field once, typed, as one request', async ({ page }) => {
  const out = await paint(page, form(fields, { consequential: true }), `
    const form = root.querySelector('form.ir-form');
    const button = form.querySelector('.ir-form-actions > button[type=submit]');
    button.click();
    await wait(50);
    return { tag: form.tagName, name: form.getAttribute('aria-labelledby') && document.getElementById(form.getAttribute('aria-labelledby')).textContent, button: button.textContent };
  `);
  expect(out.errors).toEqual([]);
  expect(out).toMatchObject({ tag: 'FORM', name: 'Invite a teammate', button: 'Send invite' });
  expect(out.requests).toHaveLength(1);
  expect(out.requests[0]).toMatchObject({ component: 'form', action: 'submit', id: 'invite', path: 'children[0]', consequential: true });
  expect(out.requests[0].values).toEqual({
    workEmail: 'ana@example.com', role: 'editor', notifyMeAbout: ['Mentions'], weeklyDigest: true, productUpdates: false,
    monthlyEvents: 40, budget: [200, 800], seats: 1, assignTo: 'Jamie Chen', labels: ['Design', 'Research'],
    period: { start: '2026-09-01', end: '2026-09-30' }, note: 'Hi'
  });
});

test('each field is named, described, and says what it holds in words', async ({ page }) => {
  const out = await paint(page, form([...fields, { id: 'site', component: 'syntari.text-input', props: { label: 'Website', type: 'url', error: 'Use a full address, such as https://example.com.' } }]), `
    const describedBy = el => (el.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean).map(id => document.getElementById(id)?.textContent).join(' | ');
    const labelled = el => el.getAttribute('aria-labelledby').split(' ').map(id => document.getElementById(id).textContent).join(' ');
    const at = id => root.querySelector('[data-ir-id="' + id + '"] [data-syntari-contract]');
    const email = at('email').querySelector('input'), site = at('site').querySelector('input');
    const stepper = at('seats');
    return {
      email: [email.getAttribute('aria-label'), email.type, email.required, email.autocomplete, describedBy(email)],
      site: [site.getAttribute('aria-invalid'), site.classList.contains('invalid'), describedBy(site)],
      role: [at('role').getAttribute('role'), labelled(at('role')), [...at('role').querySelectorAll('input')].map(i => i.checked)],
      alerts: [...at('alerts').querySelectorAll('input[role=switch]')].map(i => [i.getAttribute('aria-label'), i.checked]),
      events: [at('events').querySelector('output').parentElement.textContent.trim(), [...at('events').querySelectorAll('.label-caption > span')].map(s => s.textContent)],
      budget: at('budget').querySelector('[data-range-output]').textContent,
      seats: [stepper.querySelector('[data-number-step="-1"]').disabled, stepper.querySelector('[data-number-step="1"]').disabled, stepper.querySelector('label').htmlFor === stepper.querySelector('input').id],
      labels: [...at('labels').querySelectorAll('[data-combo-remove]')].map(chip => chip.dataset.comboRemove),
      owner: at('owner').querySelector('input').value,
      period: [labelled(at('period').querySelector('[data-date-range]'))],
      note: at('note').querySelector('[data-text-count]').textContent
    };
  `);
  expect(out.errors).toEqual([]);
  expect(out.email).toEqual(['Work email', 'email', true, 'email', 'The invite is sent here.']);
  expect(out.site).toEqual(['true', true, 'Use a full address, such as https://example.com.']);
  expect(out.role).toEqual(['radiogroup', 'Role', [false, true]]);
  expect(out.alerts).toEqual([['Weekly digest', true], ['Product updates', false]]);
  expect(out.events).toEqual(['40%', ['0%', '100%']]);
  expect(out.budget).toBe('$200 – $800');
  expect(out.seats).toEqual([true, false, true]);
  expect(out.labels).toEqual(['Design', 'Research']);
  expect(out.owner).toBe('Jamie Chen');
  expect(out.period).toEqual(['Period Sep 1 – Sep 30, 2026']);
  expect(out.note).toBe('2 / 140 characters');
});

test('the form refuses an empty required field and a choice that is not an option, then sends once they are fixed', async ({ page }) => {
  const out = await paint(page, form([
    { id: 'email', component: 'syntari.text-input', props: { label: 'Work email', type: 'email', required: true } },
    { id: 'owner', component: 'syntari.searchable-select', props: { label: 'Assign to', options: ['Alex Morgan', 'Sam Rivera'] } },
    { id: 'labels', component: 'syntari.multiselect', props: { label: 'Labels', options: ['Design', 'Research'], required: true } }
  ]), `
    const form = root.querySelector('form');
    const submit = () => form.querySelector('[type=submit]').click();
    const [email, owner, labels] = ['email', 'owner', 'labels'].map(id => root.querySelector('[data-ir-id="' + id + '"] input'));
    const type = (input, text) => { input.value = text; input.dispatchEvent(new Event('input', { bubbles: true })); };
    submit(); await wait(30);
    const blankRequests = requests.length;
    type(email, 'ana@example.com'); type(owner, 'Nobody');
    submit(); await wait(30);
    const ownerMessage = owner.validationMessage;
    type(owner, 'sam rivera');
    submit(); await wait(30);
    const labelsMessage = labels.validationMessage;
    root.querySelector('[data-ir-id="labels"] [data-starter-combo]').click();
    labels.focus(); type(labels, 'Res'); await wait(30);
    root.querySelector('[data-ir-id="labels"] [data-combo-option="Research"]').click(); await wait(30);
    submit(); await wait(30);
    return { blankRequests, ownerMessage, labelsMessage };
  `);
  expect(out.errors).toEqual([]);
  expect(out.blankRequests).toBe(0);
  expect(out.ownerMessage).toBe('Choose one of the options.');
  expect(out.labelsMessage).toBe('Choose at least one option.');
  expect(out.requests).toHaveLength(1);
  expect(out.requests[0].values).toEqual({ workEmail: 'ana@example.com', assignTo: 'Sam Rivera', labels: ['Research'] });
});

test('outside a form, two radio groups with one name stay apart, and the runtime keeps a range pair in its own units', async ({ page }) => {
  const radio = id => ({ id, component: 'syntari.radio', props: { label: 'Role', options: [{ label: 'Viewer', checked: true }, { label: 'Editor' }] } });
  const out = await paint(page, [radio('first'), radio('second'), { id: 'budget', component: 'syntari.range-slider', props: { label: 'Storage', min: 0, max: 500, step: 50, low: 100, high: 300, unit: 'GB' } }], `
    const names = [...root.querySelectorAll('input[type=radio]')].map(input => input.name);
    root.querySelector('[data-ir-id="second"] input[value="Editor"]').click();
    const first = [...root.querySelectorAll('[data-ir-id="first"] input')].map(input => input.checked);
    const low = root.querySelector('[data-ir-id="budget"] input[data-bound=min]');
    low.value = '150'; low.dispatchEvent(new Event('input', { bubbles: true }));
    return { distinct: new Set(names).size, first, output: root.querySelector('[data-ir-id="budget"] [data-range-output]').textContent, fill: low.style.getPropertyValue('--range-fill') };
  `);
  expect(out.distinct).toBe(2);
  expect(out.first).toEqual([true, false]);
  expect(out.output).toBe('150 GB – 300 GB');
  expect(out.fill).toBe('30%');
});
