import assert from "node:assert/strict";
import test from "node:test";
import { COMPONENTS } from "../src/catalog.mjs";
import { buildUiPlan, normalizeDecisions } from "../src/policy.mjs";
import { FIXTURES, fixtureAnswers } from "./fixtures.mjs";

for (const fixture of FIXTURES) {
  test("policy: " + fixture.name, () => {
    const plan = buildUiPlan(fixtureAnswers(fixture));

    assert.equal(plan.primary, fixture.expected.primary);

    for (const component of plan.components) {
      assert.ok(COMPONENTS[component], component + " must exist in the experiment catalog");
    }
  });
}

test("Q2 plan composes trend + KPIs + comparison + evidence", () => {
  const fixture = FIXTURES[0];
  const plan = buildUiPlan(fixtureAnswers(fixture));

  assert.deepEqual(plan.components, [
    "syntari.area-chart",
    "syntari.stat-row",
    "syntari.comparison-table",
    "syntari.source-list"
  ]);
  assert.equal(plan.needsLLM, true);
});

test("destructive risk forces tool approval even if representation is wrong", () => {
  const plan = buildUiPlan({
    intent: "action",
    representation: "table",
    comparisonNeeded: false,
    evidenceNeeded: true,
    reasoningNeeded: false,
    risk: "destructive"
  });

  assert.equal(plan.primary, "syntari.tool-approval");
  assert.deepEqual(plan.supporting, []);
});

test("noul probabilities respect the configured threshold", () => {
  const low = normalizeDecisions({
    comparisonNeeded: { type: "noul", noul: 0.49 }
  }, { noulThreshold: 0.5 });

  const high = normalizeDecisions({
    comparisonNeeded: { type: "noul", noul: 0.51 }
  }, { noulThreshold: 0.5 });

  assert.equal(low.comparisonNeeded, false);
  assert.equal(high.comparisonNeeded, true);
});

test("choice and noul confidence are preserved for debugging", () => {
  const plan = buildUiPlan({
    intent: { type: "choice", choice: "analytics", confidence: 0.94 },
    representation: { type: "choice", choice: "trend", confidence: 0.88 },
    comparisonNeeded: { type: "noul", noul: 0.72 },
    evidenceNeeded: { type: "noul", noul: 0.2 },
    reasoningNeeded: { type: "noul", noul: 0.9 },
    risk: { type: "choice", choice: "read", confidence: 0.99 }
  });

  assert.equal(plan.confidence.intent, 0.94);
  assert.equal(plan.confidence.representation, 0.88);
  assert.equal(plan.confidence.comparisonNeeded, 0.72);
  assert.equal(plan.confidence.evidenceNeeded, 0.8);
  assert.equal(plan.confidence.reasoningNeeded, 0.9);
  assert.equal(plan.confidence.risk, 0.99);
});
