import test from 'node:test';
import assert from 'node:assert/strict';
import { validateScreen } from '../agent.mjs';

const codes = result => result.diagnostics.map(item => `${item.severity}:${item.code}:${item.path}`).sort();
const form = (children, extra = {}) => ({ type: 'screen', children: [{ id: 'invite', type: 'section', heading: 'Invite a teammate', submit: 'Send invite', ...extra, children }] });
const email = (props = {}, id = 'email') => ({ id, component: 'syntari.text-input', props: { label: 'Work email', type: 'email', ...props } });

test('a form section holds fields and sends them; a field anywhere else is reported', async () => {
  assert.deepEqual(codes(await validateScreen(form([email()]))), []);
  assert.deepEqual(codes(await validateScreen({ type: 'screen', children: [email()] })), ['warning:field-outside-form:children[0]']);
  /* A field with actions of its own still reaches the host outside a form. */
  const cards = { id: 'plan', component: 'syntari.selectable-cards', props: { question: 'Which plan?', options: [{ title: 'Team' }, { title: 'Business' }] } };
  assert.deepEqual(codes(await validateScreen({ type: 'screen', children: [cards] })), []);
  assert.deepEqual(codes(await validateScreen(form([]))), ['warning:form-without-fields:children[0]']);
  const plain = { type: 'screen', children: [{ type: 'section', heading: 'Notes', consequential: true, children: [] }] };
  assert.deepEqual(codes(await validateScreen(plain)), ['warning:consequential-without-submit:children[0].consequential']);
  assert.deepEqual(codes(await validateScreen(form([email()], { submit: ' ' }))), ['error:invalid-form:children[0].submit', 'warning:field-outside-form:children[0].children[0]']);
});

test('each name is sent once, and a label names a field that has no name', async () => {
  const twice = await validateScreen(form([email(), email({}, 'email-2')]));
  assert.deepEqual(codes(twice), ['error:duplicate-field-name:children[0].children[1].props']);
  assert.match(twice.diagnostics[0].message, /"workEmail" is already sent by the field at children\[0\]\.children\[0\]/);
  assert.deepEqual(codes(await validateScreen(form([email(), email({ name: 'backupEmail' }, 'backup-email')]))), []);
  assert.deepEqual(codes(await validateScreen(form([email({ name: '2nd email' })]))), ['error:invalid-field-name:children[0].children[0].props.name']);
  const switches = { id: 'alerts', component: 'syntari.switch', props: { items: [{ label: 'Weekly digest' }, { label: 'Weekly  digest' }] } };
  assert.deepEqual(codes(await validateScreen(form([switches]))), ['error:duplicate-field-name:children[0].children[0].props.items[1]']);
});

test('forms do not nest, and a component that is a form of its own stays out of one', async () => {
  const inner = { id: 'inner', type: 'section', heading: 'More', submit: 'Save', children: [email({ name: 'other' }, 'other-email')] };
  assert.deepEqual(codes(await validateScreen(form([email(), inner]))), ['error:nested-form:children[0].children[1].submit']);
  const prompt = { id: 'ask', component: 'syntari.prompt-input', props: { label: 'Ask' } };
  assert.deepEqual(codes(await validateScreen(form([email(), prompt]))), ['error:nested-form:children[0].children[1]']);
});

test('a field agrees with itself: options, bounds, and dates', async () => {
  const one = async node => codes(await validateScreen(form([{ id: 'field', ...node }])));
  assert.deepEqual(await one({ component: 'syntari.radio', props: { label: 'Role', options: [{ label: 'Viewer', checked: true }, { label: 'Editor', checked: true }] } }), ['error:several-checked:children[0].children[0].props.options']);
  assert.deepEqual(await one({ component: 'syntari.checkbox', props: { label: 'Topics', options: [{ label: 'Billing' }, { label: 'Other', value: 'Billing' }] } }), ['error:duplicate-option:children[0].children[0].props.options[1]']);
  assert.deepEqual(await one({ component: 'syntari.searchable-select', props: { label: 'Owner', options: ['Ana', 'Ben'], value: 'Cleo' } }), ['error:no-matching-option:children[0].children[0].props.value']);
  assert.deepEqual(await one({ component: 'syntari.multiselect', props: { label: 'Labels', options: ['Design', 'Research'], values: ['Design', 'Sales'] } }), ['error:no-matching-option:children[0].children[0].props.values']);
  assert.deepEqual(await one({ component: 'syntari.slider', props: { label: 'Events', min: 10, max: 10 } }), ['error:invalid-range:children[0].children[0].props.max']);
  assert.deepEqual(await one({ component: 'syntari.number-stepper', props: { label: 'Seats', min: 1, max: 20, value: 30 } }), ['error:invalid-range:children[0].children[0].props.value']);
  assert.deepEqual(await one({ component: 'syntari.range-slider', props: { label: 'Budget', min: 0, max: 100, low: 80, high: 20 } }), ['error:invalid-range:children[0].children[0].props.high']);
  assert.deepEqual(await one({ component: 'syntari.date-range-picker', props: { label: 'Period', start: '2026-02-30', end: '2026-03-01' } }), ['error:invalid-date:children[0].children[0].props.start']);
  assert.deepEqual(await one({ component: 'syntari.date-range-picker', props: { label: 'Period', start: '2026-03-02', end: '2026-03-01' } }), ['error:invalid-range:children[0].children[0].props.end']);
  assert.deepEqual(await one({ component: 'syntari.text-area', props: { label: 'Note', value: 'Too long', maxLength: 3 } }), ['error:over-length:children[0].children[0].props.value']);
});
