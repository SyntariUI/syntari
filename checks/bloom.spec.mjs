import { test, expect } from '@playwright/test';

test('bloom menu floats above its active trigger and closes accessibly', async ({page}) => {
  await page.goto('http://127.0.0.1:4398/gallery.html');
  const root = page.locator('[data-extra-kind="bloom"]');
  const trigger = root.locator('[data-extra="bloom-toggle"]');
  await trigger.click();

  const choices = root.locator('[data-extra="bloom-choice"]');
  await expect(choices).toHaveCount(3);
  await expect(choices.first()).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(trigger).toHaveAccessibleName('Close');
  await expect(root).toHaveAttribute('data-open', '');
  await choices.last().evaluate(el => Promise.all(el.parentElement.getAnimations({subtree:true}).map(animation => animation.finished)));

  const [triggerBox, choiceBox, optionsStyle] = await Promise.all([
    trigger.boundingBox(),
    choices.first().boundingBox(),
    root.locator('.bloom-options').evaluate(el => ({background:getComputedStyle(el).backgroundColor, radius:getComputedStyle(el).borderRadius})),
  ]);
  expect(choiceBox.y + choiceBox.height).toBeLessThan(triggerBox.y);
  expect(Math.abs(choiceBox.width - choiceBox.height)).toBeLessThan(1);
  expect(optionsStyle.background).toBe('rgba(0, 0, 0, 0)');
  expect(optionsStyle.radius).toBe('0px');

  await trigger.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toHaveAccessibleName('Create');
  await expect(trigger).toBeFocused();
  await expect(choices.first()).toBeHidden();

  await trigger.click();
  await root.getByRole('button', {name:'New folder'}).click();
  await expect(root.locator('[data-extra-status]')).toHaveText('Folder selected.');
  await expect(trigger).toBeFocused();
});
