/**
 * Keyboard accessibility for the Create Mob wizard's trait cards
 * ("Two-legged", "Four-legged", "Flying", etc.) on the Select Traits step
 * (WCAG 2.1.1 Keyboard).
 *
 * These cards are non-<button> elements (styled toggle cards). They must be
 * focusable (tabIndex), expose a button role + pressed state, and respond to
 * Enter and Space. The same trait card is shared by the Create Block and Create
 * Item wizards, so this guards the common control.
 */

import { test, expect, Page } from "@playwright/test";

async function openMobWizard(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll("h3")).find(
      (e) => (e.textContent || "").trim() === "Make a Mob"
    );
    const button = heading && heading.closest("button");
    if (button) (button as HTMLElement).click();
  });
  await page.waitForTimeout(800);
}

/** Advance the wizard until the trait cards (.cwiz-trait) are on screen. */
async function gotoTraitsStep(page: Page): Promise<void> {
  const trait = page.locator(".cwiz-trait").first();
  for (let i = 0; i < 6; i++) {
    if (await trait.isVisible().catch(() => false)) return;
    const next = page.getByRole("button", { name: /^Next/i }).first();
    if ((await next.isVisible().catch(() => false)) && (await next.isEnabled().catch(() => false))) {
      await next.click();
      await page.waitForTimeout(400);
    } else {
      await page.waitForTimeout(400);
    }
  }
}

test.describe("Create Mob wizard — trait keyboard accessibility", () => {
  test("trait cards are focusable, expose button semantics, and toggle with Enter/Space", async ({ page }) => {
    await openMobWizard(page);
    await gotoTraitsStep(page);

    const trait = page.locator(".cwiz-trait").first();
    await expect(trait).toBeVisible({ timeout: 15000 });

    // Button semantics for a non-<button> control.
    await expect(trait).toHaveAttribute("role", "button");
    await expect(trait).toHaveAttribute("tabindex", "0");
    await expect(trait).toHaveAttribute("aria-pressed", /true|false/);

    const isSelected = () => trait.evaluate((el) => el.classList.contains("cwiz-trait-selected"));
    const initial = await isSelected();

    // The control must be keyboard-focusable.
    await trait.focus();
    await expect(trait).toBeFocused();

    // Enter toggles the trait.
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    expect(await isSelected()).toBe(!initial);

    // Space toggles it back.
    await page.keyboard.press(" ");
    await page.waitForTimeout(150);
    expect(await isSelected()).toBe(initial);
  });
});
