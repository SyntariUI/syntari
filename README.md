# Orbit UI 0.2

106 component pages, 246 authored preview states and layouts, seven guides, and four starter screens. Light and dark themes share Orbit’s tokens, OpenRunde typography, Lucide icons, and restrained motion.

Each component page includes Preview / Usage / Code, CLI and manual installation, its element contract, runtime API, and guidelines. All examples use the same editable HTML, CSS, and JavaScript runtime included in the source archive.

## Run locally

Use Node.js 22 or newer:

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:4318/ for documentation. The original gallery is at `/gallery.html`; its screen and category query parameters still work. Run the build again after adding catalog entries or changing installation source. The development server serves files from this directory without caching.

## Use a component

With the local site running:

```sh
npm exec --yes --package="http://127.0.0.1:4318/downloads/orbit-ui-0.2.0.tgz" -- orbit add button
```

```html
<div id="action"></div>
<script type="module">
  import { mount } from './components/orbit/button.js';
  const button = await mount('#action');
</script>
```

The CLI copies the selected entries and a shared runtime to `./components/orbit`. Use `--dir` to choose another directory. Existing source files are preserved. The downloadable archive also contains editable HTML for manual enhancement with `prepare(root)`.

This command uses the archive served by the documentation site; no published npm package is required. Package-manager command variants are available on each component page. The application must be served over HTTP.

## Test and build

```sh
npx playwright install chromium
npm test
npm run build
```

Eleven suites cover the original gallery and workflows, all 106 page routes, all 246 authored preview states, documentation navigation, clipboard, keyboard controls, light/dark themes, reduced motion, responsive layouts, and a fresh-project installation from the downloadable archive. The installer check also verifies that existing files are preserved and invalid component names are rejected.

`dist/` contains the complete static site, generated routes, and versioned source download. Existing GitHub Actions configuration can build and deploy it; local changes are not published by the build command.

## Project structure

- `docs.html`, `docs.js`, `docs.css`: documentation shell, routes, previews, source viewer, installation UI.
- `docs-data.js`, `docs-guides.js`: example states, element contracts, and guides.
- `orbit.js`: reusable mounting and manual enhancement API.
- `cli.mjs`: source installer.
- `gallery.html`, `app.js`, `styles.css`: gallery and base component templates.
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

OpenRunde fonts use the SIL Open Font License (`assets/OFL.txt`); Lucide icon paths use the ISC license (`assets/lucide-LICENSE.txt`). Historical milestone details are in [HISTORY.md](HISTORY.md).

## Expanded starter pack

The gallery includes 106 component families and four composed starter screens. See [REFERENCE-COVERAGE.md](./REFERENCE-COVERAGE.md) for the Be UI catalog audit, equivalent Orbit patterns, and intentional adaptations.

- `?category=Agents` opens the agent collection.
- `?view=screens&screen=settings` opens account settings.
- `?view=screens&screen=team` opens team management.
- `?view=screens&screen=projects` opens the project workspace.
- `?view=screens&screen=onboarding` opens sign-in and onboarding.

`starter.js` contains reusable form, table, overlay, and layout builders exposed through `OrbitStarter.components`. `agents.js` exposes the agent pattern builders through `OrbitAgents`. Include their matching styles and the existing Orbit scripts in the same order as `index.html`. The inspector's HTML is the initial markup; interactive behavior requires those scripts. All examples are local demonstrations, with the boundaries explained in the coverage document.

Run `npm run build` for the static `dist/` output. Run `npm test` for gallery, control, number, motion, agent, and composed-screen workflows. Tests reuse the local development server outside CI; CI builds and starts the static output itself.
