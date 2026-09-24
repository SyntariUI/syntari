# Syntari

A design system that agents can understand, use, verify, and evolve. Syntari includes a deterministic CLI, editable component sources, design tokens, interaction patterns, and a machine-readable registry.

## Install for an agent or project

```sh
npm install syntari-ui
npx syntari list --json
npx syntari search dashboard --json
npx syntari info button --json
npx syntari add button app-shell
npx syntari doctor --dir ./components/syntari --json
npx syntari validate --dir ./components/syntari --json
```

The CLI is bundled in the npm package. It installs editable HTML, JavaScript, CSS, and the shared Syntari runtime. Existing files are preserved; choose a new destination when installing a conflicting name.

Use `npx syntari patterns --json` to inspect authored layouts and interaction patterns. The installable `app-shell` pattern includes a responsive workspace frame, grouped navigation, utility settings, account footer, collapsible desktop sidebar, and mobile drawer.

## Machine-readable registry

The package ships the same registry as the documentation site under `kit/runtime/registry/`. The public static endpoints are:

- [Component index](https://syntariui.giovanitier.com/registry/index.json)
- [Pattern index](https://syntariui.giovanitier.com/registry/patterns/index.json)
- [Primitive tokens](https://syntariui.giovanitier.com/registry/tokens/primitive.json)
- [Semantic tokens](https://syntariui.giovanitier.com/registry/tokens/semantic.json)
- [Component schema](https://syntariui.giovanitier.com/registry/schema/component.schema.json)
- [Screen IR schema](https://syntariui.giovanitier.com/registry/schema/sui.schema.json)

`syntari registry --json` returns the component index. `syntari info <id> --json` returns a component or pattern's metadata, dependencies, tokens, examples, package files, and installability. Registry manifests are the lookup source; docs and examples explain use.

## Development

Use Node.js 22 or newer:

```sh
npm ci
npm test
npm start
```

`npm test` builds the package and runs CLI installation and registry checks. The build creates the package-ready `kit/` directory and the static website in `dist/`.

## Cloudflare deployment

The Cloudflare Pages project is named `syntariui`. Cloudflare's connected Git build deploys the static output in `dist/` using `npm run build` and `npm run deploy`; Wrangler and the output directory are configured in `wrangler.toml`. GitHub Actions runs CI checks only and does not publish a second copy of the site. Configure the Cloudflare build settings with repository `SyntariUI/syntari`, production branch `main`, root `/`, build command `npm run build`, and deploy command `npm run deploy`. Add `syntariui.giovanitier.com` as a custom domain in the Cloudflare Pages project and point its DNS record to that project. npm package publishing remains a separate release workflow and requires `NPM_TOKEN`.

## Documentation

Visit [syntariui.giovanitier.com](https://syntariui.giovanitier.com/) for the renderer, library, and component examples. The source repository is [SyntariUI/syntari](https://github.com/SyntariUI/syntari).
