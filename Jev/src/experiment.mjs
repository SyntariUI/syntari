import { buildUiPlan } from "./policy.mjs";

export async function runExperiment({ provider, state, noulThreshold = 0.5 }) {
  const started = performance.now();
  const response = await provider.decide({ state });
  const latencyMs = performance.now() - started;
  const answers = response.answers ?? response;
  const plan = buildUiPlan(answers, { noulThreshold });

  return {
    model: response.model ?? provider.constructor?.name ?? "unknown",
    usage: response.usage ?? null,
    latencyMs,
    answers,
    plan
  };
}
