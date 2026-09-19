export const COMPONENTS = Object.freeze({
  "syntari.area-chart": {
    role: "trend",
    bestFor: ["time-series", "change-over-time", "period-comparison"],
    interaction: "read",
    risk: "none"
  },
  "syntari.chart-bars": {
    role: "categorical",
    bestFor: ["ranking", "category-comparison", "distribution"],
    interaction: "read",
    risk: "none"
  },
  "syntari.comparison-table": {
    role: "comparison",
    bestFor: ["exact-comparison", "option-comparison", "period-comparison"],
    interaction: "read",
    risk: "none"
  },
  "syntari.table": {
    role: "table",
    bestFor: ["records", "exact-values", "lookup"],
    interaction: "read",
    risk: "none"
  },
  "syntari.stat-row": {
    role: "summary",
    bestFor: ["headline-kpis", "snapshot", "summary"],
    interaction: "read",
    risk: "none"
  },
  "syntari.source-list": {
    role: "evidence",
    bestFor: ["provenance", "sources", "auditability"],
    interaction: "read",
    risk: "none"
  },
  "syntari.tool-approval": {
    role: "action",
    bestFor: ["confirmation", "destructive-action", "tool-call"],
    interaction: "approve",
    risk: "managed"
  }
});

export const REPRESENTATION_TO_COMPONENT = Object.freeze({
  trend: "syntari.area-chart",
  categorical: "syntari.chart-bars",
  comparison: "syntari.comparison-table",
  table: "syntari.table",
  summary: "syntari.stat-row",
  action: "syntari.tool-approval"
});

export function resolveComponents(decisions) {
  const {
    intent = "analytics",
    representation = "summary",
    comparisonNeeded = false,
    evidenceNeeded = false,
    risk = "read"
  } = decisions;

  const highRisk = risk === "destructive" || risk === "critical";
  const primary = highRisk
    ? "syntari.tool-approval"
    : REPRESENTATION_TO_COMPONENT[representation] ?? "syntari.stat-row";

  const supporting = [];

  if (intent === "analytics" && primary !== "syntari.stat-row") {
    supporting.push("syntari.stat-row");
  }

  if (comparisonNeeded && primary !== "syntari.comparison-table" && !highRisk) {
    supporting.push("syntari.comparison-table");
  }

  if (evidenceNeeded && !highRisk) {
    supporting.push("syntari.source-list");
  }

  return {
    primary,
    supporting: [...new Set(supporting)],
    components: [primary, ...new Set(supporting)]
  };
}
