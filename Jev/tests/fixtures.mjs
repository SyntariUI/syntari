export const FIXTURES = [
  {
    name: "Q2 performance",
    state: {
      request: "Compare Q2 revenue with Q1 and explain why costs increased.",
      dataProfile: {
        shape: "time-series",
        periods: ["Q1", "Q2"],
        metrics: ["revenue", "costs", "margin"],
        provenanceAvailable: true
      }
    },
    expected: {
      intent: "analytics",
      representations: ["trend", "comparison"],
      comparisonNeeded: true,
      evidenceNeeded: true,
      reasoningNeeded: true,
      risk: "read",
      primary: "syntari.area-chart"
    }
  },
  {
    name: "Daily signups",
    state: {
      request: "Show daily signups for the last 30 days.",
      dataProfile: {
        shape: "time-series",
        periods: ["last-30-days"],
        metrics: ["signups"],
        provenanceAvailable: false
      }
    },
    expected: {
      intent: "analytics",
      representations: ["trend"],
      comparisonNeeded: false,
      evidenceNeeded: false,
      reasoningNeeded: false,
      risk: "read",
      primary: "syntari.area-chart"
    }
  },
  {
    name: "Rank acquisition channels",
    state: {
      request: "Rank acquisition channels by qualified leads.",
      dataProfile: {
        shape: "categorical",
        dimensions: ["channel"],
        metrics: ["qualified-leads"],
        provenanceAvailable: false
      }
    },
    expected: {
      intent: "analytics",
      representations: ["categorical"],
      comparisonNeeded: false,
      evidenceNeeded: false,
      reasoningNeeded: false,
      risk: "read",
      primary: "syntari.chart-bars"
    }
  },
  {
    name: "Delete inactive users",
    state: {
      request: "Delete the 37 inactive users in this workspace.",
      dataProfile: {
        shape: "records",
        recordCount: 37,
        mutation: "delete",
        reversible: false
      }
    },
    expected: {
      intent: "action",
      representations: ["action"],
      comparisonNeeded: false,
      evidenceNeeded: false,
      reasoningNeeded: false,
      risk: "destructive",
      primary: "syntari.tool-approval"
    }
  },
  {
    name: "Overdue invoice records",
    state: {
      request: "Show every overdue invoice and let me inspect the source records.",
      dataProfile: {
        shape: "records",
        fields: ["customer", "amount", "due-date", "status"],
        provenanceAvailable: true
      }
    },
    expected: {
      intent: "reference",
      representations: ["table"],
      comparisonNeeded: false,
      evidenceNeeded: true,
      reasoningNeeded: false,
      risk: "read",
      primary: "syntari.table"
    }
  }
];

export function fixtureAnswers(fixture) {
  const expected = fixture.expected;
  return {
    intent: expected.intent,
    representation: expected.representations[0],
    comparisonNeeded: expected.comparisonNeeded,
    evidenceNeeded: expected.evidenceNeeded,
    reasoningNeeded: expected.reasoningNeeded,
    risk: expected.risk
  };
}
