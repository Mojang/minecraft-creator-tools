import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage, enterEditor } from "./WebTestUtilities";

/**
 * Tests for the per-item "Item Actions" dropdown menu in the project editor
 * toolbar. When a project item is selected, the toolbar shows an item-name
 * button whose dropdown menu exposes actions like Focus, Download, Rename,
 * Open in Text Editor, View on map, and Delete.
 *
 * These tests verify that clicking each action actually invokes the handler
 * (previously regressed when McToolbar stopped forwarding the menu item
 * descriptor to onClick handlers).
 */
test.describe("Item Actions Menu @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      const text = msg.text();
      if (text.includes("[ItemMenuDiag]")) {
        // eslint-disable-next-line no-console
        console.log("PAGE:", text);
      }
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("item actions menu should invoke Rename action", async ({ page }) => {
    test.setTimeout(90000);

    const entered = await enterEditor(page);
    expect(entered).toBe(true);
    await page.waitForTimeout(1500);

    // Select any .ts script item — default starter projects always have main.ts
    const projectList = page.getByRole("tree", { name: /project items/i });
    await expect(projectList).toBeVisible({ timeout: 10000 });

    // Click an editable project item (main script) to make it active
    const mainScript = projectList
      .getByRole("treeitem")
      .filter({ hasText: /^main$/ })
      .first();
    if (await mainScript.isVisible({ timeout: 3000 })) {
      await mainScript.click();
    } else {
      // Fall back to the first non-special tree item
      const firstItem = projectList.getByRole("treeitem").nth(3);
      await firstItem.click();
    }
    await page.waitForTimeout(1500);

    await page.screenshot({ path: "debugoutput/screenshots/item-menu-01-item-selected.png", fullPage: true });

    // The toolbar should now show an "Item Actions" button
    const toolbar = page.locator('[aria-label="Project Editor main toolbar"]');
    const itemActionsButton = toolbar.getByRole("button", { name: /item actions/i }).first();
    await expect(itemActionsButton).toBeVisible({ timeout: 5000 });

    await itemActionsButton.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: "debugoutput/screenshots/item-menu-02-menu-open.png", fullPage: true });

    // The menu should include Rename
    const renameItem = page.getByRole("menuitem", { name: /^rename$/i }).first();
    await expect(renameItem).toBeVisible({ timeout: 3000 });

    await renameItem.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: "debugoutput/screenshots/item-menu-03-after-rename.png", fullPage: true });

    // Clicking Rename should open a rename dialog. The MUI Dialog has role="dialog".
    const dialog = page
      .locator('[role="dialog"]')
      .filter({ hasText: /rename/i })
      .first();
    const dialogVisible = await dialog.isVisible({ timeout: 3000 }).catch(() => false);
    expect(dialogVisible, "Rename dialog should open when the menu item is clicked").toBe(true);
  });

  test("item actions toolbar menu should not include Focus (list-only action)", async ({ page }) => {
    test.setTimeout(90000);

    const entered = await enterEditor(page);
    expect(entered).toBe(true);
    await page.waitForTimeout(1500);

    // Select main script
    const projectList = page.getByRole("tree", { name: /project items/i });
    await expect(projectList).toBeVisible({ timeout: 10000 });

    const mainScript = projectList
      .getByRole("treeitem")
      .filter({ hasText: /^main$/ })
      .first();
    if (await mainScript.isVisible({ timeout: 3000 })) {
      await mainScript.click();
    } else {
      await projectList.getByRole("treeitem").nth(3).click();
    }
    await page.waitForTimeout(1500);

    const toolbar = page.locator('[aria-label="Project Editor main toolbar"]');
    const itemActionsButton = toolbar.getByRole("button", { name: /item actions/i }).first();
    await itemActionsButton.click();
    await page.waitForTimeout(500);

    // Focus is a project-tree concern; it should not appear in the toolbar menu
    // because clicking it had no effect (no wiring to ProjectItemList from the toolbar).
    const focusItem = page.getByRole("menuitem", { name: /^focus$/i });
    await expect(focusItem).toHaveCount(0);

    // But Rename / Download / Delete should be present
    const renameItem = page.getByRole("menuitem", { name: /^rename$/i }).first();
    await expect(renameItem).toBeVisible({ timeout: 3000 });
    const downloadItem = page.getByRole("menuitem", { name: /^download$/i }).first();
    await expect(downloadItem).toBeVisible({ timeout: 3000 });
    const deleteItem = page.getByRole("menuitem", { name: /^delete$/i }).first();
    await expect(deleteItem).toBeVisible({ timeout: 3000 });
  });
});
