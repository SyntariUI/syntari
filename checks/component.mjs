/** Open one component on its System route, by its registry id, and return the live preview root. Ids stay fixed when
    a display name changes, so a rename never breaks a check. */
export const origin = 'http://127.0.0.1:4398';

export async function component(page, slug) {
  await page.goto(`${origin}/components/${slug}/`);
  const root = page.locator('.syntari-component');
  await root.waitFor();
  return root;
}

export async function fitsViewport(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
}
