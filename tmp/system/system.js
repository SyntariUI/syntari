import { initialize, getComponents, mount } from "../../syntari.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let catalog = [];
let selected = null;
let activeMount = null;
let query = "";
let swapToken = 0;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[char]);
}

function group(items) {
  return items.reduce((groups, item) => {
    const key = item.category || "Other";
    (groups[key] ||= []).push(item);
    return groups;
  }, {});
}

function nav() {
  const q = query.trim().toLowerCase();
  const visible = catalog.filter(item =>
    !q || (item.name + " " + item.category + " " + (item.description || "")).toLowerCase().includes(q)
  );
  const groups = group(visible);
  const html = Object.keys(groups).sort().map(category => {
    const items = groups[category].map(component =>
      '<button class="sys-nav-item" type="button" data-slug="' + escapeHtml(component.slug) + '" aria-current="' +
      (selected?.slug === component.slug ? "true" : "false") + '">' +
      '<span>' + escapeHtml(component.name) + '</span></button>'
    ).join("");
    return '<div class="sys-nav-group"><div class="sys-nav-label">' + escapeHtml(category) + '</div>' + items + '</div>';
  }).join("");
  $("[data-nav]").innerHTML = html || '<div class="sys-nav-label">No matches</div>';
  $$("[data-slug]").forEach(button => {
    button.addEventListener("click", () => select(button.dataset.slug, true));
  });
}

function sizeMode(component) {
  const category = String(component.category || "").toLowerCase();
  const slug = component.slug;
  if (/table|list|data|navigation/.test(category) || /table|chart|navigation|calendar/.test(slug)) return "wide";
  if (/action|form|feedback/.test(category) || /button|input|switch|badge|tooltip/.test(slug)) return "compact";
  return "default";
}

function renderInspector(component) {
  $("[data-inspector-kicker]").textContent = component.category || "Component";
  $("[data-inspector-title]").textContent = component.name;
  $("[data-description]").textContent = component.description || "A trusted Syntari primitive.";
  $("[data-registry-id]").textContent = component.slug;
  $("[data-code-file]").textContent = component.slug + ".html";
  $("[data-source]").textContent = component.html || "<!-- Component markup is provided by the Syntari runtime. -->";
  const tokens = Array.isArray(component.tokens) ? component.tokens.slice(0,12) : [];
  $("[data-tokens]").innerHTML = tokens.length
    ? tokens.map(token => '<span class="sys-token">' + escapeHtml(token) + '</span>').join("")
    : '<span class="sys-token">semantic tokens</span>';
}

function setStatus(text) {
  $("[data-status]").textContent = text;
}

async function select(slug, animate = true) {
  const component = catalog.find(item => item.slug === slug);
  if (!component) return;

  const token = ++swapToken;
  const host = $("[data-component-mount]");
  selected = component;
  nav();
  renderInspector(component);
  $("[data-category]").textContent = component.category || "Component";
  $("[data-name]").textContent = component.name;
  setStatus("Preparing " + component.name + "…");

  if (animate && !reducedMotion) {
    host.classList.add("is-swapping");
    await wait(170);
  }
  if (token !== swapToken) return;

  if (activeMount) {
    try { activeMount.destroy(); } catch {}
    activeMount = null;
  }
  host.replaceChildren();

  try {
    activeMount = await mount(component.slug, host);
  } catch (error) {
    host.innerHTML = '<div style="font-size:13px;color:var(--muted)">Preview unavailable</div>';
    setStatus("Could not mount " + component.name);
    console.error(error);
    return;
  }
  if (token !== swapToken) {
    activeMount.destroy();
    return;
  }

  host.classList.remove("is-wide","is-compact","is-swapping","is-entering");
  const mode = sizeMode(component);
  if (mode === "wide") host.classList.add("is-wide");
  if (mode === "compact") host.classList.add("is-compact");
  if (animate && !reducedMotion) {
    void host.offsetWidth;
    host.classList.add("is-entering");
    setTimeout(() => host.classList.remove("is-entering"), 560);
  }

  setStatus("Live · real Syntari component");
  try { history.replaceState(null, "", "#" + component.slug); } catch {}
}

function panel(mode) {
  const workspace = $("[data-workspace]");
  const current = workspace.dataset.panel;
  const next = current === mode ? "none" : mode;
  workspace.dataset.panel = next;

  const open = next !== "none";
  $("[data-inspector]").setAttribute("aria-hidden", String(!open));
  $("[data-info-panel]").hidden = next !== "info";
  $("[data-code-panel]").hidden = next !== "code";
  $("[data-inspect]").setAttribute("aria-pressed", String(next === "info"));
  $("[data-code]").setAttribute("aria-pressed", String(next === "code"));
}

function closePanel() {
  const workspace = $("[data-workspace]");
  workspace.dataset.panel = "none";
  $("[data-inspector]").setAttribute("aria-hidden","true");
  $("[data-inspect]").setAttribute("aria-pressed","false");
  $("[data-code]").setAttribute("aria-pressed","false");
}

function focusMode() {
  const shell = $("[data-shell]");
  const active = shell.classList.toggle("is-focus");
  $("[data-focus]").setAttribute("aria-pressed", String(active));
  if (active) closePanel();
}

function copyInstall() {
  if (!selected) return;
  const text = "npx syntari add " + selected.slug;
  navigator.clipboard?.writeText(text).catch(()=>{});
  const button = $("[data-install] span");
  button.textContent = "Copied";
  setTimeout(() => button.textContent = "Install", 900);
}

function copyCode() {
  if (!selected) return;
  navigator.clipboard?.writeText(selected.html || "").catch(()=>{});
  const button = $("[data-copy-code]");
  const old = button.textContent;
  button.textContent = "Copied";
  setTimeout(() => button.textContent = old, 900);
}

function ambientMotion() {
  const stage = $("[data-stage]");
  const cursor = $("[data-cursor]");
  if (!stage || matchMedia("(pointer:coarse)").matches) return;

  let tx=-40,ty=-40,x=-40,y=-40,raf=0;
  const tick = () => {
    x += (tx-x)*.18;
    y += (ty-y)*.18;
    cursor.style.transform = "translate3d(" + (x-11) + "px," + (y-11) + "px,0)";
    raf = requestAnimationFrame(tick);
  };

  stage.addEventListener("pointerenter", () => {
    cursor.classList.add("is-visible");
    if (!raf) tick();
  });
  stage.addEventListener("pointerleave", () => cursor.classList.remove("is-visible","is-hot"));
  stage.addEventListener("pointermove", event => {
    const rect = stage.getBoundingClientRect();
    const rx = event.clientX - rect.left;
    const ry = event.clientY - rect.top;
    tx = rx; ty = ry;
    stage.style.setProperty("--mx", (rx / rect.width * 100).toFixed(2) + "%");
    stage.style.setProperty("--my", (ry / rect.height * 100).toFixed(2) + "%");
    cursor.classList.toggle("is-hot", !!event.target.closest("button,a,input,textarea,select,[role=button]"));
  });
}

function shortcuts(event) {
  const tag = event.target?.tagName?.toLowerCase();
  const typing = ["input","textarea","select"].includes(tag);
  if (event.key === "/" && !typing) {
    event.preventDefault();
    $("[data-search]").focus();
  }
  if (event.key === "Escape") {
    closePanel();
    if ($("[data-shell]").classList.contains("is-focus")) focusMode();
  }
}

async function boot() {
  await initialize();
  catalog = (await getComponents()).slice().sort((a,b) =>
    (a.category || "").localeCompare(b.category || "") || a.name.localeCompare(b.name)
  );
  $("[data-component-count]").textContent = catalog.length;
  nav();

  const initial = location.hash.slice(1);
  const preferred = ["metric-and-sparkline","date-range-picker","command-palette","button"];
  let slug = catalog.some(item => item.slug === initial) ? initial : preferred.find(name => catalog.some(item => item.slug === name));
  slug ||= catalog[0]?.slug;
  if (slug) await select(slug, false);

  $("[data-search]").addEventListener("input", event => {
    query = event.target.value;
    nav();
  });
  $("[data-inspect]").addEventListener("click", () => panel("info"));
  $("[data-code]").addEventListener("click", () => panel("code"));
  $("[data-close-panel]").addEventListener("click", closePanel);
  $("[data-focus]").addEventListener("click", focusMode);
  $("[data-install]").addEventListener("click", copyInstall);
  $("[data-copy-code]").addEventListener("click", copyCode);
  window.addEventListener("keydown", shortcuts);
  ambientMotion();
}

boot().catch(error => {
  console.error(error);
  setStatus("Workspace failed to load");
});
