# Syntari agent integration

Use Syntari as a bounded interface renderer. Retrieve its current contracts before composing a screen.

1. Discover components and patterns. From a terminal, run `syntari list --json`, `syntari patterns --json`, and `syntari info <id> --json`. From an MCP client, connect `npx -y syntari-ui mcp` and use `search_components`, `list_components`, `get_component`, and `get_pattern`. Models without tools can read [llms.txt](https://syntariui.giovanitier.com/llms.txt) and [llms-full.txt](https://syntariui.giovanitier.com/llms-full.txt).
   Read `syntari registry policy --json` or the MCP tool `get_agent_policy` for the machine-readable rendering and action boundary.
2. Choose a pattern and components that fit the user's intent. Use only component ids declared by the registry. Prefer components marked `renderable`: they declare `props`, `ir`, `actions`, and a valid `sample`. Other components are documented but cannot render from Screen IR yet.
3. Produce JSON that matches `registry/schema/sui.schema.json`. Keep values inside each manifest's prop types, enum values, ranges, and list limits. Give every node that a person can act on a unique `id`. Structure an answer in sections (`{ "type": "section", "heading", "layout"?, "children" }`): the finding, the evidence, then the decision. Put skippable evidence and provenance in labelled regions. Explain numbers with Text block and Breakdown, let people explore with Calculator, whose formulas are arithmetic only, and never write an image URL: Media cards name image ids the host supplies.
4. Run `syntari validate --spec screen.json --json`, call `validateScreen(spec)` from `syntari-ui`, or use the MCP tool `validate_screen`. Repair every error before presenting the screen. Preserve warnings in the decision trace.
5. Render with `render(spec, target, { onActionRequest, assets })` from the installed browser runtime. Show the intent, selected pattern, candidate components, decision, Screen IR, validation results, and rendered interface so a person can inspect why the screen looks as it does.

## Unverified blocks

Some explanations need a visual no contract covers, such as a diagram. A host may allow unverified blocks: `{ "type": "sandbox", "label", "html", "height"? }`. They are rejected by default (`sandbox-not-allowed`). A host that passes `{ sandbox: true }` to `render()`, `validateScreen()`, or the MCP tool `validate_screen` gets them in a sandboxed frame with no scripts, no network, no forms, and no navigation, labelled as unverified, with a warning in the diagnostics. They can never request actions. Prefer registry components; use a block only for what no contract can show.

## Actions

A contract declares what a person can ask for, such as `approve` and `reject` on Tool approval, `submit` on Prompt input, or `open` on Citations. When a person acts, the renderer calls `onActionRequest` and dispatches a bubbling `syntari:action` event with:

```json
{ "component": "tool-approval", "action": "approve", "id": "deploy", "path": "children[0]", "consequential": true }
```

Form actions add `values` with what the person entered. List actions add `index`. Declared actions never run demo behaviour and never perform anything. Re-render with the outcome once the host has decided.

View controls, such as the period on Filter bar, Compare on Chart toolbar, or the chosen measure on Metric strip, are `local` actions: the control updates itself, then the request reports its new state in `values` (`value`, `checked`, or `pressed`) so the host can load the matching data. Set an instance's consequence with its props where the contract allows it, such as `consequential: true` on a Delete button.

Leave an optional prop out and its slot stays empty: the renderer never shows the template's example copy. Required text and labels cannot be empty strings, and every component that declares actions needs an `id`. Icon props take a name from `icons` in the registry index (also returned by `get_component`): a malformed name is an `invalid-icon` error, and a well-formed name the runtime does not ship is an `unknown-icon` warning that keeps the component's own icon.

## Action boundary

Screen validation controls UI composition. A button or approval card is a visual affordance; it does not grant permission to run a tool. The host application must keep authentication, tool allowlists, data scope, and human approval in trusted code outside the model's Screen IR. A model-provided `approved: true` value is not evidence of human consent, and an `approve` request is consent to ask for, not authorization.

For a consequential action, the host should validate its arguments and scope, obtain approval through its own trusted state, then execute the action. Show the outcome and any failure in a new validated Screen IR result. Never infer permission from a rendered component or a model-authored provenance field.

## Example

```js
import { getComponent, getPattern, validateScreen } from 'syntari-ui';

const approval = await getComponent('tool-approval');
const screen = {
  type: 'screen',
  children: [{ id: 'deploy', component: 'syntari.tool-approval', props: approval.sample.props }]
};
const { ok, diagnostics } = await validateScreen(screen);
const next = ok ? { status: 'ready', screen, diagnostics } : { status: 'repair', diagnostics };
```
