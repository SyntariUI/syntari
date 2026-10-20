# Syntari

A design system for people and agents. 136 components, a machine-readable registry, and a renderer that validates what agents compose.

People install the components as editable HTML, CSS, and JavaScript. Agents read the same registry, describe a screen as Screen IR, and validate it before anything renders. One contract configures both: 37 components can be rendered from Screen IR or mounted with props, and the others are documented in the registry and installable as source. Explore them at [syntariui.giovanitier.com](https://syntariui.giovanitier.com/).

## Install in an agent project

Node.js 22 or newer is required.

```sh
npm install syntari-ui
npx syntari list --json
npx syntari search dashboard --json
npx syntari info approval-review --json
npx syntari add button app-shell
npx syntari doctor --dir ./components/syntari --json
npx syntari validate --spec ./screen.json --dir ./components/syntari --json
```

The same package archive is served from the site as an installation fallback:

```sh
npm exec --yes --package=https://syntariui.giovanitier.com/downloads/syntari-ui-0.4.0.tgz -- syntari add button app-shell
```

The CLI copies editable HTML, JavaScript, CSS, fonts, registry JSON, and runtime files into the project. It refuses to overwrite existing component files or a mismatched installation. `syntari info <id> --json` returns manifests, dependencies, tokens, examples, package files, and, for renderer patterns, a complete Screen IR example.

## Connect an agent over MCP

`syntari mcp` is a read-only MCP server over stdio. It lists and searches components and patterns, returns contracts with a valid sample, returns the agent policy, and validates Screen IR. It never writes files or performs actions.

```sh
claude mcp add syntari -- npx -y syntari-ui mcp
```

Other clients use the same command, for example `{ "command": "npx", "args": ["-y", "syntari-ui", "mcp"] }`. Models without tools can read [llms.txt](https://syntariui.giovanitier.com/llms.txt) and [llms-full.txt](https://syntariui.giovanitier.com/llms-full.txt).

## Mount with props

```js
import { mount } from './components/syntari/tool-approval.js';

await mount('#consent', {
  props: { title: 'Run the billing migration?', question: 'Apply three schema changes.', scope: 'billing-production · write access' },
  onActionRequest(request) {
    // request.action is "approve" or "reject". Nothing has run: your code decides.
  }
});
```

Props are validated against the component contract, the same one Screen IR uses. Declared actions report requests and never run demo behaviour. Without props, `mount()` renders the documented example; pass `onActionRequest` and its declared actions report requests the same way instead of running the demo.

The runtime only touches Syntari markup. Its styles apply inside an element with the `syntari-component` class or the `data-syntari-root` attribute, which `mount()`, `prepare()`, and the renderer add for you; its listeners ignore the rest of the page. If you paste component HTML yourself, put it inside one of those and call `prepare()` on it.

## Explain, then decide

A screen can be organised in sections, each a heading over a group with its own layout, and can explain a number before it asks for a decision with Text block, Breakdown, Checklist, Media cards, and Calculator. Calculator formulas are arithmetic that the renderer parses and never runs as code. Media cards show only images the host passes as `render(spec, target, { assets })`. Model-written HTML, an unverified block, is rejected unless the host passes `{ sandbox: true }`, and is then shown in a labelled frame with no scripts, no network, and no actions.

## Use the Node API

```js
import { listComponents, listPatterns, getComponent, getPattern, getAgentPolicy, searchRegistry, validateScreen } from 'syntari-ui';

const pattern = await getPattern('approval-review');
const policy = await getAgentPolicy();
if (policy.actions.default !== 'deny') throw new Error('Unexpected action policy');
const result = await validateScreen(pattern.screen);
if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
```

The package exports `syntari-ui/registry/*` and `syntari-ui/runtime/*` for direct access to the versioned JSON contracts and browser runtime. The public site serves the same data at [registry/index.json](https://syntariui.giovanitier.com/registry/index.json), [registry/patterns/index.json](https://syntariui.giovanitier.com/registry/patterns/index.json), [registry/schema/sui.schema.json](https://syntariui.giovanitier.com/registry/schema/sui.schema.json), and [registry/agent-policy.json](https://syntariui.giovanitier.com/registry/agent-policy.json).

Read [AGENT-GUIDE.md](AGENT-GUIDE.md) for a complete discovery, composition, validation, and host authorization workflow. Screen IR validation controls what Syntari renders. The host application must decide whether an agent may call a tool or change external state. The six AI behaviour patterns (clarification, uncertainty, delegation, recovery, memory, and generation) are documented in the [System guide](https://syntariui.giovanitier.com/system/?guide=ai-patterns).

## Develop and verify

```sh
npm ci
npm test
npm run test:browser
npm start
```

`npm test` builds `kit/` and `dist/`, checks the registry schemas, and exercises the CLI and Node API. `npm run test:browser` runs every Playwright suite in `checks/`: the homepage, Renderer, System, Screen IR, component behaviour, and clean-project installation. `npm start` serves the built site locally.

Earlier prototype workspaces (`Jev/`, `tmp/`, `new/`, `morrow/`, `art-atlas/`) live on the `archive/prototypes` branch.

## Privacy

The documentation site uses Kobbe analytics. The npm package and the components it installs contain no analytics and make no third-party requests.

## Deploy and publish

Cloudflare Workers Static Assets serves `dist/` through the `syntari` Worker in `wrangler.toml`. Cloudflare's connected Git build uses `main`, `npm run build`, and `npm run deploy`; `syntariui.giovanitier.com` is the custom domain. GitHub Actions runs CI. Publishing a GitHub release whose tag matches the package version (for example `v0.3.0`) runs the npm release workflow, which verifies the tag and package before `npm publish --provenance`. The workflow publishes through npm trusted publishing, or with an `NPM_TOKEN` repository secret when one is configured. The site archive is built from the same `kit/` package files.
