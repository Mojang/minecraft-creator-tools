/**
 * Keyboard-operability sweep for disclosure / flyout controls.
 *
 * Companion to StatusAreaKeyboardAccessibility.spec.ts. That regression
 * showed our a11y coverage checked reflow + ARIA *presence* but not keyboard
 * *operability* (focus movement, Escape) of disclosures. This sweep locks in the
 * keyboard contract for the other reachable disclosure patterns:
 *   - Menu/flyout (MUI Menu): open via keyboard, Escape closes AND returns focus
 *     to the trigger.
 *   - Inline expander (ListItemButton + aria-expanded): Enter toggles the state.
 *
 * Run: npx playwright test DisclosureKeyboardAccessibility.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { enterEditor, processMessage } from "./WebTestUtilities";

test.describe("Disclosure keyboard operability", () => {
  test("item actions menu: keyboard open, Escape closes and returns focus to trigger", async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    expect(await enterEditor(page)).toBe(true);
    await page.waitForTimeout(1500);

    // Select a project item so the toolbar exposes the "Item Actions" menu.
    const projectList = page.getByRole("tree", { name: /project items/i });
    await expect(projectList).toBeVisible({ timeout: 10000 });

    const mainScript = projectList
      .getByRole("treeitem")
      .filter({ hasText: /^main$/ })
      .first();
    if (await mainScript.isVisible({ timeout: 3000 }).catch(() => false)) {
      await mainScript.click();
    } else {
      await projectList.getByRole("treeitem").nth(3).click();
    }
    await page.waitForTimeout(1000);

    const toolbar = page.locator('[aria-label="Project Editor main toolbar"]');
    const itemActionsButton = toolbar.getByRole("button", { name: /item actions/i }).first();
    await expect(itemActionsButton).toBeVisible({ timeout: 5000 });

    // Open the menu using ONLY the keyboard.
    await itemActionsButton.focus();
    await expect(itemActionsButton).toBeFocused();
    await page.keyboard.press("Enter");

    const menu = page.getByRole("menu").first();
    await expect(menu).toBeVisible({ timeout: 3000 });

    // Escape must close the flyout AND return focus to the trigger (not strand it).
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden({ timeout: 3000 });
    await expect(itemActionsButton).toBeFocused();

    expect(consoleErrors, `unexpected console errors: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
  });

  test("project item disclosure headers toggle via keyboard (aria-expanded)", async ({ page }) => {
    test.setTimeout(90000);
    expect(await enterEditor(page, { editMode: "full" })).toBe(true);
    await page.waitForTimeout(1500);

    const headers = page.locator('[role="treeitem"][aria-expanded]');
    const count = await headers.count();
    test.skip(count === 0, "No collapsible project-item disclosure headers present in this project/mode");

    const header = headers.first();
    await header.scrollIntoViewIfNeeded();
    const before = await header.getAttribute("aria-expanded");

    // Operate the inline disclosure with the keyboard.
    await header.focus();
    await expect(header).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);

    const after = await header.getAttribute("aria-expanded");
    expect(after, "Enter should toggle the disclosure header's aria-expanded state").not.toBe(before);
  });
});
