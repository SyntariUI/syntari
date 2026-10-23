# Syntari agent integration

Use Syntari as a bounded interface renderer. Retrieve its current contracts before composing a screen.

1. Discover components and patterns. From a terminal, run `syntari list --json`, `syntari patterns --json`, and `syntari info <id> --json`. From an MCP client, connect `npx -y syntari-ui mcp` and use `search_components`, `list_components`, `get_component`, and `get_pattern`. Models without tools can read [llms.txt](https://syntariui.giovanitier.com/llms.txt) and [llms-full.txt](https://syntariui.giovanitier.com/llms-full.txt).
   Read `syntari registry policy --json` or the MCP tool `get_agent_policy` for the machine-readable rendering and action boundary.
2. Choose a pattern and components that fit the user's intent. Use only component ids declared by the registry. Prefer components marked `renderable`: they declare `props`, `ir`, `actions`, and a valid `sample`. Other components are documented but cannot render from Screen IR yet.
3. Produce JSON that matches `registry/schema/sui.schema.json`. Keep values inside each manifest's prop types, enum values, ranges, and list limits. Give every node that a person can act on a unique `id`. Structure an answer in sections (`{ "type": "section", "heading", "layout"?, "children" }`): the finding, the evidence, then the decision. Put skippable evidence and provenance in labelled regions. Explain numbers with Text block and Breakdown, let people explore with Calculator, whose formulas are arithmetic only, and never write an image URL: Media cards name image ids the host supplies.
4. Run `syntari validate --spec screen.json --json`, call `validateScreen(spec)` from `syntari-ui`, or use the MCP tool `validate_screen`. Repair every error before presenting the screen. Preserve warnings in the decision trace.
5. Render with `render(spec, target, { onActionRequest, assets })` from the installed browser runtime. Show the intent, selected pattern, candidate components, decision, Screen IR, validation results, and rendered interface so a person can inspect why the screen looks as it does.

## Screen data

A screen that shows numbers states them once, in `data`, and binds every figure to it. The runtime computes each measure and group in code, so a headline, a chart, and a table cannot disagree:

```json
"data": {
  "mode": "demo", "label": "Illustrative portfolio", "currency": "EUR", "locale": "es-ES",
  "tables": { "holdings": { "key": "asset", "fields": {
    "asset": { "type": "text", "label": "Asset" },
    "weight": { "type": "percent", "label": "Weight", "total": 100, "role": "allocation" },
    "liquidityDays": { "type": "days", "label": "Liquidity", "role": "liquidity" } }, "rows": [ ] } },
  "measures": { "liquid30": { "label": "Liquid within 30 days", "sum": "holdings.weight", "where": { "liquidityDays": { "max": 30 } }, "format": "percent" } },
  "groups": { "ladder": { "table": "holdings", "by": "liquidityDays", "value": "weight", "buckets": [{ "label": "D0", "max": 0 }, { "label": "D1–30", "max": 30 }, { "label": ">D30" }] } }
}
```

- A table declares each field's `type` (`text`, `category`, `period`, `date`, `number`, `percent`, `currency`, `days`), and may declare a `total` the column must add up to and a `role` (`allocation`, `exposure`, `risk-contribution`, `volatility`, `return`, `benchmark`, `value`, `liquidity`, `count`). Allocation, exposure, volatility, and risk contribution are different things: a field holds one of them.
- A measure is `sum`, `avg`, `min`, `max`, `count`, `first`, or `last` over `table.field`, with an optional `where`; a `formula` over other measures; or a stated `value` with its `source`. A group splits a table `by` a field, with `value` or `values`, ordered `buckets` whose `max` is inclusive, `order`, and `top`. Bucket boundaries must cover every row.
- A prop binds with `{ "$data": "measures.liquid30" }`, `{ "$data": "groups.ladder", "map": { "label": "label", "a": "value" } }`, or `{ "$data": "tables.holdings", "cells": ["asset", { "field": "weight", "format": "percent" }], "sort": { "by": "weight", "dir": "desc" } }`. Formats are `percent`, `signed-percent`, `points`, `currency`, `compact-currency`, `number`, `integer`, `days`, and `text`, written in the screen's locale.
- A literal figure whose label names data must agree with it: “Liquid within 30 days: 38 %” beside rows that add up to 48 % is a `data-conflict` error, and that part is not painted. Totals (`data-total`), bucket labels that do not match their rows (`bucket-mismatch`), uncovered rows (`bucket-gap`), and unknown references are errors too. A screen without data is checked against its own tables where it can be, as warnings, because the runtime cannot know which figure is canonical.
- `mode` is `provided` or `demo`. Demonstration data is labelled under the title.

## Composition

`registry/composition-policy.json` (MCP `get_composition_policy`, `getCompositionPolicy()` in Node) says which visualization fits which kind of data, and the order each kind of screen follows: a report, a dashboard, a transaction workflow, a workspace. Time series take a line or area chart; parts of a whole take a breakdown; ordered buckets take ordered bars; risk contribution is compared with weight, not shown as a second allocation; records take a sortable table.

- Declare the decision in `meta.plan`: `{ pattern, purpose, questions, groups, alternatives, rationale, limits }`. It is shown to the person as the decision trace; it is not private reasoning.
- Validation separates hard errors from advice. A visualization that misrepresents its data (a pie chart of a time series, a risk chart that repeats the allocation, `misleading-visualization`, `relabeled-data`) is an error. Order, repetition, density, and weak fits (`summary-not-first`, `repeated-metric`, `redundant-visualization`, `weak-visualization`) are advice: they are inspectable, and they are not presented as objective.
- `assessScreen(spec)` or the MCP tool `assess_composition` returns the pattern, each part's data role and fit, seven criteria with a verdict, and a profile of the screen data that lists the visualizations each table, measure, and group supports.
- When a request names a visualization Syntari does not have, such as a scatter plot or a map, answer `unsupported: [{ visualization, reason, closest }]` instead of imitating it with another component.

## Changing a screen

Change a screen that exists with operations; never regenerate it to add one part. Give every node an id with `assignIds(spec)` (or the MCP tool `prepare_screen`), show the model the screen with its `versionOf(spec)`, and ask it for a change:

```json
{ "version": "syntari-ops-1", "base": "sv-5884dcb6", "summary": "Add a table of employees under the chart",
  "operations": [{ "op": "insert", "parent": "section-trend", "after": "area-chart", "node": { "id": "employee-table", "component": "syntari.table", "props": { } } }] }
```

`applyScreenOperations(spec, change, options)` in Node, `applyOperations(spec, change, options)` from the browser runtime, or the MCP tool `apply_operations` applies it. The model proposes; the runtime applies:

- Each operation names its scope by id. `insert { parent?, after? | before?, node }` adds one node at that place. `replace { target, set: { "props.caption": … } }` changes only the listed fields; `replace { target, node }` replaces one node and keeps its id and kind; the screen title is `replace { target: "screen", set: { "title": … } }`. `move { target, parent?, after? | before? }` moves one node, unchanged; it must name where. `remove { target }` removes one node and what it holds.
- `replace { target: "data", set: { "measures.excess": { … } } }` defines a measure or group; definitions are computed from the rows, so they add no figure. Tables, sources, and settings are protected data.
- A broad request, such as “improve the hierarchy of the whole screen”, is one `recompose { screen }`, alone in its change: the whole new screen, with the same data. It may add measures and groups; it may not change tables or settings (`data-changed`), drop a record its tables showed (`dropped-records`), or quote a figure the data does not hold. A screen without data states its rows in `data` first, using only figures already on the screen. `diffScreens()` reports the moves and the data entries a recomposition touched.
- A change written for another version is refused (`stale-base`). The result is compared with the base node by node, and any difference no operation declared is refused (`scope-violation`). `diffScreens(before, after)` returns the same comparison, for showing exactly what a change touched.
- Existing data is protected: a figure or a record already on the screen cannot change unless the host passes `allowDataChanges` after a person confirmed it (`protected-data`; the refused result lists what would change in `authorization`). Titles, captions, labels, and notes are copy and may be reworded.
- New figures need a source. With `data: "strict"`, the default, a number that appears neither on the screen nor in `options.sources` is refused (`unsourced-data`). With `data: "demo"` it is reported (`demo-data`), and the screen must say so: `meta.data = { "mode": "demo" }` renders a Demonstration data label under the title.
- The whole result is validated, including its data and composition. Errors the base already had do not block the change; new ones do. On any error, `ok` is false and `spec` is null: keep the last valid screen.
- Ask for the change in a form the model cannot break. Where the provider supports it, offer a tool whose input is the change and validate it inside the tool, handing problems back once; otherwise read exactly one JSON value from the answer and treat a second value or a cut-off answer as a failed attempt. Allow one automatic correction, then show a recovery state with the screen unchanged. Never ask a person to repair JSON or Screen IR.
- Instead of operations, a model may answer `clarify` (`{ "kind": "new-screen" | "recompose" | "question", "message" }`), `needs` (`[{ "data", "reason" }]`), or `unsupported` (`[{ "visualization", "reason", "closest" }]`). The host asks the person. The model never switches to a new screen on its own: the interface decides whether a request edits this screen or starts another.

## Unverified blocks

Some explanations need a visual no contract covers, such as a diagram. A host may allow unverified blocks: `{ "type": "sandbox", "label", "html", "height"? }`. They are rejected by default (`sandbox-not-allowed`). A host that passes `{ sandbox: true }` to `render()`, `validateScreen()`, or the MCP tool `validate_screen` gets them in a sandboxed frame with no scripts, no network, no forms, and no navigation, labelled as unverified, with a warning in the diagnostics. They can never request actions. Prefer registry components; use a block only for what no contract can show.

## Actions

A contract declares what a person can ask for, such as `approve` and `reject` on Tool approval, `submit` on Prompt input, or `open` on Citations. When a person acts, the renderer calls `onActionRequest` and dispatches a bubbling `syntari:action` event with:

```json
{ "component": "tool-approval", "action": "approve", "id": "deploy", "path": "children[0]", "consequential": true }
```

Form actions add `values` with what the person entered. List actions add `index`. Declared actions never run demo behaviour and never perform anything. Re-render with the outcome once the host has decided.

View controls, such as the period on Filter bar, Compare on Chart toolbar, or the chosen measure on Metric tabs, are `local` actions: the control updates itself, then the request reports its new state in `values` (`value`, `checked`, or `pressed`) so the host can load the matching data. Set an instance's consequence with its props where the contract allows it, such as `consequential: true` on a Delete button.

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
