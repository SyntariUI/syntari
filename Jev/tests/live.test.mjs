import assert from "node:assert/strict";
import test from "node:test";
import { JevDecisionProvider } from "../src/jev-provider.mjs";
import { runExperiment } from "../src/experiment.mjs";
import { FIXTURES } from "./fixtures.mjs";

const live = process.env.TYPESAFE_API_KEY ? test : test.skip;

function matchFixture(fixture, decisions) {
  const expected = fixture.expected;
  const checks = [
    decisions.intent === expected.intent,
    expected.representations.includes(decisions.representation),
    decisions.comparisonNeeded === expected.comparisonNeeded,
    decisions.evidenceNeeded === expected.evidenceNeeded,
    decisions.reasoningNeeded === expected.reasoningNeeded,
    decisions.risk === expected.risk
  ];

  return {
    passed: checks.filter(Boolean).length,
    total: checks.length
  };
}

live("Jev routes Syntari fixtures with >= 80% decision accuracy", async () => {
  const provider = new JevDecisionProvider();
  const rows = [];
  let passed = 0;
  let total = 0;

  for (const fixture of FIXTURES) {
    const result = await runExperiment({ provider, state: fixture.state });
    const score = matchFixture(fixture, result.plan.decisions);

    passed += score.passed;
    total += score.total;

    rows.push({
      fixture: fixture.name,
      model: result.model,
      latencyMs: Math.round(result.latencyMs),
      accuracy: Math.round((score.passed / score.total) * 100) + "%",
      primary: result.plan.primary,
      needsLLM: result.plan.needsLLM
    });
  }

  console.table(rows);

  const accuracy = passed / total;
  console.log("Overall decision accuracy:", Math.round(accuracy * 100) + "%");
  assert.ok(accuracy >= 0.8, "Expected at least 80% decision accuracy, received " + Math.round(accuracy * 100) + "%");
});
