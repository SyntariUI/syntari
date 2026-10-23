# Syntari — next release

October 21, 2026. Change a screen without regenerating it.

- The landing is the collection page: a full-height hero with the npm install command and Quick start, a centered Components / Renderer nav with an icon-only GitHub link, nine live previews, the component count with a fading texture behind it, and Explore all components with Read the docs beneath. Docs moved from the header into the footer.
- Controls are squared-rounded instead of pills. `--radius-control` now resolves to 8px (`--radius-4`) and every button, icon button, chip, filter, segmented control, stepper, switch track and picker reads it; the new `--radius-badge` (6px, `--radius-3`) covers badges. Docks, floating toolbars and the body toolbar take `--radius-5`. Focus no longer uses the accent blue: `--focus-ring` is the neutral `--fg-a3` and the new `--focus-halo` (`--bg-a3`) replaces the blue glow on fields, composers, OTP slots, sliders and drop zones.
- Added Screen IR operations. A model proposes a change against one version of a screen, as `insert`, `replace`, and `remove` operations that name nodes by id; the runtime applies them with `applyOperations()` in the browser, `applyScreenOperations()` in Node, or the MCP tool `apply_operations`. A change written for another version is refused, every difference from the base must belong to an operation that declared it, existing data changes only with `allowDataChanges` after a person confirmed it, new figures need a source unless the screen holds demonstration data, and the whole result is validated before it replaces the last valid screen.
- `assignIds()` gives every node a stable id, `versionOf()` fingerprints a screen, `findNode()` looks a node up by id, and `diffScreens()` reports what changed node by node. The MCP tool `prepare_screen` does the first two for agents.
- Sections, regions, and unverified blocks may carry an `id`, and the renderer marks every node it paints with `data-ir-id`.
- A screen says where its figures come from in `meta.data`: `{ "mode": "demo" }` renders a Demonstration data label under the title.
- Added screen data. A screen states its figures once in `data`: typed tables with totals and roles, measures (`sum`, `avg`, `min`, `max`, `count`, `first`, `last`, formulas, or stated values with a source), and groups with ordered buckets. Props bind to it with `{ "$data": … }`, so a headline, a chart, and a table read the same numbers, computed in code and written in the screen's locale. A structurally valid screen can now fail: a figure that contradicts the data (`data-conflict`), a column that does not reach its total, a bucket label that does not match its rows, or a row no bucket covers is an error, and the part is not painted. Screens without data are checked against their own tables, as warnings.
- Added a composition policy, `registry/composition-policy.json`: which visualization fits which kind of data, and the order a report, a dashboard, a transaction workflow, and a workspace follow. A visualization that misrepresents its data, such as a risk chart that repeats the allocation under another name, is an error; order, repetition, and density are advice. `assessScreen()` and the MCP tools `assess_composition` and `get_composition_policy` expose the assessment, with seven criteria and a profile of what the screen data supports. A request for a visualization Syntari does not have is answered as `unsupported`, with the closest components that exist.
- Added `move` and `recompose` operations. `move` relocates one node unchanged. `recompose` rebuilds a whole screen from the same data for broad requests: tables and settings stay, every record stays, and no new figure appears. `replace` on `"data"` defines measures and groups.
- Added Line chart, with an optional comparison series on the same scale, a zero line, and signed values. Chart bars can stand vertically, show one series, and scale paired bars by the largest value. Table rows can be sortable. 38 components render from Screen IR.
- The Renderer artifact iterates on screens instead of regenerating them. Each screen keeps its own Screen IR, versions, validation state, and conversation; with a screen open the composer edits it, a new screen is always an explicit choice, and a request that reads like another screen asks first. A change streams into place with a skeleton where the new part goes, is validated whole, and becomes a new version, or the screen is put back exactly. Undo returns to the previous version, a screen menu returns to other screens, and a Changes view shows what each change touched and that everything else is identical. Its source now lives in `artifacts/renderer/` with browser checks.
- The Renderer receives changes through a tool call where the platform offers one, so a change arrives as data and is validated inside the call. A text answer must be exactly one JSON value: an answer followed by a second value used to fail with “Unexpected non-whitespace character after JSON”, and now gets one automatic correction, then a recovery state that keeps the screen as it was. A broad request recomposes the screen from its data with a before/after comparison, undo, and the criteria that changed. A Plan tab shows the decision trace and the policy's reading of each part, validation is grouped by category, and a development log keeps the last raw answers, redacted, until cleared.

---

# Syntari — version 0.4.0

October 20, 2026. Screens that explain, not only show.

- Added sections to Screen IR: `{ "type": "section", "heading", "layout", "children" }` puts a heading over a group with its own layout and never collapses, so an answer can read as numbered steps. Regions stay the disclosure for detail a person may skip.
- Added unverified blocks for visuals no contract covers, such as a diagram: `{ "type": "sandbox", "label", "html", "height" }`. They are rejected unless the host passes `{ sandbox: true }` to `render()`, `validateScreen()`, or the MCP tool `validate_screen`. When allowed, each renders in a sandboxed frame with no scripts, no network, no forms, and no navigation, is labelled as unverified on screen, warns in the diagnostics, and can never request an action. The agent policy records the rule as `screenIR.unverifiedBlocks`.
- Added five components with render contracts: Text block (a paragraph with steps and small print), Breakdown (a whole split into shares, which must add up to 100), Checklist (progress counted from its own boxes, with a `check` action), Media cards (artwork with captions), and Calculator (sliders whose results are recomputed from declared formulas, with the parts of the main result as shares, and an `adjust` action that reports each new input value). Selectable cards now has a contract with a `select` action. 37 components render from Screen IR.
- Calculator formulas are arithmetic only: numbers, input and earlier result names, `+ - * / ^`, parentheses, and `min`, `max`, `round`, `floor`, `ceil`, `abs`, and `fv`. They are parsed by the renderer and never run as code. Validation reports `invalid-formula`, `unknown-name`, `invalid-range`, and `off-step`.
- Media cards never load an image URL from a spec. A card names an id, and only images the host passes as `render(spec, target, { assets })` or `mount(slug, target, { props, assets })` are shown; anything else keeps the card's icon and warns `unknown-asset`.
- A list prop can declare that its parts add up to a total (`sum` in the manifest schema), reported as `wrong-sum`.
- A Process ledger stage without a `mark` shows the icon of its state: a check when done, a clock when current, a circle when pending. It used to keep the template's check, so a stage that had not happened looked finished; pending stages are now neutral instead of green. An explicit `mark` still wins. A list item field can follow another this way (`defaultFrom` in the manifest schema), and `syntari validate` checks the mapping.
- A Live readout's status dot follows its `tone`, so a degraded service no longer shows a green dot beside a red badge. A `variant` binding can set classes in several places from one value.
- `renderableSlugs()` answers from the component index, which records each component's renderable flag at build time. It used to fetch every authored manifest one at a time, so a page took 37 serial requests to start on a slow connection.
- The runtime exports `parseFormula`, `evaluateFormula`, and `formatValue`.
- A region whose `children` is not a list no longer stops the renderer.
- In a rendered screen, rows of equal cards no longer leave one card alone: four stats sit two by two instead of three plus one, and where no even split exists the last card spans the row. This covers Stat row, Headline metric, Media cards, Live readout values, Metric strip, and three Selectable cards.

---

# Syntari — version 0.3.1

October 19, 2026. Fixes from the first audit of the published 0.3.0.

- The install commands use the published npm package: `npx syntari-ui add`, `pnpm dlx syntari-ui add`, `yarn dlx syntari-ui add` (Yarn 2 or later), and `bunx syntari-ui add`. The Yarn command used to fail on every Yarn version. System no longer says npm publication is pending, and the Install panel shows how to mount the component.
- An example mounted with `onActionRequest` and no props reports its declared actions instead of running the demo, as the documentation says.
- `syntari doctor` accepts a manual setup: a missing installation marker is a note, and only a marker for another version fails.
- System guide links such as `/system/?guide=ai-patterns` open the guide. The page's `<base href>` used to drop the query before the guide was read.
- Code no longer shows Geist Mono ligatures: `var(--surface)` used to render with an arrow.
- A `two-column` screen keeps its title above both columns. The title used to take the first cell and push every node one cell along.
- Pattern previews point to the Renderer page, and the guides name the inspector panels and install paths that exist.

---

# Syntari — version 0.3.0

October 16, 2026. Version 0.2.3 was prepared but never published; its changes ship here.

- Added contract mode. `mount(slug, target, { props })` validates props against the component contract and renders one configured instance, the same contract Screen IR uses. Invalid props reject with a TypeError that carries diagnostics.
- Added Screen IR actions. Contracts declare what a person can ask for; the renderer reports each request through `onActionRequest` and a bubbling `syntari:action` event, with the node `id`, form `values`, and list `index`. Declared actions never run demo behaviour and never perform anything.
- Added render contracts for Prompt input, Agent message, Tool result, Citations, File diff, Agent activity, Agent questions, Chat composer, and Button: 31 components now render from Screen IR. Tool approval, Approval card, and Streaming response declare their actions. Every contract ships a sample that validates.
- Added `syntari mcp`, a read-only MCP server over stdio with tools to list, search, and read components and patterns, read the agent policy, and validate Screen IR. It has no dependencies and is tested with the official MCP client.
- Published `llms.txt`, `llms-full.txt`, `README.md`, and `AGENT-GUIDE.md` on the site, generated from the same registry as the package.
- Contract roots now discard every other branch of the example, as the schema documents. Demo small print no longer appears in contract instances.
- Added `local` actions for view controls. Filter bar, Chart toolbar, Metric strip, and Transport controls declare actions: a period, a comparison, a view, or a measure updates the control and reports its new `value`, `checked`, or `pressed` state, and Play, Step, and Reset wait for the host. Actions can listen for `change`.
- An optional prop that a spec leaves out now empties its slot instead of showing the template's example copy. Contracts can hide chrome that only means something beside a value (`ir.showWhen`), such as the Process ledger total.
- Model-authored icon names can no longer inject markup. A malformed icon name is an `invalid-icon` error, a name the runtime does not ship is an `unknown-icon` warning, and `SyntariIcon()` falls back to a safe icon. The registry index publishes the icon vocabulary as `icons`, and MCP `get_component` returns it for components with icon props.
- Button takes `consequential`, so one instance, such as Delete, can mark its requests consequential. Streaming response takes `streaming`, which enables Stop and disables Generate. Agent questions names its option group with the question.
- Comparison table requires `optionA` and `optionB`: a column of values without a name is not readable.
- Contract buttons outside a form no longer submit a surrounding form. Renderer warnings now carry their own message instead of their path, and a reset instance reports its diagnostics once.
- The MCP server answers JSON-RPC batches, malformed requests, and missing params with the specified error codes instead of failing.
- Removed the Transport controls keyboard hint: no shortcut handler existed. A dropdown shows the option's label, not its value, and the Chart toolbar view toggle keeps its label while `aria-pressed` carries the state.
- Charts show the agent's data, never the template's. Area chart draws its points, axis, grid, and labels from `points` on a percentage scale that fits them, with each label under its point; Metric & sparkline values stay the agent's text instead of rolling back to the example figure; Chart bars render outside the Syntari site, where they used to collapse to zero width.
- Importing the runtime no longer changes the host page. Its styles and design tokens are scoped to Syntari markup (`.syntari-component` or `[data-syntari-root]`) with the same specificity, so a host's own `--accent` or `--text` never changes; the outermost Syntari element paints its canvas, so the dark theme stays readable on any page. Its listeners and queries ignore everything else, so a host form, button, menu, dialog, keyboard shortcut, or radio group keeps its own behaviour and markup. The Ctrl+K command palette only opens on Syntari's own pages and screens. The runtime now loads `ir.css` itself.
- Validation is linear in the size of the spec, checks the node budget before the schema, and reports schema problems at their own path. The browser and Node now agree: unknown keys and a non-text layout are errors everywhere. Required text and labels cannot be empty (`empty-value`), a component with actions and no `id` raises `missing-node-id`, and a table row that does not match its columns raises `row-length`.
- Table renders one cell for each column instead of the template's three. An attribute whose prop is unset is removed instead of keeping the template's label; Area chart's label falls back to the title, and Chart bars requires `chartLabel`, the summary a screen reader hears instead of the bars. Filter bar marks the period whose label matches `period` as selected (`ir.select`), and Metric strip marks the active measure `aria-pressed`.
- A required list cannot be empty (`empty-list`), a label cannot be empty, and a `period` that matches no option raises `no-matching-item`. Unresolved nodes still count toward the budget, and the browser validator checks slots, provenance, region children, and screen meta like the schema.
- `syntari validate --spec` uses the same validator as the Node API and MCP, and `syntari list` and `search` report `renderable`. `llms-full.txt` lists the types and limits of list item fields. The package ships types for `syntari-ui/runtime/syntari.js` and `syntari-ui/runtime/ir.js`. Range and number controls report numeric values.
- The pattern screens give every actionable node an id.
- Agent questions submits its choice as `choice` instead of `focus`. The component index marks each entry `renderable`.
- Published the six AI behaviour patterns (clarification, uncertainty, delegation, recovery, memory, and generation) as a System guide that links each pattern to the components that carry it. The former standalone page redirects there, and the pattern registry points agents to it.
- Raised light-theme text contrast to WCAG AA. Tertiary labels, success text, danger text, and banner details now reach 4.5:1; all 131 components in their default state, the homepage, Renderer, and System pass an automated contrast check in both themes.
- Fixed System clearing the first row of components whose rows carry a `data-status` attribute, such as Simple data table.
- Pointed workspace preview links at System instead of the retired gallery.
- Moved the prototype workspaces (`Jev/`, `tmp/`, `new/`, `morrow/`, `art-atlas/`) to the `archive/prototypes` branch. Their public URLs redirect to the production surfaces.
- Disclosed the site's Kobbe analytics on the homepage and in the README. A test keeps analytics out of the npm package.
- Unified the product sentence and component count across the README, package metadata, site, and coverage notes, with a test that keeps them in step with the registry.
- Ported component behaviour checks from the retired gallery to System routes, and CI now runs every browser suite.
- Synced the committed registry index with current component descriptions.
- The release workflow skips versions that are already on npm, and `npm publish` always builds and tests first.

---

# Syntari UI — version 0.2.2

September 26, 2026.

- Made the homepage an intent-first renderer with three bounded compositions, validation results, and an inspectable decision trace.
- Added a versioned Node API and CLI Screen IR validation for agent projects.
- Validated component and pattern manifests against published schemas, including dependency and token references.
- Moved registry generation into build output so building no longer writes skeleton manifests into source.
- Added a focused browser gate for the homepage, renderer, and clean-project package install.
- Prepared npm publication with provenance and a GitHub release archive; kept the site archive as an installation fallback.

---

# Unreleased

September 16, 2026.

- Renamed the design system to Syntari across the interface, documentation, runtime, source archive, and installer.
- Renamed the installation command to <code>syntari</code> and the default installed directory to <code>components/syntari</code>.
- Set the Syntari mark, favicon, sign-in art, icon tiles, avatars, artwork, selection controls, and hover surfaces in solid fills, and removed the brand gradient token from the token set and registry.
- Rebuilt the asset swap as a two-sided convert form: each field carries its own asset select, the reverse control sits on the seam between the fields, and the primary action reviews the order.
- Added the Syntari UI IR: a screen spec an agent can produce, prop contracts and slot bindings for twenty-two components, a reference renderer that validates against the published registry, and labelled fallbacks for anything it cannot draw. The guide is at `guides/generative-ui/`, and the renderer at `generative-ui.html` shows the same registry in two modes — a report to read and an overview screen rendered from a spec — beside the catalogue it draws from.
- Added livelier motion: staggered entrances, card hover lift, springy controls, and a brand-mark hover response.
- Added matching sidebar and topbar layouts to the App shell and starter screens, with shared workspace, search, account, and navigation controls.
- Added a collapsible rail with accessible destination names and a mobile drawer with keyboard dismissal and focus restoration.
- Preserved navigation preferences across screens and form edits when switching layouts.
- Refined library navigation spacing and active states, and strengthened keyboard focus contrast in both themes.
- Added a full-screen workspace preview at `preview.html`.

---

# Syntari UI — version 0.2.1

September 11, 2026.

- Unified the gallery and documentation into one Syntari experience.
- Refined the component library’s controls, navigation, chat surfaces, cards, and data-table hierarchy.
- Added desktop drag support to the swipeable list.
- Clarified the shared Syntari system scope across library guidance and examples.

---

# Syntari UI — version 0.2

September 10, 2026.

- Dedicated static documentation routes for all 106 component families.
- Preview, Usage, and Code views with 246 authored states and layouts.
- Copyable source, module entries, shared interaction files, and styles.
- Versioned source archive and CLI installer; equivalent manual installation.
- Runtime mounting API and per-component native element contracts.
- Seven guides covering setup, installation, theming, motion and accessibility, composition, runtime API, and migration.
- Original gallery and four composed screens retained at `gallery.html`.
- Light/dark and mobile layouts; all 11 test suites pass, including fresh-project installation.

The content below records the earlier milestone and its scope at that time.

---

# Syntari UI — milestone 01

A working, framework-independent component gallery with 38 component families, light and dark themes, search, category navigation, component inspection, HTML copying, and token export.

## Run

From this directory, run `python3 -m http.server 4318 --bind 127.0.0.1`, then open http://127.0.0.1:4318.

No install or build is needed. Font files are local. There are no analytics, API calls, or external runtime dependencies. (Since September 22, 2026 the documentation site loads Kobbe analytics; the npm package and installed components still contain none.)

## Files

- `index.html`: gallery shell and native dialogs.
- `app.js`: example catalog, interactions, search, and inspection.
- `tokens.css`: light/dark tokens and Syntari semantic aliases.
- `styles.css`: shared component and gallery styles.
- `motion.css`: transitions, elevations, moving selections, and composed card/toolbar styles.
- `motion.js`: interruptible entrances, dialogs, disclosures, and reduced-motion support.
- `assets/`: OpenRunde regular, medium, semibold.

## Scope

This is a gallery milestone, not a packaged component library. Copied HTML uses the shared styles and, for interactive examples, app.js event handlers. Demo actions and messages are local; no files are uploaded, no project records are stored, and no external changes occur. Theme preference persists locally. Search filters the catalog by names, descriptions, and category.

The next milestone can extract components into the chosen product framework, add formal APIs and documentation.

## Verification

27 browser checks passed: catalog, themes and persistence, search and category filtering, keyboard selection, switches, tab panels, menu dismissal, component inspection, project dialog, pagination, local chat, foundations, token download, and overflow at 390/768/1440px in both themes. No JavaScript runtime errors. Browser check source: `checks/browser-check.mjs`.

## Motion milestone

Subtle motion now covers every specimen entrance and the interactive states of controls. Navigation panels fade and settle; selected pills slide; charts and progress reveal once on entering the viewport. Buttons have hover elevation and a restrained press response. Dialogs, menus, toasts, accordion details, chips, and chat messages have short entrance or exit transitions. The gallery toolbar remains available while scrolling.

New examples: Session card, Selection toolbar, and Expandable dock. Use Realtime in the expandable dock to reveal its contextual summary. Use Replay motion to replay visible specimens. Foundations explains the timing scale; exported tokens include both theme elevations and shared motion timing.

The OS reduced-motion preference disables transitions and Web Animations, including when changed during an animation. State changes and keyboard controls remain available. No animation library or runtime dependency was added. Native disclosure height and the small expanding dock intentionally animate layout so surrounding content follows their size; entrances and moving indicators primarily use opacity and transforms.

Validation: the 27 gallery checks still pass, plus 20 motion checks covering interrupted disclosure, expanding dock, contextual toolbar, nested Escape behavior, live reduced-motion changes, and mobile layouts in both themes. See `checks/motion-check.mjs`.

## Data motion milestone

Attribution table, Rolling number, and Visitor table now lead the gallery. The ranked table uses two proportional segments per row: neutral people and green revenue, separated by a small gap. Bars resize in 300ms. Hover or keyboard focus reveals currency; Show revenue provides the same interaction for touch. Countries/Sources swaps dimensions. Update advances the demo, and Pause stops automatic updates.

The reusable numeric display masks each digit and rolls changed columns, maintaining tabular figures and one accessible final-value label. It handles increases, decreases, currency, and changes in digit count. Initial build lasts 800ms with a small digit stagger; updates use 650ms. Metric, score, and visitor-table values share the primitive. Replay motion restarts the visible numeric builds.

Automatic updates run every three seconds only while the table is visible, the document is visible, and reduced motion is off. No external data is used. Implementation: `numbers.js` and `numbers.css`.

Validation: 27 gallery checks, 20 motion checks, and 17 numeric/table checks passed. Numeric checks cover hover/focus, touch revenue toggle, dimension changes, rapid 999 → 1,000 → 9 updates, reduced-motion behavior, live-update gating, and mobile overflow in both themes. See `checks/numbers-check.mjs`.

## Gallery refinements

Checkboxes and radios retain native input semantics with rounded shells, subtle inset highlights, and animated selected marks. All shared icon paths now come from Lucide v0.468.0; the local ISC license is in `assets/lucide-LICENSE.txt`. The date input uses a Lucide calendar while retaining the platform picker. Toasts and the toast specimen stay navigation-dark in either theme. File input is a keyboard-accessible clickable drop zone with local-file feedback; the browser's file button is hidden.

## Unified form controls

Workspace select now uses the shared dropdown surface. A custom calendar replaces the native date popup, including month controls, Today, roving day focus, arrow navigation, Home/End, Page Up/Down with month-end clamping, Escape dismissal, and viewport positioning. Selection controls use flat semantic surfaces and the shared lavender accent. Slider track, fill and thumb are explicitly styled in WebKit and Firefox; its fill follows pointer and keyboard input with 100-event steps. The asset zone uses the empty-state composition and a small Select assets button while retaining drop support.

Shared UI icons, including source-category symbols and verification marks, use local Lucide paths. Country flags remain content. Asset URLs are versioned to avoid older browser-cached scripts and styles. Open `http://127.0.0.1:4318/?v=controls2` for this revision.

Validation: 20 custom-control checks and 27 gallery checks passed, including keyboard selection, calendar month-end transitions, mobile popup bounds, range extrema, and local drop behavior. See `checks/controls-check.mjs`.
