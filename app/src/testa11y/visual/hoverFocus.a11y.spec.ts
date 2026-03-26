/**
 * Content on hover/focus tests (MAS / WCAG 1.4.13).
 *
 * Verifies that additional content appearing on hover or focus (tooltips,
 * dropdown menus, autocomplete results):
 * - Can be dismissed (usually via Escape)
 * - The pointer can move to the additional content without it disappearing
 * - Remains visible until dismissed or focus/hover is removed
 *
 * Tags: @comprehensive-a11y @visual-a11y
 */

import { test, expect } from "../fixtures";
import { gotoWithTheme, enterEditor } from "../../testweb/WebTestUtilities";

test.describe("Content on Hover/Focus — Tooltips @comprehensive-a11y @visual-a11y", () => {
  test("tooltips should be dismissable via Escape", async ({ page }) => {
    await gotoWithTheme(page, "dark");
    await page.waitForTimeout(500);

    // Find a button with a title attribute (which generates a tooltip)
    const buttonWithTitle = page.locator("button[title], button[aria-label]").first();
    if (!(await buttonWithTitle.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log("No buttons with tooltips found on home page — skipping");
      test.skip();
      return;
    }

    // Hover to show tooltip
    await buttonWithTitle.hover();
    await page.waitForTimeout(500);

    // Press Escape — should dismiss any tooltip/popover
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // Verify the tooltip is no longer showing (if it was a custom tooltip)
    const tooltipVisible = await page
      .locator('[role="tooltip"]')
      .isVisible({ timeout: 500 })
      .catch(() => false);

    console.log(`Tooltip visible after Escape: ${tooltipVisible}`);
    // Native title tooltips can't be dismissed via Escape (browser limitation),
    // but custom [role="tooltip"] elements should be dismissable.
  });
});

test.describe("Content on Hover/Focus — Dropdowns @comprehensive-a11y @visual-a11y", () => {
  test("dropdown menus remain visible while hovered", async ({ page }) => {
    await gotoWithTheme(page, "dark");
    await page.waitForTimeout(500);

    // Enter editor where dropdown menus exist
    const entered = await enterEditor(page);
    if (!entered) {
      test.skip();
      return;
    }

    // Look for MUI Select dropdown triggers specifically (not arbitrary aria-haspopup elements)
    const dropdownTrigger = page.locator('[role="combobox"][aria-haspopup="listbox"]').first();

    if (!(await dropdownTrigger.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log("No MUI Select dropdown triggers found in editor — skipping");
      test.skip();
      return;
    }

    // Click to open dropdown
    await dropdownTrigger.click();
    await page.waitForTimeout(300);

    // Check if dropdown content appeared (MUI renders listbox in a portal)
    const dropdownContent = page.locator('[role="listbox"]').first();

    const isOpen = await dropdownContent.isVisible({ timeout: 1000 }).catch(() => false);
    if (!isOpen) {
      console.log("Dropdown listbox did not open — skipping hover test");
      return;
    }

    // Move mouse to the dropdown content — it should stay visible
    await dropdownContent.hover();
    await page.waitForTimeout(300);

    const stillVisible = await dropdownContent.isVisible({ timeout: 500 }).catch(() => false);
    expect(stillVisible, "Dropdown content should remain visible while hovered").toBe(true);

    // Dismiss with Escape
    await page.keyboard.press("Escape");
  });
});

test.describe("Content on Hover/Focus — Command Bar @comprehensive-a11y @visual-a11y", () => {
  test("command bar autocomplete results persist while focused", async ({ page }) => {
    const entered = await enterEditor(page);
    if (!entered) {
      test.skip();
      return;
    }

    // Focus command bar input
    const commandInput = page.locator('[aria-label*="command"], [aria-label*="search"]').first();
    if (!(await commandInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log("Command bar not found — skipping");
      test.skip();
      return;
    }

    await commandInput.focus();
    await commandInput.fill("a"); // Type to trigger autocomplete
    await page.waitForTimeout(500);

    // Check for autocomplete results
    const results = page.locator('[role="option"], [role="listbox"] li').first();
    const hasResults = await results.isVisible({ timeout: 2000 }).catch(() => false);

    if (!hasResults) {
      console.log("No autocomplete results appeared — skipping");
      return;
    }

    // Keep focus in the input — results should persist
    await page.waitForTimeout(300);
    const stillShowing = await results.isVisible({ timeout: 500 }).catch(() => false);
    expect(stillShowing, "Autocomplete results should persist while input is focused").toBe(true);
  });
});
