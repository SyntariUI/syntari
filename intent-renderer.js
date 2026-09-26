import { render, validate, renderableSlugs } from './ir.js';

const $ = selector => document.querySelector(selector);
let mounted;
let patterns;
let screens;

function matches(prompt, pattern) {
  const words = new Set(prompt.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  return (pattern.keywords ?? []).filter(keyword => words.has(keyword));
}

function choose(prompt) {
  const candidates = patterns.map(pattern => ({ pattern, cues: matches(prompt, pattern) }))
    .sort((a, b) => b.cues.length - a.cues.length || a.pattern.id.localeCompare(b.pattern.id));
  const selected = candidates[0];
  return { selected, candidates, confidence: selected.cues.length ? Math.min(0.95, 0.52 + selected.cues.length * 0.11) : 0.2 };
}

function line(label, value) {
  const row = document.createElement('div');
  row.className = 'intent-trace-row';
  const term = document.createElement('dt');
  term.textContent = label;
  const detail = document.createElement('dd');
  detail.textContent = value;
  row.append(term, detail);
  return row;
}

function showTrace(prompt, choice, spec, result) {
  const trace = $('[data-intent-trace]');
  trace.replaceChildren(
    line('Intent', prompt),
    line('Pattern selected', choice.selected.pattern.name),
    line('Candidates', choice.candidates.map(item => `${item.pattern.name} · ${item.cues.length} cues`).join(' / ')),
    line('Decision', choice.selected.cues.length ? `Matched ${choice.selected.cues.join(', ')}.` : 'No supported cue matched. Showing the closest sample composition.'),
    line('Confidence', `${Math.round(choice.confidence * 100)}% rule match estimate`),
    line('Composition', choice.selected.pattern.dependencies.join(', ')),
    line('Rules applied', 'Registry component ids, prop contracts, layout and node budgets.'),
    line('Validation', result.ok ? `Passed · ${result.diagnostics.length} diagnostics` : `Stopped · ${result.diagnostics.length} diagnostics`)
  );
  $('[data-intent-spec]').textContent = JSON.stringify(spec, null, 2);
  $('[data-intent-diagnostics]').textContent = result.diagnostics.length
    ? result.diagnostics.map(item => `${item.severity}: ${item.path} · ${item.message}`).join('\n')
    : 'No diagnostics. Every node matches its contract.';
}

async function paint(prompt) {
  const status = $('[data-intent-status]');
  const output = $('[data-intent-output]');
  const button = $('[data-intent-submit]');
  button.disabled = true;
  status.textContent = 'Selecting a pattern and checking its contract…';
  try {
    const choice = choose(prompt);
    const spec = structuredClone(screens[choice.selected.pattern.screenMode]);
    spec.title = prompt.slice(0, 80);
    const result = await validate(spec);
    showTrace(prompt, choice, spec, result);
    if (!result.ok) {
      status.textContent = 'The registry rejected this composition. See validation details.';
      return;
    }
    mounted?.destroy();
    mounted = await render(spec, output);
    status.textContent = `${choice.selected.pattern.name} rendered with sample data. Inspect the decisions and Screen IR beside it.`;
  } catch (error) {
    status.textContent = `The renderer could not finish: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

async function start() {
  const [indexResponse, screensResponse] = await Promise.all([
    fetch('registry/patterns/index.json'), fetch('registry/patterns/screens.json')
  ]);
  if (!indexResponse.ok || !screensResponse.ok) throw new Error('The pattern registry is unavailable.');
  const [index, loadedScreens] = await Promise.all([indexResponse.json(), screensResponse.json()]);
  patterns = index.patterns.filter(pattern => pattern.screenMode && loadedScreens[pattern.screenMode]);
  screens = loadedScreens;
  if (!patterns.length) throw new Error('No renderable screen patterns were found.');
  const form = $('[data-intent-form]');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const prompt = $('[data-intent-input]').value.trim();
    if (prompt) paint(prompt);
  });
  document.querySelectorAll('[data-intent-example]').forEach(button => button.addEventListener('click', () => {
    $('[data-intent-input]').value = button.dataset.intentExample;
    paint(button.dataset.intentExample);
  }));
  await paint($('[data-intent-input]').value.trim());
  renderableSlugs().then(slugs => { $('[data-intent-renderable]').textContent = String(slugs.length); }).catch(() => {});
}

start().catch(error => { $('[data-intent-status]').textContent = error.message; });
