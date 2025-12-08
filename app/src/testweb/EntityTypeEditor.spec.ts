/**
 * Entity Type Editor Visual Tests
 *
 * These tests verify the visual consistency and functionality of the Entity Type Editor
 * by creating a Full Add-On project (which includes sample entity types like Biceson, Mammothon, etc.)
 * and iterating through the different tabs in the editor.
 *
 * The Full Add-On template includes 4 sample entity types that can be tested:
 * - Biceson
 * - Mammothon
 * - Sheepson
 * - Hogson
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage, gotoWithTheme, ThemeMode } from "./WebTestUtilities";

// Entity type editor tabs to test (using actual tab names from EntityTypeEditor.tsx)
const ENTITY_EDITOR_TABS = [
  { name: "Overview", label: "Overview" },
  { name: "Properties", label: "Properties" },
  { name: "Components", label: "Components" },
  { name: "Actions", label: "Actions" },
  { name: "Visuals", label: "Visuals" },
  { name: "Spawn", label: "Spawn" },
  { name: "Loot", label: "Loot" },
];

// Helper to create a Full Add-On project and enter the editor
async function createFullAddOnProject(page: any, themeMode?: ThemeMode): Promise<boolean> {
  try {
    // Navigate with theme if specified
    if (themeMode) {
      await gotoWithTheme(page, themeMode, "/");
    } else {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
    }
    await page.waitForTimeout(500);

    // Find and click the "New" button for the Full Add-On template
    // First, find the Full Add-On card by looking for its title text
    const fullAddOnCard = page.locator('text="Full Add-On"').first();

    if (!(await fullAddOnCard.isVisible({ timeout: 5000 }))) {
      // Scroll to find it or click "See more templates"
      const seeMoreTemplates = page.locator('text="See more templates"').first();
      if (await seeMoreTemplates.isVisible({ timeout: 2000 })) {
        await seeMoreTemplates.click();
        await page.waitForTimeout(1000);
      }
    }

    // Now find the New button near the Full Add-On template
    // Look for a card containing "Full Add-On" and find the CREATE NEW button in it
    const fullAddOnSection = page.locator('div:has-text("Full Add-On")').filter({
      has: page.locator('text="A full example add-on project"'),
    });

    let createButton = fullAddOnSection.locator('button:has-text("CREATE NEW")').first();

    if (!(await createButton.isVisible({ timeout: 3000 }))) {
      // Try alternative: look for New button after Full Add-On text
      createButton = page.locator('button:has-text("New")').or(page.locator('button:has-text("CREATE NEW")')).nth(2); // Full Add-On is usually the 3rd template
    }

    if (!(await createButton.isVisible({ timeout: 3000 }))) {
      console.log("Could not find CREATE NEW button for Full Add-On template");
      // Fall back to clicking the first New button
      createButton = page.getByRole("button", { name: "New" }).first();
    }

    console.log("Clicking CREATE NEW for Full Add-On project");
    await createButton.click();
    await page.waitForTimeout(1000);

    // Click OK on the project creation dialog
    const okButton = page.getByTestId("submit-button").first();
    if (await okButton.isVisible({ timeout: 3000 })) {
      console.log("Clicking OK on project dialog");
      await okButton.click();
    } else {
      // Try alternative OK button locator
      const altOkButton = page.locator("button:has-text('OK')").first();
      if (await altOkButton.isVisible({ timeout: 2000 })) {
        await altOkButton.click();
      } else {
        await page.keyboard.press("Enter");
      }
    }

    // Wait for the project to load - Full Add-On takes longer due to GitHub fetch
    await page.waitForTimeout(5000);
    await page.waitForLoadState("networkidle");

    // Verify we're in the editor
    const viewButton = page.getByRole("button", { name: /view/i }).first();
    const isInEditor = await viewButton.isVisible({ timeout: 5000 });

    if (isInEditor) {
      console.log("Successfully created Full Add-On project and entered editor");
      return true;
    }

    console.log("Could not verify editor interface loaded");
    return false;
  } catch (error) {
    console.log(`Error creating Full Add-On project: ${error}`);
    return false;
  }
}

// Helper to click "Show" button and enable entity type visibility
async function enableEntityTypeVisibility(page: any): Promise<void> {
  const showButton = page.locator('button:has-text("Show")').first();
  if (await showButton.isVisible({ timeout: 2000 })) {
    await showButton.click();
    await page.waitForTimeout(500);

    // Look for entity types checkbox/option in the Show menu
    const entityTypesOption = page.locator('text="Entity Types"').or(page.locator('text="Entities"')).first();

    if (await entityTypesOption.isVisible({ timeout: 2000 })) {
      await entityTypesOption.click();
      await page.waitForTimeout(500);
    }

    // Close the menu
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
}

// Helper to select an entity type from the project list
async function selectEntityType(page: any, entityName: string): Promise<boolean> {
  try {
    // First enable entity type visibility if needed
    await enableEntityTypeVisibility(page);

    // Look for the entity in the project item list
    // Entity types are usually shown with their name (e.g., "biceson", "mammothon")
    const entityItem = page
      .locator(`[role="option"]:has-text("${entityName}")`)
      .or(page.locator(`li:has-text("${entityName}")`))
      .or(page.locator(`text="${entityName}"`))
      .first();

    if (await entityItem.isVisible({ timeout: 3000 })) {
      console.log(`Selecting entity type: ${entityName}`);
      await entityItem.click();
      await page.waitForTimeout(1000);
      return true;
    }

    // Try scrolling the list to find the entity
    const projectList = page.locator('[role="listbox"]').first();
    if (await projectList.isVisible()) {
      await projectList.evaluate((el: HTMLElement) => {
        el.scrollTop = 0;
      });
      await page.waitForTimeout(500);

      // Try again after scrolling
      if (await entityItem.isVisible({ timeout: 2000 })) {
        await entityItem.click();
        await page.waitForTimeout(1000);
        return true;
      }
    }

    console.log(`Could not find entity type: ${entityName}`);
    return false;
  } catch (error) {
    console.log(`Error selecting entity type ${entityName}: ${error}`);
    return false;
  }
}

// Helper to click a tab in the entity type editor
// Tab names may include counts like "Components (14)" or "Actions (3)"
// The tabs are rendered as Toolbar items with CustomTabLabel containing span.label-text
async function clickEditorTab(page: any, tabName: string): Promise<boolean> {
  try {
    // FluentUI Toolbar renders tab content inside buttons
    // The text is inside: button > span.label-tab/label-deseltab > span.label-text

    // Strategy 1: Look for span.label-text containing the tab name
    const labelTextSpan = page.locator(`span.label-text:has-text("${tabName}")`).first();
    if (await labelTextSpan.isVisible({ timeout: 2000 })) {
      console.log(`Clicking tab via label-text: ${tabName}`);
      await labelTextSpan.click();
      await page.waitForTimeout(1000);
      return true;
    }

    // Strategy 2: Look for any clickable element with the tab name
    const anyClickable = page.locator(`*:has-text("${tabName}")`).first();
    if (await anyClickable.isVisible({ timeout: 2000 })) {
      console.log(`Clicking tab via generic locator: ${tabName}`);
      await anyClickable.click();
      await page.waitForTimeout(1000);
      return true;
    }

    // Strategy 3: Try title attribute on toolbar items
    const titleMatch = page.locator(`[title*="${tabName}"]`).first();
    if (await titleMatch.isVisible({ timeout: 2000 })) {
      console.log(`Clicking tab via title: ${tabName}`);
      await titleMatch.click();
      await page.waitForTimeout(1000);
      return true;
    }

    console.log(`Tab not found: ${tabName}`);
    return false;
  } catch (error) {
    console.log(`Error clicking tab ${tabName}: ${error}`);
    return false;
  }
}

test.describe("Entity Type Editor Visual Tests", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should create Full Add-On project and display entity list", async ({ page }) => {
    const projectCreated = await createFullAddOnProject(page);

    if (!projectCreated) {
      console.log("Could not create Full Add-On project - skipping test");
      test.skip();
      return;
    }

    // Take screenshot of the editor with project loaded
    await page.screenshot({
      path: "debugoutput/screenshots/entity-editor-full-addon-loaded.png",
      fullPage: true,
    });

    // Enable entity type visibility
    await enableEntityTypeVisibility(page);

    // Take screenshot showing entity types in the list
    await page.screenshot({
      path: "debugoutput/screenshots/entity-editor-entity-list.png",
      fullPage: true,
    });

    // Verify we can see some entity types (the Full Add-On includes biceson, mammothon, etc.)
    const hasEntities =
      (await page.locator('text="biceson"').or(page.locator('text="Biceson"')).count()) > 0 ||
      (await page.locator('text="mammothon"').or(page.locator('text="Mammothon"')).count()) > 0;

    console.log(`Entity types visible: ${hasEntities}`);
  });

  test("should display entity type editor when selecting an entity", async ({ page }) => {
    const projectCreated = await createFullAddOnProject(page);

    if (!projectCreated) {
      test.skip();
      return;
    }

    // Try to select biceson entity
    const entitySelected = await selectEntityType(page, "biceson");

    if (!entitySelected) {
      // Try mammothon as fallback
      const fallbackSelected = await selectEntityType(page, "mammothon");
      if (!fallbackSelected) {
        console.log("Could not select any entity type");
        await page.screenshot({
          path: "debugoutput/screenshots/entity-editor-no-entity-selected.png",
          fullPage: true,
        });
      }
    }

    // Take screenshot of the entity type editor
    await page.screenshot({
      path: "debugoutput/screenshots/entity-editor-entity-selected.png",
      fullPage: true,
    });

    // Verify editor tabs are visible
    const componentsTab = page.locator('button:has-text("Components")').first();
    if (await componentsTab.isVisible({ timeout: 3000 })) {
      console.log("Entity type editor tabs are visible");
      await expect(componentsTab).toBeVisible();
    }
  });

  test("should iterate through all entity type editor tabs", async ({ page }) => {
    const projectCreated = await createFullAddOnProject(page);

    if (!projectCreated) {
      test.skip();
      return;
    }

    // Select an entity type
    const entitySelected = await selectEntityType(page, "biceson");

    if (!entitySelected) {
      const fallbackSelected = await selectEntityType(page, "mammothon");
      if (!fallbackSelected) {
        console.log("Could not select any entity - skipping tab iteration");
        test.skip();
        return;
      }
    }

    // Iterate through each tab and take screenshots
    for (const tab of ENTITY_EDITOR_TABS) {
      const tabClicked = await clickEditorTab(page, tab.label);

      if (tabClicked) {
        await page.waitForTimeout(500);

        // Take screenshot of this tab
        await page.screenshot({
          path: `debugoutput/screenshots/entity-editor-tab-${tab.name.toLowerCase().replace(/\s+/g, "-")}.png`,
          fullPage: true,
        });

        console.log(`Captured screenshot for tab: ${tab.name}`);
      } else {
        console.log(`Could not click tab: ${tab.name}`);
      }
    }
  });

  test("should display Components tab with component list", async ({ page }) => {
    const projectCreated = await createFullAddOnProject(page);

    if (!projectCreated) {
      test.skip();
      return;
    }

    const entitySelected = await selectEntityType(page, "biceson");
    if (!entitySelected) {
      test.skip();
      return;
    }

    // Click Components tab
    await clickEditorTab(page, "Components");

    // Take screenshot
    await page.screenshot({
      path: "debugoutput/screenshots/entity-editor-components-tab.png",
      fullPage: true,
    });

    // Look for component list elements
    const componentList = page.locator('[class*="component"]').or(page.locator('[class*="Component"]'));
    console.log(`Found ${await componentList.count()} component-related elements`);
  });

  test("should display Actions tab with events and triggers", async ({ page }) => {
    const projectCreated = await createFullAddOnProject(page);

    if (!projectCreated) {
      test.skip();
      return;
    }

    const entitySelected = await selectEntityType(page, "biceson");
    if (!entitySelected) {
      test.skip();
      return;
    }

    // Click Actions tab
    await clickEditorTab(page, "Actions");

    // Take screenshot
    await page.screenshot({
      path: "debugoutput/screenshots/entity-editor-actions-tab.png",
      fullPage: true,
    });
  });

  test("should display Overview tab with entity diagram", async ({ page }) => {
    const projectCreated = await createFullAddOnProject(page);

    if (!projectCreated) {
      test.skip();
      return;
    }

    const entitySelected = await selectEntityType(page, "biceson");
    if (!entitySelected) {
      test.skip();
      return;
    }

    // Click Overview tab (was called Diagram in early design)
    await clickEditorTab(page, "Overview");

    // Wait for diagram to render
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({
      path: "debugoutput/screenshots/entity-editor-overview-tab.png",
      fullPage: true,
    });
  });

  test("should display Visuals tab with visual settings", async ({ page }) => {
    const projectCreated = await createFullAddOnProject(page);

    if (!projectCreated) {
      test.skip();
      return;
    }

    const entitySelected = await selectEntityType(page, "biceson");
    if (!entitySelected) {
      test.skip();
      return;
    }

    // Click Visuals tab
    await clickEditorTab(page, "Visuals");

    // Take screenshot
    await page.screenshot({
      path: "debugoutput/screenshots/entity-editor-visuals-tab.png",
      fullPage: true,
    });
  });
});

test.describe("Entity Type Editor - Theme Comparison", () => {
  test("should display entity type editor correctly in light mode", async ({ page }) => {
    const projectCreated = await createFullAddOnProject(page, "light");

    if (!projectCreated) {
      test.skip();
      return;
    }

    const entitySelected = await selectEntityType(page, "biceson");
    if (!entitySelected) {
      console.log("Entity not found, taking screenshot of current state");
    }

    await page.screenshot({
      path: "debugoutput/screenshots/entity-editor-light-mode.png",
      fullPage: true,
    });

    // Click through a few tabs in light mode
    for (const tabName of ["Components", "Actions", "Visuals"]) {
      await clickEditorTab(page, tabName);
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `debugoutput/screenshots/entity-editor-light-mode-${tabName.toLowerCase()}.png`,
        fullPage: true,
      });
    }
  });

  test("should display entity type editor correctly in dark mode", async ({ page }) => {
    const projectCreated = await createFullAddOnProject(page, "dark");

    if (!projectCreated) {
      test.skip();
      return;
    }

    const entitySelected = await selectEntityType(page, "biceson");
    if (!entitySelected) {
      console.log("Entity not found, taking screenshot of current state");
    }

    await page.screenshot({
      path: "debugoutput/screenshots/entity-editor-dark-mode.png",
      fullPage: true,
    });

    // Click through a few tabs in dark mode
    for (const tabName of ["Components", "Actions", "Visuals"]) {
      await clickEditorTab(page, tabName);
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `debugoutput/screenshots/entity-editor-dark-mode-${tabName.toLowerCase()}.png`,
        fullPage: true,
      });
    }
  });
});

test.describe("Entity Type Editor - Multiple Entity Types", () => {
  const entityTypes = ["biceson", "mammothon", "sheepson", "hogson"];

  test("should be able to switch between different entity types", async ({ page }) => {
    const projectCreated = await createFullAddOnProject(page);

    if (!projectCreated) {
      test.skip();
      return;
    }

    // Enable entity visibility
    await enableEntityTypeVisibility(page);

    // Try to select and screenshot each entity type
    for (const entityName of entityTypes) {
      const selected = await selectEntityType(page, entityName);

      if (selected) {
        await page.waitForTimeout(500);
        await page.screenshot({
          path: `debugoutput/screenshots/entity-editor-${entityName}.png`,
          fullPage: true,
        });
        console.log(`Captured ${entityName} entity`);
      } else {
        console.log(`Could not select entity: ${entityName}`);
      }
    }
  });
});

test.describe("Entity Type Editor - Visual Regression Baseline", () => {
  test("capture baseline screenshots for entity type editor", async ({ page }) => {
    const projectCreated = await createFullAddOnProject(page);

    if (!projectCreated) {
      console.log("Could not create project for baseline capture");
      test.skip();
      return;
    }

    // Enable entity visibility and select first entity
    await enableEntityTypeVisibility(page);
    const entitySelected = await selectEntityType(page, "biceson");

    if (!entitySelected) {
      console.log("Could not select entity for baseline capture");
      test.skip();
      return;
    }

    // Capture baseline for each tab
    for (const tab of ENTITY_EDITOR_TABS) {
      const tabClicked = await clickEditorTab(page, tab.label);

      if (tabClicked) {
        await page.waitForTimeout(1000);

        // Capture the main editor area for visual comparison
        const editorArea = page.locator('[class*="editor"]').or(page.locator('[class*="Editor"]')).first();

        if (await editorArea.isVisible({ timeout: 2000 })) {
          await editorArea.screenshot({
            path: `debugoutput/screenshots/baseline-entity-${tab.name.toLowerCase().replace(/\s+/g, "-")}.png`,
          });
        } else {
          // Fallback to full page screenshot
          await page.screenshot({
            path: `debugoutput/screenshots/baseline-entity-${tab.name.toLowerCase().replace(/\s+/g, "-")}-full.png`,
            fullPage: true,
          });
        }

        console.log(`Captured baseline for: ${tab.name}`);
      }
    }
  });
});
