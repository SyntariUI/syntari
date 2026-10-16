// Compiled by tests/types.test.mjs: the published types must describe the API an agent host uses.
import { getComponent, searchRegistry, validateScreen, type ActionRequest, type Screen } from 'syntari-ui';

const contract = await getComponent('tool-approval');
const screen: Screen = { type: 'screen', children: [{ id: 'deploy', component: 'syntari.tool-approval', props: contract?.sample?.props }] };
const result = await validateScreen(screen);
const found = await searchRegistry('approval');
const authorise = (request: ActionRequest): boolean => request.consequential && request.action === 'approve' && result.ok;
// @ts-expect-error component ids use the syntari. prefix
const invalid: Screen = { type: 'screen', children: [{ component: 'tool-approval' }] };

export { authorise, found, invalid };
