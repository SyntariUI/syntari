/** Build llms.txt and llms-full.txt from the published registry, so they never drift from the contracts. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const site = 'https://syntariui.giovanitier.com';
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

function constraints(prop) {
  return [
    prop.default !== undefined && prop.default !== '' ? `default ${JSON.stringify(prop.default)}` : null,
    prop.maxLength ? `max ${prop.maxLength} characters` : null,
    prop.minimum !== undefined && prop.maximum !== undefined ? `${prop.minimum} to ${prop.maximum}` : prop.minimum !== undefined ? `at least ${prop.minimum}` : prop.maximum !== undefined ? `at most ${prop.maximum}` : null
  ].filter(Boolean);
}
const typeName = prop => prop.type === 'enum' ? prop.values.map(value => JSON.stringify(value)).join(' | ') : prop.type;

function describeProp(name, prop) {
  const type = prop.type === 'array' ? `array${prop.maxItems ? `, at most ${prop.maxItems} items` : ''}` : typeName(prop);
  const notes = [prop.required ? 'required' : 'optional', ...constraints(prop), prop.description].filter(Boolean);
  const line = `- \`${name}\` (${type}): ${notes.join('; ')}`;
  /* List items carry their own types and limits; a model without tools needs them as much as the top-level ones. */
  const fields = prop.type === 'array' && prop.items?.type === 'object' ? Object.entries(prop.items.fields ?? {}) : [];
  const items = prop.type === 'array' && prop.items && prop.items.type !== 'object' ? [`  - each item: ${[typeName(prop.items), ...constraints(prop.items)].join('; ')}`] : [];
  return [line, ...items, ...fields.map(([field, spec]) => `  - \`${field}\` (${typeName(spec)}): ${[spec.required ? 'required' : 'optional', ...constraints(spec), spec.description].filter(Boolean).join('; ')}`)].join('\n');
}

function actionNote(action) {
  const how = action.event === 'submit' ? ' (form submit, sends values)'
    : action.local ? ' (the control updates itself and sends its new state)'
    : action.event === 'change' ? ' (on change, sends the new state)' : '';
  const consequence = action.consequential ? ' — consequential' : action.consequentialProp ? ` — consequential when \`${action.consequentialProp}\` is true` : '';
  return how + consequence;
}

export async function buildLlms(registryDir) {
  const index = await readJson(join(registryDir, 'index.json'));
  const patterns = (await readJson(join(registryDir, 'patterns/index.json'))).patterns;
  const policy = await readJson(join(registryDir, 'agent-policy.json'));
  const agentGuide = await readFile(new URL('../AGENT-GUIDE.md', import.meta.url), 'utf8');
  const contracts = [];
  for (const entry of index.components.filter(item => item.renderable)) contracts.push(await readJson(join(registryDir, entry.manifest)));
  /* Guidance is read the same way by people in System and by agents here: when to use, when not, states, and what to do. */
  const guided = [];
  for (const entry of index.components.filter(item => item.status === 'authored')) {
    const manifest = await readJson(join(registryDir, entry.manifest));
    if (manifest.guidance) guided.push(manifest);
  }
  const nameOf = id => index.components.find(item => item.id === id)?.name ?? id;
  const guidanceText = guided.map(item => {
    const g = item.guidance;
    return `### ${item.name} (\`syntari.${item.id}\`)

${g.summary}

Use when:
${g.useWhen.map(text => `- ${text}`).join('\n')}

Do not use when:
${g.avoidWhen.map(entry => `- ${entry.text}${entry.instead ? ` Use ${nameOf(entry.instead)} (\`syntari.${entry.instead}\`).` : ''}`).join('\n')}

States:
${g.states.map(state => `- ${state.label}: ${state.description} (${state.how})`).join('\n')}

Do:
${g.dos.map(rule => `- ${rule.title}: ${rule.description}`).join('\n')}

Don’t:
${g.donts.map(rule => `- ${rule.title}: ${rule.description}`).join('\n')}${g.content?.length ? `\n\nWriting:\n${g.content.map(text => `- ${text}`).join('\n')}` : ''}

Accessibility:
${[...g.accessibility.keyboard.map(key => `- ${key.keys}: ${key.action}`), ...g.accessibility.notes.map(text => `- ${text}`)].join('\n')}`;
  }).join('\n\n');

  const intro = `# Syntari

> A design system for people and agents. ${index.components.length} components, a machine-readable registry, and a renderer that validates what agents compose. ${contracts.length} components have render contracts an agent can use from Screen IR.

Syntari ships editable HTML, CSS, and JavaScript components. An agent describes a screen as Screen IR (JSON), validates it against the published contracts, and renders it with the same components people use. Actions in a rendered screen are requests: the host application decides whether anything runs.

Install: \`npm install syntari-ui\`. MCP (read-only, stdio): \`npx -y syntari-ui mcp\`. Version ${index.version}.`;

  const short = `${intro}

## Start here

- [Agent guide](${site}/AGENT-GUIDE.md): discovery, composition, validation, and host authorization
- [Generative UI guide](${site}/system/?guide=generative-ui): Screen IR, layouts, validation codes, limits, actions
- [AI behaviour patterns](${site}/system/?guide=ai-patterns): clarification, uncertainty, delegation, recovery, memory, generation
- [Full context for models](${site}/llms-full.txt): every render contract with props, actions, and a valid sample

## Registry

- [Component index](${site}/registry/index.json): all ${index.components.length} components with status and renderable flag
- [Screen IR schema](${site}/registry/schema/sui.schema.json): the screen contract
- [Component schema](${site}/registry/schema/component.schema.json): the manifest contract, including actions
- [Patterns](${site}/registry/patterns/index.json): layouts, AI behaviour patterns, and complete Screen IR compositions
- [Agent policy](${site}/registry/agent-policy.json): validation is required; actions default to deny

## Components with a render contract

${contracts.map(item => `- [${item.name}](${site}/registry/components/${item.id}.json): ${item.purpose}`).join('\n')}

## Optional

- [Changelog](${site}/HISTORY.md)
- [Source](https://github.com/SyntariUI/syntari)
`;

  const contractText = contracts.map(item => {
    const actions = Object.entries(item.actions ?? {});
    return `### ${item.name} (\`syntari.${item.id}\`)

${item.purpose}

${item.guidance ? `Use when: ${item.guidance.useWhen.join(' ')}\n\nDo not use when: ${item.guidance.avoidWhen.map(entry => `${entry.text}${entry.instead ? ` Use \`syntari.${entry.instead}\`.` : ''}`).join(' ')}\n\n` : item.avoidWhen?.length ? `Avoid when: ${item.avoidWhen.join(', ')}.\n\n` : ''}Props:
${Object.entries(item.props).map(([name, prop]) => describeProp(name, prop)).join('\n')}
${actions.length ? `\nActions (fire \`syntari:action\` and \`onActionRequest\`; nothing runs until the host decides):\n${actions.map(([name, action]) => `- \`${name}\`${actionNote(action)}: ${action.description ?? ''}`).join('\n')}\n` : ''}
Valid sample:

\`\`\`json
${JSON.stringify({ component: `syntari.${item.id}`, props: item.sample.props }, null, 2)}
\`\`\``;
  }).join('\n\n');

  const compositions = patterns.filter(item => item.screenMode).map(item => `- \`${item.id}\`: ${item.description}`).join('\n');

  const full = `${intro}

${agentGuide.replace(/^# .*\n/, '## Agent integration\n')}
## Agent policy

\`\`\`json
${JSON.stringify(policy, null, 2)}
\`\`\`

## Screen IR in brief

A screen is \`{ "type": "screen", "layout": "stack" | "row" | "grid" | "two-column", "title"?, "children": [...] }\`. A child is a component node \`{ "id"?, "component": "syntari.<id>", "props": {...}, "provenance"? }\` a section \`{ "type": "section", "heading", "layout"?, "children": [...] }\` that groups nodes under a heading and never collapses, or a labelled region \`{ "type": "region", "label", "open"?, "children": [...] }\` for detail a person may skip. Components do not take children; group them in a section or a region. Calculator formulas are arithmetic only: numbers, input and earlier result names, + - * / ^, parentheses, min, max, round, floor, ceil, abs, and fv(rate, periods, payment). Media card images name an id the host supplies, never a URL. An unverified block \`{ "type": "sandbox", "label", "html", "height"? }\` holds static HTML; it is rejected unless the host allows unverified blocks, and is then shown isolated, labelled, and without scripts, network, or actions. Budgets: 120 nodes, depth 8, 40 top-level children, 40 items in any list prop. Errors stop a node and show a labelled fallback; warnings repair it. An optional prop left out leaves its slot empty.

Icon props take one of these names: ${index.icons.map(name => `\`${name}\``).join(', ')}.

Complete compositions you can fetch with \`syntari info <id> --json\` or the MCP tool \`get_pattern\`:
${compositions}

## Render contracts

${contractText}
${guided.length ? `\n## Component guidance\n\nWhen to use each component, when not and what to use instead, its states, and what to do and not do. ${guided.length} of ${index.components.length} components are documented this way so far.\n\n${guidanceText}\n` : ''}`;
  return { short, full };
}
