# Syntari

A design system for people and agents. 131 components, a machine-readable registry, and a renderer that validates what agents compose.

People install the components as editable HTML, CSS, and JavaScript. Agents read the same registry, describe a screen as Screen IR, and validate it before anything renders. Today 22 components can be rendered from Screen IR; the others are documented in the registry and installable as source. Explore them at [syntariui.giovanitier.com](https://syntariui.giovanitier.com/).

## Install in an agent project

Node.js 22 or newer is required.

```sh
npm install syntari-ui@0.2.3
npx syntari list --json
npx syntari search dashboard --json
npx syntari info approval-review --json
npx syntari add button app-shell
npx syntari doctor --dir ./components/syntari --json
npx syntari validate --spec ./screen.json --dir ./components/syntari --json
```

The same package archive is served from the site as an installation fallback:

```sh
npm exec --yes --package=https://syntariui.giovanitier.com/downloads/syntari-ui-0.2.3.tgz -- syntari add button app-shell
```

The CLI copies editable HTML, JavaScript, CSS, fonts, registry JSON, and runtime files into the project. It refuses to overwrite existing component files or a mismatched installation. `syntari info <id> --json` returns manifests, dependencies, tokens, examples, package files, and, for renderer patterns, a complete Screen IR example.

## Use the Node API

```js
import { listComponents, listPatterns, getPattern, getAgentPolicy, validateScreen } from 'syntari-ui';

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

Cloudflare Workers Static Assets serves `dist/` through the `syntari` Worker in `wrangler.toml`. Cloudflare's connected Git build uses `main`, `npm run build`, and `npm run deploy`; `syntariui.giovanitier.com` is the custom domain. GitHub Actions runs CI. Publishing a GitHub release whose tag matches the package version (for example `v0.2.3`) runs the npm release workflow, which verifies the tag and package before `npm publish --provenance`. The workflow publishes through npm trusted publishing, or with an `NPM_TOKEN` repository secret when one is configured. The site archive is built from the same `kit/` package files.
