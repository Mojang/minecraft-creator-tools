/**
 * Accessibility coverage for editor section headings rendered via the shared
 * SectionHeading component (WCAG 1.3.1).
 *
 * Several dialogs/pickers rendered text that looks like a section heading inside
 * a plain <div>, invisible to heading navigation. They now use SectionHeading,
 * which emits a real <h*>. This drives the New Mob dialog (whose "Mob Name" and
 * "Base Template" labels are migrated section headers) and asserts they are
 * reachable by heading role.
 *
 * Run (from app/):
 *   npx playwright test SectionHeadingAccessibility.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { processMessage, enterEditor } from "./WebTestUtilities";

async function openContentWizard(page: Page): Promise<boolean> {
  const existingDialog = page.locator(".MuiDialog-root").first();
  if (await existingDialog.isVisible({ timeout: 500 }).catch(() => false)) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
  }
  const addButton = page.locator('button[aria-label="Add new content"]').first();
  if (!(await addButton.isVisible({ timeout: 15000 }).catch(() => false))) return false;
  await addButton.click();
  await page.waitForTimeout(800);
  const wizard = page.locator(".cwiz-launcher-wrapper, .cwiz-launcher").first();
  return wizard.isVisible({ timeout: 3000 }).catch(() => false);
}

async function clickNewMobFromExisting(page: Page): Promise<boolean> {
  const byTestId = page.locator('[data-testid="wizard-mob-from-mc"]').first();
  if (await byTestId.isVisible({ timeout: 2000 }).catch(() => false)) {
    await byTestId.click();
    await page.waitForTimeout(600);
    return true;
  }
  const byLabel = page.locator('.cwiz-main-option:has-text("New Mob Based on Existing")').first();
  if (await byLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    await byLabel.click();
    await page.waitForTimeout(600);
    return true;
  }
  return false;
}

test("New Mob dialog section labels are semantic headings", async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];
  page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

  expect(await enterEditor(page, { editMode: "focused" })).toBe(true);

  expect(await openContentWizard(page), "Content Wizard should open").toBe(true);
  expect(await clickNewMobFromExisting(page), "should start New Mob Based on Existing").toBe(true);

  // The New Mob dialog's "Mob Name" / "Base Template" section labels are now
  // rendered through SectionHeading (real <h*>), reachable by heading role.
  await expect(page.getByRole("heading", { name: /Mob Name/i }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("heading", { name: /Base Template/i }).first()).toBeVisible();
});
