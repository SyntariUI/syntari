// Compiled by tests/types.test.mjs: the browser runtime's types, as a host page would use them.
import { mount, getComponents, searchItems, matchScore } from 'syntari-ui/runtime/syntari.js';
import { render, validate, IR_LIMITS, buildDataModel, formatData } from 'syntari-ui/runtime/ir.js';
import type { ActionRequest } from 'syntari-ui';

const requests: ActionRequest[] = [];
const button = await mount('button', '#save', { props: { label: 'Save' }, onActionRequest: request => requests.push(request) });
const screen = await render({ type: 'screen', children: [{ id: 'save', component: 'syntari.button', props: { label: 'Save' } }] }, '#screen', { onActionRequest: request => requests.push(request) });
const checked = await validate({ type: 'screen', children: [] });
const depth: number = IR_LIMITS.maxDepth;
const model = buildDataModel({ mode: 'demo', tables: { holdings: { fields: { weight: { type: 'percent', total: 100 } }, rows: [{ weight: 100 }] } }, measures: { total: { label: 'Total', sum: 'holdings.weight', format: 'percent' } } });
const total: string = formatData(model?.measures.get('total')?.value ?? null, 'percent', { locale: model?.locale });
const bound = checked.bindings.map(binding => binding.ref);
// @ts-expect-error mount takes options, not a callback
await mount('button', '#save', () => {});
const ranked = searchItems(await getComponents(), 'modal').map(component => component.slug);
const score: number = matchScore({ name: 'Dialog', aliases: ['modal'] }, 'modal');

export { button, screen, checked, depth, total, bound, ranked, score };
