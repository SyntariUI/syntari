# Syntari Registry

The registry is the machine-readable source of truth for what Syntari contains, why each part exists, and how it may be composed. It is meant to be consumed by agents and tooling, not scraped from the documentation site.

## Layout

- `index.json` — the generated catalog index for all components.
- `components/*.json` — per-component manifests.
- `tokens/primitive.json` — raw values (colors, radii, motion, spacing).
- `tokens/semantic.json` — meaningful roles mapped to primitives and CSS variables.
- `schema/component.schema.json` — the component manifest contract.
- `schema/sui.schema.json` — the Syntari UI IR (screen) contract.

## Published URLs

The deployment serves these files alongside the documentation, so agents and tools can fetch them over HTTP instead of cloning the repository:

- <https://syntariui.github.io/syntari/registry/index.json>
- <https://syntariui.github.io/syntari/registry/schema/component.schema.json>
- <https://syntariui.github.io/syntari/registry/schema/sui.schema.json>
- <https://syntariui.github.io/syntari/registry/tokens/primitive.json>
- <https://syntariui.github.io/syntari/registry/tokens/semantic.json>

Each artifact declares the matching `$id`, so a schema reference resolves without configuration.

## Three token layers

Primitive values feed semantic roles, and semantic roles feed component tokens:

```
purple.400               (primitive)
  → color.action.primary (semantic)
    → button.primary.background (component)
```

CSS variables remain compiled output. The semantic layer is where agents reason; `--purple-4` and `--bg-3` are not part of the agent vocabulary.

## Component manifest status

`button.json` and `tool-approval.json` are fully authored exemplars. The remaining components are indexed from the existing catalog and marked `generated`; they are skeletons to be filled in with intents, variants, anatomy, rules, and semantics over time.

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

The registry is the first of three foundational artifacts. The others are the validator (`@syntari/validator`) that judges generated output, and the Syntari UI IR renderer/compiler that turns validated IR into HTML and, later, React and Figma.
