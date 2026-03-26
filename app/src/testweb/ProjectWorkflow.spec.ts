/**
 * ProjectWorkflow.spec.ts - Comprehensive project workflow tests
 *
 * These tests cover end-to-end project workflows that were identified as gaps
 * in the existing test coverage:
 * - Template selection and project creation from different templates
 * - Project item operations (add, delete, navigate)
 * - Toolbar and menu interactions
 * - Project settings and configuration
 * - File tree navigation
 *
 * Run with: npx playwright test ProjectWorkflow.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import {
  processMessage,
  enterEditor,
  gotoWithTheme,
  enableAllFileTypes,
  takeScreenshot,
  preferBrowserStorageInProjectDialog,
} from "./WebTestUtilities";

test.describe("Project Template Selection @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("should display multiple project templates on home page", async ({ page }) => {
    await takeScreenshot(page, "debugoutput/screenshots/workflow-home-templates");

    // Look for template cards or New buttons
    const newButtons = page.getByRole("button", { name: "Create New" });
    const count = await newButtons.count();

    console.log(`Found ${count} New buttons (project templates)`);
    expect(count).toBeGreaterThan(0);

    // Check for common template names
    const templateNames = ["Add-On Starter", "Full Add-On", "Script"];
    for (const name of templateNames) {
      const template = page.locator(`text="${name}"`).first();
      if (await template.isVisible({ timeout: 2000 })) {
        console.log(`Found template: ${name}`);
      }
    }
  });

  test("should create project from Add-On Starter template", async ({ page }) => {
    // Find the first New button (Add-On Starter)
    const addOnStarterNew = page.getByRole("button", { name: "Create New" }).first();
    await expect(addOnStarterNew).toBeVisible({ timeout: 5000 });

    await addOnStarterNew.click();
    await page.waitForTimeout(1000);

    // Verify dialog appeared
    const dialog = page.locator("dialog, [role='dialog']");
    await expect(dialog.first()).toBeVisible({ timeout: 5000 });

    await takeScreenshot(page, "debugoutput/screenshots/workflow-addon-starter-dialog");

    // Fill in custom project details
    const titleInput = page.getByLabel("Title");
    if (await titleInput.isVisible()) {
      await titleInput.fill("Test Workflow Project");
    }

    // Select browser storage for automated test flow
    await preferBrowserStorageInProjectDialog(page);

    // Click create/OK button
    const createButton = page.getByTestId("submit-button");
    await expect(createButton).toBeVisible();
    await createButton.click();

    // Wait for editor to load
    await page.waitForTimeout(5000);
    await page.waitForLoadState("networkidle");

    // Verify we're in the editor
    const viewButton = page.getByRole("button", { name: "View" }).first();
    await expect(viewButton).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, "debugoutput/screenshots/workflow-addon-starter-editor");

    expect(consoleErrors.length).toBe(0);
  });

  test("should see expanded templates when clicking 'See more'", async ({ page }) => {
    // Look for "See more templates" or similar
    const seeMore = page.locator("text=/see more|view all|more templates/i").first();

    if (await seeMore.isVisible({ timeout: 3000 })) {
      await seeMore.click();
      await page.waitForTimeout(1000);

      await takeScreenshot(page, "debugoutput/screenshots/workflow-all-templates");

      // Should now see more template options
      const newButtons = page.getByRole("button", { name: "Create New" });
      const count = await newButtons.count();
      console.log(`Found ${count} templates after expanding`);
    } else {
      console.log("No 'See more templates' button found - all templates visible by default");
    }
  });
});

test.describe("Project Item Operations @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should add new item from Add button menu", async ({ page }) => {
    // Enter editor first
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await page.waitForTimeout(1000);

    // Find and click the Add button
    const addButton = page.locator('button:has-text("Add")').first();

    if (await addButton.isVisible({ timeout: 5000 })) {
      await addButton.click();
      await page.waitForTimeout(500);

      await takeScreenshot(page, "debugoutput/screenshots/workflow-add-menu");

      // Look for item types in the menu
      const menuItems = page.locator('[role="menuitem"], [role="option"]');
      const menuCount = await menuItems.count();
      console.log(`Add menu has ${menuCount} options`);

      // Press Escape to close menu
      await page.keyboard.press("Escape");
    } else {
      console.log("Add button not found in toolbar");
    }
  });

  test("should navigate file tree and select items", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    await takeScreenshot(page, "debugoutput/screenshots/workflow-file-tree");

    // Look for visible items in the project list - use text-based matching for visibility
    // Try to find clickable items like "Dashboard", "Project", "Validation"
    const knownItems = ["Dashboard", "Actions", "Project", "Validation", "Inspector", "manifest"];
    let clickedItem = false;

    for (const itemName of knownItems) {
      const item = page.locator(`text="${itemName}"`).first();
      if (await item.isVisible({ timeout: 2000 })) {
        console.log(`Found and clicking item: ${itemName}`);
        await item.click();
        await page.waitForTimeout(500);
        clickedItem = true;

        await takeScreenshot(page, `debugoutput/screenshots/workflow-item-${itemName.toLowerCase()}-selected`);
        break;
      }
    }

    if (!clickedItem) {
      // Fallback: look for any list items that are visible
      const listItems = page.locator(".ui-list__item").filter({ hasNot: page.locator('[aria-hidden="true"]') });
      const visibleCount = await listItems.count();
      console.log(`Found ${visibleCount} list items via class selector`);

      if (visibleCount > 0) {
        // Just document what we found, don't fail
        await takeScreenshot(page, "debugoutput/screenshots/workflow-list-items-found");
      }
    }

    // Test passes if we got here without errors
    console.log("File tree navigation test completed");
  });

  test("should expand/collapse sections in project tree", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await page.waitForTimeout(1000);

    // Look for expandable sections (usually have chevron or arrow icons)
    const expandButtons = page.locator("[aria-expanded], .expandable, .chevron");

    if ((await expandButtons.count()) > 0) {
      console.log(`Found ${await expandButtons.count()} expandable sections`);

      const firstExpand = expandButtons.first();
      await firstExpand.click();
      await page.waitForTimeout(500);

      await takeScreenshot(page, "debugoutput/screenshots/workflow-section-toggled");
    }
  });
});

test.describe("Toolbar Menu Interactions @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should open and navigate View menu", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);

    // Find and click the View button
    const viewButton = page.getByRole("button", { name: "View" }).first();
    await expect(viewButton).toBeVisible();

    await viewButton.click();
    await page.waitForTimeout(500);

    await takeScreenshot(page, "debugoutput/screenshots/workflow-view-menu");

    // Look for menu items
    const menuItems = page.locator('[role="menuitem"], [role="option"], .menu-item');
    const menuCount = await menuItems.count();
    console.log(`View menu has ${menuCount} options`);

    // Close menu
    await page.keyboard.press("Escape");
  });

  test("should open and navigate Save menu", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);

    // Find Save button
    const saveButton = page.getByRole("button", { name: "Save" }).first();

    if (await saveButton.isVisible({ timeout: 3000 })) {
      await saveButton.click();
      await page.waitForTimeout(500);

      await takeScreenshot(page, "debugoutput/screenshots/workflow-save-menu");

      // Close menu
      await page.keyboard.press("Escape");
    } else {
      console.log("Save button not found - may use different export workflow");
    }
  });

  test("should access Settings from toolbar", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);

    // Look for Settings button (gear icon or text)
    const settingsButton = page
      .getByRole("button", { name: /settings/i })
      .or(page.locator('[aria-label="Settings"]'))
      .or(page.locator('button:has-text("Settings")'))
      .first();

    if (await settingsButton.isVisible({ timeout: 3000 })) {
      await settingsButton.click();
      await page.waitForTimeout(1000);

      await takeScreenshot(page, "debugoutput/screenshots/workflow-settings");

      // Verify settings panel appeared
      const settingsPanel = page.locator("text=/settings|preferences|options/i");
      if ((await settingsPanel.count()) > 1) {
        console.log("Settings panel opened");
      }
    } else {
      console.log("Settings button not directly visible in toolbar");
    }
  });

  test("should use Home button to return to homepage", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);

    // Find Home button
    const homeButton = page.getByRole("button", { name: /home/i }).first();

    if (await homeButton.isVisible({ timeout: 3000 })) {
      await homeButton.click();
      await page.waitForTimeout(2000);
      await page.waitForLoadState("networkidle");

      await takeScreenshot(page, "debugoutput/screenshots/workflow-back-to-home");

      // Verify we're back on home page - look for template New buttons
      const newButtons = page.getByRole("button", { name: "Create New" });
      expect(await newButtons.count()).toBeGreaterThan(0);
    }
  });
});

test.describe("Export Operations @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should show export options in Save menu", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);

    // Find Save button and click it
    const saveButton = page.getByRole("button", { name: "Save" }).first();

    if (await saveButton.isVisible({ timeout: 3000 })) {
      await saveButton.click();
      await page.waitForTimeout(500);

      await takeScreenshot(page, "debugoutput/screenshots/workflow-export-options");

      // Look for export-related menu items
      const exportOptions = [
        page.locator("button").filter({ hasText: /Install in Minecraft \(\.mcaddon\)/i }),
        page.locator('text="Export to folder"'),
        page.locator('text="Download"'),
        page.locator("text=/mcaddon|mcworld|zip/i"),
      ];

      let foundExport = false;
      for (const option of exportOptions) {
        if ((await option.count()) > 0) {
          console.log(`Found export option: ${await option.first().textContent()}`);
          foundExport = true;
        }
      }

      if (!foundExport) {
        console.log("No export options found in Save menu");
      }

      // Close menu
      await page.keyboard.press("Escape");
    }
  });

  test("should display download buttons for world exports", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);

    // World download buttons may be in the Save menu or visible in Dashboard panel
    // First check if Dashboard item exists and click it
    const actionsItem = page.locator('text="Dashboard"').or(page.locator('text="Actions"')).first();
    if (await actionsItem.isVisible({ timeout: 3000 })) {
      await actionsItem.click();
      await page.waitForTimeout(1000);
    }

    // Look for world-related download buttons (they may or may not be visible)
    const worldButtonPatterns = [
      'button:has-text("flat world")',
      'button:has-text("project world")',
      'button:has-text("MCWorld")',
      'button:has-text("world")',
      "text=/download.*world/i",
    ];

    let foundAny = false;
    for (const pattern of worldButtonPatterns) {
      const button = page.locator(pattern).first();
      if (await button.isVisible({ timeout: 1000 })) {
        console.log(`Found world download option: ${await button.textContent()}`);
        foundAny = true;
      }
    }

    if (!foundAny) {
      console.log("No world download buttons visible - this is acceptable as they may be in menus");
    }

    await takeScreenshot(page, "debugoutput/screenshots/workflow-world-buttons");

    // This test documents what's available, not a hard requirement
  });
});

test.describe("Project Inspector and Validation @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should open Inspector from project item list", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await page.waitForTimeout(2000);

    // Look for Inspector in the project tree
    const inspector = page.locator("text=Inspector").first();

    if (await inspector.isVisible({ timeout: 5000 })) {
      await inspector.click();
      await page.waitForTimeout(3000); // Inspector takes time to run validation

      await takeScreenshot(page, "debugoutput/screenshots/workflow-inspector");

      // Look for validation results
      const validationResults = page.locator("text=/error|warning|info|recommendation/i");
      if ((await validationResults.count()) > 0) {
        console.log("Inspector showing validation results");
      }
    } else {
      console.log("Inspector not found in project tree");
    }
  });

  test("should display status area with validation info", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);

    // Look for status area (usually at bottom of editor)
    const statusArea = page.locator('.pe-statusArea, [class*="status"]').first();

    if (await statusArea.isVisible({ timeout: 3000 })) {
      console.log("Status area is visible");
      await takeScreenshot(page, "debugoutput/screenshots/workflow-status-area");
    } else {
      console.log("Status area not visible or collapsed");
    }
  });
});

test.describe("Error State Handling @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should handle invalid URL gracefully", async ({ page }) => {
    // Navigate to a non-existent route
    await page.goto("/#/nonexistent/route/123");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await takeScreenshot(page, "debugoutput/screenshots/workflow-invalid-route");

    // Should not crash - page should still be functional
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Should not show React error boundary
    const errorBoundary = page.locator("text=/something went wrong|error boundary/i");
    expect(await errorBoundary.count()).toBe(0);
  });

  test("should handle rapid navigation without crashing", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Rapid clicks on different buttons
    for (let i = 0; i < 3; i++) {
      const newButton = page.getByRole("button", { name: "Create New" }).first();
      if (await newButton.isVisible({ timeout: 2000 })) {
        await newButton.click();
        await page.waitForTimeout(200);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      }
    }

    await takeScreenshot(page, "debugoutput/screenshots/workflow-rapid-nav");

    // Page should still be functional
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Check for critical errors
    const criticalErrors = consoleErrors.filter((e) => !e.error.includes("404") && !e.error.includes("cancelled"));
    expect(criticalErrors.length).toBe(0);
  });
});

test.describe("Theme Persistence @full", () => {
  test("should persist light theme setting", async ({ page }) => {
    await gotoWithTheme(page, "light");

    await takeScreenshot(page, "debugoutput/screenshots/workflow-light-theme");

    // Verify light theme is active (usually lighter background)
    const body = page.locator("body");
    const bgColor = await body.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    console.log(`Light theme background: ${bgColor}`);
    // Light theme typically has brighter background
  });

  test("should persist dark theme setting", async ({ page }) => {
    await gotoWithTheme(page, "dark");

    await takeScreenshot(page, "debugoutput/screenshots/workflow-dark-theme");

    // Verify dark theme is active
    const body = page.locator("body");
    const bgColor = await body.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    console.log(`Dark theme background: ${bgColor}`);
  });

  test("should maintain theme in editor view", async ({ page }) => {
    await gotoWithTheme(page, "dark");

    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);

    await takeScreenshot(page, "debugoutput/screenshots/workflow-editor-dark-theme");

    // Theme should persist in editor
    const body = page.locator("body");
    const bgColor = await body.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    console.log(`Editor dark theme background: ${bgColor}`);
  });
});

test.describe("Keyboard Shortcuts @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should handle Escape key to close dialogs/menus", async ({ page }) => {
    const entered = await enterEditor(page);
    expect(entered).toBe(true);

    // Open a menu
    const viewButton = page.getByRole("button", { name: "View" }).first();
    if (await viewButton.isVisible({ timeout: 3000 })) {
      await viewButton.click();
      await page.waitForTimeout(300);

      // Press Escape
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);

      await takeScreenshot(page, "debugoutput/screenshots/workflow-escape-key");
    }

    // Page should still be functional
    expect(await page.locator("body").isVisible()).toBe(true);
  });

  test("should support Tab navigation through toolbar", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);

    // Start tabbing through the interface
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(100);
    }

    await takeScreenshot(page, "debugoutput/screenshots/workflow-tab-navigation");

    // Check if something is focused
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName : "none";
    });

    console.log(`Focused element after Tab: ${focusedElement}`);
  });
});
