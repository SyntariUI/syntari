import { render, validate } from "../ir.js";

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
    supporting: [
      "syntari.stat-row",
      "syntari.streaming-response",
      "syntari.comparison-table",
      "syntari.source-list"
    ],
    route: {
      needsLLM: true,
      title: "Reasoning required",
      copy: "Use the LLM only to explain why costs increased.",
      footer: "Jev routes → LLM"
    },
    streamText: "Costs increased 12.4% quarter over quarter, led by infrastructure and contractor spend. Revenue grew faster than costs, so margin still improved by 2.1 percentage points.",
    numberAnimation: [
      { end: 1.84, format: n => "€" + n.toFixed(2) + "M" },
      { end: 712, format: n => "€" + Math.round(n) + "k" },
      { end: 61.3, format: n => n.toFixed(1) + "%" }
    ]
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
    supporting: [
      "syntari.streaming-response",
      "syntari.metadata-list",
      "syntari.source-list"
    ],
    route: {
      needsLLM: true,
      title: "Synthesis required",
      copy: "The LLM summarizes project state after Jev fixes the UI shape.",
      footer: "Jev routes → LLM"
    },
    streamText: "The team is shipping the renderer validation work, but two blockers remain. The meeting needs one decision: how low-confidence routing should fall back before Syntari composes the final interface.",
    numberAnimation: [
      { end: 18, format: n => String(Math.round(n)) },
      { end: 3, format: n => String(Math.round(n)) },
      { end: 2, format: n => String(Math.round(n)) }
    ]
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
    numberAnimation: []
  }
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = ms => new Promise(resolve => setTimeout(resolve, reducedMotion ? 0 : ms));

let generation = 0;
let activeScenario = "q2";
let activeRenders = [];
const promptInput = $("[data-prompt]");

function scenarioFromPrompt(value) {
  const prompt = String(value || "").toLowerCase();
  if (/delete|remove|inactive|destructive|revoke/.test(prompt)) return "delete";
  if (/brief|meeting|project|summary|prepare/.test(prompt)) return "brief";
  return "q2";
}

function destroyActiveRenders() {
  for (const result of activeRenders) {
    try { result.destroy(); } catch {}
  }
  activeRenders = [];
}

function componentIds(node, found = []) {
  if (!node || typeof node !== "object") return found;
  if (typeof node.component === "string") found.push(node.component);
  for (const child of node.children ?? []) componentIds(child, found);
  return found;
}

function followRender(container) {
  if (!container) return;
  requestAnimationFrame(() => {
    container.scrollTo({
      top: Math.max(0, container.scrollHeight - container.clientHeight),
      behavior: reducedMotion ? "auto" : "smooth"
    });
  });
}

function followIR() {
  const pane = $(".ir-stream");
  if (!pane) return;
  requestAnimationFrame(() => {
    pane.scrollTo({
      top: Math.max(0, pane.scrollHeight - pane.clientHeight),
      behavior: reducedMotion ? "auto" : "smooth"
    });
  });
}

function paintIR(spec, label = "streaming") {
  const code = $("[data-ir-code]");
  const progress = $("[data-ir-progress]");
  const pane = $(".ir-stream");
  if (code) code.textContent = JSON.stringify(spec, null, 2);
  if (progress) progress.textContent = label;
  followIR();
}


function confidenceLabel(value) {
  return Math.round(value * 100) + "%";
}

function specFor(name) {
  if (name === "q2") {
    return {
      version: "syntari-ir-1",
      type: "screen",
      layout: "stack",
      title: "Q2 performance",
      children: [
        {
          component: "syntari.stat-row",
          props: {
            stats: [
              { label: "Revenue", value: "€1.84M", badge: "+18.6%", note: "versus Q1", tone: "success" },
              { label: "Operating costs", value: "€712k", badge: "+12.4%", note: "versus Q1", tone: "warning" },
              { label: "Margin", value: "61.3%", badge: "+2.1 pp", note: "versus Q1", tone: "success" }
            ]
          }
        },
        {
          component: "syntari.streaming-response",
          props: {
            author: "Analysis agent",
            status: "Reasoning complete",
            text: scenarios.q2.streamText,
            action: "Regenerate",
            icon: "bot"
          }
        },
        {
          component: "syntari.area-chart",
          props: {
            title: "Revenue trend",
            note: "Indexed · Q2",
            chartLabel: "Revenue trend rises through Q2, ending at its strongest point in the period.",
            points: [
              { label: "W1", value: 52 }, { label: "W2", value: 58 }, { label: "W3", value: 55 },
              { label: "W4", value: 63 }, { label: "W5", value: 61 }, { label: "W6", value: 68 },
              { label: "W7", value: 72 }, { label: "W8", value: 69 }, { label: "W9", value: 76 },
              { label: "W10", value: 81 }, { label: "W11", value: 79 }, { label: "W12", value: 88 }
            ]
          }
        },
        {
          component: "syntari.comparison-table",
          props: {
            caption: "Q1 and Q2 measured on the same business outcomes",
            optionA: "Q1",
            optionB: "Q2",
            rows: [
              { metric: "Revenue", a: "€1.55M", b: "€1.84M", advantage: "Q2" },
              { metric: "Operating costs", a: "€633k", b: "€712k", advantage: "Q1" },
              { metric: "Margin", a: "59.2%", b: "61.3%", advantage: "Q2" }
            ]
          }
        },
        {
          type: "region",
          label: "Evidence · 3 sources",
          open: false,
          children: [
            {
              component: "syntari.source-list",
              props: {
                sources: [
                  { name: "Billing warehouse", share: 58 },
                  { name: "Finance ledger", share: 27 },
                  { name: "CRM", share: 15 }
                ]
              }
            }
          ]
        }
      ]
    };
  }

  if (name === "brief") {
    return {
      version: "syntari-ir-1",
      type: "screen",
      layout: "stack",
      title: "Project brief",
      children: [
        {
          component: "syntari.stat-row",
          props: {
            stats: [
              { label: "Open work", value: "18", badge: "5 priority", note: "current sprint", tone: "neutral" },
              { label: "Decisions needed", value: "3", badge: "meeting", note: "one blocks release", tone: "warning" },
              { label: "Blockers", value: "2", badge: "active", note: "need owners", tone: "danger" }
            ]
          }
        },
        {
          component: "syntari.streaming-response",
          props: {
            author: "Briefing agent",
            status: "Synthesized",
            text: scenarios.brief.streamText,
            action: "Regenerate",
            icon: "bot"
          }
        },
        {
          component: "syntari.metadata-list",
          props: {
            items: [
              { label: "Focus", value: "Renderer validation and decision-provider fallback" },
              { label: "Decision", value: "Choose behavior below the confidence threshold" },
              { label: "Owners", value: "Product · Design engineering · Platform" },
              { label: "Meeting", value: "Weekly product review" }
            ]
          }
        },
        {
          type: "region",
          label: "Sources · 4 project records",
          open: false,
          children: [
            {
              component: "syntari.source-list",
              props: {
                sources: [
                  { name: "Project tasks", share: 42 },
                  { name: "Decision log", share: 28 },
                  { name: "GitHub activity", share: 19 },
                  { name: "Meeting notes", share: 11 }
                ]
              }
            }
          ]
        }
      ]
    };
  }

  return {
    version: "syntari-ir-1",
    type: "screen",
    layout: "stack",
    title: "Workspace action",
    children: [
      {
        component: "syntari.tool-approval",
        props: {
          title: "Destructive action",
          question: "Delete 37 inactive users from this workspace?",
          scope: "37 users · workspace access and associated memberships",
          hint: "This action is irreversible. Explicit human approval is required.",
          icon: "trash2",
          approveLabel: "Approve deletion",
          rejectLabel: "Decline"
        }
      }
    ]
  };
}

function renderState(scenario) {
  $("[data-request]").textContent = "“" + scenario.request + "”";
  $("[data-state]").innerHTML = Object.entries(scenario.state)
    .map(([key, value]) => '<div class="state-item"><span>' + key + '</span><span>' + value + '</span></div>')
    .join("");
}

function decisionPlaceholder(scenario) {
  $("[data-decisions]").innerHTML = scenario.decisions.map(([name]) =>
    '<div class="decision is-pending" data-decision="' + name + '">' +
      '<span class="decision-name">' + name + '</span>' +
      '<strong class="decision-value">evaluating…</strong>' +
      '<span class="decision-confidence">—</span>' +
      '<div class="decision-bar"><span style="--confidence:0%"></span></div>' +
    '</div>'
  ).join("");
  $("[data-latency]").textContent = "running";
}

function revealDecision(decision) {
  const [name, value, confidence] = decision;
  const row = $('[data-decision="' + name + '"]');
  if (!row) return;
  $(".decision-value", row).textContent = value;
  $(".decision-confidence", row).textContent = confidenceLabel(confidence);
  $(".decision-bar span", row).style.setProperty("--confidence", (confidence * 100) + "%");
  row.classList.remove("is-pending");
  row.classList.add("is-resolved");
}

function resetPlan() {
  $("[data-primary]").textContent = "Waiting for Jev…";
  $("[data-primary]").classList.add("is-waiting");
  $("[data-supporting]").innerHTML = '<div class="component-pill is-waiting">No components selected yet</div>';
}

async function revealPlan(scenario, id) {
  const primary = $("[data-primary]");
  primary.classList.remove("is-waiting");
  primary.textContent = scenario.primary;
  primary.classList.add("jev-pop");
  await sleep(140);
  if (id !== generation) return;

  const target = $("[data-supporting]");
  target.innerHTML = "";
  if (!scenario.supporting.length) {
    target.innerHTML = '<div class="component-pill jev-pop">No supporting components</div>';
    return;
  }

  for (const component of scenario.supporting) {
    if (id !== generation) return;
    const pill = document.createElement("div");
    pill.className = "component-pill jev-pop";
    pill.textContent = component;
    target.append(pill);
    await sleep(120);
  }
}

function renderRoute(scenario) {
  const root = $("[data-route-state]");
  root.classList.toggle("is-skip", !scenario.route.needsLLM);
  $("[data-route-title]").textContent = scenario.route.title;
  $("[data-route-copy]").textContent = scenario.route.copy;
  $("[data-route-footer]").textContent = scenario.route.footer;
}

function resetRoute() {
  const root = $("[data-route-state]");
  root.classList.add("is-skip");
  $("[data-route-title]").textContent = "Waiting for policy";
  $("[data-route-copy]").textContent = "Jev decides whether open-ended reasoning is necessary.";
  $("[data-route-footer]").textContent = "Route pending";
}

function resetCompile() {
  $("[data-ir-count]").textContent = "Waiting";
  $("[data-registry-status]").textContent = "Waiting";
  $("[data-registry-status]").className = "";
  $("[data-validator-status]").textContent = "Waiting";
  $("[data-validator-status]").className = "";
  $("[data-renderer-status]").textContent = "Waiting";
  $("[data-renderer-status]").className = "";
}

function addTrace(decision) {
  const [name, value, confidence] = decision;
  const row = document.createElement("div");
  row.className = "trace-row is-new";
  row.innerHTML =
    '<span>' + name + '</span>' +
    '<em>' + confidenceLabel(confidence) + '</em>' +
    '<strong>' + value + '</strong>';
  $("[data-trace]").append(row);
}

function stage(name, state) {
  const node = $('[data-stage="' + name + '"]');
  if (!node) return;
  node.classList.toggle("is-processing", state === "processing");
  node.classList.toggle("is-complete", state === "complete");
}

function skeleton(status, detail, count) {
  const blocks = Array.from({ length: Math.max(2, Math.min(count, 5)) }, (_, index) =>
    '<div class="generation-skeleton-card skeleton-' + (index + 1) + '">' +
      '<span></span><i></i><i></i><i></i>' +
    '</div>'
  ).join("");

  $("[data-preview]").innerHTML =
    '<div class="generation-shell">' +
      '<div class="generation-status">' +
        '<span class="generation-pulse"></span>' +
        '<div><strong data-generation-status>' + status + '</strong><p data-generation-detail>' + detail + '</p></div>' +
      '</div>' +
      '<div class="generation-skeleton">' + blocks + '</div>' +
    '</div>';
}

function setSkeletonStatus(status, detail) {
  const title = $("[data-generation-status]");
  const copy = $("[data-generation-detail]");
  if (title) title.textContent = status;
  if (copy) copy.textContent = detail;
}

function animateNumbers(scenario, root) {
  if (reducedMotion || !scenario.numberAnimation.length) return;
  const values = $$('[data-ir-component="stat-row"] .stat-card strong', root);
  values.forEach((node, index) => {
    const config = scenario.numberAnimation[index];
    if (!config) return;
    const duration = 760;
    const started = performance.now();
    node.textContent = config.format(0);
    const tick = now => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = config.format(config.end * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function animateChart(root) {
  if (reducedMotion) return;
  const line = $(".area-line", root);
  const fill = $(".area-fill", root);
  if (line && typeof line.getTotalLength === "function") {
    const length = line.getTotalLength();
    line.style.strokeDasharray = String(length);
    line.style.strokeDashoffset = String(length);
    line.animate(
      [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
      { duration: 950, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards", delay: 260 }
    );
  }
  if (fill) {
    fill.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, fill: "forwards", delay: 420 });
  }
}

function animateBars(root) {
  if (reducedMotion) return;
  $$(".rank-fill", root).forEach((bar, index) => {
    bar.animate(
      [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
      { duration: 650, easing: "cubic-bezier(.22,1,.36,1)", fill: "both", delay: 500 + index * 70 }
    );
    bar.style.transformOrigin = "left center";
  });
}

async function typeStreamingText(scenario, root, id) {
  if (!scenario.streamText) return;
  const content = $(".stream-content", root);
  const preview = root.closest("[data-preview]");
  if (!content || reducedMotion) return;
  content.textContent = "";
  const text = scenario.streamText;
  for (let index = 0; index < text.length; index += 2) {
    if (id !== generation) return;
    content.textContent = text.slice(0, index + 2);
    if (index % 16 === 0) followRender(preview);
    await sleep(12);
  }
  content.textContent = text;
  followRender(preview);
}

async function openEvidence(root, id) {
  const details = $(".ir-region", root);
  if (!details) return;
  await sleep(280);
  if (id !== generation) return;
  details.open = true;
  details.classList.add("jev-evidence-open");
  followRender(root.closest("[data-preview]"));
}

function animateGeneratedNodes(root) {
  const nodes = $$(".ir-node, .ir-region", root);
  nodes.forEach((node, index) => {
    node.classList.add("jev-generated-node");
    node.style.setProperty("--enter-delay", (index * 110) + "ms");
  });
}

async function renderGeneratedInterface(name, scenario, id) {
  const preview = $("[data-preview]");
  const validationLabel = $("[data-validation-label]");
  const fullSpec = specFor(name);

  destroyActiveRenders();

  paintIR(
    { version: fullSpec.version, type: fullSpec.type, layout: fullSpec.layout, title: fullSpec.title, children: [] },
    "planning"
  );
  setSkeletonStatus("Validating Screen IR", "Every component is checked against the Syntari registry before anything is mounted.");
  $("[data-ir-count]").textContent = fullSpec.children.length + " top-level nodes";
  if (validationLabel) validationLabel.textContent = "checking Syntari registry";

  const ids = componentIds(fullSpec);
  const foreignIds = ids.filter(component => !component.startsWith("syntari."));
  const preflight = await validate(fullSpec);
  const preflightErrors = preflight.diagnostics.filter(item => item.severity === "error");

  if (id !== generation) return;

  if (foreignIds.length || preflightErrors.length) {
    $("[data-registry-status]").textContent = "Blocked";
    $("[data-registry-status]").className = "error";
    $("[data-validator-status]").textContent = preflightErrors.length + foreignIds.length + " errors";
    $("[data-validator-status]").className = "error";
    $("[data-renderer-status]").textContent = "Stopped";
    $("[data-renderer-status]").className = "error";
    if (validationLabel) validationLabel.textContent = "blocked by registry";
    preview.innerHTML =
      '<div class="generation-shell"><div class="generation-status">' +
        '<span class="generation-pulse"></span><div><strong>Render blocked</strong>' +
        '<p>Jev can only render components that pass the Syntari registry and component contracts.</p></div>' +
      '</div></div>';
    return;
  }

  $("[data-registry-status]").textContent = "Passed";
  $("[data-registry-status]").className = "ok";
  if (validationLabel) validationLabel.textContent = "Syntari registry passed";

  const progressiveRoot = document.createElement("div");
  progressiveRoot.className = "ir-screen jev-progressive-screen";
  progressiveRoot.dataset.irLayout = fullSpec.layout || "stack";
  progressiveRoot.dataset.jevGeneration = String(id);

  if (fullSpec.title) {
    const heading = document.createElement("h2");
    heading.className = "ir-screen-title";
    heading.textContent = fullSpec.title;
    progressiveRoot.append(heading);
  }

  preview.replaceChildren(progressiveRoot);
  preview.scrollTop = 0;

  const diagnostics = [];

  for (let index = 0; index < fullSpec.children.length; index += 1) {
    if (id !== generation) return;

    const currentSpec = {
      ...fullSpec,
      children: fullSpec.children.slice(0, index + 1)
    };
    paintIR(currentSpec, (index + 1) + " / " + fullSpec.children.length + " nodes");

    const nodeSpec = {
      version: fullSpec.version,
      type: "screen",
      layout: fullSpec.layout,
      children: [fullSpec.children[index]]
    };

    const scratch = document.createElement("div");
    const result = await render(nodeSpec, scratch);

    if (id !== generation) {
      result.destroy();
      return;
    }

    activeRenders.push(result);
    diagnostics.push(...result.diagnostics);

    const appended = [...result.element.children];
    for (const node of appended) progressiveRoot.append(node);

    const newest = appended[appended.length - 1];
    if (newest) {
      newest.classList.add("jev-generated-node");
      newest.style.setProperty("--enter-delay", "0ms");
    }

    followRender(preview);
    await sleep(index === fullSpec.children.length - 1 ? 220 : 360);
  }

  const errors = diagnostics.filter(item => item.severity === "error").length;
  $("[data-validator-status]").textContent = errors ? errors + " errors" : "0 errors";
  $("[data-validator-status]").className = errors ? "error" : "ok";
  $("[data-renderer-status]").textContent = errors ? "Partial" : "Ready";
  $("[data-renderer-status]").className = errors ? "error" : "ok";
  if (validationLabel) validationLabel.textContent = errors ? "validation issues" : "validated by Syntari";

  animateNumbers(scenario, progressiveRoot);
  animateChart(progressiveRoot);
  animateBars(progressiveRoot);

  const count = progressiveRoot.querySelectorAll("[data-ir-component]").length;
  $("[data-result-status]").textContent = errors
    ? "Rendered with " + errors + " validation errors"
    : "Live · " + count + " real Syntari components · validated";

  await Promise.all([
    typeStreamingText(scenario, progressiveRoot, id),
    openEvidence(progressiveRoot, id)
  ]);

  followRender(preview);
  paintIR(fullSpec, "complete");
}

async function run(name, requestOverride = "") {
  activeScenario = name;
  const scenario = { ...scenarios[name], request: requestOverride.trim() || scenarios[name].request };
  const id = ++generation;

  if (promptInput && document.activeElement !== promptInput) promptInput.value = scenario.request;

  $$("[data-scenario]").forEach(button => {
    button.classList.toggle("is-selected", button.dataset.scenario === name);
    button.disabled = false;
  });

  $("[data-replay]").disabled = true;
  $("[data-result-status]").textContent = "Jev is deciding…";

  $$("[data-stage]").forEach(node => node.classList.remove("is-processing", "is-complete"));
  renderState(scenario);
  decisionPlaceholder(scenario);
  resetPlan();
  resetRoute();
  resetCompile();
  $("[data-trace]").innerHTML = "";
  skeleton("Reading application state", "Collecting only the context needed for this request.", 1 + scenario.supporting.length);
  paintIR({ intent: scenario.request, state: "reading context", screenIR: "pending" }, "reading state");

  stage("input", "processing");
  await sleep(190);
  if (id !== generation) return;
  stage("input", "complete");

  stage("jev", "processing");
  setSkeletonStatus("Jev is deciding", "Typed decisions arrive independently instead of generating prose.");
  for (const decision of scenario.decisions) {
    if (id !== generation) return;
    revealDecision(decision);
    addTrace(decision);
    await sleep(105);
  }
  $("[data-latency]").textContent = scenario.latency;
  stage("jev", "complete");

  stage("plan", "processing");
  setSkeletonStatus("Selecting Syntari components", "The decision space is narrowed to registry components that match the request.");
  await revealPlan(scenario, id);
  if (id !== generation) return;
  stage("plan", "complete");

  stage("route", "processing");
  renderRoute(scenario);
  if (scenario.route.needsLLM) {
    setSkeletonStatus("LLM reasoning", "The model handles synthesis only; it is not designing the interface.");
    await sleep(360);
  } else {
    setSkeletonStatus("LLM skipped", "This request is fully handled by typed routing and Syntari safety patterns.");
    await sleep(210);
  }
  if (id !== generation) return;
  stage("route", "complete");

  stage("render", "processing");
  await renderGeneratedInterface(name, scenario, id);
  if (id !== generation) return;
  stage("render", "complete");

  $("[data-replay]").disabled = false;
}

$$("[data-scenario]").forEach(button => {
  button.addEventListener("click", () => {
    const name = button.dataset.scenario;
    const request = scenarios[name].request;
    if (promptInput) promptInput.value = request;
    run(name, request);
  });
});

$("[data-prompt-form]")?.addEventListener("submit", event => {
  event.preventDefault();
  const request = promptInput?.value.trim();
  if (!request) return;
  run(scenarioFromPrompt(request), request);
});

$("[data-replay]").addEventListener("click", () => {
  const request = promptInput?.value.trim() || scenarios[activeScenario].request;
  run(activeScenario, request);
});

renderState(scenarios.q2);
decisionPlaceholder(scenarios.q2);
resetPlan();
resetRoute();
resetCompile();
skeleton("Ready", "The renderer will assemble itself from validated Syntari components.", 5);
paintIR({ intent: scenarios.q2.request, screenIR: "ready" }, "ready");

setTimeout(() => run("q2", promptInput?.value || scenarios.q2.request), reducedMotion ? 0 : 420);
