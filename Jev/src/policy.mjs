import { resolveComponents } from "./catalog.mjs";

function choiceValue(answer, fallback) {
  if (typeof answer === "string") return answer;
  return answer?.choice ?? fallback;
}

function noulValue(answer, threshold) {
  if (typeof answer === "boolean") return answer;
  if (typeof answer === "number") return answer >= threshold;
  if (typeof answer?.noul === "number") return answer.noul >= threshold;
  return false;
}

function confidenceOf(answer) {
  if (typeof answer?.confidence === "number") return answer.confidence;
  if (typeof answer?.noul === "number") return Math.max(answer.noul, 1 - answer.noul);
  return null;
}

export function normalizeDecisions(answers, { noulThreshold = 0.5 } = {}) {
  return {
    intent: choiceValue(answers.intent, "analytics"),
    representation: choiceValue(answers.representation, "summary"),
    comparisonNeeded: noulValue(answers.comparisonNeeded, noulThreshold),
    evidenceNeeded: noulValue(answers.evidenceNeeded, noulThreshold),
    reasoningNeeded: noulValue(answers.reasoningNeeded, noulThreshold),
    risk: choiceValue(answers.risk, "read")
  };
}

export function buildUiPlan(answers, options = {}) {
  const decisions = normalizeDecisions(answers, options);
  const resolved = resolveComponents(decisions);

  return {
    decisions,
    ...resolved,
    needsLLM: decisions.reasoningNeeded,
    confidence: {
      intent: confidenceOf(answers.intent),
      representation: confidenceOf(answers.representation),
      comparisonNeeded: confidenceOf(answers.comparisonNeeded),
      evidenceNeeded: confidenceOf(answers.evidenceNeeded),
      reasoningNeeded: confidenceOf(answers.reasoningNeeded),
      risk: confidenceOf(answers.risk)
    }
  };
}
