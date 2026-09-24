const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function mount(target, options = {}) {
  const root = typeof target === 'string' ? document.querySelector(target) : target;
  if (!root) throw new Error('Syntari app-shell target was not found.');
  const id = `syntari-shell-${Math.random().toString(36).slice(2, 9)}`;
  const title = escapeHtml(options.title || 'Workspace');
  const account = escapeHtml(options.account || 'Account');
  const groups = options.groups || [{ label: 'Workspace', items: [{ label: 'Overview', href: '#overview', icon: '◫' }, { label: 'Projects', href: '#projects', icon: '▦' }] }];
  const content = options.content || '<div class="syntari-shell-welcome"><p class="syntari-shell-eyebrow">Workspace</p><h1>Build with clarity.</h1><p>Your interface is ready for the work ahead.</p></div>';
  const groupMarkup = groups.map((group) => `<section class="syntari-nav-group"><h2>${escapeHtml(group.label)}</h2>${(group.items || []).map((item) => `<a class="syntari-nav-item" href="${escapeHtml(item.href || '#')}" ${item.active ? 'aria-current="page"' : ''}><span class="syntari-nav-icon" aria-hidden="true">${escapeHtml(item.icon || '•')}</span><span>${escapeHtml(item.label)}</span></a>`).join('')}</section>`).join('');
  root.innerHTML = `<section class="syntari-shell" id="${id}" data-layout="sidebar">
    <aside class="syntari-nav-panel" id="${id}-nav" aria-label="Workspace navigation">
      <div class="syntari-nav-header"><a class="syntari-workspace" href="#" aria-label="Workspace home"><span class="syntari-brand-mark" aria-hidden="true">S</span><strong>${title}</strong></a><button class="syntari-icon-button syntari-nav-collapse" type="button" data-nav-collapse aria-label="Collapse sidebar" aria-expanded="true" aria-controls="${id}-nav">‹</button><button class="syntari-icon-button syntari-nav-close" type="button" data-nav-close aria-label="Close navigation">×</button></div>
      <nav class="syntari-nav-groups" aria-label="Workspace pages">${groupMarkup}<section class="syntari-nav-group syntari-nav-utilities"><a class="syntari-nav-item" href="#settings"><span class="syntari-nav-icon" aria-hidden="true">⚙</span><span>Settings</span></a></section></nav>
      <footer class="syntari-nav-footer"><button class="syntari-account" type="button"><span class="syntari-account-avatar" aria-hidden="true">${account.slice(0,1)}</span><span>${account}<small>Personal workspace</small></span><span aria-hidden="true">⌄</span></button></footer>
    </aside>
    <div class="syntari-shell-body"><header class="syntari-context-bar"><button class="syntari-icon-button syntari-nav-open" type="button" data-nav-open aria-label="Open workspace navigation" aria-expanded="false" aria-controls="${id}-nav">☰</button><span class="syntari-context-title">${title}</span><span class="syntari-context-status"><i aria-hidden="true"></i> All changes saved</span></header><main class="syntari-shell-content">${content}</main></div>
  </section>`;
  const shell = root.querySelector('.syntari-shell');
  const panel = root.querySelector('.syntari-nav-panel');
  const open = root.querySelector('[data-nav-open]');
  const collapse = root.querySelector('[data-nav-collapse]');
  const onOpen = () => { shell.dataset.open = 'true'; open.setAttribute('aria-expanded', 'true'); panel.inert = false; };
  const onClose = () => { shell.dataset.open = 'false'; open.setAttribute('aria-expanded', 'false'); };
  const onCollapse = () => { shell.dataset.collapsed = String(shell.dataset.collapsed !== 'true'); collapse.setAttribute('aria-expanded', String(shell.dataset.collapsed !== 'true')); };
  const onResize = () => { panel.inert = matchMedia('(max-width: 700px)').matches && shell.dataset.open !== 'true'; };
  open.addEventListener('click', onOpen);
  root.querySelector('[data-nav-close]').addEventListener('click', onClose);
  collapse.addEventListener('click', onCollapse);
  addEventListener('resize', onResize);
  onResize();
  return { element: shell, destroy() { removeEventListener('resize', onResize); root.replaceChildren(); } };
}
