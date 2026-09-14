import { initialize, setTheme } from './syntari.js';
const root = document.querySelector('#screens');
const themeButton = document.querySelector('[data-preview-theme]');
function theme(value) {
  setTheme(value);
  themeButton.innerHTML = window.SyntariIcon(value === 'dark' ? 'sun' : 'moon');
  themeButton.setAttribute('aria-label', `Switch to ${value === 'dark' ? 'light' : 'dark'} theme`);
  try { localStorage.setItem('syntari-theme', value); } catch {}
}
function render(screen, focus = false) {
  if (!['settings','team','projects','onboarding'].includes(screen)) screen = 'projects';
  window.SyntariStarter.renderScreen(screen, root);
  const title = root.querySelector('.product-heading h2,.auth-card h2');
  const heading = document.createElement('h1'); heading.textContent = title.textContent; title.replaceWith(heading);
  const url = new URL(location.href); url.searchParams.set('screen', screen); history.replaceState(null, '', url);
  document.title = `${{settings:'Settings',team:'People',projects:'Projects',onboarding:'Welcome'}[screen]} — Syntari workspace`;
  document.querySelector('[data-preview-status]').textContent = document.title;
  if (focus) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
}
try {
  await initialize();
  theme(document.documentElement.dataset.theme || 'light');
  render(new URL(location.href).searchParams.get('screen'));
  themeButton.addEventListener('click', () => theme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  window.addEventListener('syntari:navigate', event => {
    if (event.detail.view === 'screens') render(event.detail.screen, true);
    else if (event.detail.component) location.href = new URL(`gallery.html?q=${encodeURIComponent(event.detail.component)}`, import.meta.url);
  });
} catch (error) {
  root.textContent = 'The workspace could not load. Refresh to try again.';
  console.error(error);
}
