# Unreleased

September 16, 2026.

- Renamed the design system to Syntari across the interface, documentation, runtime, source archive, and installer.
- Renamed the installation command to <code>syntari</code> and the default installed directory to <code>components/syntari</code>.
- Set the Syntari mark, favicon, sign-in art, icon tiles, avatars, artwork, selection controls, and hover surfaces in solid fills, and removed the brand gradient token from the token set and registry.
- Rebuilt the asset swap as a two-sided convert form: each field carries its own asset select, the reverse control sits on the seam between the fields, and the primary action reviews the order.
- Added the Syntari UI IR: a screen spec an agent can produce, prop contracts and slot bindings for ten components, a reference renderer that validates against the published registry, and labelled fallbacks for anything it cannot draw. The guide is at `guides/generative-ui/` and the live demo at `generative-ui.html`.
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

No install or build is needed. Font files are local. There are no analytics, API calls, or external runtime dependencies.

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
