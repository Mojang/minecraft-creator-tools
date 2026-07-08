/**
 * Keyboard accessibility for the Content Wizard launcher controls
 * (WCAG 2.1.1 Keyboard).
 *
 * The launcher's type-select cards, "start from example" cards, gallery/section
 * item rows, and collapsible section headers are non-<button> elements. They must
 * be focusable, expose a button role, and respond to Enter / Space — otherwise
 * keyboard-only users cannot create content.
 */

import { test, expect, Page } from "@playwright/test";
import { enterEditor } from "./WebTestUtilities";

async function openLauncher(page: Page): Promise<boolean> {
  const addButton = page.locator('button[aria-label="Add new content"], button:has-text("Add")').first();
  if (!(await addButton.isVisible({ timeout: 5000 }).catch(() => false))) return false;
  await addButton.click();
  await page.waitForTimeout(800);
  const launcher = page.locator(".cwiz-launcher-wrapper, .cwiz-launcher").first();
  return launcher.isVisible({ timeout: 5000 }).catch(() => false);
}

test.describe("Content Wizard launcher — keyboard accessibility", () => {
  test("type-select card is focusable and activates with Enter", async ({ page }) => {
    test.setTimeout(90000);
    expect(await enterEditor(page)).toBe(true);
    if (!(await openLauncher(page))) test.skip(true, "Could not open the Content Wizard launcher");

    const mobCard = page.locator('[data-testid="wizard-new-mob"]').first();
    await expect(mobCard).toBeVisible({ timeout: 10000 });
    await expect(mobCard).toHaveAttribute("role", "button");
    await expect(mobCard).toHaveAttribute("tabindex", "0");

    await mobCard.focus();
    await expect(mobCard).toBeFocused();

    // Enter must activate the card and leave the launcher (enter the mob wizard).
    await page.keyboard.press("Enter");
    await page.waitForTimeout(600);
    await expect(page.locator('[data-testid="wizard-new-mob"]')).toHaveCount(0);
  });

  test("collapsible section header toggles with the keyboard", async ({ page }) => {
    test.setTimeout(90000);
    expect(await enterEditor(page)).toBe(true);
    if (!(await openLauncher(page))) test.skip(true, "Could not open the Content Wizard launcher");

    const header = page.locator(".cwiz-advanced-header").first();
    await expect(header).toBeVisible({ timeout: 10000 });
    await expect(header).toHaveAttribute("role", "button");
    await expect(header).toHaveAttribute("tabindex", "0");

    const before = await header.getAttribute("aria-expanded");
    await header.focus();
    await expect(header).toBeFocused();

    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    const after = await header.getAttribute("aria-expanded");
    expect(after).not.toBe(before);
  });
});
