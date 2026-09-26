// Shared navigation, inspection, focus and theme behavior for Renderer and System.
export function initWorkspace() {
  const $ = selector => document.querySelector(selector);
  const shell = $('[data-shell]'), rail = $('[data-rail]');
  const workspace = $('[data-workspace]'), inspector = $('[data-inspector]');
  const stage = $('[data-workspace-stage]'), menu = $('[data-workspace-menu]');
  const media = matchMedia('(max-width: 760px)');
  let returnFocus;
  const focusable = root => [...root.querySelectorAll('a[href],button,input,textarea,select,[tabindex="0"]')]
    .filter(node => !node.disabled && !node.closest('[inert],[hidden]') && node.getClientRects().length);
  function sync() {
    const navOpen = shell.classList.contains('nav-open');
    const panelOpen = workspace.dataset.panel !== 'none';
    rail.inert = shell.classList.contains('is-focus') || (media.matches && !navOpen);
    stage.inert = media.matches && (navOpen || panelOpen);
    inspector.inert = !panelOpen || (media.matches && navOpen);
    inspector.setAttribute('aria-hidden', String(!panelOpen));
    menu.setAttribute('aria-expanded', String(navOpen));
    $('[data-workspace-backdrop]').hidden = !navOpen;
  }
  function closeNav() { shell.classList.remove('nav-open'); sync(); }
  function closePanel(restore = true) {
    workspace.dataset.panel = 'none';
    document.querySelectorAll('[data-panel-open]').forEach(button => button.setAttribute('aria-pressed', 'false'));
    sync();
    if (restore && returnFocus?.isConnected) returnFocus.focus();
  }
  function openPanel(mode, trigger) {
    if (workspace.dataset.panel === mode) { closePanel(); return; }
    closeNav();
    returnFocus = trigger || document.activeElement;
    workspace.dataset.panel = mode;
    document.querySelectorAll('[data-inspector-panel]').forEach(panel => { panel.hidden = panel.dataset.inspectorPanel !== mode; });
    document.querySelectorAll('[data-panel-open]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.panelOpen === mode)));
    const title = $('[data-panel-title]');
    if (title) title.textContent = {logic:'Why this interface?',ir:'Screen IR',components:'Components'}[mode] || mode;
    sync();
    $('[data-close-panel]').focus();
  }
  document.querySelectorAll('[data-panel-open]').forEach(button => button.addEventListener('click', () => openPanel(button.dataset.panelOpen, button)));
  $('[data-close-panel]').addEventListener('click', () => closePanel());
  menu.addEventListener('click', () => {
    const open = !shell.classList.contains('nav-open');
    closePanel(false);
    shell.classList.toggle('nav-open', open);
    shell.classList.remove('is-focus');
    sync();
    if (open) focusable(rail)[0]?.focus();
  });
  $('[data-workspace-backdrop]').addEventListener('click', () => { closeNav(); menu.focus(); });
  $('[data-workspace-focus]').addEventListener('click', event => {
    shell.classList.toggle('is-focus');
    event.currentTarget.setAttribute('aria-pressed', String(shell.classList.contains('is-focus')));
    closePanel(false); sync();
  });
  const themeButton = $('[data-workspace-theme]');
  function themeLabel() { themeButton.setAttribute('aria-label', `Switch to ${document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'} theme`); }
  themeButton.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('syntari-theme', theme); } catch {}
    themeLabel();
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !event.target.closest('dialog,[popover]')) {
      if (shell.classList.contains('nav-open')) { closeNav(); menu.focus(); }
      else if (workspace.dataset.panel !== 'none') closePanel();
      else { shell.classList.remove('is-focus'); $('[data-workspace-focus]').setAttribute('aria-pressed','false'); sync(); }
    }
    const trap = media.matches && (shell.classList.contains('nav-open') ? rail : workspace.dataset.panel !== 'none' ? inspector : null);
    if (event.key === 'Tab' && trap) {
      const nodes = focusable(trap), first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  media.addEventListener('change', () => { closeNav(); sync(); });
  themeLabel(); sync();
  return {openPanel, closePanel, closeNav};
}

export async function copyText(text, status) {
  try { await navigator.clipboard.writeText(text); status.textContent = 'Copied to clipboard.'; }
  catch { status.textContent = 'Clipboard unavailable. Select the text above and copy it.'; }
}
