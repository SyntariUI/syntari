/** Open one component on its System route and return the live preview root. */
export const origin = 'http://127.0.0.1:4398';
export const slugify = name => name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function component(page, name) {
  await page.goto(`${origin}/components/${slugify(name)}/`);
  const root = page.locator('.syntari-component');
  await root.waitFor();
  return root;
}

export async function fitsViewport(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
}
