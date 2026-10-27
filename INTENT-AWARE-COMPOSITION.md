# Intent-aware composition

Syntari could already tell an agent which chart fits which data and refuse a screen that broke a contract. It could not tell a valid screen that serves the wrong job from one that serves the right one. This document records what was found in the code, what changed, how it was tested, what the benchmark shows, and what it does not show.

## 1. Audit: why a valid screen could still be a poor one

What the code did before this change, read from the source:

1. **Discovery and selection.** `searchRegistry()` (`agent.mjs`) and `search_components` match words against names, aliases, categories, descriptions, and `intents`. The Renderer workspace (`intent-renderer.js`) picks a pattern by counting keyword hits (`dashboard` → Analytics overview). Nothing asked who the screen is for or what they do with it.
2. **Hierarchy and disclosure in Screen IR.** Order of children, sections with a heading, regions that open or close, and four layouts. No notion of priority, emphasis, surface, or why something is collapsed.
3. **Composition policy.** `registry/composition-policy.json` mapped data roles (time series, composition, records…) to visualizations and gave four screen patterns a zone order. Every zone was about data; there was no task, queue, record, document, or setting.
4. **Enforced and advisory.** Enforced: the schema, component contracts, budgets, data consistency, misleading visualizations. Advisory: order, repetition, density, weak fits. `meta.plan` was an unvalidated object shown as a trace.
5. **Validation, assessment, repair.** `validateScreen`, `assessScreen` (seven criteria, data-only), and `applyScreenOperations` with scope and data protection. Repair existed only as model-proposed operations.
6. **MCP.** Read-only tools for discovery, contracts, validation, assessment, and operations. No planning step, no composition guidance beyond visualization fit.
7. **Renderer.** The public Renderer composes with a model; the workspace renders a canned pattern screen chosen by keywords.
8. **Source installation.** `syntari add` copies components; nothing checks the markup an agent then writes, and no rules travel with the installation.
9. **What to extend.** The policy, `meta.plan`, `assessComposition`, `applyOperations` and its protections, the guidance block in manifests, the pattern registry, MCP, and the CLI. None of them needed replacing.

The gap: every check was about whether a part is correct, none about whether the screen is organised for the person's job. A model told “use Syntari” could produce four KPI cards above a list of overdue approvals, and every check would pass.

## 2. Architecture

```
request ─▶ brief (model judgment, structured) ─▶ plan_screen (rules) ─▶ compose (zones) ─▶ validate ─▶ assess (lint, gate) ─▶ repair (safe ops) ─▶ render
                                                                                           │
                                         source installs: runtime/COMPOSITION.md + lint_markup ┘
```

- **The brief** is where context goes: who uses the screen, the job (`resolve`, `decide`, `review`, `investigate`, `monitor`, `create`, `configure`), the decisions, each piece of information with its kind, the decisions it informs, how often it is needed, and whether an exception is present. A model writes it; it is the one place semantic judgment is needed.
- **The plan** (`ir-plan.js`, `planScreen`) is deterministic: the same brief always gives the same plan. It ranks archetypes by the job, by whether the archetype leads with the information decisions depend on, then by the subject and signals; assigns each piece of information a priority and disclosure; picks a layout whose aside has something to hold; lists candidate components, what to avoid, the alternatives considered with the reason each lost, and a rationale. Words in the request are cues: they raise `openQuestions` and order a provisional plan whose status is `needs-context`. Once the brief states the job they carry no weight, which a test checks.
- **The linter** (`ir-lint.js`) reads the screen against its plan and the policy. It is wired into `assessComposition`, so `assessScreen` and `assess_composition` return `findings`, a `quality` gate, and a `repair` change.
- **Repair** is a `syntari-ops-1` change holding only fixes that change disclosure (open a region hiding a decision input, close one showing reference). It goes through `applyOperations`, so data, records, and every other node keep their protections.

## 3. Contracts added or changed

| Contract | Change | Compatibility |
| --- | --- | --- |
| `registry/schema/plan.schema.json` | New. `syntari-plan-1`: userRole, primaryJob, mode, userDecisions, archetype, informationPriority (priority, disclosure, exception, neededFor, nodes), zones, disclosureStrategy, layoutStrategy, interactionRequirements, actions, componentCandidates, avoid, alternativesConsidered, designRationale, terminology, openQuestions. Carries `pattern`, `purpose`, `rationale` for the earlier checks. | Opt-in by `version`. A `meta.plan` without a version is a legacy plan and is read as before. |
| `validate()` / `validateScreen` | A versioned plan is a contract: `plan-invalid`, `plan-unknown-node` are errors. | Only for screens that declare `syntari-plan-1`. |
| `registry/composition-policy.json` | Adds `jobs`, `information` (priorities, disclosures, rules, 18 kinds), `surfaces`, `dividers`, `archetypes` (7), `cues`, `lint` (25 rules, 12 criteria). | Additive; existing keys unchanged. The registry validator now checks the policy against itself and the registry. |
| Screen IR (`sui.schema.json`) | `layout: "split"` for screens and sections; section `emphasis` (`primary`, `supporting`, `reference`) and `surface` (`none`, `inset`, `panel`). Unknown values are warnings, as unknown layouts were. | Additive; `syntari-ir-1` unchanged. A runtime older than this release rejects the new keys as unknown. |
| Component manifests | `guidance.composition`: surface, defaultVisible, density, contentLength, redundantWith, archetypes, mistakes, responsive. Guidance added to card, text block, stat row, metric strip, metadata list, activity list, banner, approval card, tool approval; composition blocks on table, value diff, source excerpt. | Optional; validated against the policy's surfaces and archetypes. |
| Banner | `tone` adds `warning` and `danger`. | Additive; `success` stays the default. |
| `registry/patterns/index.json` | Five archetype patterns with `archetype`, `screenMode` (example), `antiExample`, `differences`. `get_pattern` adds the archetype's guidance and the anti-pattern screen. | Additive. The workspace's keyword examples are unchanged. |
| `registry/schema/visual-review.schema.json` | New. What a rendered-review adapter returns. | Only used by `assessRenderedScreen`. |

## 4. Components

Two primitives were added after checking what existing components could do:

- **Value diff** (`value-diff`): fields with the current value, the new value, where in the source it was read, a status, and, when `choosable`, a per-row choice of which value to save, reported to the host as a local `choose` action. A table with row and column headers that keeps its roles when its rows stack on a phone. Comparison table could not say which value will be saved (its last column is an “advantage”), and File diff is for code.
- **Source excerpt** (`source-excerpt`): the lines of a statement or invoice with the lines that differ marked in words. Nothing existing showed a document's lines.

Rows and lines that share a `ref` are linked by the renderer: pointing at or focusing either marks both, and a row's source reference is a button that brings the line into view.

Not added, because existing parts cover them without strain: **ImpactSummary** is a value diff without a choice (“Now” → “After saving”); **DecisionBar** is Tool approval or a consequential form section; **EvidenceReview** is a composition (split layout, value diff beside source excerpt), and is the `evidence-review` archetype; **DetailRegion** is a region or a split aside. Revealing on selection in a live interface needs host state that static Screen IR does not hold; the plan records it as `on-selection` and the composition shows the selected item in an aside.

## 5. Archetypes

`task-triage`, `record-workspace`, `evidence-review`, `comparison-workspace`, `configuration-workspace`, plus `monitoring-dashboard` and `analytical-report`, which map to the earlier dashboard and report patterns. Each declares the jobs it serves, what it requires, use and contraindications, zones with priority and disclosure, more than one layout, responsive behaviour, states, and what to avoid. The five new ones are in the pattern registry with a complete example and the anti-pattern for the same job, from the benchmark's support and logistics scenarios.

## 6. Findings

Deterministic rules, listed with their severity in `lint.rules`. Errors: `hidden-decision-input`, `hidden-exception` (and the plan contract in validation). Warnings include `kpi-grid-on-task-screen`, `card-per-item`, `everything-at-once`, `priority-order`, `competing-emphasis`, `nested-surface`, `card-as-grouping`, `unranked-queue`, `restated-content`, `vague-change-summary`, `repeated-label`, `decision-without-impact`, `competing-primary-actions`, `archetype-mismatch`. Suggestions include `banner-without-exception`, `stacked-disclosures`, `supporting-expanded`, `dense-record`, `action-per-card`, `missing-plan`. No rule uses a universal count where context decides: most read the plan (what the job avoids, what is primary), and thresholds that remain (three sibling cards, seven visible settings, more than two primary sections) are stated in the rule.

The quality gate gives a verdict per criterion (task prominence, information architecture, disclosure, content economy, component fit, surface economy, grouping, action clarity, fit to the job, plan contract) and marks responsive behaviour and accessibility beyond contracts as needing a rendered review. It never produces a score.

A rendered review is optional: `assessRenderedScreen` passes a screenshot, the screen, and its plan to an adapter the host supplies, checks the answer against the schema, and labels it a judgment. It is not exposed over MCP, because the server cannot render.

## 7. Agent integration

| Surface | Screen IR (Syntari renders) | Source components (the agent writes markup) |
| --- | --- | --- |
| Plan | `plan_screen`, `syntari plan`, `planScreen` | same |
| Guidance | `get_composition_guidance`, `get_pattern`, `get_component` | same, and `runtime/COMPOSITION.md` in every installation, or `syntari rules` |
| Check | `validate_screen`, `assess_composition` (findings, gate, repair) | `lint_markup`, `syntari lint-markup`: reads markup as text and says what it cannot see |
| Repair | `repair` change → `apply_operations`; `repairScreen` | by hand |

The MCP server's instructions now lead with the brief and the plan, so an agent that connects is told to plan before choosing components without anyone pasting a prompt. `AGENT-GUIDE.md` explains the plan, layouts and surfaces, findings, and the two modes.

## 8. Benchmark

Twelve scenarios in `benchmarks/`: seven for a fictional advisory firm (advisor overview, work queue, household overview, plans and approvals, portfolio review, statement reconciliation, firm settings), two for a support desk, three for a freight operation. Each has a request, a brief, and the same data and tasks under two conditions.

- **Baseline**: composed by following the guidance that existed before (AGENT-GUIDE, the composition policy's patterns and roles, the authored pattern screens). Each scenario states its derivation. Baselines validate and apply the earlier advice; they were not degraded. Where the first choice broke a contract (bar values are percentages), the baseline repaired it as an agent would.
- **Intent-aware**: composed from `plan_screen`'s plan for the brief. The plan in each screen is the planner's output, not hand-written; only the node ids are added.

Both conditions were composed by hand by the same author who wrote the rules. They show what each set of guidance leads to; they are not model output, and they cannot show how a given model behaves.

Rule-based results (gate · errors/warnings/suggestions). Both conditions are read against the plan for the same brief; for baselines, the nodes that show each piece of information were mapped by reading them.

| Scenario | Archetype | Baseline | Baseline errors and warnings | Intent-aware |
| --- | --- | --- | --- | --- |
| Cairn Advisory · Advisor overview | `task-triage` | review · 0/3/1 | priority-order, kpi-grid-on-task-screen | pass · 0/0/0 |
| Cairn Advisory · Work queue | `task-triage` | review · 0/3/1 | kpi-grid-on-task-screen, card-per-item, card-as-grouping | pass · 0/0/0 |
| Cairn Advisory · Household overview | `record-workspace` | review · 0/2/3 | kpi-grid-on-task-screen, card-as-grouping | pass · 0/0/0 |
| Cairn Advisory · Plans and approvals | `comparison-workspace` | review · 0/2/1 | kpi-grid-on-task-screen, restated-content | pass · 0/0/0 |
| Cairn Advisory · Portfolio review | `analytical-report` | review · 0/3/0 | kpi-grid-on-task-screen, restated-content, repeated-label | pass · 0/0/0 |
| Cairn Advisory · Statement reconciliation | `evidence-review` | fail · 1/3/2 | hidden-decision-input, kpi-grid-on-task-screen, decision-without-impact, vague-change-summary | pass · 0/0/0 |
| Cairn Advisory · Firm settings | `configuration-workspace` | review · 0/2/2 | card-per-item, everything-at-once | pass · 0/0/0 |
| Halden Support · Agent ticket queue | `task-triage` | review · 0/3/1 | priority-order, kpi-grid-on-task-screen | pass · 0/0/0 |
| Halden Support · Targets and routing settings | `configuration-workspace` | review · 0/2/2 | card-per-item, everything-at-once | pass · 0/0/0 |
| Kestrel Freight · Delayed shipment | `record-workspace` | review · 0/2/4 | kpi-grid-on-task-screen, card-as-grouping | pass · 0/0/0 |
| Kestrel Freight · Freight invoice audit | `evidence-review` | fail · 1/2/1 | hidden-decision-input, kpi-grid-on-task-screen, decision-without-impact | pass · 0/0/0 |
| Kestrel Freight · Carrier comparison | `comparison-workspace` | review · 0/2/1 | card-per-item, card-as-grouping | pass · 0/0/0 |

How to read it: the table shows that the rules detect the patterns the brief names in the earlier compositions, and that the intent-aware compositions avoid them. It does not show that the intent-aware screens are better designed: the same person wrote the rules and the screens, so passing them is partly circular. The tests guard against the obvious form of that, since each rule is also triggered by perturbing an intent-aware screen, but the qualitative judgment is separate. Each scenario's `observations` are authored readings, shown in the lab as such.

No screenshots of earlier Sherpas work were available in this session, so the benchmark follows the written specification.

## 9. The composition lab

`/renderer/v2/` (source `renderer-v2.html`, `renderer-v2.js`, `renderer-v2-frame.*`). Pick a scenario; show the baseline, the intent-aware screen, or both side by side; switch between desktop and a 390-pixel phone (rendered in a frame of that width, so layouts respond as on a device). The inspector shows the recognized intent, the archetype and alternatives, each piece of information's priority and disclosure and the nodes that show it, layout, candidate components and what to avoid, validation and findings with the gate, the rule-based difference, iterations, the action requests the screen made, and the Screen IR. Baselines with a safe repair offer it; applying it adds an iteration with its node-by-node difference. URLs keep the state: `?scenario=statement-reconciliation&condition=compare&viewport=mobile&tab=findings`.

Run it with `npm run build && npm start`, then open http://127.0.0.1:4318/renderer/v2/. The production Renderer at `/renderer/` and the workspace at `/renderer/workspace/` are unchanged.

## 10. Tests

- `tests/intent.test.mjs`: policy consistency; the archetype for all twelve briefs (expected values live in the test, not the planner); determinism; “dashboard” with a monitoring job and with a resolve job; cues versus a stated job; priority and disclosure; backward compatibility for screens and legacy plans; the plan contract; IR additions; the gate for both conditions; each lint rule by perturbation; repair that changes only `open`; data protection; archetype patterns; markup linting; the generated rules; the rendered-review contract; MCP discoverability.
- `checks/renderer-v2.spec.mjs`: every scenario in both conditions with no fallback or page error; split and stacked layouts; no sideways scrolling on a phone for any screen; value choice as a host request; source linking by pointer and keyboard; keyboard tabs; repair as an iteration; the lab on a phone.

Layout is checked by measuring rendered boxes rather than comparing pixels, because pixel baselines differ across machines and fonts; `npm run test:browser` runs both suites.

## 11. Limits and next steps

- **Hand-composed conditions.** The decisive experiment is a model composing both conditions from the same request: once with the earlier tools, once with `plan_screen` and `assess_composition`. It needs a model budget and was not run here.
- **Briefs are written by the agent.** If a model writes a poor brief (wrong mode, no `neededFor`), the plan is faithfully wrong. The planner asks when the job or the information is missing, but cannot detect a confident wrong brief.
- **Selection in static IR.** `on-selection` is planned and drawn as the selected item in an aside; switching selection needs host state.
- **Markup linting reads text.** It sees tags, classes, and nesting; not computed layout, conditional rendering, or components behind other names.
- **Rendered review.** The adapter contract exists; no adapter ships, and responsive and contrast verdicts stay `not-checked` without one.
- **Tables on a phone.** A four- or five-column queue scrolls sideways inside its own region on a 390-pixel screen (the page itself does not). A compact row layout for Table, like Value diff's, is the fix.
- **Coverage.** Guidance with composition blocks covers twelve components; the other renderable components have none yet.
- Next: run the model-composed benchmark; add composition guidance to the remaining renderable components; let `apply_operations` propose the structural moves the linter describes but does not automate (moving reference into a region); a selection model for master-detail screens.
