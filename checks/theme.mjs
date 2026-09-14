export async function setTheme(page, label) {
  const theme = label.toLowerCase().startsWith('dark') ? 'dark' : 'light';
  if (await page.locator('html').getAttribute('data-theme') !== theme) {
    await page.locator('#docs-theme').click();
  }
}
