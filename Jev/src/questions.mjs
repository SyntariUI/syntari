import { choice, noul } from "@typesafe-ai/sdk";

export function makeQuestions() {
  return {
    intent: choice("What kind of interface should Syntari create for this request?", {
      analytics: "Read, inspect, compare, or explain metrics and data.",
      reference: "Look up, list, browse, or inspect records and exact values.",
      workflow: "Guide the user through a multi-step process without executing a consequential action yet.",
      action: "Execute, approve, change, delete, publish, send, or otherwise mutate state."
    }),

    representation: choice("What should be the primary information representation?", {
      trend: "A time-series or change-over-time visualization is primary.",
      categorical: "Categories, rankings, or distributions are primary.",
      comparison: "Exact side-by-side comparison is primary.",
      table: "Rows, records, and exact values are primary.",
      summary: "A compact KPI or status summary is primary.",
      action: "An action or approval control is primary."
    }),

    comparisonNeeded: noul(
      "Does the interface need an explicit comparison between periods, options, cohorts, or alternatives?",
      {
        true: "The user is comparing at least two meaningful things and should be able to inspect the comparison directly.",
        false: "The task can be understood without a dedicated comparison."
      }
    ),

    evidenceNeeded: noul(
      "Should the generated interface expose provenance, sources, records, or evidence behind the answer?",
      {
        true: "Trust, auditability, traceability, or source inspection materially helps the task.",
        false: "Source inspection is not necessary for this task."
      }
    ),

    reasoningNeeded: noul(
      "Does the request need open-ended reasoning or explanation from a larger language model after the UI shape is decided?",
      {
        true: "The user asks why, asks for explanation, synthesis, diagnosis, or other open-ended reasoning.",
        false: "The request can be fulfilled by selecting and rendering the right structured interface."
      }
    ),

    risk: choice("What is the consequence level of the requested interaction?", {
      read: "Read-only; no external or persistent state changes.",
      reversible: "Changes state, but the effect is easy to undo or low consequence.",
      destructive: "Deletes, sends, publishes, charges, revokes, or makes a consequential change that should require explicit approval.",
      critical: "A high-stakes consequential action where additional safeguards are appropriate."
    })
  };
}
