const scenarios = {
  q2: {
    request: "Compare Q2 revenue with Q1 and explain why costs increased.",
    state: {
      shape: "time-series",
      periods: "Q1 + Q2",
      metrics: "revenue · costs · margin",
      provenance: "available"
    },
    latency: "86 ms",
    decisions: [
      ["intent", "analytics", .98],
      ["representation", "trend", .91],
      ["comparison", "yes", .97],
      ["evidence", "yes", .84],
      ["reasoning", "yes", .88],
      ["risk", "read", .99]
    ],
    primary: "syntari.area-chart",
    supporting: ["syntari.stat-row","syntari.comparison-table","syntari.source-list"],
    route: {
      needsLLM: true,
      title: "Reasoning required",
      copy: "Use the LLM only to explain why costs increased.",
      footer: "Jev routes → LLM"
    },
    preview: "analytics"
  },
  brief: {
    request: "Prepare a project brief before the weekly product meeting.",
    state: {
      shape: "project context",
      sources: "tasks · decisions · owners",
      output: "meeting brief",
      provenance: "available"
    },
    latency: "73 ms",
    decisions: [
      ["intent", "workflow", .94],
      ["representation", "summary", .89],
      ["comparison", "no", .92],
      ["evidence", "yes", .79],
      ["reasoning", "yes", .95],
      ["risk", "read", .99]
    ],
    primary: "syntari.stat-row",
    supporting: ["syntari.metadata-list","syntari.source-list"],
    route: {
      needsLLM: true,
      title: "Synthesis required",
      copy: "The LLM summarizes project state after Jev fixes the UI shape.",
      footer: "Jev routes → LLM"
    },
    preview: "brief"
  },
  delete: {
    request: "Delete the 37 inactive users in this workspace.",
    state: {
      shape: "records",
      scope: "37 users",
      mutation: "delete",
      reversible: "false"
    },
    latency: "64 ms",
    decisions: [
      ["intent", "action", .99],
      ["representation", "action", .98],
      ["comparison", "no", .99],
      ["evidence", "no", .87],
      ["reasoning", "no", .94],
      ["risk", "destructive", .99]
    ],
    primary: "syntari.tool-approval",
    supporting: [],
    route: {
      needsLLM: false,
      title: "LLM skipped",
      copy: "No open-ended reasoning is needed. Safety policy wins.",
      footer: "Direct → Syntari IR"
    },
    preview: "approval"
  }
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function confidenceLabel(value) {
  return Math.round(value * 100) + "%";
}

function renderState(scenario) {
  $("[data-request]").textContent = "“" + scenario.request + "”";
  $("[data-state]").innerHTML = Object.entries(scenario.state)
    .map(([key,value]) => '<div class="state-item"><span>' + key + '</span><span>' + value + '</span></div>')
    .join("");
}

function renderDecisions(scenario) {
  $("[data-decisions]").innerHTML = scenario.decisions.map(([name,value,confidence]) => `
    <div class="decision">
      <span class="decision-name">${name}</span>
      <strong class="decision-value">${value}</strong>
      <span class="decision-confidence">${confidenceLabel(confidence)}</span>
      <div class="decision-bar"><span style="--confidence:${confidence * 100}%"></span></div>
    </div>
  `).join("");
  $("[data-latency]").textContent = scenario.latency;
}

function renderPlan(scenario) {
  $("[data-primary]").textContent = scenario.primary;
  $("[data-supporting]").innerHTML = scenario.supporting.length
    ? scenario.supporting.map(component => '<div class="component-pill">' + component + '</div>').join("")
    : '<div class="component-pill">No supporting components</div>';
  $("[data-ir-count]").textContent = (1 + scenario.supporting.length) + " nodes";
}

function renderRoute(scenario) {
  const root = $("[data-route-state]");
  root.classList.toggle("is-skip", !scenario.route.needsLLM);
  $("[data-route-title]").textContent = scenario.route.title;
  $("[data-route-copy]").textContent = scenario.route.copy;
  $("[data-route-footer]").textContent = scenario.route.footer;
}

function renderTrace(scenario) {
  $("[data-trace]").innerHTML = scenario.decisions.map(([name,value,confidence]) => `
    <div class="trace-row">
      <span>${name}</span>
      <em>${confidenceLabel(confidence)}</em>
      <strong>${value}</strong>
    </div>
  `).join("");
}

function analyticsPreview() {
  return `
    <section class="generated-screen">
      <div class="generated-top">
        <strong>Q2 performance</strong>
        <span>Generated from Syntari registry</span>
      </div>
      <div class="generated-body">
        <div class="preview-stat-row">
          <div class="preview-stat"><span>Revenue</span><strong>€1.84M</strong><em>+18.6%</em></div>
          <div class="preview-stat"><span>Operating costs</span><strong>€712k</strong><em style="color:var(--warning-text)">+12.4%</em></div>
          <div class="preview-stat"><span>Margin</span><strong>61.3%</strong><em>+2.1 pp</em></div>
        </div>
        <div class="preview-grid">
          <div class="preview-card">
            <div class="preview-card-head"><strong>Revenue over time</strong><span>Q2 vs Q1</span></div>
            <svg class="preview-chart" viewBox="0 0 520 145" preserveAspectRatio="none" aria-label="Revenue trend">
              <path class="grid" d="M0 28H520 M0 72H520 M0 116H520"/>
              <path class="fill" d="M0 118 C55 102,76 108,118 83 S195 91,235 62 S316 72,356 49 S432 58,520 22 L520 145 L0 145Z"/>
              <path class="line" d="M0 118 C55 102,76 108,118 83 S195 91,235 62 S316 72,356 49 S432 58,520 22"/>
            </svg>
          </div>
          <div class="preview-card">
            <div class="preview-card-head"><strong>Q1 → Q2</strong><span>comparison</span></div>
            <div class="mini-comparison">
              <div class="comparison-row"><span>Revenue</span><strong>€1.55M</strong><strong>€1.84M</strong></div>
              <div class="comparison-row"><span>Costs</span><strong>€633k</strong><strong>€712k</strong></div>
              <div class="comparison-row"><span>Margin</span><strong>59.2%</strong><strong>61.3%</strong></div>
            </div>
            <div class="preview-card-head" style="margin-top:18px"><strong>Evidence</strong><span>sources</span></div>
            <div class="source-row"><span>Billing warehouse</span><strong>58%</strong></div>
            <div class="source-row"><span>Finance ledger</span><strong>27%</strong></div>
            <div class="source-row"><span>CRM</span><strong>15%</strong></div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function briefPreview() {
  return `
    <section class="generated-screen">
      <div class="generated-top">
        <strong>Project brief</strong>
        <span>Prepared for weekly product meeting</span>
      </div>
      <div class="generated-body">
        <div class="preview-stat-row">
          <div class="preview-stat"><span>Open work</span><strong>18</strong><em>5 priority</em></div>
          <div class="preview-stat"><span>Decisions needed</span><strong>3</strong><em style="color:var(--warning-text)">meeting</em></div>
          <div class="preview-stat"><span>Blockers</span><strong>2</strong><em style="color:var(--danger-text)">active</em></div>
        </div>
        <div class="brief-block">
          <span>What changed</span><strong>Renderer validation landed; registry coverage increased.</strong>
          <div class="brief-lines"><i></i><i></i><i></i></div>
        </div>
        <div class="brief-block">
          <span>Needs a decision</span><strong>Choose how the decision provider falls back below confidence threshold.</strong>
          <div class="brief-lines"><i></i><i></i><i></i></div>
        </div>
        <div class="brief-block">
          <span>Sources</span><strong>7 project records used to prepare this brief.</strong>
        </div>
      </div>
    </section>
  `;
}

function approvalPreview() {
  return `
    <section class="generated-screen">
      <div class="generated-top">
        <strong>Workspace actions</strong>
        <span>Human approval required</span>
      </div>
      <div class="generated-body">
        <div class="approval-preview">
          <div class="approval-head">
            <div class="approval-icon">!</div>
            <div><strong>Delete 37 inactive users?</strong><span>Destructive · irreversible</span></div>
          </div>
          <div class="approval-copy">
            This action removes 37 users and their workspace access. Jev classified the request as destructive,
            so Syntari requires explicit approval before any tool call can continue.
          </div>
          <div class="approval-actions">
            <button>Decline</button>
            <button class="danger-action">Approve deletion</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderPreview(scenario) {
  const html = scenario.preview === "analytics"
    ? analyticsPreview()
    : scenario.preview === "brief"
      ? briefPreview()
      : approvalPreview();
  $("[data-preview]").innerHTML = html;
  const count = 1 + scenario.supporting.length;
  $("[data-result-status]").textContent = scenario.preview === "approval"
    ? "Generated safety interface · approval required"
    : "Generated from " + count + " selected components";
}

async function animatePipeline() {
  const stages = $$("[data-stage]");
  stages.forEach(stage => stage.classList.remove("is-processing"));
  if (reducedMotion) return;
  for (const stage of stages) {
    stage.classList.add("is-processing");
    await new Promise(resolve => setTimeout(resolve, 170));
    stage.classList.remove("is-processing");
  }
}

function paint(name, animate = true) {
  const scenario = scenarios[name];
  renderState(scenario);
  renderDecisions(scenario);
  renderPlan(scenario);
  renderRoute(scenario);
  renderTrace(scenario);
  renderPreview(scenario);
  if (animate) animatePipeline();
}

$$("[data-scenario]").forEach(button => {
  button.addEventListener("click", () => {
    $$("[data-scenario]").forEach(item => item.classList.toggle("is-selected", item === button));
    paint(button.dataset.scenario);
  });
});

paint("q2", false);
