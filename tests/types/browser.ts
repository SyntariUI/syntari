// Compiled by tests/types.test.mjs: the browser runtime's types, as a host page would use them.
import { mount } from 'syntari-ui/runtime/syntari.js';
import { render, validate, IR_LIMITS } from 'syntari-ui/runtime/ir.js';
import type { ActionRequest } from 'syntari-ui';

const requests: ActionRequest[] = [];
const button = await mount('button', '#save', { props: { label: 'Save' }, onActionRequest: request => requests.push(request) });
const screen = await render({ type: 'screen', children: [{ id: 'save', component: 'syntari.button', props: { label: 'Save' } }] }, '#screen', { onActionRequest: request => requests.push(request) });
const checked = await validate({ type: 'screen', children: [] });
const depth: number = IR_LIMITS.maxDepth;
// @ts-expect-error mount takes options, not a callback
await mount('button', '#save', () => {});

export { button, screen, checked, depth };
