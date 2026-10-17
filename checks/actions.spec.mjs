import { test, expect } from '@playwright/test';
import { origin } from './component.mjs';

/* Contract mode: one contract configures a component for agents (Screen IR) and for people (mount with props).
   Declared actions report what a person asked for and never run demo behaviour. */
const stage = async page => {
  await page.goto(`${origin}/generative-ui.html`);
  await page.locator('[data-ir-output] .ir-screen').waitFor();
};
const renderScreen = (page, children) => page.evaluate(async children => {
  const { render } = await import('/ir.js');
  window.requests = [];
  window.domRequests = [];
  const target = document.querySelector('[data-ir-output]');
  target.addEventListener('syntari:action', event => window.domRequests.push(event.detail));
  const result = await render({ type: 'screen', children }, target, { onActionRequest: detail => window.requests.push(detail) });
  return result.diagnostics.filter(item => item.severity === 'error').map(item => item.code);
}, children);
const requests = page => page.evaluate(() => window.requests.map(({ values, ...rest }) => ({ ...rest, ...(values ? { values: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value instanceof File ? `file:${value.name}` : value])) } : {}) })));

test('an approval rendered from Screen IR asks the host instead of approving itself', async ({ page }) => {
  await stage(page);
  expect(await renderScreen(page, [{ id: 'deploy-billing', component: 'syntari.tool-approval', props: { title: 'Run the migration?', question: 'Apply three schema changes.', scope: 'billing · write' } }])).toEqual([]);
  const output = page.locator('[data-ir-output]');
  await output.getByRole('button', { name: 'Approve' }).click();
  expect(await requests(page)).toEqual([{ component: 'tool-approval', action: 'approve', id: 'deploy-billing', path: 'children[0]', consequential: true }]);
  expect(await page.evaluate(() => window.domRequests.length)).toBe(1);
  await expect(output.locator('.agent-decision')).toHaveText('');
  await output.getByRole('button', { name: 'Decline' }).click();
  expect((await requests(page)).map(item => item.action)).toEqual(['approve', 'reject']);
});

test('forms in contract mode send what the person entered', async ({ page }) => {
  await stage(page);
  expect(await renderScreen(page, [
    { id: 'ask', component: 'syntari.prompt-input', props: { placeholder: 'Ask about the Q3 report', hint: 'PDF or CSV' } },
    { id: 'audience', component: 'syntari.agent-questions', props: { question: 'Who is this for?', options: [{ value: 'Board' }, { value: 'Team', selected: true }] } },
    { id: 'thread', component: 'syntari.chat-composer', props: { messages: [{ text: 'Which quarter?' }, { text: 'Q3, please.', from: 'person' }] } }
  ])).toEqual([]);
  const output = page.locator('[data-ir-output]');
  await expect(output.locator('[data-prompt-status]')).toHaveText('');
  await output.getByPlaceholder('Ask about the Q3 report').fill('Summarise renewals');
  await output.getByLabel('Attach a file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('renewals') });
  await output.getByRole('button', { name: 'Send message' }).first().click();
  await output.getByRole('textbox', { name: 'Anything to preserve?' }).fill('Keep it short');
  await output.getByRole('button', { name: 'Send answer' }).click();
  await expect(output.locator('[data-question-stage]')).toBeVisible();
  await expect(output.locator('.chat-composer-demo .message')).toHaveCount(2);
  await expect(output.locator('.chat-composer-demo .message.sent')).toHaveText('Q3, please.');
  await output.getByRole('textbox', { name: 'Write a message' }).fill('And Q2?');
  await output.getByRole('textbox', { name: 'Write a message' }).press('Enter');
  await expect(output.locator('.chat-composer-demo .message')).toHaveCount(2);
  expect(await requests(page)).toEqual([
    { component: 'prompt-input', action: 'submit', id: 'ask', path: 'children[0]', values: { prompt: 'Summarise renewals', attachment: 'file:notes.txt' }, consequential: false },
    { component: 'agent-questions', action: 'submit', id: 'audience', path: 'children[1]', values: { choice: 'Team', notes: 'Keep it short' }, consequential: false },
    { component: 'chat-composer', action: 'send', id: 'thread', path: 'children[2]', values: { message: 'And Q2?' }, consequential: false }
  ]);
});

test('list items report their position and demo-only controls are removed', async ({ page }) => {
  await stage(page);
  expect(await renderScreen(page, [
    { id: 'sources', component: 'syntari.citations', props: { text: 'Renewals drove growth.', sources: [{ number: 1, title: 'Board report' }, { number: 2, title: 'Sales dashboard', linkLabel: 'Open dashboard' }] } },
    { component: 'syntari.agent-activity', props: { events: [{ title: 'Workspace opened' }, { title: 'Files read', detail: '3 files' }] } },
    { component: 'syntari.file-diff', props: { file: 'pricing.css', lines: [{ kind: 'remove', text: '−   padding: 12px;' }, { kind: 'add', text: '+   padding: var(--space-4);' }] } }
  ])).toEqual([]);
  const output = page.locator('[data-ir-output]');
  await output.locator('details.citation').nth(1).locator('summary').click();
  await output.getByRole('button', { name: 'Open dashboard' }).click();
  await expect(output.locator('.agent-timeline li')).toHaveCount(2);
  await expect(output.getByRole('button', { name: 'Add event' })).toHaveCount(0);
  await expect(output.locator('.diff-lines .diff-remove')).toHaveCount(1);
  await expect(output.locator('.diff-lines .diff-add')).toHaveText('+   padding: var(--space-4);');
  await output.getByRole('button', { name: 'Keep changes' }).click();
  await expect(output.locator('[data-ir-component="file-diff"] .agent-decision')).toHaveText('');
  expect((await requests(page)).map(({ component, action, index, consequential }) => ({ component, action, index, consequential }))).toEqual([
    { component: 'citations', action: 'open', index: 1, consequential: false },
    { component: 'file-diff', action: 'approve', index: undefined, consequential: true }
  ]);
});

test('mount() with props renders one configured instance from the same contract', async ({ page }) => {
  await stage(page);
  const result = await page.evaluate(async () => {
    const { mount } = await import('/syntari.js');
    const host = document.createElement('div');
    document.body.append(host);
    const seen = [];
    host.addEventListener('syntari:action', event => seen.push(event.detail.action));
    const instance = await mount('button', host, { props: { label: 'Delete project', variant: 'danger' }, onActionRequest: detail => seen.push(`callback:${detail.action}`) });
    const buttons = [...instance.element.querySelectorAll('button')];
    buttons[0].click();
    let error = null;
    try { await mount('button', host, { props: { label: 'Save', variant: 'loud' } }); } catch (caught) { error = { name: caught.name, codes: caught.diagnostics.map(item => item.code) }; }
    const specimen = await mount('button', document.createElement('div'));
    return {
      count: buttons.length,
      text: buttons[0].textContent.trim(),
      danger: buttons[0].classList.contains('danger'),
      secondary: buttons[0].classList.contains('secondary'),
      seen,
      toast: document.querySelector('#toast')?.textContent ?? '',
      error,
      specimenButtons: specimen.element.querySelectorAll('button').length
    };
  });
  expect(result.count).toBe(1);
  expect(result.text).toBe('Delete project');
  expect(result.danger).toBe(true);
  expect(result.secondary).toBe(false);
  expect(result.seen).toEqual(['press', 'callback:press']);
  expect(result.toast).not.toContain('Secondary action selected');
  expect(result.error).toEqual({ name: 'TypeError', codes: ['enum-outside-values'] });
  expect(result.specimenButtons).toBeGreaterThan(1);
});

test('view controls update themselves and report their new state; run controls wait for the host', async ({ page }) => {
  await stage(page);
  expect(await renderScreen(page, [
    { id: 'scope', component: 'syntari.filter-bar', props: { period: 'Last 30 days', periods: [{ label: 'Last 7 days', value: '7d' }, { label: 'Last 30 days', value: '30d' }] } },
    { id: 'chart', component: 'syntari.chart-toolbar', props: { compareLabel: 'Compare with last month', viewLabel: 'View daily numbers' } },
    { id: 'measures', component: 'syntari.metric-strip', props: { items: [{ label: 'Mention rate', value: '45%', active: true }, { label: 'Leads', value: '2' }] } },
    { id: 'run', component: 'syntari.transport-controls', props: { label: 'Paused at step 3 of 60', speed: 12, steps: 60 } }
  ])).toEqual([]);
  const output = page.locator('[data-ir-output]');
  await output.locator('[data-select-toggle]').click();
  await output.getByRole('option', { name: 'Last 7 days' }).click();
  await expect(output.locator('[data-select-label]')).toHaveText('Last 7 days');
  await output.getByRole('button', { name: 'Filters' }).click();
  await output.getByRole('checkbox', { name: 'Compare with last month' }).uncheck();
  await output.getByRole('button', { name: 'View daily numbers' }).click();
  await expect(output.locator('[data-chart-view]')).toHaveAttribute('aria-pressed', 'true');
  await expect(output.locator('[data-chart-view]')).toHaveText('View daily numbers');
  await output.locator('.metric-item').nth(1).click();
  await expect(output.locator('.metric-item').nth(1)).toHaveClass(/active/);
  await expect(output.locator('[data-transport-number]')).toHaveText('12');
  await output.getByRole('button', { name: 'Play' }).click();
  await expect(output.locator('[data-transport-status]')).toHaveText('Paused at step 3 of 60');
  await expect(output.locator('[data-transport-play]')).toHaveAttribute('aria-pressed', 'false');
  await output.getByRole('slider').fill('20');
  await expect(output.locator('[data-transport-number]')).toHaveText('20');
  await expect(output.locator('[data-transport-status]')).toHaveText('Paused at step 3 of 60');
  await expect.poll(async () => (await requests(page)).map(({ path, ...rest }) => rest)).toEqual([
    { component: 'filter-bar', action: 'period', id: 'scope', index: 0, values: { value: '7d' }, consequential: false },
    { component: 'filter-bar', action: 'filters', id: 'scope', consequential: false },
    { component: 'chart-toolbar', action: 'compare', id: 'chart', values: { checked: false }, consequential: false },
    { component: 'chart-toolbar', action: 'view', id: 'chart', values: { pressed: true }, consequential: false },
    { component: 'metric-strip', action: 'select', id: 'measures', index: 1, values: { pressed: true }, consequential: false },
    { component: 'transport-controls', action: 'play', id: 'run', consequential: false },
    { component: 'transport-controls', action: 'speed', id: 'run', values: { value: 20 }, consequential: false }
  ]);
});

test('instance props decide consequence, streaming state and the accessible question', async ({ page }) => {
  await stage(page);
  expect(await renderScreen(page, [
    { id: 'delete', component: 'syntari.button', props: { label: 'Delete project', variant: 'danger', consequential: true } },
    { id: 'save', component: 'syntari.button', props: { label: 'Save draft' } },
    { id: 'live', component: 'syntari.streaming-response', props: { author: 'Research assistant', text: 'Renewals grew', streaming: true } },
    { id: 'done', component: 'syntari.streaming-response', props: { author: 'Research assistant', text: 'Renewals grew 18%.' } },
    { id: 'audience', component: 'syntari.agent-questions', props: { question: 'Who is this for?', options: [{ value: 'Board' }, { value: 'Team' }] } }
  ])).toEqual([]);
  const output = page.locator('[data-ir-output]');
  await output.getByRole('button', { name: 'Delete project' }).click();
  await output.getByRole('button', { name: 'Save draft' }).click();
  const [live, done] = [output.locator('[data-ir-component="streaming-response"]').first(), output.locator('[data-ir-component="streaming-response"]').nth(1)];
  await expect(live.locator('[data-agent-action=stream-stop]')).toBeEnabled();
  await expect(live.locator('[data-agent-action=stream-start]')).toBeDisabled();
  await expect(done.locator('[data-agent-action=stream-stop]')).toBeDisabled();
  await expect(done.locator('[data-agent-action=stream-start]')).toBeEnabled();
  await live.locator('[data-agent-action=stream-stop]').click();
  await expect(output.getByRole('group', { name: 'Who is this for?' })).toBeVisible();
  expect((await requests(page)).map(({ id, action, consequential }) => ({ id, action, consequential }))).toEqual([
    { id: 'delete', action: 'press', consequential: true },
    { id: 'save', action: 'press', consequential: false },
    { id: 'live', action: 'stop', consequential: false }
  ]);
});

test('a reset instance reports its diagnostics once, with their own message', async ({ page }) => {
  await stage(page);
  const result = await page.evaluate(async () => {
    const { mount } = await import('/syntari.js');
    const instance = await mount('agent-message', document.createElement('div'), { props: { author: 'Agent', text: 'Hello', icon: 'rocketship' } });
    const first = instance.diagnostics.map(({ code, path, message }) => ({ code, path, message }));
    await instance.reset();
    await instance.reset();
    return { first, after: instance.diagnostics.length };
  });
  expect(result.first).toEqual([{ code: 'unknown-icon', path: 'props.icon', message: expect.stringContaining('"rocketship" is not a Syntari icon') }]);
  expect(result.after).toBe(1);
});
