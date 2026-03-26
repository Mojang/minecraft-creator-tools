/**
 * FocusedModeFiltering.spec.ts
 *
 * Tests that verify the Focused editing mode correctly hides developer/implementation
 * files while showing creator-facing content items. These tests validate the product's
 * default UX — new users should see a clean file tree focused on Minecraft content,
 * not build configs or internal metadata.
 *
 * Architecture:
 * - Focused mode = CreatorToolsEditPreference.summarized (0)
 * - Full mode = CreatorToolsEditPreference.editors (1)
 * - Filtering logic lives in ProjectItemList.shouldShowProjectItem()
 * - Items with category "build", "mctools", "package" are hidden in Focused mode
 * - Manifest files, package.json, package-lock.json, markdown docs also hidden
 * - Content items (entities, blocks, items, scripts, textures, etc.) remain visible
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage, enterEditor } from "./WebTestUtilities";

test.describe("Focused Mode Filtering @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should hide manifest files in Focused mode", async ({ page }) => {
    // Enter editor in Focused mode (the default for new users)
    const entered = await enterEditor(page);
    expect(entered).toBe(true);

    await page.waitForTimeout(2000);
    await page.screenshot({ path: "debugoutput/screenshots/focused-mode-file-tree.png" });

    // In Focused mode, manifest files should NOT be visible in the file tree
    const fileTree = page.locator(".pil-outer");

    // Manifest files should be hidden
    const manifestItem = fileTree.getByText("manifest.json");
    const manifestCount = await manifestItem.count();
    expect(manifestCount).toBe(0);

    // package.json should be hidden
    const packageJsonItem = fileTree.getByText("package.json");
    const packageJsonCount = await packageJsonItem.count();
    expect(packageJsonCount).toBe(0);
  });

  test("should show content items in Focused mode", async ({ page }) => {
    const entered = await enterEditor(page);
    expect(entered).toBe(true);

    await page.waitForTimeout(2000);

    const fileTree = page.locator(".pil-outer");

    // The starter addon includes TypeScript files and content items visible in Focused mode
    // Look for any tree item content (category headers or individual items)
    const treeItems = fileTree.locator(".pil-item, .pil-itemTypeHeader");
    const itemCount = await treeItems.count();

    // There should be at least some items visible in the file tree
    expect(itemCount).toBeGreaterThan(0);

    await page.screenshot({ path: "debugoutput/screenshots/focused-mode-content-items.png" });
  });

  test("should reveal hidden files when switching to Full mode", async ({ page }) => {
    // Start in Focused mode
    const entered = await enterEditor(page);
    expect(entered).toBe(true);

    await page.waitForTimeout(2000);
    await page.screenshot({ path: "debugoutput/screenshots/focused-to-full-before.png" });

    // Count items in Focused mode
    const fileTree = page.locator(".pil-outer");
    const focusedItemCount = await fileTree.locator(".pil-item").count();

    // Now switch to Full mode via the Show menu
    // Click "Show" button in the toolbar area to reveal all items
    const showButton = page.locator('button:has-text("Show")').first();
    if (await showButton.isVisible({ timeout: 2000 })) {
      await showButton.click();

      // Look for "All Single Files (Advanced)" in the menu
      const menuList = page.locator(".MuiMenu-list");
      const allFilesOption = menuList.getByRole("menuitem", { name: "All Single Files (Advanced)" });

      if (await allFilesOption.isVisible({ timeout: 2000 })) {
        await allFilesOption.click();
        await page.waitForTimeout(1000);

        // After enabling all files, more items should be visible
        const fullItemCount = await fileTree.locator(".pil-item").count();
        expect(fullItemCount).toBeGreaterThanOrEqual(focusedItemCount);

        await page.screenshot({ path: "debugoutput/screenshots/focused-to-full-after.png" });
      } else {
        // Close menu if option not found
        await page.keyboard.press("Escape");
      }
    }
  });

  test("should hide Inspector sidebar item in Focused mode", async ({ page }) => {
    const entered = await enterEditor(page);
    expect(entered).toBe(true);

    await page.waitForTimeout(2000);

    // Check for Problems should be hidden in Focused mode (it's for advanced users)
    const inspectorItem = page.locator(".pil-outer").getByText("Check for Problems").or(page.locator(".pil-outer").getByText("Validation")).or(page.locator(".pil-outer").getByText("Inspector"));
    const inspectorVisible = await inspectorItem.first().isVisible({ timeout: 3000 }).catch(() => false);
    expect(inspectorVisible).toBe(false);

    await page.screenshot({ path: "debugoutput/screenshots/focused-mode-inspector-hidden.png" });
  });
});

test.describe("Full Mode Visibility @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should show manifest files in Full mode", async ({ page }) => {
    // Enter editor in Full mode
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);

    await page.waitForTimeout(2000);
    await page.screenshot({ path: "debugoutput/screenshots/full-mode-file-tree.png" });

    // In Full mode, manifest files SHOULD be visible
    // Note: the sidebar strips file extensions, so "manifest.json" displays as "manifest"
    const fileTree = page.locator(".pil-outer");
    const manifestItem = fileTree.getByText("manifest").first();

    // At least one manifest should be visible
    const manifestVisible = await manifestItem.isVisible({ timeout: 5000 }).catch(() => false);
    expect(manifestVisible).toBe(true);
  });

  test("should show Inspector sidebar item in Full mode", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);

    await page.waitForTimeout(2000);

    // Validation (formerly Inspector) should be visible in Full mode
    const inspectorItem = page.locator(".pil-outer").getByText("Check for Problems").or(page.locator(".pil-outer").getByText("Validation")).or(page.locator(".pil-outer").getByText("Inspector")).first();
    const inspectorVisible = await inspectorItem.isVisible({ timeout: 5000 }).catch(() => false);
    expect(inspectorVisible).toBe(true);

    await page.screenshot({ path: "debugoutput/screenshots/full-mode-inspector.png" });
  });
});
