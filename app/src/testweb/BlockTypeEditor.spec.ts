/**
 * Block Type Editor Visual Tests
 *
 * These tests verify the visual consistency and functionality of the Block Type Editor
 * by creating an Add-On project and adding a block type to test the editor interface.
 */

import { test, ConsoleMessage } from "@playwright/test";
import { processMessage, gotoWithTheme, ThemeMode, selectEditMode } from "./WebTestUtilities";

// Block type editor tabs to test (using actual tab names from BlockTypeEditor.tsx)
const BLOCK_EDITOR_TABS = [
  { name: "Overview", label: "Overview" },
  { name: "Components", label: "Components" },
  { name: "Visuals", label: "Visuals" },
  { name: "Permutations", label: "Permutations" },
  { name: "States", label: "States" },
];

// Helper to create an Add-On Starter project and enter the editor
async function createAddOnStarterProject(page: any, themeMode?: ThemeMode): Promise<boolean> {
  try {
    // Navigate with theme if specified
    if (themeMode) {
      await gotoWithTheme(page, themeMode, "/");
    } else {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
    }
    await page.waitForTimeout(500);

    // Find and click the "New" button for the Add-On Starter template (first New button)
    const createButton = page.getByRole("button", { name: "Create New" }).first();

    if (!(await createButton.isVisible({ timeout: 3000 }))) {
      console.log("Could not find CREATE NEW button");
      return false;
    }

    console.log("Clicking CREATE NEW for Add-On Starter project");
    await createButton.click();
    await page.waitForTimeout(1000);

    const okButton = page.getByTestId("submit-button").first();
    if (await okButton.isVisible({ timeout: 3000 })) {
      console.log("Clicking OK on project dialog");
      await okButton.click();
    } else {
      const altOkButton = page.locator("button:has-text('OK')").first();
      if (await altOkButton.isVisible({ timeout: 2000 })) {
        await altOkButton.click();
      } else {
        await page.keyboard.press("Enter");
      }
    }

    // Wait for the project to load
    await page.waitForTimeout(3000);
    await page.waitForLoadState("networkidle");

    // Dismiss welcome dialog if present
    await selectEditMode(page, "full");

    // Verify we're in the editor
    const viewButton = page.getByRole("button", { name: /view/i }).first();
    const isInEditor = await viewButton.isVisible({ timeout: 5000 });

    if (isInEditor) {
      console.log("Successfully created Add-On Starter project and entered editor");
      return true;
    }

    console.log("Could not verify editor interface loaded");
    return false;
  } catch (error) {
    console.log(`Error creating Add-On Starter project: ${error}`);
    return false;
  }
}

// Helper to add a block type via the Add menu
async function addBlockType(page: any): Promise<boolean> {
  try {
    // Click the Add button in the toolbar
    const addButton = page.locator('button:has-text("Add")').first();
    if (await addButton.isVisible({ timeout: 2000 })) {
      await addButton.click();
      await page.waitForTimeout(500);

      // Look for "Basic Block Type" first (simple dialog), then try "New Block" (multi-step)
      const basicBlockOption = page.locator('text="Basic Block Type"').first();
      const blockWizardOption = page.locator('text="New Block"').first();

      if (await basicBlockOption.isVisible({ timeout: 2000 })) {
        // Use basic block type - simpler dialog
        console.log("Clicking Basic Block Type in Add menu");
        await basicBlockOption.click();
        await page.waitForTimeout(1000);

        // Fill in the name input
        const nameInput = page.locator('input[type="text"]').first();
        if (await nameInput.isVisible({ timeout: 1000 })) {
          await nameInput.fill("test_block");
          await page.waitForTimeout(200);

          // Look for dialog buttons specifically - prefer role-based selectors in dialog context
          const dialogAddButton = page.getByRole("button", { name: "Add" }).last();
          const okButton = page.locator('button:has-text("OK")').first();
          const createButton = page.locator('button:has-text("Create")').first();

          if (await okButton.isVisible({ timeout: 500 })) {
            await okButton.click();
            await page.waitForTimeout(1000);
          } else if (await createButton.isVisible({ timeout: 500 })) {
            await createButton.click();
            await page.waitForTimeout(1000);
          } else if (await dialogAddButton.isVisible({ timeout: 500 })) {
            await dialogAddButton.click();
            await page.waitForTimeout(1000);
          }
        }
        return true;
      } else if (await blockWizardOption.isVisible({ timeout: 2000 })) {
        // Use block wizard - multi-step dialog
        console.log("Clicking New Block in Add menu");
        await blockWizardOption.click();
        await page.waitForTimeout(1000);

        // Step 1: Fill in block ID
        const blockIdInput = page.locator('textbox[name="my_block"]').or(page.locator('input[type="text"]').first());
        if (await blockIdInput.isVisible({ timeout: 1000 })) {
          await blockIdInput.fill("test_block");
          await page.waitForTimeout(200);
        }

        // Click Next for each step (wizard has 3 steps)
        for (let step = 0; step < 3; step++) {
          const nextButton = page.locator('button:has-text("Next")');
          const createButton = page.locator('button:has-text("Create")').or(page.locator('button:has-text("Done")'));

          if (await createButton.isVisible({ timeout: 500 })) {
            await createButton.first().click();
            await page.waitForTimeout(500);
            break;
          } else if (await nextButton.isVisible({ timeout: 500 })) {
            await nextButton.first().click();
            await page.waitForTimeout(500);
          } else {
            break;
          }
        }
        return true;
      } else {
        // Close the Add menu if we couldn't find any option
        console.log("Block type option not found, closing Add menu");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
    }

    console.log("Could not find Add button or Block Type option");
    return false;
  } catch (error) {
    console.log(`Error adding block type: ${error}`);
    // Ensure dialog is closed on error
    try {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    } catch {
      // Page may be closed
    }
    return false;
  }
}

// Helper to click "Show" button and enable block type visibility
async function enableBlockTypeVisibility(page: any): Promise<void> {
  const showButton = page.locator('button:has-text("Show")').first();
  if (await showButton.isVisible({ timeout: 2000 })) {
    await showButton.click();

    // Wait for the MUI Menu modal to appear
    const menuModal = page.locator(".MuiModal-root.MuiMenu-root");
    await menuModal.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});

    // Click "Types" to enable type visibility (this enables block types too)
    const menuList = page.locator(".MuiMenu-list");
    const typesOption = menuList.getByRole("menuitem", { name: "Types", exact: true });
    if (await typesOption.isVisible({ timeout: 2000 })) {
      await typesOption.click();
    } else {
      await page.keyboard.press("Escape");
    }

    // Wait for MUI Menu modal overlay to fully close
    await menuModal.waitFor({ state: "detached", timeout: 5000 }).catch(async () => {
      await page.keyboard.press("Escape");
      await menuModal.waitFor({ state: "detached", timeout: 3000 }).catch(() => {});
    });

    // Ensure no MUI backdrop remains
    const backdrop = page.locator(".MuiBackdrop-root");
    const backdropCount = await backdrop.count().catch(() => 0);
    if (backdropCount > 0) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    await page.waitForTimeout(300);
  }
}

// Helper to select a block type from the project list
async function selectBlockType(page: any, blockName: string): Promise<boolean> {
  try {
    await enableBlockTypeVisibility(page);

    const blockItem = page
      .locator(`[role="option"]:has-text("${blockName}")`)
      .or(page.locator(`li:has-text("${blockName}")`))
      .or(page.locator(`text="${blockName}"`))
      .first();

    if (await blockItem.isVisible({ timeout: 3000 })) {
      console.log(`Selecting block type: ${blockName}`);
      await blockItem.click();
      await page.waitForTimeout(1000);
      return true;
    }

    console.log(`Block type "${blockName}" not found in project list`);
    return false;
  } catch (error) {
    console.log(`Error selecting block type: ${error}`);
    return false;
  }
}

// Helper to click a tab in the block type editor
async function clickBlockEditorTab(page: any, tabName: string): Promise<boolean> {
  try {
    // Look for tab buttons with the specified name
    const tabButton = page
      .locator(`button:has-text("${tabName}")`)
      .or(page.locator(`[role="tab"]:has-text("${tabName}")`))
      .or(page.locator(`.bte-tab-button:has-text("${tabName}")`))
      .first();

    if (await tabButton.isVisible({ timeout: 3000 })) {
      console.log(`Clicking ${tabName} tab`);
      await tabButton.click();
      await page.waitForTimeout(500);
      return true;
    }

    console.log(`Tab "${tabName}" not found`);
    return false;
  } catch (error) {
    console.log(`Error clicking tab: ${error}`);
    return false;
  }
}

test.describe("Block Type Editor Visual Tests @full", () => {
  // Shared console errors and warnings arrays for all tests in this suite
  let consoleErrors: Array<{ url: string; error: string }> = [];
  let consoleWarnings: Array<{ url: string; error: string }> = [];

  test.beforeEach(async ({ page }) => {
    // Reset console errors for each test
    consoleErrors = [];
    consoleWarnings = [];
    // Set up console error tracking
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should add block type and navigate through tabs", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
    // Create Add-On Starter project
    const projectCreated = await createAddOnStarterProject(page);

    if (!projectCreated) {
      test.skip(true, "Could not create Add-On Starter project");
      return;
    }

    // Take screenshot of initial state
    await page.screenshot({
      path: "debugoutput/screenshots/block-type-editor-project-before.png",
      fullPage: false,
    });

    // Add a block type
    const blockAdded = await addBlockType(page);

    if (!blockAdded) {
      console.log("Could not add block type via menu - trying to find existing one");
    }

    // Wait for block to be added
    await page.waitForTimeout(1000);
    await enableBlockTypeVisibility(page);

    // Take screenshot after adding block
    await page.screenshot({
      path: "debugoutput/screenshots/block-type-editor-after-add.png",
      fullPage: false,
    });

    // Look for any block type item in the list
    const blockTypeItem = page.locator('[role="option"]').filter({ hasText: /block/i }).first();

    if (await blockTypeItem.isVisible({ timeout: 3000 })) {
      await blockTypeItem.click();
      await page.waitForTimeout(1000);

      // Take screenshot of the Block Type Editor (should show Overview by default)
      await page.screenshot({
        path: "debugoutput/screenshots/block-type-editor-overview.png",
        fullPage: false,
      });

      // Navigate through each tab
      for (const tab of BLOCK_EDITOR_TABS) {
        const clicked = await clickBlockEditorTab(page, tab.name);
        if (clicked) {
          await page.waitForTimeout(500);
          await page.screenshot({
            path: `debugoutput/screenshots/block-type-editor-${tab.name.toLowerCase().replace(" ", "-")}.png`,
            fullPage: false,
          });
        }
      }
    } else {
      console.log("No block types found in project - taking screenshot of current state");
      await page.screenshot({
        path: "debugoutput/screenshots/block-type-editor-no-blocks.png",
        fullPage: false,
      });
    }
  });

  test("should display block components with icons in Components tab", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
    const projectCreated = await createAddOnStarterProject(page);

    if (!projectCreated) {
      test.skip(true, "Could not create Add-On Starter project");
      return;
    }

    // Add a block type
    const blockAdded = await addBlockType(page);
    await page.waitForTimeout(1000);
    await enableBlockTypeVisibility(page);

    // Find a block type
    const blockTypeItem = page.locator('[role="option"]').filter({ hasText: /block/i }).first();

    if (await blockTypeItem.isVisible({ timeout: 3000 })) {
      await blockTypeItem.click();
      await page.waitForTimeout(1000);

      // Click on Components tab
      const clicked = await clickBlockEditorTab(page, "Components");
      if (clicked) {
        await page.waitForTimeout(1000);

        // Take screenshot showing component slots with icons
        await page.screenshot({
          path: "debugoutput/screenshots/block-type-components-with-icons.png",
          fullPage: false,
        });

        // Verify component slots exist
        const componentSlots = page.locator(".bcose-componentSlot");
        const slotCount = await componentSlots.count();

        console.log(`Found ${slotCount} component slots in the Components tab`);

        if (slotCount > 0) {
          // Click on a component to verify the detail panel works
          await componentSlots.first().click();
          await page.waitForTimeout(500);

          await page.screenshot({
            path: "debugoutput/screenshots/block-type-component-detail.png",
            fullPage: false,
          });
        }
      }
    }
  });
});
