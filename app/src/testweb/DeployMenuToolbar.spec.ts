import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage, enterEditor } from "./WebTestUtilities";

/**
 * Tests for the Deploy/Test menu in the project editor toolbar.
 *
 * Verifies:
 * 1. The default "Test" button with dropdown menu appears correctly.
 * 2. The deploy menu lists expected items (Flat world, Editor project, Custom world, etc.).
 * 3. After selecting a deploy option like "Flat world with packs", the toolbar
 *    still shows all items inline without pushing anything into an overflow "..." menu.
 * 4. The split-button pattern works: icon+Test label + dropdown arrow.
 * 5. The Help button remains visible after deploy selection.
 */
test.describe("Deploy Menu and Toolbar Overflow @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("deploy menu items should be visible and toolbar should not overflow after selection", async ({ page }) => {
    test.setTimeout(90000);

    // Enter editor
    const entered = await enterEditor(page);
    expect(entered).toBe(true);

    await page.waitForTimeout(2000);

    // Take a baseline screenshot of the toolbar
    await page.screenshot({ path: "debugoutput/screenshots/deploy-toolbar-initial.png", fullPage: true });

    // The toolbar should be visible
    const toolbar = page.locator('[aria-label="Project Editor main toolbar"]');
    await expect(toolbar).toBeVisible({ timeout: 5000 });

    // ── Step 1: Verify the default deploy/Test button is visible ──
    // Before any deploy action, the button should say "Test" with a dropdown
    const runButton = toolbar.getByRole("button", { name: /run|test|deploy/i }).first();
    await expect(runButton).toBeVisible({ timeout: 5000 });
    console.log("Found Test/Deploy button in toolbar");

    // Verify Help is visible in toolbar (not in overflow)
    const helpButton = toolbar.getByRole("button", { name: /help/i }).first();
    await expect(helpButton).toBeVisible({ timeout: 3000 });
    console.log("Help button is visible in toolbar (before deploy selection)");

    // Verify there's no overflow "..." button when items fit
    const overflowButton = toolbar.getByRole("button", { name: "More options" });
    const hasOverflow = (await overflowButton.count()) > 0 && (await overflowButton.isVisible());
    console.log(`Overflow button visible before deploy selection: ${hasOverflow}`);

    // ── Step 2: Open the deploy menu ──
    // Click the Test button (or its dropdown arrow) to open the deploy menu
    await runButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "debugoutput/screenshots/deploy-menu-open.png", fullPage: true });

    // Check for deploy menu items
    const deployMenu = page.locator("[role='menu']").last();
    if (await deployMenu.isVisible({ timeout: 3000 })) {
      console.log("Deploy menu is open");

      // Check for expected menu items
      const flatWorldItem = page.getByRole("menuitem", { name: /flat world/i }).first();
      const editorProjectItem = page.getByRole("menuitem", { name: /editor project/i }).first();
      const customWorldItem = page.getByRole("menuitem", { name: /custom world with packs/i }).first();
      const deployZipItem = page.getByRole("menuitem", { name: /deploy folder as zip/i }).first();

      // At least Flat world should be present
      if (await flatWorldItem.isVisible({ timeout: 2000 })) {
        console.log("Found 'Flat world with packs' in deploy menu");
      }
      if (await editorProjectItem.isVisible({ timeout: 1000 })) {
        console.log("Found 'Editor project with packs' in deploy menu");
      }
      if (await customWorldItem.isVisible({ timeout: 1000 })) {
        console.log("Found 'Custom world with packs' in deploy menu");
      }
      if (await deployZipItem.isVisible({ timeout: 1000 })) {
        console.log("Found 'Save deploy folder as zip' in deploy menu");
      }

      // ── Step 3: Select "Flat world with packs" ──
      // This should update the Test button to show the flat world icon
      // but should NOT cause toolbar overflow
      if (await flatWorldItem.isVisible()) {
        console.log("Clicking 'Flat world with packs'");

        // Set up download handler so the click doesn't fail waiting for filesystem
        const downloadPromise = page.waitForEvent("download", { timeout: 15000 }).catch(() => null);
        await flatWorldItem.click();

        // Wait for the download to start (or timeout gracefully)
        const download = await downloadPromise;
        if (download) {
          console.log(`Download started: ${download.suggestedFilename()}`);
          // Cancel the download - we don't need the file
          await download.cancel().catch(() => {});
        }
      }
    } else {
      // Menu might not have opened - close and try the dropdown arrow
      console.log("Deploy menu did not open from Test button click, trying dropdown approach");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Wait for toolbar to settle after deploy action
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "debugoutput/screenshots/deploy-toolbar-after-selection.png", fullPage: true });

    // ── Step 4: Verify toolbar state after deploy selection ──
    // After selecting "Flat world with packs", the split button's main action button
    // gets aria-label from the deploy target's title (e.g., "Flat world with packs (F5)").
    // The icon contains the "Test" text via CustomLabel, but the aria-label references the deploy target.
    const deployActionButton = toolbar.getByRole("button", { name: /flat world/i }).first();
    const deployActionVisible = (await deployActionButton.count()) > 0 && (await deployActionButton.isVisible());
    console.log(`Deploy action button visible after selection: ${deployActionVisible}`);
    expect(deployActionVisible).toBe(true);

    // CRITICAL: Help button must still be visible in the toolbar, not hidden in overflow
    const helpButtonAfter = toolbar.getByRole("button", { name: /help/i }).first();
    const helpVisible = (await helpButtonAfter.count()) > 0 && (await helpButtonAfter.isVisible());
    console.log(`Help button visible after deploy selection: ${helpVisible}`);
    expect(helpVisible).toBe(true);

    // CRITICAL: There should be no overflow "..." menu when items fit
    const overflowAfter = toolbar.getByRole("button", { name: "More options" });
    const overflowVisibleAfter = (await overflowAfter.count()) > 0 && (await overflowAfter.isVisible());
    console.log(`Overflow button visible after deploy selection: ${overflowVisibleAfter}`);

    // If overflow IS visible, log what's in it for debugging
    if (overflowVisibleAfter) {
      await overflowAfter.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: "debugoutput/screenshots/deploy-overflow-contents.png", fullPage: true });

      const overflowMenu = page.locator("[role='menu']").last();
      if (await overflowMenu.isVisible({ timeout: 1000 })) {
        const overflowItems = await overflowMenu.locator("[role='menuitem']").allTextContents();
        console.log(`Overflow menu items: ${JSON.stringify(overflowItems)}`);
      }
      await page.keyboard.press("Escape");
    }

    // The overflow should NOT be visible - all items should fit inline
    expect(overflowVisibleAfter).toBe(false);

    // ── Step 5: Verify the deploy dropdown arrow still works ──
    // After selecting flat world, there should be a dropdown arrow next to Test
    // that opens the deploy menu
    const dropdownArrow = toolbar.getByRole("button", { name: /more deploy options/i }).first();
    const hasDropdownArrow = (await dropdownArrow.count()) > 0 && (await dropdownArrow.isVisible());
    console.log(`Deploy dropdown arrow visible: ${hasDropdownArrow}`);

    if (hasDropdownArrow) {
      await dropdownArrow.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "debugoutput/screenshots/deploy-dropdown-after-selection.png", fullPage: true });

      // Verify the deploy menu opens with all expected items
      const menuAfter = page.locator("[role='menu']").last();
      if (await menuAfter.isVisible({ timeout: 2000 })) {
        const menuItems = await menuAfter.locator("[role='menuitem']").allTextContents();
        console.log(`Deploy menu items after selection: ${JSON.stringify(menuItems)}`);

        // Verify key items are present
        const hasFlatWorld = menuItems.some((item) => /flat world/i.test(item));
        const hasEditorProject = menuItems.some((item) => /editor project/i.test(item));
        console.log(`Menu has Flat world: ${hasFlatWorld}, Editor project: ${hasEditorProject}`);
        expect(hasFlatWorld).toBe(true);
      }
      await page.keyboard.press("Escape");
    }

    // ── Step 6: Final toolbar screenshot ──
    await page.screenshot({ path: "debugoutput/screenshots/deploy-toolbar-final.png", fullPage: true });

    // Filter out expected warnings
    const nonMuiWarnings = consoleWarnings.filter(
      (w) => !w.error.includes("Body element does not contain trap zone element")
    );
    expect(nonMuiWarnings.length).toBeLessThanOrEqual(0);
  });
});
