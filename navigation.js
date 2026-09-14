/* Shared navigation anatomy for Syntari's sidebar and topbar. */
(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const roots = new Set();
  let observer, cleanupObserver, drawer, origin, opener;
  const glyph = name => window.SyntariIcon(name);
  const action = (key, label, icon, extra = '') => `<button type="button" class="syntari-nav-item" data-nav-action="${key}" aria-label="${escape(label)}" data-nav-label="${escape(label)}">${glyph(icon)}<span class="syntari-nav-label">${escape(label)}</span>${extra}</button>`;
  const item = (entry, active) => `<a class="syntari-nav-item" href="${escape(entry.href)}" data-nav-route="${escape(entry.key)}" aria-label="${escape(entry.label)}" data-nav-label="${escape(entry.label)}" ${entry.key === active ? 'aria-current="page"' : ''}>${glyph(entry.icon)}<span class="syntari-nav-label">${escape(entry.label)}</span>${entry.count == null ? '' : `<span class="syntari-nav-count" aria-hidden="true">${escape(entry.count)}</span>`}</a>`;

  function render({ content, items, active, pinned = [], account = 'Alex Morgan', layout = 'sidebar', collapsed = false, compact = false }) {
    const current = items.find(entry => entry.key === active)?.label || 'Projects';
    return `<section class="syntari-shell-example">
      <div class="syntari-shell-controls"><span>Navigation</span><div class="syntari-layout-picker" role="group" aria-label="Navigation layout"><button type="button" data-nav-layout="sidebar" aria-pressed="${layout === 'sidebar'}">Sidebar</button><button type="button" data-nav-layout="topbar" aria-pressed="${layout === 'topbar'}">Topbar</button></div></div>
      <div class="syntari-shell ${compact ? 'mini-app-shell' : 'product-shell'}" data-syntari-shell data-layout="${layout}" data-collapse-preference="${collapsed}" data-collapsed="${collapsed === true || collapsed === 'true'}">
        <aside class="syntari-nav-panel product-sidebar" aria-label="Workspace sidebar">
          <div class="syntari-nav-header"><div class="starter-popover syntari-workspace"><button type="button" class="syntari-workspace-trigger" data-popover-toggle aria-expanded="false" aria-label="Syntari Studio workspace"> <span class="syntari-workspace-mark" aria-hidden="true"><span class="brand-mark"></span></span><span class="syntari-nav-label">Syntari Studio</span>${glyph('down')}</button><div class="starter-popover-panel syntari-workspace-menu" hidden><p>Workspace</p><div class="syntari-workspace-current"><span class="syntari-workspace-mark" aria-hidden="true"><span class="brand-mark"></span></span><span>Syntari Studio<small>Personal workspace</small></span>${glyph('check')}</div>${action('settings', 'Workspace settings', 'settings')}</div></div><button type="button" class="syntari-nav-icon syntari-nav-collapse" data-nav-collapse aria-label="Collapse sidebar" aria-expanded="true">${glyph('layout')}</button><button type="button" class="syntari-nav-icon syntari-nav-close" data-nav-close aria-label="Close workspace navigation">${glyph('x')}</button></div>
          <div class="syntari-nav-tools">${action('search', 'Search', 'search', '<kbd>⌘ K</kbd>')}<button type="button" class="syntari-nav-create" data-nav-action="create" aria-label="New project" data-nav-label="New project">${glyph('plus')}<span class="syntari-nav-label">New project</span></button></div>
          <nav class="syntari-nav-groups" aria-label="Workspace pages"><div class="syntari-nav-group"><h3>Workspace</h3>${items.filter(entry => entry.key !== 'settings').map(entry => item(entry, active)).join('')}</div>${pinned.length ? `<div class="syntari-nav-group syntari-nav-pinned"><h3>Pinned projects</h3>${pinned.map(entry => `<button type="button" class="syntari-nav-item" data-nav-record="${escape(entry.id)}" aria-label="Open ${escape(entry.name)}" data-nav-label="${escape(entry.name)}"><span class="syntari-project-dot" aria-hidden="true"></span><span class="syntari-nav-label">${escape(entry.name)}</span></button>`).join('')}</div>` : ''}<div class="syntari-nav-group syntari-nav-utilities">${items.filter(entry => entry.key === 'settings').map(entry => item(entry, active)).join('')}${action('help', 'Help & shortcuts', 'info')}</div></nav>
          <div class="syntari-nav-footer"><button type="button" class="syntari-account" data-nav-action="settings" aria-label="Account settings for ${escape(account)}" data-nav-label="Account settings"><span class="avatar blue tiny" aria-hidden="true"></span><span class="syntari-nav-label">${escape(account)}<small>Personal workspace</small></span>${glyph('down')}</button></div>
        </aside>
        <div class="syntari-shell-body product-main"><div class="syntari-context-bar product-topbar"><button class="syntari-nav-icon syntari-nav-mobile" type="button" data-nav-open aria-label="Open workspace navigation" aria-expanded="false">${glyph('list')}</button><nav class="breadcrumbs" aria-label="Screen breadcrumb"><span>Workspace</span>${glyph('chevron')}<span data-nav-current aria-current="page">${escape(current)}</span></nav><span class="syntari-context-status"><span class="status-dot"></span>All changes saved</span></div>${content}</div>
      </div>
    </section>`;
  }

  function shellFor(element) {
    return element.closest('[data-syntari-shell]') || element.closest('.syntari-shell-example')?.querySelector('[data-syntari-shell]') || (element.closest('.syntari-navigation-dialog') ? origin : null);
  }
  function sync(root) {
    const width = root.getBoundingClientRect().width;
    const mobile = width <= 520;
    root.dataset.mobile = String(mobile);
    const collapsed = !mobile && root.dataset.layout === 'sidebar' && (root.dataset.collapsePreference === 'true' || (width < 740 && root.dataset.collapsePreference !== 'expanded'));
    root.dataset.collapsed = String(collapsed);
    const toggle = root.querySelector('[data-nav-collapse]');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    const panel = root.querySelector('.syntari-nav-panel');
    panel.inert = mobile;
    panel.setAttribute('aria-label', root.dataset.layout === 'topbar' ? 'Workspace topbar' : 'Workspace sidebar');
    root.closest('.syntari-shell-example').querySelectorAll('[data-nav-layout]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.navLayout === root.dataset.layout)));
    if (!mobile && origin === root) close();
  }
  function prepare(scope) {
    const candidates = [...scope.querySelectorAll('[data-syntari-shell]')];
    if (scope.matches?.('[data-syntari-shell]')) candidates.unshift(scope);
    if (!candidates.length) return;
    observer ||= new ResizeObserver(entries => entries.forEach(({target}) => sync(target)));
    cleanupObserver ||= new MutationObserver(() => { for (const root of roots) if (!root.isConnected) destroy(root); });
    cleanupObserver.observe(document.body, {childList:true, subtree:true});
    for (const root of candidates) {
      if (!roots.has(root)) { roots.add(root); observer.observe(root); }
      const panel = root.querySelector('.syntari-nav-panel');
      // Every mounted copy needs its own disclosure relationships.
      if (!panel.id) panel.id = `syntari-nav-${Math.random().toString(36).slice(2,10)}`;
      root.querySelector('[data-nav-collapse]').setAttribute('aria-controls', panel.id);
      root.querySelector('[data-nav-open]').setAttribute('aria-controls', 'syntari-navigation-drawer');
      sync(root);
    }
  }
  function destroy(root) {
    if (origin === root) close(false);
    observer?.unobserve(root); roots.delete(root);
    if (!roots.size) cleanupObserver?.disconnect();
  }
  function setLayout(root, layout) {
    if (!['sidebar','topbar'].includes(layout)) return;
    root.dataset.layout = layout; sync(root);
    root.dispatchEvent(new CustomEvent('syntari:layout-change', {bubbles:true, detail:{layout, collapsed:root.dataset.collapsePreference}}));
  }
  function setActive(root, key) {
    root.querySelectorAll('[data-nav-route]').forEach(link => {
      if (link.dataset.navRoute === key) { link.setAttribute('aria-current','page'); root.querySelector('[data-nav-current]').textContent = link.dataset.navLabel; }
      else link.removeAttribute('aria-current');
    });
  }
  function close(restoreFocus = true) {
    if (!drawer?.open) return;
    const trigger = opener;
    origin?.querySelector('[data-nav-open]')?.setAttribute('aria-expanded','false');
    drawer.close(); drawer.replaceChildren(); origin = null; opener = null;
    if (restoreFocus && trigger?.isConnected) trigger.focus({preventScroll:true});
  }
  function open(root, trigger) {
    if (!drawer) {
      drawer = document.createElement('dialog'); drawer.id = 'syntari-navigation-drawer'; drawer.className = 'syntari-navigation-dialog'; drawer.setAttribute('aria-label','Workspace navigation'); document.body.append(drawer);
      drawer.addEventListener('cancel', event => { event.preventDefault(); close(); });
      drawer.addEventListener('click', event => { if (event.target === drawer) close(); });
      drawer.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const controls = [...drawer.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),[tabindex="0"]')].filter(element => element.getClientRects().length && !element.closest('[hidden],[inert]'));
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
    }
    origin = root; opener = trigger;
    const panel = root.querySelector('.syntari-nav-panel').cloneNode(true);
    panel.removeAttribute('id'); panel.inert = false; panel.setAttribute('aria-label','Workspace sidebar');
    panel.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    panel.querySelectorAll('[aria-controls]').forEach(element => element.removeAttribute('aria-controls'));
    panel.querySelectorAll('.starter-popover-panel').forEach(element => element.hidden = true);
    panel.querySelectorAll('[data-popover-toggle]').forEach(element => element.setAttribute('aria-expanded','false'));
    drawer.replaceChildren(panel); drawer.showModal(); trigger.setAttribute('aria-expanded','true'); panel.querySelector('[data-nav-close]').focus();
  }
  document.addEventListener('click', event => {
    const control = event.target.closest('[data-nav-layout],[data-nav-collapse],[data-nav-open],[data-nav-close],[data-nav-route],[data-nav-action],[data-nav-record]');
    if (!control) return;
    const root = shellFor(control); if (!root) return;
    if (control.hasAttribute('data-nav-layout')) { setLayout(root, control.dataset.navLayout); return; }
    if (control.hasAttribute('data-nav-collapse')) {
      root.dataset.collapsePreference = root.dataset.collapsed === 'true' ? 'expanded' : 'true'; sync(root);
      root.dispatchEvent(new CustomEvent('syntari:layout-change', {bubbles:true, detail:{layout:root.dataset.layout, collapsed:root.dataset.collapsePreference}})); return;
    }
    if (control.hasAttribute('data-nav-open')) { open(root,control); return; }
    if (control.hasAttribute('data-nav-close')) { close(); return; }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const detail = control.hasAttribute('data-nav-route') ? {action:'navigate',key:control.dataset.navRoute} : control.hasAttribute('data-nav-record') ? {action:'record',key:control.dataset.navRecord} : {action:control.dataset.navAction};
    const accepted = !root.dispatchEvent(new CustomEvent('syntari:shell-action', {bubbles:true, cancelable:true, detail}));
    if (accepted) { event.preventDefault(); close(false); }
  });
  window.SyntariNavigation = {render, prepare, destroy, setLayout, setActive, close};
})();
