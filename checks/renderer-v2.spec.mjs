import { test, expect } from '@playwright/test';
import { scenarios } from '../benchmarks/index.js';

const lab = (query = '') => `http://127.0.0.1:4398/renderer/v2/${query}`;
/** The lab announces what it rendered once both the screen and the inspector are painted. */
async function ready(page) {
  await expect(page.locator('[data-lab-status]')).toContainText('·', { timeout: 30000 });
  for (const frame of page.frames().filter(frame => frame !== page.mainFrame())) await frame.locator('.ir-screen').waitFor();
}
const frameOf = (page, condition) => page.frameLocator(`[data-condition="${condition}"] iframe`);

test('every benchmark scenario renders in both conditions with no fallback and no page errors', async ({ page }) => {
  test.setTimeout(240000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const scenario of scenarios) {
    await page.goto(lab(`?scenario=${scenario.id}&condition=compare&viewport=desktop&tab=findings`));
    await ready(page);
    for (const condition of ['baseline', 'intent']) {
      await expect(frameOf(page, condition).locator('.ir-screen')).toBeVisible();
      await expect(frameOf(page, condition).locator('.ir-fallback')).toHaveCount(0);
    }
    await expect(page.locator('[data-findings="intent"] .lab-gate')).toContainText('Passes');
    await expect(page.locator('[data-findings="baseline"] .lab-finding.is-warning').first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('a split screen puts the source beside the differences on desktop and after them on a phone', async ({ page }) => {
  await page.goto(lab('?scenario=statement-reconciliation&condition=intent&viewport=desktop'));
  await ready(page);
  const frame = frameOf(page, 'intent');
  const main = await frame.locator('[data-ir-id="review"]').boundingBox();
  const aside = await frame.locator('[data-ir-id="source"]').boundingBox();
  expect(aside.x).toBeGreaterThan(main.x + main.width - 1);
  expect(Math.abs(aside.y - main.y)).toBeLessThan(40);

  await page.locator('[data-lab-viewport] button[value="mobile"]').click();
  await ready(page);
  const phone = frameOf(page, 'intent');
  const width = await phone.locator('html').evaluate(node => node.clientWidth);
  expect(width).toBeLessThanOrEqual(390);
  expect(await phone.locator('html').evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(0);
  const stackedMain = await phone.locator('[data-ir-id="review"]').boundingBox();
  const stackedAside = await phone.locator('[data-ir-id="source"]').boundingBox();
  expect(stackedAside.y).toBeGreaterThan(stackedMain.y + stackedMain.height - 1);
  /* On a phone the value diff reads row by row and keeps its table roles. */
  await expect(phone.locator('[data-ir-id="differences"] .value-diff[role="table"] tbody tr[role="row"]')).toHaveCount(3);
});

test('no benchmark screen scrolls sideways on a phone', async ({ page }) => {
  test.setTimeout(240000);
  for (const scenario of scenarios) for (const condition of ['intent', 'baseline']) {
    await page.goto(lab(`?scenario=${scenario.id}&condition=${condition}&viewport=mobile`));
    await ready(page);
    const overflow = await frameOf(page, condition).locator('html').evaluate(node => node.scrollWidth - node.clientWidth);
    expect(overflow, `${scenario.id} ${condition}`).toBeLessThanOrEqual(0);
  }
});

test('choosing a value is a request to the host, and pointing at a row marks its line in the source', async ({ page }) => {
  await page.goto(lab('?scenario=statement-reconciliation&condition=intent&viewport=desktop&tab=changes'));
  await ready(page);
  const frame = frameOf(page, 'intent');
  const row = frame.locator('.value-diff tbody tr').nth(1);
  await row.hover();
  await expect(frame.locator('.source-line.is-linked')).toHaveText(/Municipal bond fund/);
  const keep = row.locator('[data-choice="from"]');
  await keep.focus();
  await page.keyboard.press('Enter');
  await expect(keep).toHaveAttribute('aria-pressed', 'true');
  await expect(row.locator('[data-choice="to"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-lab-status]')).toContainText('value-diff asked to choose on row 2');
  await expect(page.locator('[data-panel="changes"]')).toContainText('value-diff · choose · row 2 · {"value":"from"}');
  /* The source reference is a button: keyboard users bring the line into view without a pointer. */
  await frame.locator('.value-diff tbody tr').first().locator('.value-diff-source').focus();
  await expect(frame.locator('.source-line.is-linked')).toHaveText(/Cash and sweep/);
});

test('the inspector is keyboard operable and explains the plan, the findings, and the difference', async ({ page }) => {
  await page.goto(lab('?scenario=advisor-overview&condition=compare'));
  await ready(page);
  const plan = page.locator('[data-panel="plan"]');
  await expect(plan).toContainText('Task triage');
  await expect(plan).toContainText('names a place');
  await expect(plan.locator('tbody tr')).toHaveCount(6);
  await page.getByRole('tab', { name: 'Plan' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Findings' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-panel="findings"]')).toBeVisible();
  await expect(page.locator('[data-panel="findings"]')).toContainText('kpi-grid-on-task-screen');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'IR' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-panel="ir"]')).toContainText('syntari-plan-1');
  await page.getByRole('tab', { name: 'Changes' }).click();
  await expect(page.locator('[data-panel="changes"]')).toContainText('How the baseline was composed');
  await expect(page.locator('[data-panel="changes"]')).toContainText('not a quality score');
});

test('a safe repair changes disclosure only and is listed as an iteration', async ({ page }) => {
  await page.goto(lab('?scenario=freight-invoice&condition=baseline&tab=findings'));
  await ready(page);
  const findings = page.locator('[data-panel="findings"]');
  await expect(findings).toContainText('hidden-decision-input');
  await expect(findings.locator('.lab-gate').first()).toContainText('Fails');
  await expect(frameOf(page, 'baseline').locator('[data-ir-id="invoice"]')).not.toHaveAttribute('open', '');
  await page.locator('[data-repair="baseline"]').click();
  await expect(page.locator('[data-lab-status]')).toContainText('Applied 1 safe repair');
  await ready(page);
  await expect(frameOf(page, 'baseline').locator('[data-ir-id="invoice"]')).toHaveAttribute('open', '');
  await expect(findings).not.toContainText('hidden-decision-input');
  await expect(findings.locator('.lab-gate').first()).toContainText('Review');
  await page.getByRole('tab', { name: 'Changes' }).click();
  await expect(page.locator('[data-panel="changes"]')).toContainText('Repair 1');
  await expect(page.locator('[data-panel="changes"]')).toContainText('changed region invoice: open');
});

test('the lab works on a phone: the inspector opens as a sheet over the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(lab('?scenario=support-queue&condition=intent&viewport=mobile'));
  await ready(page);
  const inspector = page.locator('[data-lab-inspector]');
  await expect(page.locator('[data-lab-inspect]')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('[data-lab-inspect]').click();
  await expect(page.locator('[data-lab-inspect]')).toHaveAttribute('aria-expanded', 'true');
  await expect(inspector).toBeInViewport();
  await expect(inspector).toContainText('Task triage');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
