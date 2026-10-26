import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.mjs';

/* Every guard answers before the model is called, so these run without a network or a key that works. */
const site = 'https://syntariui.giovanitier.com';
const call = (env, { method = 'POST', origin = site, headers = {}, body = '{}' } = {}) =>
  worker.fetch(new Request(`${site}/api/claude-turn`, { method, headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}), ...headers }, ...(method === 'POST' ? { body } : {}) }), env, { waitUntil() {} });
const limiter = success => ({ calls: [], async limit({ key }) { this.calls.push(key); return { success }; } });

test('the model answers only this site\'s pages', async () => {
  const env = { CLAUDE_API_KEY: 'sk-test' };
  assert.equal((await call(env, { method: 'GET' })).status, 405);
  assert.equal((await call(env, { origin: null })).status, 403, 'a request without Origin is not from a page here');
  assert.equal((await call(env, { origin: 'https://elsewhere.example' })).status, 403);
  assert.equal((await call(env, { origin: 'null' })).status, 403);
});

test('the key connects under the name the dashboard gives it, CLAUDE_API_KEY', async () => {
  assert.equal((await call({})).status, 503);
  assert.match((await (await call({})).json()).error, /CLAUDE_API_KEY/);
  /* With the key, the request gets as far as reading its body: an invalid one is refused there, before any model call. */
  for (const env of [{ CLAUDE_API_KEY: 'sk-test' }, { ANTHROPIC_API_KEY: 'sk-test' }]) assert.equal((await call(env, { body: 'not json' })).status, 400);
});

test('each visitor and the whole site have a ceiling, checked before the body is read', async () => {
  const visitor = limiter(false), siteWide = limiter(true);
  const refused = await call({ CLAUDE_API_KEY: 'sk-test', CLAUDE_VISITOR_LIMIT: visitor, CLAUDE_SITE_LIMIT: siteWide }, { headers: { 'CF-Connecting-IP': '203.0.113.7' }, body: 'not json' });
  assert.equal(refused.status, 429);
  assert.deepEqual(visitor.calls, ['visitor:203.0.113.7']);
  const crowded = limiter(false);
  assert.equal((await call({ CLAUDE_API_KEY: 'sk-test', CLAUDE_VISITOR_LIMIT: limiter(true), CLAUDE_SITE_LIMIT: crowded }, { body: 'not json' })).status, 429);
  assert.deepEqual(crowded.calls, ['site']);
  assert.equal((await call({ CLAUDE_API_KEY: 'sk-test', CLAUDE_VISITOR_LIMIT: limiter(true), CLAUDE_SITE_LIMIT: limiter(true) }, { body: 'not json' })).status, 400, 'within both ceilings, the request goes on');
});

test('an access code, when the deployment sets one, is required', async () => {
  assert.equal((await call({ CLAUDE_API_KEY: 'sk-test', DEMO_CODE: 'open-sesame' })).status, 401);
  assert.equal((await call({ CLAUDE_API_KEY: 'sk-test', DEMO_CODE: 'open-sesame' }, { headers: { 'X-Demo-Code': 'open-sesame' }, body: 'not json' })).status, 400);
});
