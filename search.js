/**
 * Syntari component search, shared by System, the command palette, the CLI, and the agent API. People type the names
 * they already know from other systems, so a component's aliases count as much as its name. A match on the name or an
 * alias ranks above a match on the category, which ranks above a match in the description, and every word typed must
 * match the start of a word: "table" finds tables, not "selectable". A whole word ranks above part of one, so "select"
 * puts the selects before "Selection toolbar".
 */
const normal = text => String(text ?? '').toLocaleLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9%]+/g, ' ').trim();
const startsWord = (text, word) => text === word || text.startsWith(`${word} `) || text.includes(` ${word}`);

/**
 * How well an item matches a query, from 0 (no match) to 100 (its name or an alias, exactly).
 * @param {{ name?: string, id?: string, slug?: string, aliases?: string[], category?: string, description?: string }} item
 * @param {string} query
 */
export function matchScore(item, query) {
  const q = normal(query);
  if (!q) return 0;
  const words = q.split(' ');
  const names = [item.name, item.id ?? item.slug, ...(item.aliases ?? [])].filter(Boolean).map(normal);
  if (names.includes(q)) return 100;
  if (names.some(name => name.startsWith(`${q} `))) return 90;
  if (names.some(name => name.startsWith(q))) return 85;
  if (names.some(name => startsWord(name, q))) return 80;
  const named = names.join(' | ');
  if (words.every(word => startsWord(named, word))) return 70;
  const category = normal(item.category);
  if (words.every(word => startsWord(`${named} | ${category}`, word))) return 50;
  if (words.every(word => startsWord(`${named} | ${category} | ${normal(item.description)}`, word))) return 30;
  return 0;
}

/** The items that match a query, best first; items that match equally keep their order. */
export function searchItems(items, query) {
  return items.map((item, index) => ({ item, index, score: matchScore(item, query) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(entry => entry.item);
}
