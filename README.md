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

- [Component index](https://syntariui.github.io/syntari/registry/index.json)
- [Pattern index](https://syntariui.github.io/syntari/registry/patterns/index.json)
- [Primitive tokens](https://syntariui.github.io/syntari/registry/tokens/primitive.json)
- [Semantic tokens](https://syntariui.github.io/syntari/registry/tokens/semantic.json)
- [Component schema](https://syntariui.github.io/syntari/registry/schema/component.schema.json)
- [Screen IR schema](https://syntariui.github.io/syntari/registry/schema/sui.schema.json)

`syntari registry --json` returns the component index. `syntari info <id> --json` returns a component or pattern's metadata, dependencies, tokens, examples, package files, and installability. Registry manifests are the lookup source; docs and examples explain use.

## Development

Use Node.js 22 or newer:

```sh
npm ci
npm test
npm start
```

`npm test` builds the package and runs CLI installation and registry checks. The build creates the package-ready `kit/` directory and the static website in `dist/`.

## Publishing

Create a GitHub Release after updating the package version. The npm release workflow runs the build and CLI checks, then publishes `syntari-ui` with provenance using the repository's `NPM_TOKEN` secret. The static site continues to deploy from the existing GitHub Pages workflow.

## Documentation

Visit [syntariui.giovanitier.com](https://syntariui.giovanitier.com/) for the renderer, library, and component examples. The source repository is [SyntariUI/syntari](https://github.com/SyntariUI/syntari).
