/*
 * The live Renderer on the site: window.claude.sample() as the artifact platform provides it, answered by the site's
 * /api/claude. Text streams as it is written; a call with page tools runs the tool loop here, in the page, and the
 * key never leaves the server.
 */
(() => {
  /* This is the public Renderer: its examples are templates, built in front of the person. For now it offers templates only;
     set model to true to let it reach Claude through the site's /api/claude, which then needs the ANTHROPIC_API_KEY secret. */
  window.syntariRenderer = { ...(window.syntariRenderer ?? {}), public: true, model: false };
  /* The theme the person chose on System holds here too: both pages wear the same shell. */
  try { document.documentElement.dataset.theme = localStorage.getItem('syntari-theme') || 'dark'; } catch {}
  const fail = (code, message) => Object.assign(new Error(message), { code });
  const cancelled = () => fail('cancelled', 'Stopped');
  async function post(path, body, signal) {
    let response;
    try { response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }); }
    catch { throw signal?.aborted ? cancelled() : fail('network', 'The model could not be reached.'); }
    if (!response.ok) {
      let message = `The model answered ${response.status}.`;
      try { message = (await response.json()).error ?? message; } catch {}
      throw fail(response.status === 429 ? 'rate_limited' : 'api_error', message);
    }
    return response;
  }
  async function viaTools(input, { signal, tools, modelTier }) {
    const messages = [{ role: 'user', content: input }];
    for (let round = 0; round < 6; round++) {
      const response = await post('/api/claude-turn', { messages, tier: modelTier ?? 'default', tools: tools.map(tool => ({ name: tool.name, description: tool.description, input_schema: tool.inputSchema })) }, signal);
      let message;
      try { message = JSON.parse(await response.text()); } catch { throw signal?.aborted ? cancelled() : fail('api_error', 'The model answer was cut off.'); }
      if (signal?.aborted) throw cancelled();
      if (message.error) throw fail('api_error', message.error);
      if (message.stop_reason === 'refusal') throw fail('refused', 'Declined');
      const text = message.content.filter(block => block.type === 'text').map(block => block.text).join('');
      if (message.stop_reason !== 'tool_use') return { text, truncated: message.stop_reason === 'max_tokens', modelTierApplied: modelTier ?? 'default' };
      messages.push({ role: 'assistant', content: message.content });
      const results = [];
      for (const block of message.content.filter(item => item.type === 'tool_use')) {
        const tool = tools.find(item => item.name === block.name);
        let output, isError = false;
        try { output = tool ? await tool.execute(block.input, { signal }) : 'Unknown tool.'; }
        catch (error) { output = String(error?.message ?? error); isError = true; }
        if (signal?.aborted) throw cancelled();
        results.push({ type: 'tool_result', tool_use_id: block.id, content: typeof output === 'string' ? output : JSON.stringify(output), is_error: isError });
      }
      await new Promise(done => setTimeout(done, 0));
      if (signal?.aborted) throw cancelled();
      messages.push({ role: 'user', content: results });
    }
    throw fail('api_error', 'Too many tool rounds.');
  }
  async function sample(input, { signal, onText, modelTier, tools } = {}) {
    if (tools?.length) return viaTools(input, { signal, tools, modelTier });
    const response = await post('/api/claude', { input, tier: modelTier ?? 'default' }, signal);
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let text = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        if (!text.startsWith('\u0000')) onText?.({ text, delta: '' });
      }
    } catch { throw signal?.aborted ? cancelled() : fail('network', 'The connection to the model was lost.'); }
    if (text.startsWith('\u0000REFUSAL') || text.endsWith('\u0000REFUSAL')) throw fail('refused', 'Declined');
    const error = text.indexOf('\u0000ERROR ');
    if (error >= 0) throw fail('api_error', text.slice(error + 7));
    return { text, truncated: false, modelTierApplied: modelTier ?? 'default' };
  }
  sample.limits = async () => ({ maxPromptBytes: 262144, tools: { maxCount: 8 } });
  window.claude = { use: async name => name === 'sample' ? sample : null };
})();
