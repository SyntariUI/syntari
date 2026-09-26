import { render, validate } from './ir.js';
import { initWorkspace, copyText } from './workspace.js';

const $ = selector => document.querySelector(selector);
const workspace = initWorkspace();
let mounted, patterns, screens, generation = 0;

function choose(prompt) {
  const words = new Set(prompt.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const candidates = patterns.map(pattern => ({pattern, cues:(pattern.keywords ?? []).filter(word => words.has(word))}))
    .sort((a,b) => b.cues.length - a.cues.length || a.pattern.id.localeCompare(b.pattern.id));
  const matched = candidates[0].cues.length > 0;
  return { candidates, matched, selected: matched ? candidates[0] : candidates.find(item => item.pattern.id === 'release-review') || candidates[0] };
}
function line(label, value) {
  const row = document.createElement('div'); row.className = 'intent-trace-row';
  const term = document.createElement('dt'); term.textContent = label;
  const detail = document.createElement('dd'); detail.textContent = value;
  row.append(term,detail); return row;
}
function showTrace(prompt, choice, spec, result) {
  $('[data-intent-trace]').replaceChildren(
    line('Intent',prompt), line('Pattern selected',choice.selected.pattern.name),
    line('Candidates',choice.candidates.map(item => `${item.pattern.name} · ${item.cues.length} cues`).join(' / ')),
    line('Decision',choice.matched ? `Matched ${choice.selected.cues.join(', ')}.` : 'No supported keyword matched. The release review is shown as an example.'),
    line('Match evidence',`${choice.selected.cues.length} matching keywords. This is a deterministic selection heuristic.`),
    line('Composition',choice.selected.pattern.dependencies.join(', ')),
    line('Rules applied','Registry component ids, prop contracts, layout and node budgets.'),
    line('Validation',result.ok ? `Passed · ${result.diagnostics.length} diagnostics` : `Stopped · ${result.diagnostics.length} diagnostics`)
  );
  $('[data-intent-spec]').textContent = JSON.stringify(spec,null,2);
  $('[data-intent-diagnostics]').textContent = result.diagnostics.length ? result.diagnostics.map(item => `${item.severity}: ${item.path} · ${item.message}`).join('\n') : 'No diagnostics. Every node matches its contract.';
  $('[data-intent-components]').replaceChildren(...choice.selected.pattern.dependencies.map(slug => {
    const link = document.createElement('a'); link.className = 'workspace-component';
    link.href = `/system/#${encodeURIComponent(slug)}`; link.target = '_blank'; link.rel = 'noopener';
    link.textContent = `${slug} ↗`; link.setAttribute('aria-label',`Inspect ${slug} in System (new tab)`); return link;
  }));
}
async function paint(prompt) {
  const token = ++generation, status = $('[data-intent-status]'), output = $('[data-intent-output]');
  $('[data-intent-submit]').disabled = true; output.setAttribute('aria-busy','true');
  status.textContent = 'Choosing a pattern and validating its components…';
  try {
    const choice = choose(prompt), spec = structuredClone(screens[choice.selected.pattern.screenMode]);
    if (choice.matched) spec.title = prompt.slice(0,80);
    const result = await validate(spec);
    if (token !== generation) return;
    showTrace(prompt,choice,spec,result);
    if (!result.ok) { status.textContent = 'This composition failed validation. Open IR to inspect the diagnostics.'; workspace.openPanel('ir'); return; }
    const staging = document.createElement('div');
    const next = await render(spec,staging);
    if (token !== generation) { next.destroy(); return; }
    mounted?.destroy(); mounted = next; output.replaceChildren(...staging.childNodes); output.scrollTop = 0;
    $('[data-intent-pattern]').textContent = choice.selected.pattern.name;
    status.textContent = choice.matched ? `${choice.selected.pattern.name} · validated · sample data` : 'No matching pattern. Showing a validated release review example.';
    document.querySelectorAll('[data-intent-example]').forEach(button => {
      const selected = button.dataset.patternId === choice.selected.pattern.id;
      button.classList.toggle('is-selected',selected); button.setAttribute('aria-pressed',String(selected));
    });
    try { sessionStorage.setItem('syntari-intent',prompt); } catch {}
  } catch (error) { if (token === generation) status.textContent = `Could not render: ${error.message}`; }
  finally { if (token === generation) { $('[data-intent-submit]').disabled = false; output.setAttribute('aria-busy','false'); } }
}
async function start() {
  const responses = await Promise.all([fetch('/registry/patterns/index.json'),fetch('/registry/patterns/screens.json')]);
  if (responses.some(response => !response.ok)) throw new Error('Pattern registry unavailable. Reload to try again.');
  const [index,loadedScreens] = await Promise.all(responses.map(response => response.json()));
  patterns = index.patterns.filter(pattern => pattern.screenMode && loadedScreens[pattern.screenMode]); screens = loadedScreens;
  if (!patterns.length) throw new Error('No renderable patterns are available.');
  $('[data-intent-examples]').replaceChildren(...patterns.map(pattern => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'renderer-nav-item';
    button.dataset.intentExample = pattern.examples[0]; button.dataset.patternId = pattern.id; button.setAttribute('aria-pressed','false');
    const dot = document.createElement('i'); dot.setAttribute('aria-hidden','true');
    const label = document.createElement('span'); label.textContent = pattern.name; button.append(dot,label);
    button.addEventListener('click', () => { $('[data-intent-input]').value = pattern.examples[0]; workspace.closeNav(); paint(pattern.examples[0]); });
    return button;
  }));
  $('[data-intent-form]').addEventListener('submit', event => { event.preventDefault(); const prompt = $('[data-intent-input]').value.trim(); if (prompt) paint(prompt); });
  $('[data-intent-input]').addEventListener('keydown', event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); $('[data-intent-form]').requestSubmit(); } });
  $('[data-copy-ir]').addEventListener('click', () => copyText($('[data-intent-spec]').textContent,$('[data-ir-copy-status]')));
  try { const saved = sessionStorage.getItem('syntari-intent'); if (saved) $('[data-intent-input]').value = saved; } catch {}
  await paint($('[data-intent-input]').value.trim());
}
start().catch(error => { $('[data-intent-status]').textContent = error.message; });
