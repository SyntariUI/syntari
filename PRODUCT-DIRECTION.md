# Syntari product direction

The Renderer and System are one visual workspace. This is the adopted product direction, promoted from the Rare UI inspired System prototype.

- `/` is the homepage: a spacious introduction, a working intent prompt, and live component previews. Its hierarchy takes inspiration from beUI; its typography, surfaces, and controls belong to Syntari.
- `/renderer/` is the full Renderer workspace: describe an intent, see a trusted composition, inspect its decisions, and refine the request.
- `/system/` is the interactive design system: a persistent navigation rail, a generous component stage, and a compact toolbar. Inspect, source, installation, states, and device preview stay in the workspace.
- Component reference lives inside System: Overview, Usage, API, Installation, Source, and shared Guides sit beside the live preview. There is no separate Docs destination. Legacy `/docs/`, `/docs/components/`, and `/guides/` URLs redirect into the appropriate System panel.

Use the Syntari tokens, Geist typography, component anatomy, and motion. Keep the rendered object prominent. Reveal technical details through the inspector, after the result is visible. The Renderer and System share theme, navigation, focus mode, and inspector behavior, including on narrow screens.

Pattern selection currently uses deterministic keyword matching against the published registry and renders sample data. Describe that honestly. Confidence figures must come from a measured model or clearly identified evidence. UI approval affordances never authorize external operations; the host owns action authorization.

The earlier `/tmp/system/` and `/Jev/` URLs lead to the production workspaces. Their original source remains in the repository for historical reference.
