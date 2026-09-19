import assert from "node:assert/strict";
import test from "node:test";
import { runExperiment } from "../src/experiment.mjs";

test("DecisionProvider contract feeds Jev-style answers into a Syntari UI plan", async () => {
  const provider = {
    async decide({ state }) {
      assert.equal(state.request, "Compare Q2 revenue with Q1 and explain why costs increased.");
      return {
        model: "fake-jev",
        usage: { input_tokens: 10, output_tokens: 6 },
        answers: {
          intent: { type: "choice", choice: "analytics", confidence: 0.97 },
          representation: { type: "choice", choice: "trend", confidence: 0.91 },
          comparisonNeeded: { type: "noul", noul: 0.98 },
          evidenceNeeded: { type: "noul", noul: 0.82 },
          reasoningNeeded: { type: "noul", noul: 0.94 },
          risk: { type: "choice", choice: "read", confidence: 0.99 }
        }
      };
    }
  };

  const result = await runExperiment({
    provider,
    state: { request: "Compare Q2 revenue with Q1 and explain why costs increased." }
  });

  assert.equal(result.model, "fake-jev");
  assert.equal(result.plan.primary, "syntari.area-chart");
  assert.deepEqual(result.plan.supporting, [
    "syntari.stat-row",
    "syntari.comparison-table",
    "syntari.source-list"
  ]);
  assert.equal(result.plan.needsLLM, true);
  assert.ok(result.latencyMs >= 0);
});
