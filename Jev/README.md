# Syntari × Jev experiment

An isolated proof of concept for using Jev as a decision layer in front of Syntari's existing IR, validator, and renderer.

## Hypothesis

Jev should not generate UI. It should make small typed decisions that narrow the Syntari decision space:

```
user + app state
       ↓
      Jev
       ↓
intent / representation / comparison / evidence / reasoning / risk
       ↓
Syntari policy
       ↓
approved Syntari components
       ↓
Syntari IR → validator → renderer
```

The existing Syntari renderer remains authoritative. Jev only proposes decisions.

## What this experiment tests

- intent routing
- primary representation selection
- comparison detection
- evidence / provenance detection
- whether a larger LLM is needed
- action-risk classification
- safe mapping from decisions to approved Syntari components
- confidence preservation for inspection and debugging

The initial component set is intentionally small:

- `syntari.area-chart`
- `syntari.chart-bars`
- `syntari.comparison-table`
- `syntari.table`
- `syntari.stat-row`
- `syntari.source-list`
- `syntari.tool-approval`

## Test fixtures

1. Q2 performance comparison + explanation
2. Daily signup trend
3. Acquisition-channel ranking
4. Destructive user deletion
5. Overdue invoice record inspection

## Run offline tests

These tests do not call Jev and do not require an API key.

```sh
cd Jev
npm test
```

They validate Syntari's decision policy and the generic `DecisionProvider` contract.

## Run the live Jev evaluation

Install dependencies and provide a TypeSafe key:

```sh
cd Jev
npm install
TYPESAFE_API_KEY=... npm run test:live
```

The live test sends the five fixtures to `jev-latest` through `@typesafe-ai/sdk` and requires at least **80% decision accuracy** across the expected routing dimensions.

The live suite records:

- model
- latency
- per-fixture decision accuracy
- selected primary component
- whether an LLM is required

## Current offline result

**10/10 tests pass** after adding the provider-contract check.

This proves the Syntari side of the architecture is coherent. It does **not** yet prove Jev's live classification quality; that requires `TYPESAFE_API_KEY`.

## Success criteria for adopting Jev

Before integrating this into Syntari proper:

- >= 90% on the canonical routing fixture set after iteration
- zero destructive actions rendered without `tool-approval`
- confidence / fallback behavior defined
- measurable latency advantage over using a general LLM for these decisions
- decision metadata moved from this experiment into the real Syntari registry
- provider remains swappable; Syntari must not depend directly on Jev
