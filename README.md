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

## Cloudflare Pages deployment

The production site is deployed to Cloudflare Pages from GitHub Actions after the build and checks pass on `main`. The Cloudflare Pages project name is `syntariui`; the Wrangler config and workflow both publish `dist/`.

Before the first production deploy:

1. Create a Cloudflare Pages Direct Upload project named `syntariui` with production branch `main`.
2. Add GitHub Actions repository secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. The token needs Cloudflare Pages edit access.
3. In Cloudflare Pages, add `syntariui.giovanitier.com` as a custom domain and confirm its DNS record points to the Pages project.
4. Merge the deployment workflow to `main`; subsequent successful main builds publish automatically.

Direct Upload is used so the existing GitHub Actions build and release checks stay authoritative. GitHub Pages is no longer the production deploy target once this workflow is merged. npm package publishing remains a separate release workflow and requires `NPM_TOKEN`.

## Documentation

Visit [syntariui.giovanitier.com](https://syntariui.giovanitier.com/) for the renderer, library, and component examples. The source repository is [SyntariUI/syntari](https://github.com/SyntariUI/syntari).
