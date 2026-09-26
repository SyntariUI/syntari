# Syntari Registry

The registry is the machine-readable source of truth for what Syntari contains, why each part exists, and how it may be composed. It is meant to be consumed by agents and tooling, not scraped from the documentation site.

## Layout

- `index.json` — the generated catalog index for all components.
- `components/*.json` — per-component manifests.
- `tokens/primitive.json` — raw values (colors, radii, motion, spacing).
- `tokens/semantic.json` — meaningful roles mapped to primitives and CSS variables.
- `schema/component.schema.json` — the component manifest contract.
- `schema/sui.schema.json` — the Syntari UI IR (screen) contract.
- `patterns/index.json` — installable layouts, documented interaction patterns, and intent patterns.
- `patterns/screens.json` — Screen IR for the renderer's three bounded compositions, produced by the build from `screen-recipes.js`.
- `agent-policy.json` — machine-readable boundary between Screen IR rules and host-authorized actions.

## Published URLs

The deployment serves these files alongside the documentation, so agents and tools can fetch them over HTTP instead of cloning the repository:

- <https://syntariui.giovanitier.com/registry/index.json>
- <https://syntariui.giovanitier.com/registry/schema/component.schema.json>
- <https://syntariui.giovanitier.com/registry/schema/sui.schema.json>
- <https://syntariui.giovanitier.com/registry/tokens/primitive.json>
- <https://syntariui.giovanitier.com/registry/tokens/semantic.json>

Each artifact declares the matching `$id`, so a schema reference resolves without configuration.

## Three token layers

Primitive values feed semantic roles, and semantic roles feed component tokens:

```
blue.400                 (primitive)
  → color.action.primary (semantic)
    → button.primary.background (component)
```

CSS variables remain compiled output. The semantic layer is where agents reason; `--blue-4` and `--bg-3` are not part of the agent vocabulary.

## Component manifest status

The authored manifests declare intent, anatomy, rules, and, where supported, prop and renderer bindings. The build includes authored component manifests. Those declaring both props and IR bindings can render from Screen IR. Other catalog entries receive generated skeletons in the package and site build. The build leaves the source manifests untouched.

## Rebuild the index

From the repository root:

```sh
node scripts/generate-registry.mjs
```

To write skeletons for every component without an authored manifest:

```sh
node scripts/generate-registry.mjs --skeleton all
```

To write a single skeleton:

```sh
node scripts/generate-registry.mjs --skeleton tool-approval
```

Authored manifests are never overwritten by the generator.

## Next layers

The package includes schema-backed registry validation through `syntari validate`. Pass `--spec screen.json` to check Screen IR against the published schema and component contracts. The browser renderer applies the same component contracts before painting. Host applications authorize model actions separately.
