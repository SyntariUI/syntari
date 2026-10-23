import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { catalog } from '../scripts/catalog.mjs';
import { groups } from '../docs-data.js';

/* One set of categories, in one order: what the runtime declares, what the registry lists, what authored manifests say,
   and what System and the docs group by. A category missing from the groups would drop its components from the docs. */
test('every component sits in one of the named categories, the same one everywhere', async () => {
  const components = await catalog();
  const named = Object.keys(groups);
  assert.equal(new Set(named).size, named.length);
  for (const component of components) assert.ok(named.includes(component.category), `${component.name}: ${component.category} is not a named category`);
  assert.deepEqual(named.filter(name => components.some(component => component.category === name)), named, 'every named category has components');
  const index = JSON.parse(await readFile(new URL('../registry/index.json', import.meta.url), 'utf8'));
  const runtime = Object.fromEntries(components.map(component => [component.slug, component.category]));
  for (const entry of index.components) assert.equal(entry.category, runtime[entry.id], `registry/index.json: ${entry.id}`);
  const dir = new URL('../registry/components/', import.meta.url);
  for (const file of (await readdir(dir)).filter(name => name.endsWith('.json'))) {
    const manifest = JSON.parse(await readFile(new URL(file, dir), 'utf8'));
    assert.equal(manifest.category, runtime[manifest.id], `registry/components/${file}`);
  }
});

test('charts, buttons, and cards each have a category of their own', async () => {
  const components = await catalog();
  const of = slug => components.find(component => component.slug === slug)?.category;
  for (const slug of ['chart-bars', 'chart-donut', 'line-chart', 'area-chart', 'heatmap', 'treemap', 'funnel', 'gantt-chart', 'network-graph']) assert.equal(of(slug), 'Charts', slug);
  for (const slug of ['button', 'icon-button']) assert.equal(of(slug), 'Buttons', slug);
  for (const slug of ['card', 'session-card', 'tilt-card', 'wallet-card', 'prediction-card']) assert.equal(of(slug), 'Cards', slug);
});
