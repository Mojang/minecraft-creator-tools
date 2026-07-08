/**
 * The editor's item-list (left) panel can be resized by dragging the splitter;
 * this verifies it can also be resized WITHOUT dragging — the splitter is an
 * ARIA window separator that is focusable and keyboard-operable (WCAG 2.1.1),
 * with a single-pointer double-click reset (WCAG 2.5.7 Dragging Movements).
 *
 * Run (from app/): npx playwright test ItemPanelSplitterKeyboard.spec.ts --project=chromium
 */

import { test, expect } from "@playwright/test";
import { enterEditor } from "./WebTestUtilities";

test.describe("Editor item-panel splitter is operable without dragging", () => {
  test("splitter is a keyboard-operable ARIA separator with a reset", async ({ page }) => {
    test.setTimeout(120000);

    expect(await enterEditor(page, { editMode: "full" })).toBe(true);

    const splitter = page.locator(".pe-itemSplitter").first();
    await expect(splitter).toBeVisible({ timeout: 15000 });

    // ARIA window-splitter semantics.
    await expect(splitter).toHaveAttribute("role", "separator");
    await expect(splitter).toHaveAttribute("aria-orientation", "vertical");

    const min = Number(await splitter.getAttribute("aria-valuemin"));
    const max = Number(await splitter.getAttribute("aria-valuemax"));
    expect(max).toBeGreaterThan(min);

    // Reachable and operable by keyboard.
    await splitter.focus();
    await expect(splitter).toBeFocused();

    const start = Number(await splitter.getAttribute("aria-valuenow"));
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(100);
    const wider = Number(await splitter.getAttribute("aria-valuenow"));
    expect(wider, "ArrowRight should widen the panel").toBeGreaterThan(start);

    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(100);
    const narrower = Number(await splitter.getAttribute("aria-valuenow"));
    expect(narrower, "ArrowLeft should narrow the panel").toBeLessThan(wider);

    // Home/End jump to the documented bounds.
    await page.keyboard.press("Home");
    await expect(splitter).toHaveAttribute("aria-valuenow", String(min));
    await page.keyboard.press("End");
    await expect(splitter).toHaveAttribute("aria-valuenow", String(max));

    // Single-pointer (no-drag) alternative: double-click resets the width.
    await splitter.dblclick();
    await page.waitForTimeout(100);
    const reset = Number(await splitter.getAttribute("aria-valuenow"));
    expect(reset).toBeGreaterThan(min);
    expect(reset).toBeLessThan(max);
  });
});
