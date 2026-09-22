import { test, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:4318';

const cards = [
  ['session-card', '.session-card'],
  ['card', '.mini-card'],
  ['tilt-card', '.syntari-tilt'],
  ['card-and-project-folder', '.project-folder'],
  ['wallet-card', '.wallet-surface'],
  ['prediction-card', '[data-extra-kind="prediction"]'],
  ['selectable-cards', '.selectable-cards label:nth-of-type(2)>span'],
  ['approval-card', '[data-agent-kind="approval"]'],
  ['tool-approval', '[data-agent-kind="approval"]'],
  ['stat-row', '.stat-card'],
  ['feature-grid', '.feature-card'],
  ['rotating-carousel', '.carousel-stage'],
  ['live-readout', '.live-readout']
];

test('all card surfaces inherit the Session card visual contract', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  let northStar = null;

  for (const [slug, selector] of cards) {
    await page.goto(`${origin}/tmp/system/#${slug}`);
    const card = page.locator(selector).first();
    await card.waitFor({ state: 'visible', timeout: 15000 });

    const style = await card.evaluate(node => {
      const cs = getComputedStyle(node);
      return {
        radius: cs.borderRadius,
        background: cs.backgroundColor,
        borderWidth: cs.borderTopWidth,
        borderStyle: cs.borderTopStyle,
        borderColor: cs.borderTopColor
      };
    });

    if (!northStar) northStar = style;

    expect(style.radius, slug).toBe('16px');
    expect(style.borderWidth, slug).toBe('1px');
    expect(style.borderStyle, slug).toBe('solid');
    expect(style.background, slug).toBe(northStar.background);
    expect(style.borderColor, slug).toBe(northStar.borderColor);
  }
});
