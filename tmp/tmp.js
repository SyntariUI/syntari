import { initialize, getComponents, mount, prepare } from "../syntari.js";

const page = document.body.dataset.tmpPage;
const $ = function(selector, root) { return (root || document).querySelector(selector); };
const $$ = function(selector, root) { return Array.from((root || document).querySelectorAll(selector)); };
const wait = function(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); };
const escapeHtml = function(value) {
  return String(value).replace(/[&<>"']/g, function(char) {
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char];
  });
};

function iconTheme(theme) {
  if (theme === "dark") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
}

function setupTheme() {
  var button = $("[data-theme-toggle]");
  if (!button) return;
  function paint() {
    var theme = document.documentElement.dataset.theme || "dark";
    button.innerHTML = iconTheme(theme);
    button.setAttribute("aria-label", "Switch to " + (theme === "dark" ? "light" : "dark") + " theme");
  }
  button.addEventListener("click", function() {
    var next = (document.documentElement.dataset.theme || "dark") === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("syntari-theme", next); } catch (error) {}
    paint();
  });
  paint();
}

function setupMagnetic() {
  if (matchMedia("(pointer: coarse)").matches) return;
  $$("[data-magnetic]").forEach(function(button) {
    button.addEventListener("pointermove", function(event) {
      var rect = button.getBoundingClientRect();
      var x = (event.clientX - rect.left - rect.width / 2) * 0.07;
      var y = (event.clientY - rect.top - rect.height / 2) * 0.09;
      button.style.transform = "translate3d(" + x + "px," + y + "px,0)";
    });
    button.addEventListener("pointerleave", function() { button.style.transform = ""; });
  });
}

function setupCursor(stage) {
  if (!stage || matchMedia("(pointer: coarse)").matches) return;
  var cursor = $(".cursor-orbit", stage);
  if (!cursor) return;
  var targetX = -40, targetY = -40, x = -40, y = -40, raf = 0;
  function loop() {
    x += (targetX - x) * 0.19;
    y += (targetY - y) * 0.19;
    cursor.style.transform = "translate3d(" + (x - 13) + "px," + (y - 13) + "px,0)";
    raf = requestAnimationFrame(loop);
  }
  stage.addEventListener("pointerenter", function() {
    cursor.classList.add("is-visible");
    if (!raf) loop();
  });
  stage.addEventListener("pointerleave", function() {
    cursor.classList.remove("is-visible");
  });
  stage.addEventListener("pointermove", function(event) {
    var rect = stage.getBoundingClientRect();
    targetX = event.clientX - rect.left + stage.scrollLeft;
    targetY = event.clientY - rect.top + stage.scrollTop;
    var hot = !!event.target.closest("button,a,input,textarea,select,[role=button]");
    cursor.classList.toggle("is-hot", hot);
  });
}

function copyText(text, button) {
  navigator.clipboard.writeText(text).then(function() {
    if (!button) return;
    var old = button.textContent;
    button.textContent = "Copied";
    setTimeout(function() { button.textContent = old; }, 1100);
  }).catch(function() {});
}

setupTheme();
setupMagnetic();

if (page === "home") {
  var scenarios = {
    dashboard: {
      label: "Revenue health",
      prompt: "Create a calm revenue health dashboard for a finance lead. Show ARR, month-over-month trend, channel contribution and anomalies.",
      intent: "Revenue health dashboard for a finance lead, prioritising ARR and its explanation.",
      pattern: "Metric overview",
      confidence: 94,
      slugs: ["headline-metric","metric-and-sparkline","chart-bars","source-list"],
      validation: ["Hierarchy has one dominant metric","Every comparison names its period","Chart values remain available as text","Semantic status is not color-only"]
    },
    onboarding: {
      label: "Workspace setup",
      prompt: "Create a workspace setup review with progress, owners, completed steps and the next action.",
      intent: "A setup review that makes progress and ownership immediately legible.",
      pattern: "Guided setup review",
      confidence: 91,
      slugs: ["progress-and-score","metadata-list","activity-list","selectable-cards"],
      validation: ["Progress has a textual equivalent","Next action remains explicit","Completed work stays visible","Interactive choices have focus states"]
    },
    review: {
      label: "Project review",
      prompt: "Create a project decision screen that summarizes status, evidence, activity and the next decision.",
      intent: "Project review focused on evidence, state and a clear next decision.",
      pattern: "Decision workspace",
      confidence: 89,
      slugs: ["banner","metadata-list","activity-list","tabs"],
      validation: ["Decision context appears before actions","Status is written, not implied","Activity uses chronological labels","Secondary actions are visually quiet"]
    },
    verification: {
      label: "Verification",
      prompt: "Create a secure one-time-code verification step with a clear error state and recovery path.",
      intent: "A focused verification step with obvious completion and recovery states.",
      pattern: "Verification step",
      confidence: 96,
      slugs: ["otp-input","banner","button","alert"],
      validation: ["Code slots expose focus state","Error state is announced in text","Recovery action remains reachable","No hidden destructive action"]
    }
  };

  var activeScenario = "dashboard";
  var catalog = [];
  var mounted = [];
  var rendering = false;

  function availableSlug(slug) {
    return catalog.some(function(item) { return item.slug === slug; });
  }

  function findFallback(index) {
    var preferred = ["headline-metric","metric-and-sparkline","progress-and-score","metadata-list","activity-list","card","switch","text-input"];
    for (var i = index; i < preferred.length; i += 1) {
      if (availableSlug(preferred[i])) return preferred[i];
    }
    return catalog[index % Math.max(catalog.length,1)] ? catalog[index % catalog.length].slug : null;
  }

  function destroyMounted() {
    mounted.forEach(function(instance) { try { instance.destroy(); } catch (error) {} });
    mounted = [];
  }

  function renderTrace(scenario, resolved) {
    $("[data-output-title]").textContent = scenario.label;
    $("[data-trace-intent]").textContent = scenario.intent;
    $("[data-trace-pattern]").textContent = scenario.pattern;
    $("[data-trace-confidence]").textContent = scenario.confidence + "%";
    $("[data-confidence-fill]").style.width = scenario.confidence + "%";
    $("[data-component-count]").textContent = resolved.length + " primitives";
    $("[data-trace-components]").innerHTML = resolved.map(function(slug, index) {
      var component = catalog.find(function(item) { return item.slug === slug; });
      var name = component ? component.name : slug;
      var category = component ? component.category : "Primitive";
      return '<div class="trace-component"><i>0' + (index + 1) + '</i><div><strong>' + escapeHtml(name) + '</strong><span>' + escapeHtml(category) + '</span></div></div>';
    }).join("");
    $("[data-validation-list]").innerHTML = scenario.validation.map(function(item) {
      return '<div class="validation-item"><i></i><span>' + escapeHtml(item) + '</span></div>';
    }).join("");
    var ir = {
      version: "0.2",
      intent: scenario.intent,
      pattern: scenario.pattern,
      confidence: scenario.confidence / 100,
      composition: resolved.map(function(slug, index) {
        return {slot:index === 0 ? "primary" : "support-" + index, component:slug};
      }),
      validation: {status:"pass", blockingIssues:0}
    };
    $("[data-ir-code]").textContent = JSON.stringify(ir, null, 2);
  }

  async function mountScenario(scenario, animate) {
    if (rendering) return;
    rendering = true;
    var runtime = $("[data-runtime]");
    var screen = $("[data-render-screen]");
    var loading = $("[data-render-loading]");
    var loadingLabel = $("[data-loading-label]");
    var steps = ["ask","decide","compose","verify","render"];
    runtime.classList.add("is-running");
    screen.classList.add("is-leaving");
    loading.hidden = false;
    $$("[data-runtime-step]").forEach(function(node) {
      node.classList.remove("is-active","is-complete");
    });

    if (animate !== false) {
      var labels = ["Understanding intent","Selecting valid patterns","Composing trusted primitives","Validating against Syntari","Rendering interface"];
      for (var s = 0; s < steps.length; s += 1) {
        var stepNode = $('[data-runtime-step="' + steps[s] + '"]');
        stepNode.classList.add("is-active");
        loadingLabel.textContent = labels[s];
        await wait(s === 0 ? 260 : 330);
        stepNode.classList.remove("is-active");
        stepNode.classList.add("is-complete");
      }
    } else {
      $$("[data-runtime-step]").forEach(function(node) { node.classList.add("is-complete"); });
    }

    destroyMounted();
    screen.innerHTML = "";
    var resolved = [];
    scenario.slugs.forEach(function(slug, index) {
      var actual = availableSlug(slug) ? slug : findFallback(index);
      if (actual && resolved.indexOf(actual) === -1) resolved.push(actual);
    });
    while (resolved.length < 4 && catalog[resolved.length]) {
      var candidate = catalog[resolved.length].slug;
      if (resolved.indexOf(candidate) === -1) resolved.push(candidate);
    }

    for (var i = 0; i < resolved.length; i += 1) {
      var cell = document.createElement("div");
      cell.className = "render-cell" + (i === 2 ? " wide" : "");
      screen.appendChild(cell);
      try {
        var instance = await mount(resolved[i], cell);
        mounted.push(instance);
      } catch (error) {
        cell.innerHTML = '<div class="trace-component"><i>0' + (i + 1) + '</i><div><strong>' + escapeHtml(resolved[i]) + '</strong><span>Trusted primitive</span></div></div>';
      }
    }

    renderTrace(scenario, resolved);
    screen.classList.remove("is-leaving");
    loading.hidden = true;
    $("[data-validation-summary]").textContent = "Validated";
    $$(".render-cell", screen).forEach(function(cell, index) {
      setTimeout(function() { cell.classList.add("is-in"); }, 80 + index * 95);
    });
    setTimeout(function() { runtime.classList.remove("is-running"); }, 700);
    rendering = false;
  }

  function selectScenario(key) {
    if (!scenarios[key]) return;
    activeScenario = key;
    $("[data-intent]").value = scenarios[key].prompt;
    $$("[data-scenario]").forEach(function(button) {
      button.setAttribute("aria-pressed", button.dataset.scenario === key ? "true" : "false");
    });
  }

  async function bootHome() {
    try {
      await initialize();
      catalog = await getComponents();
      setupCursor($("[data-render-viewport]"));
      $$("[data-scenario]").forEach(function(button) {
        button.addEventListener("click", function() { selectScenario(button.dataset.scenario); });
      });
      $("[data-intent-form]").addEventListener("submit", function(event) {
        event.preventDefault();
        var scenario = Object.assign({}, scenarios[activeScenario]);
        scenario.prompt = $("[data-intent]").value.trim() || scenario.prompt;
        scenario.intent = scenario.prompt;
        mountScenario(scenario, true);
      });
      $("[data-replay-render]").addEventListener("click", function() { mountScenario(scenarios[activeScenario], true); });
      $$("[data-trace-tab]").forEach(function(button, index) {
        button.addEventListener("click", function() {
          $$("[data-trace-tab]").forEach(function(item) { item.setAttribute("aria-selected","false"); });
          button.setAttribute("aria-selected","true");
          $(".trace-tabs .tab-indicator").style.setProperty("--tab-x", (index * 100) + "%");
          $$("[data-trace-view]").forEach(function(view) {
            var active = view.dataset.traceView === button.dataset.traceTab;
            view.hidden = !active;
            view.classList.toggle("is-active", active);
          });
        });
      });
      $("[data-copy-ir]").addEventListener("click", function(event) {
        copyText($("[data-ir-code]").textContent, event.currentTarget);
      });
      await mountScenario(scenarios.dashboard, false);
    } catch (error) {
      console.error(error);
      $("[data-render-screen]").innerHTML = '<div class="render-cell wide is-in"><div><strong>Syntari runtime unavailable</strong><p class="stage-hint">The preview shell loaded, but the component runtime did not.</p></div></div>';
    }
  }

  bootHome();
}

if (page === "components") {
  var componentCatalog = [];
  var selected = null;
  var selectedIndex = 0;
  var activeMount = null;
  var currentQuery = "";
  var previewDemoToken = 0;
  var previewEventTimer = 0;

  function getTokens(component) {
    if (Array.isArray(component.tokens) && component.tokens.length) return component.tokens.slice(0,10);
    var matches = String(component.html || "").match(/var\(--[a-z0-9-]+\)/g) || [];
    return Array.from(new Set(matches.map(function(value){ return value.slice(4,-1); }))).slice(0,10);
  }

  function groupComponents(items) {
    var groups = {};
    items.forEach(function(component) {
      var key = component.category || "Other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(component);
    });
    return groups;
  }

  function renderComponentNav() {
    var query = currentQuery.trim().toLowerCase();
    var visible = componentCatalog.filter(function(component) {
      return !query || (component.name + " " + component.category + " " + (component.description || "")).toLowerCase().includes(query);
    });
    var groups = groupComponents(visible);
    var html = "";
    Object.keys(groups).sort().forEach(function(category) {
      html += '<div class="nav-category">' + escapeHtml(category) + '</div>';
      groups[category].forEach(function(component) {
        var active = selected && selected.slug === component.slug;
        html += '<button class="nav-component" type="button" data-component-slug="' + escapeHtml(component.slug) + '" aria-current="' + (active ? "true" : "false") + '"><span>' + escapeHtml(component.name) + '</span><span>↗</span></button>';
      });
    });
    $("[data-component-nav]").innerHTML = html || '<div class="nav-category">No matches</div>';
    $$("[data-component-slug]").forEach(function(button) {
      button.addEventListener("click", function() {
        var nextComponent = componentCatalog.find(function(item) { return item.slug === button.dataset.componentSlug; });
        if (nextComponent) paintRawPreview(nextComponent);
        selectComponent(button.dataset.componentSlug, true);
      });
    });
  }

  function paintRawPreview(component) {
    var host = $("[data-component-mount]");
    if (!host || !component) return null;

    if (activeMount) {
      try { activeMount.destroy(); } catch (error) {}
      activeMount = null;
    }
    host.replaceChildren();

    var element = document.createElement("div");
    element.dataset.syntariComponent = component.slug;
    element.className = "specimen-body syntari-component workbench-preview-surface is-preview-ready";
    element.innerHTML = component.html || '<div class="preview-error-card"><strong>Empty component</strong><p>No preview markup is registered for this primitive.</p></div>';
    host.appendChild(element);

    activeMount = {
      element: element,
      destroy: function() { element.remove(); }
    };

    var status = $("[data-preview-status]");
    var output = $("[data-preview-output]");
    if (status) status.textContent = "Live preview";
    var controls = previewControls(host);
    if (output) output.textContent = controls.length ? controls.length + (controls.length === 1 ? " interactive control" : " interactive controls") : "Rendered output";
    return element;
  }

  function renderDocs(component) {
    $("[data-docs-category]").textContent = String(component.category || "Component").toUpperCase();
    $("[data-docs-title]").textContent = component.name;
    $("[data-docs-description]").textContent = component.description || "A trusted Syntari primitive.";
    $("[data-registry-id]").textContent = component.slug;
    var stageCategory = $("[data-stage-category]");
    var stageName = $("[data-stage-name]");
    if (stageCategory) stageCategory.textContent = String(component.category || "Component").toUpperCase();
    if (stageName) stageName.textContent = component.name;
    $("[data-code-title]").textContent = component.name;
    $("[data-code-file]").textContent = component.slug + ".html";
    $("[data-component-code]").textContent = component.html || "<!-- Component markup is provided by the Syntari runtime. -->";
    var runtime = 'await mount("' + component.slug + '", "#target")';
    $$("[data-runtime-snippet]").forEach(function(node) { node.textContent = runtime; });
    var tokens = getTokens(component);
    $("[data-token-list]").innerHTML = tokens.length ? tokens.map(function(token) {
      return '<div class="docs-token-item"><code>' + escapeHtml(token) + '</code><span style="--token-color:var(' + escapeHtml(token) + ')"></span></div>';
    }).join("") : '<p>No component-specific tokens. Uses the shared semantic layer.</p>';
    var docs = $("[data-docs-scroll]");
    if (docs && docs.animate) {
      docs.animate(
        [{opacity:.35,transform:"translateY(7px)"},{opacity:1,transform:"translateY(0)"}],
        {duration:460,easing:"cubic-bezier(.16,1,.3,1)"}
      );
    }
  }

  function previewControls(host) {
    if (!host) return [];
    return $$("button,a,input,textarea,select,[role=button],[role=tab],[role=switch]", host).filter(function(node) {
      if (node.disabled || node.getAttribute("aria-disabled") === "true") return false;
      var rect = node.getBoundingClientRect();
      return rect.width > 4 && rect.height > 4;
    });
  }

  function previewControlLabel(node) {
    if (!node) return "Component";
    var labelled = node.getAttribute("aria-label");
    if (labelled) return labelled;
    var label = node.closest("label");
    if (label) {
      var text = label.textContent.trim().replace(/\s+/g, " ");
      if (text) return text.slice(0, 54);
    }
    var own = node.textContent.trim().replace(/\s+/g, " ");
    if (own) return own.slice(0, 54);
    return node.tagName.toLowerCase();
  }

  function showPreviewEvent(message) {
    var eventBox = $("[data-preview-event]");
    var eventText = $("[data-preview-event-text]");
    if (!eventBox || !eventText) return;
    eventText.textContent = message;
    eventBox.hidden = false;
    eventBox.classList.remove("is-showing");
    void eventBox.offsetWidth;
    eventBox.classList.add("is-showing");
    clearTimeout(previewEventTimer);
    previewEventTimer = setTimeout(function() {
      eventBox.classList.remove("is-showing");
      setTimeout(function() { eventBox.hidden = true; }, 220);
    }, 1250);
  }

  function stopPreviewDemo() {
    previewDemoToken += 1;
    var cursor = $("[data-soft-cursor]");
    if (cursor) cursor.classList.remove("is-auto", "is-visible", "is-hot");
    $(".is-preview-demo").forEach(function(node) { node.classList.remove("is-preview-demo"); });
  }

  async function playPreviewDemo(component, host) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || matchMedia("(pointer:coarse)").matches) return;
    var token = ++previewDemoToken;
    var stage = $("[data-preview-stage]");
    var cursor = $("[data-soft-cursor]");
    if (!stage || !cursor) return;
    await wait(520);
    if (token !== previewDemoToken) return;

    var controls = previewControls(host).slice(0, 4);
    if (!controls.length) {
      showPreviewEvent("Rendered · " + component.name);
      return;
    }

    cursor.classList.add("is-visible", "is-auto");
    for (var index = 0; index < controls.length; index += 1) {
      if (token !== previewDemoToken) return;
      var control = controls[index];
      var stageRect = stage.getBoundingClientRect();
      var rect = control.getBoundingClientRect();
      var x = rect.left - stageRect.left + stage.scrollLeft + rect.width / 2;
      var y = rect.top - stageRect.top + stage.scrollTop + rect.height / 2;
      cursor.style.transform = "translate3d(" + (x - 12) + "px," + (y - 12) + "px,0)";
      cursor.classList.toggle("is-hot", rect.width > 42 || rect.height > 42);
      control.classList.add("is-preview-demo");
      try { control.focus({preventScroll:true}); } catch (error) {}
      showPreviewEvent("Focus · " + previewControlLabel(control));
      await wait(620);
      if (token !== previewDemoToken) return;

      var text = previewControlLabel(control).toLowerCase();
      var dangerous = /(delete|remove|archive|approve|reject|send|purchase|danger|destroy)/.test(text);
      var toggle = control.hasAttribute("aria-pressed") ||
        control.matches('input[type="checkbox"],input[type="radio"]') ||
        !!control.closest("[data-segment]");
      if (toggle && !dangerous) {
        try { control.click(); } catch (error) {}
        showPreviewEvent("Changed · " + previewControlLabel(control));
        await wait(360);
      }
      control.classList.remove("is-preview-demo");
    }
    await wait(280);
    if (token === previewDemoToken) cursor.classList.remove("is-auto", "is-visible", "is-hot");
  }

  function paintWorkspaceComponent(component, host) {
    if (activeMount) {
      try { activeMount.destroy(); } catch (error) {}
      activeMount = null;
    }

    try {
      host.getAnimations({subtree:true}).forEach(function(animation) {
        try { animation.cancel(); } catch (error) {}
      });
    } catch (error) {}
    host.replaceChildren();

    var element = document.createElement("div");
    element.dataset.syntariComponent = component.slug;
    element.className = "specimen-body syntari-component workbench-preview-surface is-preview-ready";
    element.innerHTML = component.html || '<div class="preview-error-card"><strong>Empty component</strong><p>No preview markup is registered for this primitive.</p></div>';
    host.appendChild(element);

    // The catalog markup is the preview. Enhancement is progressive and must never block paint.
    Promise.resolve()
      .then(function() { return prepare(element); })
      .catch(function(error) {
        console.error("Syntari preview enhancement failed for", component.slug, error);
        element.classList.add("is-preview-degraded");
        var status = $("[data-preview-status]");
        if (status) status.textContent = "Live preview · limited enhancement";
      });

    activeMount = {
      element: element,
      destroy: function() {
        try { element.getAnimations({subtree:true}).forEach(function(animation){ animation.cancel(); }); } catch (error) {}
        element.remove();
      }
    };
    return activeMount;
  }

  async function selectComponent(slug, animate) {
    var component = componentCatalog.find(function(item) { return item.slug === slug; });
    if (!component) return;
    selected = component;
    selectedIndex = componentCatalog.indexOf(component);
    renderComponentNav();
    renderDocs(component);
    closeCode();

    var host = $("[data-component-mount]");
    stopPreviewDemo();
    $("[data-preview-status]").textContent = "Mounting " + component.name + "…";
    var previewOutput = $("[data-preview-output]");
    if (previewOutput) previewOutput.textContent = "Preparing interaction demo";
    if (animate !== false) host.classList.add("is-changing");

    try {
      activeMount = paintWorkspaceComponent(component, host);
      var surface = activeMount && activeMount.element;
      if (surface) surface.classList.add("is-preview-ready");
      var controls = previewControls(host);
      $("[data-preview-status]").textContent = surface && surface.classList.contains("is-preview-degraded") ? "Live preview · limited enhancement" : "Live preview";
      if (previewOutput) previewOutput.textContent = controls.length ? controls.length + (controls.length === 1 ? " interactive control" : " interactive controls") : "Rendered output";
      playPreviewDemo(component, host);
    } catch (error) {
      console.error(error);
      host.innerHTML = '<div class="preview-error-card"><span>Preview</span><strong>' + escapeHtml(component.name) + '</strong><p>The component markup could not be painted. Check the registry entry for this primitive.</p></div>';
      $("[data-preview-status]").textContent = "Preview unavailable";
      if (previewOutput) previewOutput.textContent = "Render error";
      showPreviewEvent("Render failed · " + component.name);
    }
    if (animate !== false) setTimeout(function(){ host.classList.remove("is-changing"); }, 350);
    try { history.replaceState(null, "", "#" + component.slug); } catch (error) {}
  }

  function openCode() {
    var panel = $("[data-docs-panel]");
    panel.classList.add("is-code-open");
    $("[data-code-sheet]").setAttribute("aria-hidden","false");
  }

  function closeCode() {
    var panel = $("[data-docs-panel]");
    if (!panel) return;
    panel.classList.remove("is-code-open");
    $("[data-code-sheet]").setAttribute("aria-hidden","true");
  }

  function flashCopy(button, text) {
    navigator.clipboard.writeText(text).catch(function(){});
    if (!button) return;
    var label = button.querySelector("span");
    var original = button.dataset.originalLabel || (label ? label.textContent : button.textContent);
    button.dataset.originalLabel = original;
    if (label) label.textContent = "Copied";
    else button.textContent = "Copied";
    setTimeout(function() {
      var currentLabel = button.querySelector("span");
      if (currentLabel) currentLabel.textContent = original;
      else button.textContent = original;
    }, 950);
  }

  function toggleFocus() {
    var frame = $(".preview-frame");
    frame.classList.toggle("is-focused");
  }

  function setupSoftCursor() {
    if (matchMedia("(pointer:coarse)").matches) return;
    var stage = $("[data-preview-stage]");
    var cursor = $("[data-soft-cursor]");
    if (!stage || !cursor) return;
    var tx=-40,ty=-40,x=-40,y=-40,raf=0;
    function loop() {
      x += (tx-x)*.2;
      y += (ty-y)*.2;
      cursor.style.transform = "translate3d(" + (x-12) + "px," + (y-12) + "px,0)";
      raf=requestAnimationFrame(loop);
    }
    stage.addEventListener("pointerenter", function() {
      previewDemoToken += 1;
      cursor.classList.remove("is-auto");
      cursor.classList.add("is-visible");
      if (!raf) loop();
    });
    stage.addEventListener("pointerleave", function() { cursor.classList.remove("is-visible"); });
    stage.addEventListener("pointermove", function(event) {
      var rect=stage.getBoundingClientRect();
      tx=event.clientX-rect.left+stage.scrollLeft;
      ty=event.clientY-rect.top+stage.scrollTop;
      cursor.classList.toggle("is-hot", !!event.target.closest("button,a,input,textarea,select,[role=button]"));
    });
  }

  function openCommand() {
    var panel=$("[data-command-panel]");
    panel.hidden=false;
    var input=$("[data-command-input]");
    input.value="";
    renderCommand("");
    requestAnimationFrame(function(){ input.focus(); });
  }

  function closeCommand() { $("[data-command-panel]").hidden=true; }

  function renderCommand(query) {
    var q=String(query||"").toLowerCase();
    var list=componentCatalog.filter(function(component){
      return !q || (component.name+" "+component.category).toLowerCase().includes(q);
    }).slice(0,18);
    $("[data-command-results]").innerHTML=list.map(function(component){
      return '<button class="command-result" type="button" data-command-slug="' + escapeHtml(component.slug) + '"><span>' + escapeHtml(component.name) + '</span><span>' + escapeHtml(component.category || "") + '</span></button>';
    }).join("");
    $$("[data-command-slug]").forEach(function(button){
      button.addEventListener("click",function(){
        selectComponent(button.dataset.commandSlug,true);
        closeCommand();
      });
    });
  }

  async function bootComponents() {
    try {
      await initialize();
      componentCatalog=(await getComponents()).slice().sort(function(a,b){
        return (a.category||"").localeCompare(b.category||"") || a.name.localeCompare(b.name);
      });
      $("[data-total-components]").textContent=componentCatalog.length;
      renderComponentNav();

      var initial=location.hash ? location.hash.slice(1) : "otp-input";
      if (!componentCatalog.some(function(item){return item.slug===initial;})) {
        initial=componentCatalog[0] ? componentCatalog[0].slug : "";
      }
      if (initial) {
        var initialComponent = componentCatalog.find(function(item){ return item.slug === initial; });
        if (initialComponent) paintRawPreview(initialComponent);
        await selectComponent(initial,false);
      }
      setupSoftCursor();

      var previewHost = $("[data-component-mount]");
      if (previewHost) {
        previewHost.addEventListener("click", function(event) {
          var control = event.target.closest("button,a,input,textarea,select,[role=button],[role=tab],[role=switch]");
          if (control && previewHost.contains(control)) showPreviewEvent("Action · " + previewControlLabel(control));
        });
        previewHost.addEventListener("change", function(event) {
          var control = event.target.closest("input,select,textarea,[role=switch]");
          if (control) showPreviewEvent("Changed · " + previewControlLabel(control));
        });
      }

      $("[data-component-search]").addEventListener("input",function(event){
        currentQuery=event.target.value;
        renderComponentNav();
      });

      $$("[data-open-code]").forEach(function(button){button.addEventListener("click",openCode);});
      $("[data-close-code]").addEventListener("click",closeCode);

      $$("[data-copy-runtime]").forEach(function(button){
        button.addEventListener("click",function(event){
          var runtime=$("[data-runtime-snippet]").textContent;
          flashCopy(event.currentTarget,runtime);
        });
      });
      $("[data-copy-code]").addEventListener("click",function(event){
        flashCopy(event.currentTarget,$("[data-component-code]").textContent);
      });

      $("[data-replay-component]").addEventListener("click",function(){
        if (selected) selectComponent(selected.slug,true);
      });
      $("[data-fullscreen-preview]").addEventListener("click",toggleFocus);

      $("[data-command-input]").addEventListener("input",function(event){renderCommand(event.target.value);});
      $("[data-command-panel]").addEventListener("click",function(event){
        if(event.target===event.currentTarget) closeCommand();
      });

      document.addEventListener("keydown",function(event){
        var typing=event.target.matches("input,textarea,select");
        if(event.key==="Escape"){
          if(! $("[data-command-panel]").hidden) closeCommand();
          else if($("[data-docs-panel]").classList.contains("is-code-open")) closeCode();
          else $(".preview-frame").classList.remove("is-focused");
          return;
        }
        if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){
          event.preventDefault(); openCommand(); return;
        }
        if(event.key==="/"&&!typing){
          event.preventDefault();
          $("[data-component-search]").focus();
          return;
        }
        if(!typing&&event.altKey&&event.key==="ArrowRight"&&selected){
          event.preventDefault();
          var next=(selectedIndex+1)%componentCatalog.length;
          selectComponent(componentCatalog[next].slug,true);
        }
        if(!typing&&event.altKey&&event.key==="ArrowLeft"&&selected){
          event.preventDefault();
          var prev=(selectedIndex-1+componentCatalog.length)%componentCatalog.length;
          selectComponent(componentCatalog[prev].slug,true);
        }
      });
    } catch(error) {
      console.error(error);
      $("[data-component-nav]").innerHTML='<div class="nav-category">Runtime unavailable</div>';
    }
  }

  bootComponents();
}
