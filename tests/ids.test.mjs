import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { catalog } from '../scripts/catalog.mjs';
import { matchScore, searchItems } from '../search.js';

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

/* A component's id is its URL, its registry file, and the name agents and the CLI install it by. Display names change
   (33 did in 0.4.0); ids do not. registry/aliases.json lists every id, so a rename that drifts an id fails here instead
   of breaking links and installs. */
test('component ids are fixed: the runtime, the registry, and the alias list name the same ids', async () => {
  const components = await catalog();
  const ids = components.map(component => component.slug);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  assert.deepEqual([...ids].sort(), Object.keys(await json('../registry/aliases.json')).sort(), 'registry/aliases.json lists every id, and only those');
  assert.deepEqual([...ids].sort(), (await json('../registry/index.json')).components.map(entry => entry.id).sort(), 'registry/index.json');
  for (const component of components.filter(component => component.slug !== component.name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')))
    assert.equal(component.id, component.slug, `${component.name} declares its id, since its name no longer gives it`);
});

test('a renamed component keeps its id, and its manifest carries the new name', async () => {
  const components = await catalog();
  const byId = Object.fromEntries(components.map(component => [component.slug, component]));
  for (const [id, name] of [['chart-bars', 'Bar chart'], ['action-swap', 'Loading button'], ['number-stepper', 'Number input'], ['bloom-menu', 'Speed dial'], ['select-and-date', 'Select & date picker']])
    assert.equal(byId[id]?.name, name, id);
  const dir = new URL('../registry/components/', import.meta.url);
  for (const file of (await readdir(dir)).filter(name => name.endsWith('.json'))) {
    const manifest = JSON.parse(await readFile(new URL(file, dir), 'utf8'));
    assert.equal(manifest.name, byId[manifest.id]?.name, `registry/components/${file}`);
  }
  const index = await json('../registry/index.json');
  for (const entry of index.components) assert.deepEqual(entry.aliases, byId[entry.id].aliases, `registry/index.json aliases: ${entry.id}`);
});

test('the old names still find a renamed component', async () => {
  const components = await catalog();
  for (const [query, id] of [['chart bars', 'chart-bars'], ['action swap', 'action-swap'], ['number stepper', 'number-stepper'], ['bloom menu', 'bloom-menu'], ['multiselect', 'multiselect']])
    assert.equal(searchItems(components, query)[0]?.slug, id, query);
});

test('search ranks the name people type first', async () => {
  const components = await catalog();
  for (const [query, id] of [['button', 'button'], ['modal', 'dialog'], ['toggle', 'switch'], ['bar chart', 'chart-bars'], ['speed dial', 'bloom-menu'], ['table', 'table'], ['snackbar', 'toast'], ['multi select', 'multiselect'], ['loading button', 'action-swap'], ['date picker', 'select-and-date']])
    assert.equal(searchItems(components, query)[0]?.slug, id, query);
});

test('every word typed matches the start of a word, and whole words rank above parts of one', () => {
  const item = (name, extra = {}) => ({ name, ...extra });
  assert.equal(matchScore(item('Selectable list'), 'table'), 0);
  assert.equal(matchScore(item('Data table'), 'table'), 80);
  assert.equal(matchScore(item('Dialog', { aliases: ['modal'] }), 'Modal'), 100);
  assert.ok(matchScore(item('Select & date picker'), 'select') > matchScore(item('Selection toolbar'), 'select'));
  assert.equal(matchScore(item('Button', { category: 'Buttons' }), 'buttons'), 50);
  assert.equal(matchScore(item('Card', { description: 'A surface for grouped content' }), 'grouped'), 30);
  assert.equal(matchScore(item('Card'), '  '), 0);
});
