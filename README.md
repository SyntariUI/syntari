# Syntari 0.2.1

Syntari is an agentic design system: interactive components, design tokens, and agent-interface patterns, backed by a machine-readable registry that agents can query, compose, validate, and safely evolve.

107 component pages, 252 authored preview states and layouts, seven guides, and four starter screens. Light and dark themes share Syntari’s tokens, OpenRunde typography, Lucide icons, and restrained motion.

Each component page includes Preview / Usage / Code, CLI and manual installation, its element contract, runtime API, and guidelines. All examples use the same editable HTML, CSS, and JavaScript runtime included in the source archive.

Syntari is prepared for public source distribution. A license file and contribution policy are the remaining publication choices; select and add them before publishing a package to a registry.

## Run locally

Use Node.js 22 or newer:

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:4318/ for Syntari. Gallery and Components are views of the same application, with shared navigation, theme, and component runtime. `/gallery.html` still accepts screen and category query parameters; `q` stores the gallery search. Gallery cards open their component page in place, and returning restores the selected category, search, and scroll position. Run the build again after adding catalog entries or changing installation source. The development server serves files from this directory without caching.

## Workspace navigation

Open `/preview.html?screen=projects` to explore a full workspace without the documentation frame. The Sidebar / Topbar control changes the layout while preserving the current screen and unsaved form edits. The same navigation component powers the App shell example and the project, team, and settings starter screens. A compact icon rail and a modal drawer cover narrower layouts; the library sidebar shares their navigation tokens.

The shared implementation lives in `navigation.js` and `navigation.css`. Destination links, optional counts, pinned records, and workspace actions use the same structure in both layouts. Applications can handle the cancellable `syntari:shell-action` event on a shell and use `syntari:layout-change` to store layout preferences. Example data and actions remain local to the preview.

## Use a component

With the local site running:

```sh
npm exec --yes --package="http://127.0.0.1:4318/downloads/syntari-ui-0.2.1.tgz" -- syntari add button
```

```html
<div id="action"></div>
<script type="module">
  import { mount } from './components/syntari/button.js';
  const button = await mount('#action');
</script>
```

The CLI copies the selected entries and a shared runtime to `./components/syntari`. Use `--dir` to choose another directory. Existing source files are preserved. The downloadable archive also contains editable HTML for manual enhancement with `prepare(root)`.

This command uses the archive served by the documentation site; no published npm package is required. Package-manager command variants are available on each component page. The application must be served over HTTP.

## Test and build

```sh
npx playwright install chromium
npm test
npm run build
```

The browser checks cover the shared gallery and documentation shell, category and search history, gallery scroll restoration, component workflows, all 107 page routes, all 252 authored preview states, documentation navigation, clipboard, keyboard controls, light/dark themes, reduced motion, responsive layouts, and a fresh-project installation from the downloadable archive. The installer check also verifies that existing files are preserved and invalid component names are rejected.

`dist/` contains the complete static site, generated routes, and versioned source download. The deployment configuration can build and publish it; local changes are not published by the build command.

## Project structure

- `docs-data.js`, `docs-guides.js`: example states, element contracts, and guides.
- `syntari.js`: reusable mounting and manual enhancement API.
- `cli.mjs`: source installer.
- `docs.html`, `docs.js`, `docs-gallery.js`, `docs.css`: shared Syntari shell, routes, gallery, and documentation. The build generates both `index.html` and the compatible `gallery.html` entry from this shell.
- `app.js`, `styles.css`: base component templates and gallery rendering, shared with the documentation runtime.
- `starter.*`, `agents.*`, `extras.*`: additional interactive patterns and starter screens.
- `tokens.css`, `motion.*`, `numbers.*`, `controls.*`: shared foundations.
- `support.html`: shared overlay templates.
- `assets/`: fonts and third-party license notices.
- `scripts/catalog.mjs`, `scripts/build.mjs`: catalog extraction and static/source packaging.
- `checks/`: repeatable browser and installer verification.
- `index.html`, `components/`, `guides/`, `kit/`, `downloads/`, `dist/`: generated outputs.

## Scope and reuse

The 0.2 distribution is a shared browser runtime with editable interaction examples. It is framework-independent, not a React component package or hosted service. Its styles include a base reset; review conflicts before inserting them into an existing product. Demo data, uploads, sign-in, approvals, and agent output are local simulations. Connect your own services in the copied handlers. No model, billing, or upload API is bundled.

## Bundled licenses

Syntari includes the required font and icon license notices in `assets/`. Historical milestone details are in [HISTORY.md](HISTORY.md).

## Expanded starter pack

The gallery includes 107 component families and four composed starter screens. See [REFERENCE-COVERAGE.md](./REFERENCE-COVERAGE.md) for Syntari’s coverage and composition notes.

- `?category=Agents` opens the agent collection.
- `?view=screens&screen=settings` opens account settings.
- `?view=screens&screen=team` opens team management.
- `?view=screens&screen=projects` opens the project workspace.
- `?view=screens&screen=onboarding` opens sign-in and onboarding.

`starter.js` contains reusable form, table, overlay, and layout builders exposed through `SyntariStarter.components`. `agents.js` exposes the agent pattern builders through `SyntariAgents`. Include their matching styles and the existing Syntari scripts in the same order as `index.html`. The inspector's HTML is the initial markup; interactive behavior requires those scripts. All examples are local demonstrations, with the boundaries explained in the coverage document.

Run `npm run build` for the static `dist/` output. Run `npm test` for gallery, control, number, motion, agent, and composed-screen workflows. Tests reuse the local development server outside CI; CI builds and starts the static output itself.
