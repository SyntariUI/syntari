/**
 * Scope the runtime stylesheets to Syntari's own markup, so importing them never restyles a host page.
 * Every selector applies inside a component (.syntari-component) or an element marked data-syntari-root, and to
 * that element itself. :where() keeps each selector's specificity, so the cascade is unchanged.
 * Tokens declared on :root, and theme switches such as [data-theme=dark], land on the outermost Syntari element, so a
 * host's own --accent or --text never changes. A bare body or html rule applies only to Syntari's own pages.
 */
const SCOPE = ':where(.syntari-component,[data-syntari-root])';
/** The outermost Syntari element. Tokens live here, so they never reach host CSS and nested parts inherit them. */
const TOP = `${SCOPE}:not(${SCOPE} *)`;
const SITE_BODY = ':where(html[data-syntari-root])';
const SCOPED_AT_RULES = new Set(['media', 'supports', 'container', 'layer']);
const LEGACY_PSEUDO_ELEMENTS = /^:(before|after|first-line|first-letter)\b/;

/** Index just past the end of a comment or string starting at i, or i when there is none. */
function skip(css, i) {
  if (css.startsWith('/*', i)) { const end = css.indexOf('*/', i + 2); return end < 0 ? css.length : end + 2; }
  if (css[i] === '"' || css[i] === "'") {
    const quote = css[i];
    for (let j = i + 1; j < css.length; j += 1) { if (css[j] === '\\') j += 1; else if (css[j] === quote) return j + 1; }
    return css.length;
  }
  return i;
}

/** Index of the brace that closes the block opened at `open`. */
function closing(css, open) {
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    const next = skip(css, i);
    if (next !== i) { i = next - 1; continue; }
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}' && (depth -= 1) === 0) return i;
  }
  throw new Error('scope-css: unbalanced braces.');
}

/** Split on characters outside parentheses, brackets, and strings. */
function splitTopLevel(text, test) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const next = skip(text, i);
    if (next !== i) { i = next - 1; continue; }
    const ch = text[i];
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    else if (depth === 0 && test(ch)) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  parts.push(text.slice(start));
  return parts;
}

/** The first compound selector and whatever follows it, combinator included. */
function firstCompound(selector) {
  let depth = 0;
  for (let i = 0; i < selector.length; i += 1) {
    const ch = selector[i];
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    else if (depth === 0 && /[\s>+~]/.test(ch)) return [selector.slice(0, i), selector.slice(i)];
  }
  return [selector, ''];
}

/** The selector with the scope attached to its first compound, before any pseudo-element. */
function self(selector, scope = SCOPE) {
  const [first, rest] = firstCompound(selector);
  let at = first.length;
  for (let i = 0; i < first.length; i += 1) if (first.startsWith('::', i) || LEGACY_PSEUDO_ELEMENTS.test(first.slice(i))) { at = i; break; }
  return `${first.slice(0, at)}${scope}${first.slice(at)}${rest}`;
}

const scoped = selector => `${SCOPE} ${selector},${self(selector)}`;

function scopeSelector(raw) {
  const selector = raw.trim();
  if (!selector) return selector;
  const [first, rest] = firstCompound(selector);
  const context = /^(:root|html|body|\[data-theme)/i.test(first);
  if (!context) return scoped(selector);
  if (!rest.trim()) {
    if (/^body/i.test(first)) return `${SITE_BODY} ${selector}`;
    /* Tokens and theme switches land on the outermost Syntari element; a bare html rule is for Syntari pages only. */
    if (/^:root$/i.test(first)) return TOP;
    if (/^html$/i.test(first)) return self(first);
    return `${first} ${TOP},${self(first, TOP)}`;
  }
  /* Theme or page context followed by a descendant: the context stays global, the rest is scoped. */
  if (!/^\s+[^\s>+~]/.test(rest)) throw new Error(`scope-css: cannot scope "${selector}"; use a descendant after the theme context.`);
  const tail = rest.trim();
  return `${first} ${SCOPE} ${tail},${first} ${self(tail)}`;
}

/** What the Syntari page body gives its content, given instead to the outermost Syntari element in a host page:
 * its canvas too, so text keeps the contrast it was designed for on any host background.
 * Never html: its font size sets rem for the whole page. */
export const ROOT_TYPOGRAPHY = ':where(.syntari-component,[data-syntari-root]):not(html,:where(.syntari-component,[data-syntari-root]) *){background:var(--canvas);color:var(--text);font:var(--type-body)/1.5 var(--font-sans);-webkit-font-smoothing:antialiased}';

export function scopeCss(css) {
  let out = '', i = 0;
  while (i < css.length) {
    const next = skip(css, i);
    if (next !== i) { out += css.slice(i, next); i = next; continue; }
    if (/\s|}/.test(css[i])) { out += css[i]; i += 1; continue; }
    let end = i;
    while (end < css.length && css[end] !== '{' && css[end] !== ';') { const after = skip(css, end); end = after !== end ? after : end + 1; }
    if (css[end] === ';' || end >= css.length) { out += css.slice(i, end + 1); i = end + 1; continue; }
    const prelude = css.slice(i, end).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const close = closing(css, end);
    const body = css.slice(end + 1, close);
    if (prelude.startsWith('@')) {
      const name = prelude.slice(1).split(/[\s(]/)[0].toLowerCase();
      out += `${prelude}{${SCOPED_AT_RULES.has(name) ? scopeCss(body) : body}}`;
    } else {
      out += `${splitTopLevel(prelude, ch => ch === ',').map(scopeSelector).join(',')}{${body}}`;
    }
    i = close + 1;
  }
  return out;
}
