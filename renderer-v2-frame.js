/* The composition lab's frame: renders one screen at the frame's own width, so a mobile preview is a mobile viewport. */
import { render } from './ir.js';

const output = document.querySelector('[data-frame-output]');
let mounted;
let queue = Promise.resolve();

window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.data?.type !== 'syntari-lab:render') return;
  const { spec, theme, token } = event.data;
  queue = queue.then(async () => {
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
    const staging = document.createElement('div');
    try {
      const next = await render(spec, staging, { onActionRequest: detail => parent.postMessage({ type: 'syntari-lab:action', detail, token }, location.origin) });
      mounted?.destroy();
      mounted = next;
      output.replaceChildren(...staging.childNodes);
      parent.postMessage({ type: 'syntari-lab:rendered', token, fallbacks: output.querySelectorAll('.ir-fallback').length, width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }, location.origin);
    } catch (error) {
      parent.postMessage({ type: 'syntari-lab:error', token, message: error.message }, location.origin);
    }
  });
});
parent.postMessage({ type: 'syntari-lab:ready' }, location.origin);
