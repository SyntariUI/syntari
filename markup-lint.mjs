/**
 * Composition checks for markup an agent wrote by hand with installed Syntari components (HTML or JSX), where Screen IR
 * validation does not reach. It reads the markup as text: tags, classes, and their nesting. It cannot see layout, styles
 * computed at runtime, conditional rendering, or components wrapped in other names, so it reports what the text shows
 * and says so. The same rule ids and severities as the Screen IR linter; the same policy.
 */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const SCOPES = new Set(['section', 'form', 'main', 'aside', 'dialog', 'article', 'header', 'footer', 'nav']);
const KPI = new Set(['stat-row', 'metric-strip', 'headline-metric']);
const GENERIC_SURFACE = /(^|[-_])(card|panel|tile|box)($|[-_])/i;

/** Class names that identify a registry component, from each render contract's root selector, such as .mini-card for card. */
export function componentClasses(manifests) {
  const map = new Map();
  for (const manifest of manifests) {
    const selector = typeof manifest?.ir?.node === 'string' ? manifest.ir.node : null;
    const match = selector?.match(/^\.([a-z0-9-]+)$/);
    if (match) map.set(match[1], manifest.id);
  }
  return map;
}

/** Elements with their line, classes, parent, and text, from HTML or JSX source. */
function parse(source) {
  const root = { tag: '#root', classes: [], children: [], text: '', line: 1, parent: null };
  let current = root;
  const lineAt = (() => { const starts = [0]; for (let i = 0; i < source.length; i += 1) if (source[i] === '\n') starts.push(i + 1); return index => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= index) lo = mid; else hi = mid - 1; } return lo + 1; }; })();
  const pattern = /<!--[\s\S]*?-->|<(\/?)([A-Za-z][\w.-]*)((?:[^>"'{}]|"[^"]*"|'[^']*'|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*?)(\/?)>/g;
  let last = 0, match;
  while ((match = pattern.exec(source))) {
    current.text += source.slice(last, match.index).replace(/\{[^{}]*\}/g, ' ');
    last = pattern.lastIndex;
    if (match[0].startsWith('<!--')) continue;
    const [, closing, rawTag, attributes, selfClosing] = match;
    const tag = rawTag.toLowerCase();
    if (closing) {
      let node = current;
      while (node !== root && node.tag !== tag) node = node.parent;
      if (node !== root) current = node.parent;
      continue;
    }
    const classAttr = attributes.match(/\b(?:class|className)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\})/);
    const variant = attributes.match(/\bvariant\s*=\s*["']([^"']+)["']/)?.[1];
    const element = { tag, raw: rawTag, classes: (classAttr ? classAttr[1] ?? classAttr[2] ?? classAttr[3] : '').split(/\s+/).filter(Boolean), variant, children: [], text: '', line: lineAt(match.index), parent: current };
    current.children.push(element);
    if (!selfClosing && !VOID.has(tag)) current = element;
  }
  current.text += source.slice(last);
  return root;
}
const walk = (node, visit) => { for (const child of node.children) { visit(child); walk(child, visit); } };
const ancestors = node => { const out = []; for (let at = node.parent; at && at.tag !== '#root'; at = at.parent) out.push(at); return out; };
const textOf = node => `${node.text} ${node.children.map(textOf).join(' ')}`.replace(/\s+/g, ' ').trim();

/**
 * Lint markup against the composition policy, and against a plan when one is given (meta.plan from plan_screen).
 * Returns { mode: 'source', findings, components, limits }; findings carry a line instead of a node path.
 */
export function lintMarkup(source, { policy, classes = new Map(), plan = null, file = null } = {}) {
  const tree = parse(String(source ?? ''));
  const findings = [];
  const rules = policy?.lint?.rules ?? {};
  const add = (rule, element, message, fix, severity) => findings.push({ rule, severity: severity ?? rules[rule]?.severity ?? 'warning', category: rules[rule]?.category ?? 'composition', file, line: element?.line ?? null, message, fix, autofix: false });
  const surfaceOf = id => Object.entries(policy?.surfaces?.components ?? {}).find(([, ids]) => ids.includes(id))?.[0] ?? 'none';
  const componentOf = element => element.classes.map(name => classes.get(name)).find(Boolean) ?? (element.raw && /^[A-Z]/.test(element.raw) ? [...classes.values()].find(id => id.replace(/-./g, part => part[1].toUpperCase()).replace(/^./, c => c.toUpperCase()) === element.raw) : null) ?? null;
  /* A component's own parts, such as the stat cards inside a stat row, belong to it: only its root draws its surface. */
  const isSurface = element => { const id = componentOf(element); if (id) return ['card', 'panel'].includes(surfaceOf(id)); return !ancestors(element).some(componentOf) && element.classes.some(name => GENERIC_SURFACE.test(name)); };
  const found = new Set();
  const all = [];
  walk(tree, element => { all.push(element); const id = componentOf(element); if (id) found.add(id); });

  /* Surfaces: a card inside a card or panel, and cards standing in for a list. */
  for (const element of all) {
    if (!isSurface(element)) continue;
    const outer = ancestors(element).find(isSurface);
    if (outer) add('nested-surface', element, `<${element.raw} class="${element.classes.join(' ')}"> draws a surface inside <${outer.raw} class="${outer.classes.join(' ')}"> (line ${outer.line}).`, 'Drop one boundary: plain content or a list inside the surface.');
  }
  for (const element of [tree, ...all]) {
    const cards = element.children.filter(isSurface);
    if (cards.length >= 3) add('card-as-grouping', cards[0], `${cards.length} sibling cards each hold one item; boxes stand in for a list.`, 'Use rows of a table or list; keep cards for objects people act on alone.');
  }
  /* Dividers: separation belongs to layout, not to a line between every pair of things. */
  const dividers = all.filter(element => element.tag === 'hr' || element.classes.some(name => /^(divider|separator)$|[-_](divider|separator)$/.test(name)));
  if (dividers.length >= 3) add('divider-as-spacing', dividers[0], `${dividers.length} dividers in one file.`, 'Separate groups with space, headings, and alignment; keep a divider for a boundary between different kinds of content.', 'warning');
  /* Actions: one primary per scope. */
  const primary = element => (element.classes.includes('primary') && element.classes.some(name => /^(button|btn)$/.test(name))) || element.classes.some(name => /^(btn|button)-primary$/.test(name)) || (element.variant === 'primary' && /^(button|Button)$/.test(element.raw));
  const scopes = new Map();
  for (const element of all.filter(primary)) {
    const scope = ancestors(element).find(parent => SCOPES.has(parent.tag)) ?? tree;
    scopes.set(scope, [...(scopes.get(scope) ?? []), element]);
  }
  for (const [scope, buttons] of scopes) if (buttons.length >= 2) add('competing-primary-actions', buttons[1], `${buttons.length} primary buttons in the same ${scope === tree ? 'file' : `<${scope.tag}>`} (lines ${buttons.map(item => item.line).join(', ')}).`, 'Keep one primary action per part; make the others secondary or move them to their rows.');
  /* Content: banners for exceptions only. */
  for (const element of all.filter(item => componentOf(item) === 'banner')) {
    if (!element.classes.some(name => /^(warning|danger|error|critical)$/.test(name))) add('banner-without-exception', element, `A banner that is not a warning: “${textOf(element).slice(0, 60)}”.`, 'Put a normal status in the heading or a badge; keep banners for what is wrong.');
  }
  /* The plan: measures on a screen whose job is not to monitor them. */
  const avoids = id => Array.isArray(plan?.avoid) && plan.avoid.some(item => item?.id === id);
  if (avoids('kpi-grid')) for (const element of all.filter(item => KPI.has(componentOf(item)))) add('kpi-grid-on-task-screen', element, `${componentOf(element)} puts headline measures on a screen whose plan avoids them (${plan.archetype}).`, 'Show the work itself; move totals to a closed region.');
  if (!plan) add('missing-plan', null, 'No plan was given, so the markup is checked against general rules only.', 'Pass the plan from plan_screen (or syntari plan) to check it against the job it serves.');
  return {
    mode: 'source', file, deterministic: true,
    components: [...found].sort(),
    findings,
    limits: 'Read as text: tags, classes, and nesting. Layout, runtime styles, conditional rendering, and components renamed by wrappers are not seen. Screen IR validation does not apply to this markup.'
  };
}
