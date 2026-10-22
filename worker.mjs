import Anthropic from '@anthropic-ai/sdk';

/*
 * The site is static assets. This Worker only adds /api/claude, so the live Renderer can reach a model: the key stays
 * here as the ANTHROPIC_API_KEY secret and never reaches the page. The page decides nothing about cost: the model, the
 * token ceiling, and the size of what it may send are fixed below.
 */
const MODEL = 'claude-opus-5-5';
const EFFORT = { quick: 'low', default: 'medium', complex: 'high' };
const LIMITS = { body: 400_000, messages: 16, tools: 8, maxTokens: 32000 };

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/claude' || url.pathname === '/api/claude-turn') return claude(request, env, ctx, url);
    return env.ASSETS.fetch(request);
  }
};

async function claude(request, env, ctx, url) {
  if (request.method !== 'POST') return json(405, { error: 'POST only.' });
  /* Only this site's pages may call it from a browser. */
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== url.host) return json(403, { error: 'Not from this site.' });
  if (!env.ANTHROPIC_API_KEY) return json(503, { error: 'The model is not connected on this deployment: the ANTHROPIC_API_KEY secret is missing.' });
  if (env.DEMO_CODE && request.headers.get('X-Demo-Code') !== env.DEMO_CODE) return json(401, { error: 'This demo needs its access code.' });
  const text = await request.text();
  if (text.length > LIMITS.body) return json(413, { error: 'The request is too large.' });
  let body;
  try { body = JSON.parse(text); } catch { return json(400, { error: 'The request is not JSON.' }); }
  const turn = url.pathname === '/api/claude-turn';
  const effort = EFFORT[body?.tier] ?? 'medium';
  let messages, tools;
  if (turn) {
    if (!Array.isArray(body?.messages) || !body.messages.length || body.messages.length > LIMITS.messages) return json(400, { error: 'messages must be a list of at most 16 turns.' });
    if (!body.messages.every(m => isObject(m) && ['user', 'assistant'].includes(m.role) && m.content !== undefined)) return json(400, { error: 'Each message has a role and content.' });
    if (!Array.isArray(body.tools) || body.tools.length > LIMITS.tools || !body.tools.every(t => isObject(t) && typeof t.name === 'string' && isObject(t.input_schema))) return json(400, { error: 'tools must be at most 8 { name, description, input_schema }.' });
    messages = body.messages;
    tools = body.tools.map(({ name, description, input_schema }) => ({ name, description: String(description ?? ''), input_schema, eager_input_streaming: true }));
  } else {
    if (typeof body?.input !== 'string' || !body.input.trim()) return json(400, { error: 'input is the prompt text.' });
    messages = [{ role: 'user', content: body.input }];
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const write = chunk => writer.write(encoder.encode(chunk)).catch(() => { closed = true; });
  let closed = false;
  const run = async () => {
    const stream = client.messages.stream({ model: MODEL, max_tokens: LIMITS.maxTokens, thinking: { type: 'adaptive' }, output_config: { effort }, messages, ...(tools ? { tools } : {}) });
    /* A tool turn answers once, at the end: whitespace while Claude thinks keeps the connection open and is valid before JSON. */
    const alive = turn ? setInterval(() => { if (closed) stream.abort(); else write(' '); }, 10000) : null;
    if (!turn) stream.on('text', delta => { if (closed) stream.abort(); else write(delta); });
    try {
      const message = await stream.finalMessage();
      if (turn) await write(JSON.stringify({ content: message.content, stop_reason: message.stop_reason }));
      else if (message.stop_reason === 'refusal') await write('\u0000REFUSAL');
    } catch (error) {
      const reason = error?.status === 401 ? 'The model key was refused.' : error?.status === 429 ? 'The model is busy; try again in a moment.' : String(error?.message ?? error).slice(0, 300);
      await write(turn ? JSON.stringify({ error: reason }) : `\u0000ERROR ${reason}`);
    } finally {
      clearInterval(alive);
      await writer.close().catch(() => {});
    }
  };
  ctx.waitUntil(run());
  return new Response(readable, { headers: { 'Content-Type': turn ? 'application/json' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
