# Syntari Renderer

Describe an interface, choose a trusted pattern, validate Screen IR against the registry, and render it with Syntari components. The [live renderer](https://syntariui.giovanitier.com/) exposes its pattern choice, candidates, component composition, rules, validation, and final screen.

## Install in an agent project

Node.js 22 or newer is required. Once the `0.2.2` npm release is published:

```sh
npm install syntari-ui@0.2.2
npx syntari list --json
npx syntari search dashboard --json
npx syntari info approval-review --json
npx syntari add button app-shell
npx syntari doctor --dir ./components/syntari --json
npx syntari validate --spec ./screen.json --dir ./components/syntari --json
```

The same package archive is served from the site. It is an installation fallback while npm publication is pending or unavailable:

```sh
npm exec --yes --package=https://syntariui.giovanitier.com/downloads/syntari-ui-0.2.2.tgz -- syntari add button app-shell
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

Read [AGENT-GUIDE.md](AGENT-GUIDE.md) for a complete discovery, composition, validation, and host authorization workflow. Screen IR validation controls what Syntari renders. The host application must decide whether an agent may call a tool or change external state.

## Develop and verify

```sh
npm ci
npm test
npm run test:browser
npm start
```

`npm test` builds `kit/` and `dist/`, checks the registry schemas, and exercises the CLI and Node API. The browser suite covers the homepage renderer, Screen IR, and installation flow. `npm start` serves the built site locally.

## Deploy and publish

Cloudflare Workers Static Assets serves `dist/` through the `syntari` Worker in `wrangler.toml`. Cloudflare's connected Git build uses `main`, `npm run build`, and `npm run deploy`; `syntariui.giovanitier.com` is the custom domain. GitHub Actions runs CI. Publishing GitHub release `v0.2.2` runs the npm release workflow, which verifies the tag and package before `npm publish --provenance`. That workflow needs a configured npm trusted publisher or `NPM_TOKEN`. The site archive is built from the same `kit/` package files.
