// Runs only in the local extraction browser. It does not change the library.
import { getComponents, mount, setTheme } from '../syntari.js';
import { statesFor, sourceFor, contractFor, commonAPI } from '../docs-data.js';

const references = value => [...new Set([...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(match => match[1]))];
const attributes = node => Object.fromEntries([...node.attributes].map(attr => [attr.name, attr.value]));
const computedProperties = ['display', 'position', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'grid-template-columns', 'gap', 'padding', 'width', 'height', 'min-width', 'min-height', 'max-width', 'color', 'background-color', 'background-image', 'border', 'border-radius', 'box-shadow', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'opacity', 'overflow', 'transform'];

function tree(node, path = 'root') {
  if (node.nodeType === Node.TEXT_NODE) return { path, type: 'text', text: node.textContent };
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  return { path, type: 'element', tag: node.localName, attributes: attributes(node), children: [...node.childNodes].map((child, index) => tree(child, `${path}.${index}`)).filter(Boolean) };
}

function actions(root) {
  return [...root.querySelectorAll('button, input, select, textarea, summary, a, [role="button"]')].map((node, index) => ({
    index, tag: node.localName, label: node.getAttribute('aria-label') || node.labels?.[0]?.textContent.trim() || node.textContent.trim().replace(/\s+/g, ' '),
    attributes: attributes(node),
    value: 'value' in node ? node.value : undefined,
    checked: 'checked' in node ? node.checked : undefined,
    disabled: 'disabled' in node ? node.disabled : undefined,
    treatment: node.matches('.button') ? (['primary', 'secondary', 'accent', 'ghost', 'danger'].find(name => node.classList.contains(name)) || 'outline') : node.matches('.icon-button') ? 'icon-button' : 'component-specific',
  }));
}

function cssInventory() {
  const rules = [], fonts = [], keyframes = [];
  for (const sheet of document.styleSheets) {
    if (!sheet.href) continue;
    const file = new URL(sheet.href).pathname.slice(1);
    function visit(list, ancestry = [], prefix = '') {
      [...list].forEach((rule, index) => {
        const id = `${file}#${prefix}${index}`;
        if (rule.type === CSSRule.FONT_FACE_RULE) fonts.push({ source: id, declarations: Object.fromEntries([...rule.style].map(name => [name, rule.style.getPropertyValue(name)])) });
        else if (rule.type === CSSRule.KEYFRAMES_RULE) keyframes.push({ source: id, name: rule.name, css: rule.cssText });
        else if (rule.selectorText) rules.push({ id, file, selector: rule.selectorText, conditions: ancestry, declarations: [...rule.style].map(property => ({ property, value: rule.style.getPropertyValue(property), important: rule.style.getPropertyPriority(property) === 'important', tokens: references(rule.style.getPropertyValue(property)) })) });
        else if (rule.cssRules) visit(rule.cssRules, [...ancestry, rule.conditionText || rule.cssText.slice(0, rule.cssText.indexOf('{')).trim()], `${prefix}${index}.`);
      });
    }
    visit(sheet.cssRules);
  }
  return { rules, fonts, keyframes };
}

export async function initializeInventory() {
  window.inventoryCatalog = await getComponents();
  await document.fonts.ready;
  window.inventoryCSS = cssInventory();
  const foundations = window.inventoryCSS.rules.filter(rule => rule.file === 'tokens.css');
  const tokenNames = [...new Set(foundations.flatMap(rule => rule.declarations.filter(d => d.property.startsWith('--')).map(d => d.property)))].sort();
  const tokens = tokenNames.map(name => ({ name, codeSyntax: `var(${name})`, declarations: foundations.flatMap(rule => rule.declarations.filter(d => d.property === name).map(d => ({ selector: rule.selector, source: rule.id, raw: d.value, aliases: d.tokens }))), modes: {} }));
  for (const theme of ['light', 'dark']) {
    setTheme(theme);
    const style = getComputedStyle(document.documentElement);
    for (const token of tokens) token.modes[theme] = style.getPropertyValue(token.name).trim();
  }
  setTheme('light');
  return { catalog: window.inventoryCatalog.map(c => ({ slug: c.slug, name: c.name })), tokens, css: window.inventoryCSS, commonAPI, rootFontSize: getComputedStyle(document.documentElement).fontSize };
}

export async function componentInventory(slug) {
  const component = window.inventoryCatalog.find(c => c.slug === slug);
  const doc = new DOMParser().parseFromString(component.html, 'text/html');
  const states = statesFor(component).map(state => ({ ...state, kind: state.id === 'default' ? 'default-example' : state.id === 'compact' ? 'layout-recipe' : 'preview-recipe' }));
  const result = { ...component, variantDescription: component.variants, interactionSource: sourceFor(slug), elementContract: contractFor(component), template: tree(doc.body), controls: actions(doc.body), states, defaultSnapshots: {}, stateValidation: [], matchedStyleRules: [] };
  delete result.variants;
  const target = document.querySelector('#inventory-stage');
  for (const theme of ['light', 'dark']) {
    setTheme(theme);
    for (const state of states) {
      let instance;
      try {
        instance = await mount(slug, target, { configure: state.code ? new Function('root', state.code) : undefined });
        const root = instance.element;
        if (!root.children.length) throw new Error('The example is empty.');
        const rootBox = root.getBoundingClientRect();
        result.stateValidation.push({ theme, state: state.id, mounted: true, elementCount: root.querySelectorAll('*').length });
        if (state.id === 'default') {
          const nodes = [root, ...root.querySelectorAll('*')];
          result.defaultSnapshots[theme] = nodes.map((node, index) => {
            const style = getComputedStyle(node), rect = node.getBoundingClientRect();
            const pseudo = {};
            for (const name of ['::before', '::after']) {
              const p = getComputedStyle(node, name);
              if (p.content !== 'none' && p.content !== 'normal') pseudo[name] = { content: p.content, styles: Object.fromEntries(computedProperties.map(key => [key, p.getPropertyValue(key)])) };
            }
            return { index, parent: nodes.indexOf(node.parentElement), tag: node.localName, attributes: attributes(node), ownText: [...node.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join(''), visible: node.checkVisibility(), bounds: { x: rect.x - rootBox.x, y: rect.y - rootBox.y, width: rect.width, height: rect.height }, styles: Object.fromEntries(computedProperties.map(key => [key, style.getPropertyValue(key)])), pseudo };
          });
          if (theme === 'light') result.matchedStyleRules = window.inventoryCSS.rules.filter(rule => {
            try { return nodes.some(node => node.matches(rule.selector)); } catch { return false; }
          }).map(rule => rule.id);
        }
      } catch (error) { result.stateValidation.push({ theme, state: state.id, mounted: false, error: error.message }); }
      finally {
        instance?.destroy(); target.replaceChildren();
        document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
        document.getAnimations().forEach(animation => animation.cancel());
      }
    }
  }
  return result;
}
