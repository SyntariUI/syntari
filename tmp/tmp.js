import { initialize, getComponents, mount } from "../syntari.js";

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
  var filteredCatalog = [];
  var selected = null;
  var selectedIndex = 0;
  var activeMount = null;
  var currentCategory = "All";
  var currentQuery = "";

  function componentTokens(component) {
    if (Array.isArray(component.tokens) && component.tokens.length) return component.tokens;
    var matches = String(component.html || "").match(/var\(--[a-z0-9-]+\)/g) || [];
    var tokens = matches.map(function(value) { return value.slice(4,-1); });
    return Array.from(new Set(tokens)).slice(0,10);
  }

  function groupCatalog(items) {
    var groups = {};
    items.forEach(function(component) {
      var key = component.category || "Other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(component);
    });
    return groups;
  }

  function renderNav() {
    var base = componentCatalog.filter(function(component) {
      var haystack = (component.name + " " + component.category + " " + (component.description || "")).toLowerCase();
      return !currentQuery || haystack.indexOf(currentQuery.toLowerCase()) !== -1;
    });
    filteredCatalog = base;
    var groups = groupCatalog(base);
    var html = "";
    Object.keys(groups).sort().forEach(function(category) {
      html += '<div class="nav-category">' + escapeHtml(category) + '</div>';
      groups[category].forEach(function(component) {
        var active = selected && component.slug === selected.slug;
        html += '<button type="button" class="nav-component" data-component-slug="' + escapeHtml(component.slug) + '" aria-current="' + (active ? "true" : "false") + '"><span>' + escapeHtml(component.name) + '</span><span>↗</span></button>';
      });
    });
    $("[data-component-nav]").innerHTML = html || '<div class="nav-category">No matches</div>';
    $$("[data-component-slug]").forEach(function(button) {
      button.addEventListener("click", function() { selectComponent(button.dataset.componentSlug, true); });
    });
  }

  function renderInspector(component) {
    $("[data-inspector-title]").textContent = component.name;
    $("[data-inspector-description]").textContent = component.description || "A trusted Syntari primitive.";
    $("[data-component-code]").textContent = component.html || "<!-- Component markup is generated by the Syntari runtime. -->";
    var runtime = 'import { mount } from "/syntari.js";\nawait mount("' + component.slug + '", "#target");';
    $("[data-runtime-snippet]").textContent = runtime;
    var tokens = componentTokens(component);
    $("[data-token-list]").innerHTML = tokens.length ? tokens.map(function(token) {
      return '<div class="token-item"><code>' + escapeHtml(token) + '</code><span style="--token-color:var(' + escapeHtml(token) + ')"></span></div>';
    }).join("") : '<p class="stage-hint">Uses shared Syntari semantic tokens.</p>';
  }

  async function selectComponent(slug, animate) {
    var component = componentCatalog.find(function(item) { return item.slug === slug; });
    if (!component) return;
    selected = component;
    selectedIndex = componentCatalog.indexOf(component);
    currentCategory = component.category || "Other";
    renderNav();
    $("[data-selected-category]").textContent = component.category || "Component";
    $("[data-selected-name]").textContent = component.name;
    $("[data-stage-kicker]").textContent = String(component.category || "Component").toUpperCase();
    $("[data-stage-title]").textContent = component.name;
    $("[data-stage-description]").textContent = component.description || "A trusted Syntari primitive.";
    $("[data-component-position]").textContent = String(selectedIndex + 1).padStart(2,"0");
    renderInspector(component);
    var host = $("[data-component-mount]");
    if (animate !== false) host.classList.add("is-changing");
    await wait(animate === false ? 0 : 190);
    if (activeMount) {
      try { activeMount.destroy(); } catch (error) {}
      activeMount = null;
    }
    host.innerHTML = "";
    try {
      activeMount = await mount(component.slug, host);
    } catch (error) {
      host.innerHTML = '<div class="trace-component"><i>UI</i><div><strong>' + escapeHtml(component.name) + '</strong><span>Preview unavailable</span></div></div>';
    }
    if (animate !== false) setTimeout(function() { host.classList.remove("is-changing"); }, 290);
    try { history.replaceState(null,"","#" + component.slug); } catch (error) {}
  }

  function setInspector(open) {
    var app = $("[data-component-app]");
    app.dataset.inspector = open ? "open" : "closed";
    $("[data-toggle-inspector]").setAttribute("aria-expanded", open ? "true" : "false");
  }

  function selectInspectorTab(name, index) {
    $$("[data-inspector-tab]").forEach(function(button) {
      button.setAttribute("aria-selected", button.dataset.inspectorTab === name ? "true" : "false");
    });
    $(".inspector-tabs .tab-indicator").style.setProperty("--tab-x", (index * 100) + "%");
    $$("[data-inspector-view]").forEach(function(view) {
      var active = view.dataset.inspectorView === name;
      view.hidden = !active;
      view.classList.toggle("is-active", active);
    });
  }

  function openCommand() {
    var panel = $("[data-command-panel]");
    panel.hidden = false;
    var input = $("[data-command-input]");
    input.value = "";
    renderCommand("");
    requestAnimationFrame(function() { input.focus(); });
  }

  function closeCommand() {
    $("[data-command-panel]").hidden = true;
  }

  function renderCommand(query) {
    var list = componentCatalog.filter(function(component) {
      return !query || (component.name + " " + component.category).toLowerCase().indexOf(query.toLowerCase()) !== -1;
    }).slice(0,16);
    $("[data-command-results]").innerHTML = list.map(function(component) {
      return '<button type="button" class="command-result" data-command-slug="' + escapeHtml(component.slug) + '"><span>' + escapeHtml(component.name) + '</span><span>' + escapeHtml(component.category || "") + '</span></button>';
    }).join("");
    $$("[data-command-slug]").forEach(function(button) {
      button.addEventListener("click", function() {
        selectComponent(button.dataset.commandSlug, true);
        closeCommand();
      });
    });
  }

  async function bootComponents() {
    try {
      await initialize();
      componentCatalog = (await getComponents()).slice().sort(function(a,b) {
        return (a.category || "").localeCompare(b.category || "") || a.name.localeCompare(b.name);
      });
      $("[data-total-components]").textContent = componentCatalog.length;
      $("[data-component-total]").textContent = String(componentCatalog.length).padStart(2,"0");
      renderNav();
      var initialSlug = location.hash ? location.hash.slice(1) : "otp-input";
      if (!componentCatalog.some(function(item) { return item.slug === initialSlug; })) {
        initialSlug = componentCatalog[0] ? componentCatalog[0].slug : "";
      }
      if (initialSlug) await selectComponent(initialSlug, false);
      setupCursor($(".component-stage"));

      $("[data-component-search]").addEventListener("input", function(event) {
        currentQuery = event.target.value;
        renderNav();
      });
      $("[data-toggle-inspector]").addEventListener("click", function() {
        setInspector($("[data-component-app]").dataset.inspector !== "open");
      });
      $("[data-close-inspector]").addEventListener("click", function() { setInspector(false); });
      $("[data-replay-component]").addEventListener("click", function() {
        if (selected) selectComponent(selected.slug, true);
      });
      $("[data-prev-component]").addEventListener("click", function() {
        var next = (selectedIndex - 1 + componentCatalog.length) % componentCatalog.length;
        selectComponent(componentCatalog[next].slug, true);
      });
      $("[data-next-component]").addEventListener("click", function() {
        var next = (selectedIndex + 1) % componentCatalog.length;
        selectComponent(componentCatalog[next].slug, true);
      });
      $$("[data-inspector-tab]").forEach(function(button, index) {
        button.addEventListener("click", function() { selectInspectorTab(button.dataset.inspectorTab, index); });
      });
      $("[data-copy-runtime]").addEventListener("click", function(event) {
        copyText($("[data-runtime-snippet]").textContent, event.currentTarget);
      });
      $("[data-copy-code]").addEventListener("click", function(event) {
        copyText($("[data-component-code]").textContent, event.currentTarget);
      });
      $("[data-command]").addEventListener("click", openCommand);
      $("[data-command-input]").addEventListener("input", function(event) { renderCommand(event.target.value); });
      $("[data-command-panel]").addEventListener("click", function(event) {
        if (event.target === event.currentTarget) closeCommand();
      });

      document.addEventListener("keydown", function(event) {
        var typing = event.target.matches("input,textarea,select");
        if (event.key === "/" && !typing && $("[data-command-panel]").hidden) {
          event.preventDefault();
          openCommand();
        } else if (event.key === "Escape" && !$("[data-command-panel]").hidden) {
          closeCommand();
        } else if (event.key === "ArrowRight" && !typing && $("[data-command-panel]").hidden && selected) {
          var n = (selectedIndex + 1) % componentCatalog.length;
          selectComponent(componentCatalog[n].slug, true);
        } else if (event.key === "ArrowLeft" && !typing && $("[data-command-panel]").hidden && selected) {
          var p = (selectedIndex - 1 + componentCatalog.length) % componentCatalog.length;
          selectComponent(componentCatalog[p].slug, true);
        }
      });
    } catch (error) {
      console.error(error);
      $("[data-component-nav]").innerHTML = '<div class="nav-category">Runtime unavailable</div>';
    }
  }

  bootComponents();
}