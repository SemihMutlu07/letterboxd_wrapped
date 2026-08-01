import { expect, test } from '@playwright/test';

test('desktop actor and director picker opens beside its trigger', async ({ page }) => {
  await page.goto('/smt');
  await page.waitForURL(/\/results\?u=/);

  await page.getByRole('button', { name: /share your wrapped/i }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Share' });
  await expect(dialog).toBeVisible();

  const trigger = dialog.getByRole('button', { name: 'Tune actor and director' });
  await trigger.click();

  const actorRow = dialog.getByText('Actor', { exact: true }).locator('..');
  const picker = actorRow.locator('..');
  await expect(picker).toBeVisible();

  const triggerBox = await trigger.boundingBox();
  const pickerBox = await picker.boundingBox();
  const viewport = page.viewportSize();
  expect(triggerBox).not.toBeNull();
  expect(pickerBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(pickerBox!.y).toBeGreaterThanOrEqual(0);
  expect(pickerBox!.y + pickerBox!.height).toBeLessThanOrEqual(viewport!.height);
  expect(Math.abs(pickerBox!.y - (triggerBox!.y + triggerBox!.height))).toBeLessThanOrEqual(16);
});
