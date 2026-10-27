# Syntari agent integration

Use Syntari as a bounded interface renderer. Retrieve its current contracts, and decide what belongs on the screen before choosing a single component.

1. Discover components and patterns. From a terminal, run `syntari list --json`, `syntari patterns --json`, and `syntari info <id> --json`. From an MCP client, connect `npx -y syntari-ui mcp` and use `search_components`, `list_components`, `get_component`, and `get_pattern`. Models without tools can read [llms.txt](https://syntariui.giovanitier.com/llms.txt) and [llms-full.txt](https://syntariui.giovanitier.com/llms-full.txt).
   Read `syntari registry policy --json` or the MCP tool `get_agent_policy` for the machine-readable rendering and action boundary.
2. Plan the screen (see [Plan before composing](#plan-before-composing)): write a brief, call `plan_screen` (`syntari plan --brief brief.json`, `planScreen(brief)` in Node), and compose from the plan it returns. The plan decides the archetype, what is primary, what waits one step away, and what to avoid; components come after.
3. Choose components that fit the plan's zones. Use only component ids declared by the registry. Prefer components marked `renderable`: they declare `props`, `ir`, `actions`, and a valid `sample`. Other components are documented but cannot render from Screen IR yet.
4. Produce JSON that matches `registry/schema/sui.schema.json`. Keep values inside each manifest's prop types, enum values, ranges, and list limits. Give every node that a person can act on a unique `id`. Group the parts of a screen in sections (`{ "type": "section", "heading", "layout"?, "emphasis"?, "surface"?, "children" }`) in the plan's order. Put reference information in labelled regions. Explain numbers with Text block and Breakdown, let people explore with Calculator, whose formulas are arithmetic only, and never write an image URL: Media cards name image ids the host supplies.
5. Run `syntari validate --spec screen.json --json`, call `validateScreen(spec)` from `syntari-ui`, or use the MCP tool `validate_screen`. Repair every error before presenting the screen. Then run `assess_composition` (`syntari assess`, `assessScreen`) and fix its error and warning findings. Preserve the rest in the decision trace.
6. Render with `render(spec, target, { onActionRequest, assets })` from the installed browser runtime. Show the intent, the plan, the Screen IR, validation and composition findings, and the rendered interface so a person can inspect why the screen looks as it does.

## Plan before composing

A screen that validates can still serve the wrong job: four headline measures above a queue of overdue approvals, every setting at once in bordered cards, a paragraph saying “several values changed” beside a button that saves them. Valid components do not decide what belongs on the screen. The plan does.

1. Write a brief from what you know of the person and the request. The words of the request are not the job: “dashboard” names a place, and the job decides whether it is a monitoring dashboard, a work queue, or a record.

```json
{ "request": "Build a financial advisor dashboard",
  "user": { "role": "Financial advisor", "frequency": "daily" },
  "job": { "primary": "clear the client items waiting on them, most urgent first", "mode": "resolve" },
  "decisions": ["Which client item to handle first"],
  "information": [
    { "id": "overdue", "label": "Overdue client items", "kind": "exception", "exception": true },
    { "id": "queue", "label": "Client items waiting on the advisor", "kind": "pending-item", "neededFor": ["choose which item to handle first"] },
    { "id": "book", "label": "Book of business totals", "kind": "aggregate-metric", "frequency": "rare" } ],
  "actions": [{ "label": "Open the most urgent item", "kind": "primary" }] }
```

   `mode` is one of `resolve`, `decide`, `review`, `investigate`, `monitor`, `create`, `configure`. Each piece of information has a `kind` from `get_composition_guidance` (`information.kinds`): `pending-item`, `entity-profile`, `status`, `exception`, `aggregate-metric`, `trend`, `breakdown`, `category-comparison`, `records`, `source-document`, `extracted-value`, `discrepancy`, `impact`, `alternative`, `setting`, `history`, `explanation`, `decision`. Say which decisions it informs with `neededFor`, how often it is needed with `frequency`, and whether an exception is present now with `exception`.
2. `plan_screen` turns the brief into a plan (`registry/schema/plan.schema.json`, version `syntari-plan-1`), by rules, the same way every time: the archetype and the alternatives it considered, each piece of information's priority (`primary`, `supporting`, `reference`) and disclosure (`visible`, `collapsed`, `on-selection`, `on-exception`, `elsewhere`), the zones in order, the layout, candidate components, what to avoid, and a rationale. Without a job and information its status is `needs-context`: ask the person its `openQuestions` instead of guessing.
3. The archetypes are `task-triage` (resolve pending work), `record-workspace` (work on one client, account, or shipment), `evidence-review` (check values against their source and confirm what is saved), `comparison-workspace` (choose between alternatives), `configuration-workspace` (settings, grouped, with the rare ones out of the way), `monitoring-dashboard`, and `analytical-report`. `get_pattern` returns each with a complete example, the anti-pattern for the same job, and what differs between them.
4. Compose from the zones. Put the plan in `meta.plan` and add to each piece of information the ids of the nodes that show it (`"nodes": ["queue-table"]`), and to the primary action its `node`. Validation then holds the screen to the plan: a plan that is invalid or names a node the screen does not have is an error (`plan-invalid`, `plan-unknown-node`). A `meta.plan` without a version is a legacy plan and is read as before.

Layout, emphasis, and surfaces follow the plan:

- `"layout": "split"` holds two parts: the main one, and the one a person consults beside it (the source, the selected item, the working context). On a narrow screen the aside follows the main part.
- A section's `emphasis` is `primary` for the task itself, `supporting` (the default), or `reference`. Two parts can lead a screen; more and none does.
- A section's `surface` is `none` (the default: space and the heading separate it), `inset`, or `panel`. A boundary needs a reason: an independent object, a different context, a form, or a disclosure. A card inside a panel, or three cards standing in for a list, repeats boundaries; separation is a property of the layout, not of a divider between every pair of things.

`assess_composition` (`syntari assess --spec screen.json`, `assessScreen(spec)`) reads the screen against its plan and returns `findings`, each with a `rule`, a `severity`, the `node`, a `message`, a `fix`, and whether it is safe to apply automatically:

- **error**: unsafe or invalid. Information a decision needs in a closed region (`hidden-decision-input`), an exception that is present but collapsed (`hidden-exception`).
- **warning**: a probable problem in hierarchy, grouping, redundancy, or disclosure. Headline measures on a task screen (`kpi-grid-on-task-screen`), cards per item or per setting, reference before primary (`priority-order`), nested surfaces, text restating the figures beside it, a summary of change that names no value, a queue with no order to act on, competing primary actions, a decision without its consequences.
- **suggestion**: one improvement among several good answers.

Each rule is deterministic and listed in `lint.rules` of the composition policy; none of them is a model's opinion. `quality` adds the findings up to a verdict per criterion and a gate (`fail`, `review`, `pass`); it is never a score. Responsive layout and contrast need a rendered review, and say so. `repair` is a change for `apply_operations` holding the safe fixes only (opening a region that hides a decision input, closing one that shows reference), so existing data and records stay protected; `repairScreen(spec)` applies it in Node.

A rendered review is optional and separate: `assessRenderedScreen({ screenshot, viewport, spec }, { adapter })` hands a screenshot to an adapter the host supplies, such as a vision model, checks its answer against `registry/schema/visual-review.schema.json`, and labels it a judgment. It never becomes a diagnostic.

## Two ways to build with Syntari

**Screen IR, rendered by Syntari.** The runtime validates the schema, every component contract, the data, and the plan before anything paints, and assessment checks the composition against the plan. This guide's steps apply in full.

**Components installed as source.** `syntari add` copies components into a project, and an agent writes HTML, JavaScript, or React around them. Nothing validates that markup: Screen IR checks cannot see it, and Syntari does not claim they do. Use the same plan, and:

- read `runtime/COMPOSITION.md` in the installation, or run `syntari rules`: the archetypes, priority and disclosure rules, surfaces, and lint rules as Markdown, generated from the same policy. Point your project's agent instructions at it once, instead of pasting a prompt every time;
- run `syntari lint-markup <files> --plan plan.json`, or the MCP tool `lint_markup`, on what you wrote. It reads markup as text and reports nested surfaces, cards standing in for lists, dividers used as spacing, competing primary buttons, banners that are not exceptions, and, with a plan, headline measures the plan avoids. It cannot see layout, runtime styles, or conditional rendering; passing it is not validation.

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

- Declare the decision in `meta.plan`: the plan from `plan_screen` (see [Plan before composing](#plan-before-composing)), which also carries `pattern`, `purpose`, and `rationale` for the checks below. A legacy plan, `{ pattern, purpose, questions, groups, alternatives, rationale, limits }`, is still read. It is shown to the person as the decision trace; it is not private reasoning.
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

## Forms

A section with a `submit` label is a form: `{ "type": "section", "heading": "Invite a teammate", "submit": "Send invite", "children": [...] }`. Its fields are the form controls in the registry: Text input, Text area, Checkbox, Radio, Switch, Slider, Range slider, Number input, Searchable select, Multi-select, Date range picker, and Selectable cards. Each field is sent under its `name` prop; left out, the name is its label in camelCase, so "Work email" is sent as `workEmail`. Submitting reports one request with every value, typed:

```json
{ "component": "form", "action": "submit", "id": "invite", "path": "children[1]", "values": { "workEmail": "ana@example.com", "role": "editor", "notify": true, "seats": 3, "labels": ["Design"], "period": { "start": "2026-09-01", "end": "2026-09-30" } }, "consequential": false }
```

A number or a slider sends a number, a range slider a list of its low and high ends, a switch `true` or `false`, a checkbox group the list of checked values, a radio group the chosen value or `null`, and a searchable select the chosen option or `null`; text that is not one of the options is refused before anything is sent. Set `"consequential": true` on the section when sending it is hard to undo. Validation reports a field outside any form (`field-outside-form`, a warning: nothing it holds reaches the host), two fields sent under one name (`duplicate-field-name`), a form inside a form or a component that is a form of its own, such as Prompt input, inside one (`nested-form`), and a form with no fields (`form-without-fields`).

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
