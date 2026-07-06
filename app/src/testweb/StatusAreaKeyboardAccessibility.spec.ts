/**
 * Regression test — status area "Show more information" flyout keyboard accessibility.
 *
 * Verifies that the controls inside the expandable status-area flyout are operable
 * by keyboard (WCAG / MAS 2.1.1).
 *
 * Root cause this guards against: StatusArea._toggleExpandedSize() tried to move
 * focus into the expanded flyout via `this.scrollAreaList.current.focus()`, but
 * `scrollAreaList` was never attached to any DOM element — so keyboard expansion
 * never moved focus into the flyout, the log rows were `ListItemButton`s
 * (role=button, focusable, no action), and there was no Escape-to-collapse.
 *
 * Guards: focus moves into the flyout on keyboard expand, the toggle exposes
 * aria-expanded, the log contains no non-actionable buttons, and Escape collapses
 * the flyout and returns focus to the toggle.
 *
 * Run: npx playwright test StatusAreaKeyboardAccessibility.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { enterEditor, processMessage } from "./WebTestUtilities";

/** Expand the status area using ONLY the keyboard and return the toggle locator. */
async function expandStatusAreaWithKeyboard(page: Page) {
  const toggle = page
    .getByRole("button", { name: /Show more information in the status area/i })
    .or(page.locator('[title="Show more information in the status area"]'))
    .first();

  await expect(toggle).toBeVisible({ timeout: 15000 });
  await toggle.focus();
  await page.keyboard.press("Enter");

  await expect(page.locator(".sa-list")).toBeVisible({ timeout: 5000 });
  return toggle;
}

test.describe("status area flyout keyboard accessibility", () => {
  test("expanding via keyboard moves focus into the flyout", async ({ page }) => {
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    expect(await enterEditor(page, { editMode: "full" })).toBe(true);

    await expandStatusAreaWithKeyboard(page);

    // After keyboard-expanding, focus must land inside the flyout so a keyboard
    // user can read/scroll it — not remain stranded on the toggle button.
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.closest(".sa-list")), { timeout: 4000 })
      .toBe(true);

    expect(consoleErrors, `unexpected console errors: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
  });

  test("expanded toggle exposes aria-expanded and the flyout has no dead buttons", async ({ page }) => {
    expect(await enterEditor(page, { editMode: "full" })).toBe(true);

    const toggle = await expandStatusAreaWithKeyboard(page);

    // Disclosure semantics: assistive tech must be told the control is expanded.
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    // The log rows must not be exposed as buttons that do nothing — a keyboard/AT
    // user would otherwise tab onto a "button" that cannot be activated.
    const deadButtons = await page.locator(".sa-list [role='button']").count();
    expect(deadButtons, "expanded status list should contain no non-actionable buttons").toBe(0);
  });

  test("Escape collapses the flyout and returns focus to the toggle", async ({ page }) => {
    expect(await enterEditor(page, { editMode: "full" })).toBe(true);

    await expandStatusAreaWithKeyboard(page);
    await page.keyboard.press("Escape");

    // The flyout collapses ...
    await expect(page.locator(".sa-list")).toBeHidden({ timeout: 5000 });

    // ... and focus returns to the toggle so the keyboard user is not stranded.
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.activeElement?.getAttribute("title") === "Show more information in the status area"
          ),
        { timeout: 4000 }
      )
      .toBe(true);
  });
});
