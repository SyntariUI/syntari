/** Switch the theme with the surface's own toggle, or through the runtime when the toggle sits in a closed drawer. */
export async function setTheme(page, label) {
  const theme = label.toLowerCase().startsWith('dark') ? 'dark' : 'light';
  if (await page.locator('html').getAttribute('data-theme') === theme) return;
  const toggle = page.locator('[data-workspace-theme], [data-preview-theme]').first();
  if (await toggle.isVisible()) await toggle.click();
  else await page.evaluate(async value => (await import('/syntari.js')).setTheme(value), theme);
}
