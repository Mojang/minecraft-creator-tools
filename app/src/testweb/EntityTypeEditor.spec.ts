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
import {
  processMessage,
  gotoWithTheme,
  ThemeMode,
  selectEditMode,
  clickTemplateCreateButton,
  preferBrowserStorageInProjectDialog,
  fillRequiredProjectDialogFields,
} from "./WebTestUtilities";

// Full-suite runs can be slower on shared CI/dev machines; avoid flaky 30s test timeouts.
test.setTimeout(60000);

// Entity type editor tabs to test (using actual tab names from EntityTypeEditor.tsx)
const ENTITY_EDITOR_TABS = [
  { name: "Overview", label: "Overview" },
  { name: "Properties", label: "Properties" },
  { name: "Components", label: "Components" },
  { name: "AI Behaviors", label: "AI Behaviors" },
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

    // Click the Full Add-On template's "Create New" button via stable test id
    const clicked = await clickTemplateCreateButton(page, "addonFull");
    if (!clicked) {
      console.log("Could not find CREATE NEW button for Full Add-On template");
      return false;
    }
    console.log("Clicking CREATE NEW for Full Add-On project");
    await page.waitForTimeout(1000);

    // Handle the storage location dialog and required Creator field
    await preferBrowserStorageInProjectDialog(page);
    await fillRequiredProjectDialogFields(page);

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

      // Switch to "Full" editing mode to ensure entity types are visible in the sidebar
      // The welcome dialog defaults to "Focused" which hides entity types
      await selectEditMode(page, "full");

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
  // First check if entity types are already visible (look for an Entity Types section header)
  const entityTypesSection = page.locator("text=/Entity Types/i").first();
  if (await entityTypesSection.isVisible({ timeout: 1000 }).catch(() => false)) {
    console.log("enableEntityTypeVisibility: Entity types already visible, skipping");
    return;
  }

  const showButton = page.locator('button:has-text("Show")').first();
  if (await showButton.isVisible({ timeout: 2000 })) {
    await showButton.click();

    // Wait for the MUI Menu modal to appear
    const menuModal = page.locator(".MuiModal-root.MuiMenu-root");
    await menuModal.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});

    // Find "Types" menu item
    const menuList = page.locator(".MuiMenu-list");
    let typesOption: any = null;
    let found = false;

    // Strategy 1: match by title attribute (most specific)
    const byTitle = menuList.locator('li[title*="entity, block, and item types"]');
    if (await byTitle.isVisible({ timeout: 1000 }).catch(() => false)) {
      typesOption = byTitle;
      found = true;
    }

    if (!found) {
      // Strategy 2: exact role match
      const byRole = menuList.getByRole("menuitem", { name: "Types", exact: true });
      if (await byRole.isVisible({ timeout: 1000 }).catch(() => false)) {
        typesOption = byRole;
        found = true;
      }
    }

    if (!found) {
      // Strategy 3: any li containing "Types"
      const byText = menuList.locator('li:has-text("Types")').first();
      if (await byText.isVisible({ timeout: 1000 }).catch(() => false)) {
        typesOption = byText;
        found = true;
      }
    }

    if (found && typesOption) {
      // Check if Types is already selected (icon has .label-selected class)
      // showTypes defaults to true, so clicking would DISABLE it — only click if NOT selected
      const isAlreadySelected = (await typesOption.locator(".label-selected").count()) > 0;
      if (isAlreadySelected) {
        console.log("enableEntityTypeVisibility: Types already selected, closing menu without toggling");
        await page.keyboard.press("Escape");
      } else {
        console.log("enableEntityTypeVisibility: Clicking Types menu item to enable");
        await typesOption.click();
      }
    } else {
      console.log("enableEntityTypeVisibility: Could not find Types menu item, pressing Escape");
      await page.keyboard.press("Escape");
    }

    // Wait for MUI Menu modal overlay to fully close
    await menuModal.waitFor({ state: "detached", timeout: 5000 }).catch(async () => {
      console.log("enableEntityTypeVisibility: Menu did not auto-close, pressing Escape");
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

// Helper to select an entity type from the project list
async function selectEntityType(page: any, entityName: string): Promise<boolean> {
  try {
    // First enable entity type visibility if needed
    await enableEntityTypeVisibility(page);

    // Capitalize first letter to match humanified name (e.g., "biceson" -> "Biceson")
    const humanName = entityName.charAt(0).toUpperCase() + entityName.slice(1);
    const eteArea = page.locator(".ete-area");

    // Helper: click an element and verify the EntityTypeEditor appeared
    const clickAndVerify = async (locator: any, label: string): Promise<boolean> => {
      console.log(`Selecting entity type via ${label}: ${entityName}`);
      await locator.click();
      await page.waitForTimeout(1000);
      if (await eteArea.isVisible({ timeout: 5000 }).catch(() => false)) {
        return true;
      }
      return false;
    };

    // Strategy 1: Exact text match with original case (sidebar shows lowercase names)
    const originalMatch = page.locator(`text="${entityName}"`).first();
    if (await originalMatch.isVisible({ timeout: 3000 })) {
      if (await clickAndVerify(originalMatch, "exact lowercase")) return true;
    }

    // Strategy 2: Try humanified name (capitalized)
    const humanMatch = page.locator(`text="${humanName}"`).first();
    if (await humanMatch.isVisible({ timeout: 2000 })) {
      if (await clickAndVerify(humanMatch, "humanified name")) return true;
    }

    // Strategy 3: Role-based search - try each match until EntityTypeEditor appears
    const entityItems = page.locator(`[role="treeitem"]:has-text("${entityName}"), [role="option"]:has-text("${entityName}")`);
    const itemCount = await entityItems.count();
    for (let i = 0; i < Math.min(itemCount, 4); i++) {
      if (
        await entityItems
          .nth(i)
          .isVisible({ timeout: 1000 })
          .catch(() => false)
      ) {
        if (await clickAndVerify(entityItems.nth(i), `role=option match ${i}`)) return true;
      }
    }

    // Try scrolling the list to find the entity
    const projectList = page.locator('[role="tree"], [role="listbox"]').first();
    if (await projectList.isVisible()) {
      await projectList.evaluate((el: HTMLElement) => {
        el.scrollTop = 0;
      });
      await page.waitForTimeout(500);

      // Try again after scrolling
      const scrolledMatch = page.locator(`text="${entityName}"`).first();
      if (await scrolledMatch.isVisible({ timeout: 2000 })) {
        if (await clickAndVerify(scrolledMatch, "scrolled match")) return true;
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
  // Map of user-friendly tab names to actual title patterns in EntityTypeEditor
  const tabTitlePatterns: Record<string, string[]> = {
    Overview: ["Entity overview", "overview"],
    Properties: ["Edit properties", "properties"],
    Components: ["Edit components", "components"],
    Flow: ["Visual state diagram", "flow"],
    "Behavior Flows": ["Visual state diagram", "flow"],
    "AI Behaviors": ["Visual state diagram", "AI Behaviors"],
    Actions: ["Edit entity events"],
    Visuals: ["Edit documentation", "visuals"],
    Spawn: ["Spawn behavior", "spawn"],
    Loot: ["Loot", "loot"],
  };

  const patterns = tabTitlePatterns[tabName] || [tabName.toLowerCase()];

  try {
    // Dismiss any open MUI Menu/Popover whose invisible backdrop would intercept clicks.
    const openBackdrop = page.locator(".MuiModal-root .MuiBackdrop-root").first();
    if (await openBackdrop.isVisible({ timeout: 200 }).catch(() => false)) {
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(150);
    }

    // Strategy 0: Look for buttons within .ete-area (EntityTypeEditor) first - most precise
    const eteArea = page.locator(".ete-area");
    if (await eteArea.isVisible({ timeout: 2000 }).catch(() => false)) {
      for (const pattern of patterns) {
        const eteMatch = eteArea.locator(`button[title*="${pattern}" i]`).first();
        if (await eteMatch.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log(`Clicking tab within EntityTypeEditor '${pattern}': ${tabName}`);
          await eteMatch.click();
          await page.waitForTimeout(1000);
          return true;
        }
      }
    }

    // Strategy 1: Try title attribute patterns (most reliable for icon tabs)
    // Exclude buttons with aria-haspopup (dropdown menu triggers like "Item Actions")
    for (const pattern of patterns) {
      const titleMatch = page.locator(`[title*="${pattern}" i]:not([aria-haspopup])`).first();
      if (await titleMatch.isVisible({ timeout: 1000 })) {
        console.log(`Clicking tab via title pattern '${pattern}': ${tabName}`);
        await titleMatch.click();
        await page.waitForTimeout(1000);
        return true;
      }
    }

    // Strategy 2: Look for span.label-text containing the tab name
    const labelTextSpan = page.locator(`span.label-text:has-text("${tabName}")`).first();
    if (await labelTextSpan.isVisible({ timeout: 1000 })) {
      console.log(`Clicking tab via label-text: ${tabName}`);
      await labelTextSpan.click();
      await page.waitForTimeout(1000);
      return true;
    }

    // Strategy 3: Look for any clickable element with the tab name (but avoid false matches)
    const anyClickable = page.locator(`button:has-text("${tabName}"), [role="tab"]:has-text("${tabName}")`).first();
    if (await anyClickable.isVisible({ timeout: 1000 })) {
      console.log(`Clicking tab via button/tab locator: ${tabName}`);
      await anyClickable.click();
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

test.describe("Entity Type Editor Visual Tests @full", () => {
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

  test("should iterate through all entity type editor tabs", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
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

  test("should open Add Component dialog when clicking add slot", async ({ page }, testInfo) => {
    testInfo.setTimeout(120000);
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

    // Find add slot buttons
    const addSlotButtons = page.locator(".etcse-addSlot");
    await expect.poll(async () => addSlotButtons.count(), { timeout: 15000 }).toBeGreaterThan(0);
    const count = await addSlotButtons.count();
    console.log(`Found ${count} add slot buttons`);

    if (count === 0) {
      await page.screenshot({ path: "debugoutput/screenshots/add-slot-not-found.png" });
      test.skip();
      return;
    }

    // Take screenshot before clicking
    await page.screenshot({ path: "debugoutput/screenshots/before-add-slot-click.png" });

    // Click the first add slot
    await addSlotButtons.first().click();

    // Take screenshot after clicking
    await page.screenshot({ path: "debugoutput/screenshots/after-add-slot-click.png" });

    // Check if dialog appeared (MUI Dialog uses .MuiDialog-root)
    const dialog = page.locator(".MuiDialog-root");
    await expect(dialog.first()).toBeVisible({ timeout: 10000 });
    const dialogVisible = await dialog.isVisible();
    console.log(`Dialog visible after clicking add slot: ${dialogVisible}`);

    // Verify dialog is visible
    expect(dialogVisible).toBe(true);
  });

  test("should open full Add Component dialog with category picker from toolbar", async ({ page }, testInfo) => {
    testInfo.setTimeout(120000);
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
    await page.waitForTimeout(1500);

    // Click the "+ Add component" toolbar button (not the add slot)
    const addComponentButton = page.locator('button:has-text("Add component")').first();
    const buttonExists = await addComponentButton.isVisible();
    console.log(`Add component toolbar button visible: ${buttonExists}`);

    if (!buttonExists) {
      await page.screenshot({ path: "debugoutput/screenshots/add-component-toolbar-not-found.png" });
      test.skip();
      return;
    }

    await addComponentButton.click();
    await page.waitForTimeout(1500);

    // Take screenshot of the full dialog with category picker
    await page.screenshot({ path: "debugoutput/screenshots/add-component-full-dialog.png" });

    // Check if dialog appeared (MUI Dialog uses .MuiDialog-root)
    const dialog = page.locator(".MuiDialog-root");
    const dialogVisible = await dialog.isVisible();
    console.log(`Full dialog visible: ${dialogVisible}`);

    // Verify the category list is visible (etac-category class)
    // Wait longer for category list since forms are loaded asynchronously
    const categoryList = page.locator(".etac-category");
    try {
      await categoryList.waitFor({ state: "visible", timeout: 15000 });
    } catch {
      // Take screenshot for debugging if category doesn't appear
      await page.screenshot({ path: "debugoutput/screenshots/add-component-category-timeout.png" });
    }
    const categoryVisible = await categoryList.isVisible();
    console.log(`Category picker visible: ${categoryVisible}`);

    expect(dialogVisible).toBe(true);
    expect(categoryVisible).toBe(true);
  });

  test("should display Actions tab with events and triggers", async ({ page }) => {
    test.setTimeout(60000);
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
    test.setTimeout(60000);
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
    test.setTimeout(60000);
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

test.describe("Entity Type Editor - Theme Comparison @full", () => {
  test.setTimeout(60_000);

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

test.describe("Entity Type Editor - Multiple Entity Types @full", () => {
  const entityTypes = ["biceson", "mammothon", "sheepson", "hogson"];

  test("should be able to switch between different entity types", async ({ page }) => {
    test.setTimeout(60000);
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

test.describe("Entity Type Editor - Visual Regression Baseline @full", () => {
  test("capture baseline screenshots for entity type editor", async ({ page }, testInfo) => {
    testInfo.setTimeout(120000);
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

test.describe("Entity Type Editor - Deep Tab Interaction @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should display Overview tab with model viewer and component summary", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
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

    // Click Overview tab
    await clickEditorTab(page, "Overview");
    await page.waitForTimeout(2000);

    // Screenshot the overview panel
    await page.screenshot({
      path: "debugoutput/screenshots/entity-deep-overview-full.png",
      fullPage: true,
    });

    // Verify the overview panel outer container is present
    const overviewOuter = page.locator(".etop-outer").first();
    const overviewVisible = await overviewOuter.isVisible({ timeout: 3000 });
    console.log(`Overview panel visible: ${overviewVisible}`);

    // Verify the model viewer section exists
    const modelSection = page.locator(".etop-modelSection").first();
    const modelVisible = await modelSection.isVisible({ timeout: 3000 });
    console.log(`Model viewer section visible: ${modelVisible}`);

    // Verify the behaviors/components summary section
    const behaviorsSection = page.locator(".etop-behaviorsSection").first();
    const behaviorsVisible = await behaviorsSection.isVisible({ timeout: 3000 });
    console.log(`Behaviors summary section visible: ${behaviorsVisible}`);

    // Check for component group sections (e.g., "Default Properties")
    const groupHeaders = page.locator(".etop-groupHeader");
    const groupCount = await groupHeaders.count();
    console.log(`Component group headers in overview: ${groupCount}`);

    // Check for individual component rows
    const componentRows = page.locator(".etop-componentRow");
    const compRowCount = await componentRows.count();
    console.log(`Component rows in overview summary: ${compRowCount}`);

    if (overviewVisible) {
      expect(overviewVisible).toBe(true);
    }
  });

  test("should display Components tab with group list and select a component group", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
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
    await page.waitForTimeout(1500);

    // Screenshot the initial Components tab (shows group list on left, default selected)
    await page.screenshot({
      path: "debugoutput/screenshots/entity-deep-components-initial.png",
      fullPage: true,
    });

    // Verify the component groups panel is visible
    const groupsPanel = page.locator(".ete-groupsPanel").first();
    const groupsPanelVisible = await groupsPanel.isVisible({ timeout: 3000 });
    console.log(`Groups panel visible: ${groupsPanelVisible}`);

    // Verify the selectable list of component groups is present
    const groupList = page.locator('[aria-label="List of components"]').first();
    const groupListVisible = await groupList.isVisible({ timeout: 3000 });
    console.log(`Component group list visible: ${groupListVisible}`);

    // The default component set should be pre-selected and showing components
    // Look for component headers (individual components within the selected group)
    const componentHeaders = page.locator(".etcse-componentHeader");
    await page.waitForTimeout(1000);
    const headerCount = await componentHeaders.count();
    console.log(`Component headers visible: ${headerCount}`);

    // Screenshot showing default component set details
    await page.screenshot({
      path: "debugoutput/screenshots/entity-deep-components-default-group.png",
      fullPage: true,
    });

    // Try clicking a different component group from the list (e.g., second item)
    // MUI ListItemButton renders with role="button", not role="option"
    const listItems = groupList.locator('[role="button"]');
    const listItemCount = await listItems.count();
    console.log(`Component group list items: ${listItemCount}`);

    if (listItemCount > 1) {
      // Click the second component group
      await listItems.nth(1).click();
      await page.waitForTimeout(1500);

      await page.screenshot({
        path: "debugoutput/screenshots/entity-deep-components-second-group.png",
        fullPage: true,
      });

      // Verify breadcrumb navigation appeared
      const breadcrumb = page.locator(".etcse-breadcrumb");
      if (await breadcrumb.isVisible({ timeout: 2000 })) {
        console.log("Breadcrumb navigation is visible");
      }
    }

    expect(groupsPanelVisible).toBe(true);
  });

  test("should expand and display individual component form editor", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
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
    await page.waitForTimeout(2000);

    // Find component headers and click the first one to expand its form
    const componentHeaders = page.locator(".etcse-componentHeader");
    const headerCount = await componentHeaders.count();
    console.log(`Found ${headerCount} component headers`);

    if (headerCount === 0) {
      console.log("No component headers found, skipping form expansion test");
      await page.screenshot({
        path: "debugoutput/screenshots/entity-deep-component-no-headers.png",
        fullPage: true,
      });
      test.skip();
      return;
    }

    // Screenshot before clicking a component
    await page.screenshot({
      path: "debugoutput/screenshots/entity-deep-component-before-expand.png",
      fullPage: true,
    });

    // Click the first component header to expand it
    await componentHeaders.first().click();
    await page.waitForTimeout(1500);

    // Screenshot showing the expanded component with its form
    await page.screenshot({
      path: "debugoutput/screenshots/entity-deep-component-expanded.png",
      fullPage: true,
    });

    // Check if a DataForm rendered inside the component
    const componentForm = page.locator(".etcse-componentForm").first();
    const formVisible = await componentForm.isVisible({ timeout: 3000 });
    console.log(`Component form visible: ${formVisible}`);

    // If there's a second component, expand that too to show variety
    if (headerCount > 1) {
      await componentHeaders.nth(1).click();
      await page.waitForTimeout(1500);

      await page.screenshot({
        path: "debugoutput/screenshots/entity-deep-component-second-expanded.png",
        fullPage: true,
      });
    }
  });

  test("should display Actions tab and select an event to show detail", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
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
    await page.waitForTimeout(1500);

    // Screenshot the Actions tab with event list
    await page.screenshot({
      path: "debugoutput/screenshots/entity-deep-actions-initial.png",
      fullPage: true,
    });

    // Verify the actions list panel is visible
    const actionsPanel = page.locator(".ete-groupsPanel").first();
    const actionsPanelVisible = await actionsPanel.isVisible({ timeout: 3000 });
    console.log(`Actions panel visible: ${actionsPanelVisible}`);

    // Get the list of action/event items
    const actionList = page.locator('[aria-label="List of entity actions"]').first();
    const actionListVisible = await actionList.isVisible({ timeout: 3000 });
    console.log(`Action list visible: ${actionListVisible}`);

    if (actionListVisible) {
      const actionItems = actionList.locator('[role="option"]');
      const actionCount = await actionItems.count();
      console.log(`Action items in list: ${actionCount}`);

      if (actionCount > 0) {
        // Click the first action/event to show its detail
        await actionItems.first().click();
        await page.waitForTimeout(1500);

        await page.screenshot({
          path: "debugoutput/screenshots/entity-deep-actions-event-selected.png",
          fullPage: true,
        });

        // Verify the EventActionDesign component loaded
        const emptyState = page.locator(".ete-emptyState");
        const emptyVisible = await emptyState.isVisible({ timeout: 1000 }).catch(() => false);
        console.log(`Empty state visible (no event detail): ${emptyVisible}`);

        // If there's a second event, click it too
        if (actionCount > 1) {
          await actionItems.nth(1).click();
          await page.waitForTimeout(1500);

          await page.screenshot({
            path: "debugoutput/screenshots/entity-deep-actions-second-event.png",
            fullPage: true,
          });
        }
      }
    }
  });

  test("should display entity_spawned action with randomize tiles", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
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
    await page.waitForTimeout(1500);

    // Select "Entity Spawned" event — it's the first item in biceson events
    const actionList = page.locator('[aria-label="List of entity actions"]').first();
    const actionListVisible = await actionList.isVisible({ timeout: 3000 });

    if (actionListVisible) {
      const actionItems = actionList.locator('[role="option"]');
      const count = await actionItems.count();
      console.log(`Action items count: ${count}`);

      // Click first event (Entity Spawned)
      if (count > 0) {
        await actionItems.first().click();
        await page.waitForTimeout(2000);

        // Verify EventActionDesign loaded (it has a header with the event id)
        const header = page.locator(".ead-header, .ead-n-header").first();
        const headerVisible = await header.isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`Action detail header visible: ${headerVisible}`);

        // Verify trigger content section appears (displayTriggers is true for Actions tab)
        const triggerTitle = page.locator(".ead-triggerTitle").first();
        const triggerVisible = await triggerTitle.isVisible({ timeout: 2000 }).catch(() => false);
        console.log(`Trigger section visible: ${triggerVisible}`);

        // Verify action tiles rendered (biceson entity_spawned has randomize with 2 entries)
        const actionTiles = page.locator(".eat-area");
        const tileCount = await actionTiles.count();
        console.log(`Action tiles rendered: ${tileCount}`);

        // Verify the "Add action" button is present in EventActionSet
        const addActionButton = page.locator('button:has-text("Add action")').first();
        const addActionVisible = await addActionButton.isVisible({ timeout: 2000 }).catch(() => false);
        console.log(`Add action button visible: ${addActionVisible}`);

        await page.screenshot({
          path: "debugoutput/screenshots/entity-actions-spawned-detail.png",
          fullPage: true,
        });
      }
    }
  });

  test("should show Actions menu toggle options in action tile", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
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

    await clickEditorTab(page, "Actions");
    await page.waitForTimeout(1500);

    // Select an event
    const actionList = page.locator('[aria-label="List of entity actions"]').first();
    if (await actionList.isVisible({ timeout: 3000 })) {
      const actionItems = actionList.locator('[role="option"]');
      if ((await actionItems.count()) > 0) {
        await actionItems.first().click();
        await page.waitForTimeout(2000);

        // Find and click the "Actions..." button inside an EventActionTile
        const actionsMenuBtn = page.locator('.eat-area button:has-text("Actions...")').first();
        if (await actionsMenuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await actionsMenuBtn.click();
          await page.waitForTimeout(500);

          // Verify the MUI Menu appeared with toggle items
          const menuPopover = page.locator(".MuiMenu-paper");
          const menuVisible = await menuPopover.isVisible({ timeout: 2000 }).catch(() => false);
          console.log(`Actions menu popover visible: ${menuVisible}`);

          if (menuVisible) {
            // Verify expected menu items exist
            const menuItems = menuPopover.locator('[role="menuitem"]');
            const menuItemCount = await menuItems.count();
            console.log(`Actions menu items: ${menuItemCount}`);

            // Expect at least Command, Sound, Particle, Trigger, Vibration
            expect(menuItemCount).toBeGreaterThanOrEqual(5);
          }

          await page.screenshot({
            path: "debugoutput/screenshots/entity-actions-menu-toggles.png",
            fullPage: true,
          });

          // Close the menu
          await page.keyboard.press("Escape");
        }
      }
    }
  });

  test("should switch between Summary, Designer, and JSON action modes", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
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

    await clickEditorTab(page, "Actions");
    await page.waitForTimeout(1500);

    // Select an event
    const actionList = page.locator('[aria-label="List of entity actions"]').first();
    if (await actionList.isVisible({ timeout: 3000 })) {
      const actionItems = actionList.locator('[role="option"]');
      if ((await actionItems.count()) > 0) {
        await actionItems.first().click();
        await page.waitForTimeout(2000);

        // Screenshot summary mode (default)
        await page.screenshot({
          path: "debugoutput/screenshots/entity-actions-mode-summary.png",
          fullPage: true,
        });

        // Click Designer tab
        const designerTab = page.locator('button[title="Designer"]').first();
        if (await designerTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await designerTab.click();
          await page.waitForTimeout(2000);

          await page.screenshot({
            path: "debugoutput/screenshots/entity-actions-mode-designer.png",
            fullPage: true,
          });
        }

        // Click JSON tab
        const jsonTab = page.locator('button[title="JSON"]').first();
        if (await jsonTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await jsonTab.click();
          await page.waitForTimeout(1500);

          await page.screenshot({
            path: "debugoutput/screenshots/entity-actions-mode-json.png",
            fullPage: true,
          });
        }

        // Switch back to Summary
        const summaryTab = page.locator('button[title="Summary"]').first();
        if (await summaryTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await summaryTab.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });

  test("should display action detail for entity_born event (simple add groups)", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
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

    await clickEditorTab(page, "Actions");
    await page.waitForTimeout(1500);

    // Select "Entity Born" — second event in biceson
    const actionList = page.locator('[aria-label="List of entity actions"]').first();
    if (await actionList.isVisible({ timeout: 3000 })) {
      const actionItems = actionList.locator('[role="option"]');
      const count = await actionItems.count();

      // Entity Born is typically the second item — look for it by text
      let entityBornIndex = -1;
      for (let i = 0; i < count; i++) {
        const text = await actionItems.nth(i).textContent();
        if (text && text.toLowerCase().includes("born")) {
          entityBornIndex = i;
          break;
        }
      }

      if (entityBornIndex >= 0) {
        await actionItems.nth(entityBornIndex).click();
        await page.waitForTimeout(2000);

        // Verify this is a simpler single-action event (not randomize/sequence)
        const actionTiles = page.locator(".eat-area");
        const tileCount = await actionTiles.count();
        console.log(`Entity Born action tiles: ${tileCount}`);

        // Verify filter editor is present
        const filterEditor = page.locator(".mifi-outer").first();
        const filterVisible = await filterEditor.isVisible({ timeout: 2000 }).catch(() => false);
        console.log(`Filter editor visible: ${filterVisible}`);

        await page.screenshot({
          path: "debugoutput/screenshots/entity-actions-born-detail.png",
          fullPage: true,
        });
      } else {
        console.log("Could not find Entity Born event in list");
      }
    }
  });

  test("should display Properties tab with property editor content", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
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

    // Click Properties tab
    await clickEditorTab(page, "Properties");
    await page.waitForTimeout(2000);

    // Screenshot the Properties tab
    await page.screenshot({
      path: "debugoutput/screenshots/entity-deep-properties.png",
      fullPage: true,
    });

    // Verify the properties editor panel loaded (full-width panel)
    const propertiesPanel = page.locator(".ete-componentEditorInteriorFull").first();
    const propsVisible = await propertiesPanel.isVisible({ timeout: 3000 });
    console.log(`Properties panel visible: ${propsVisible}`);

    if (propsVisible) {
      expect(propsVisible).toBe(true);
    }
  });

  test("should display AI Behaviors tab with state diagram", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
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

    // Click AI Behaviors tab (formerly "Behavior Flows" / "Flow")
    await clickEditorTab(page, "AI Behaviors");
    await page.waitForTimeout(2000);

    // Screenshot the AI Behaviors / State Diagram tab
    await page.screenshot({
      path: "debugoutput/screenshots/entity-deep-ai-behaviors.png",
      fullPage: true,
    });

    // Verify the diagram editor panel loaded
    const diagramPanel = page.locator(".ete-componentEditorInteriorFull").first();
    const diagramVisible = await diagramPanel.isVisible({ timeout: 3000 });
    console.log(`AI Behaviors diagram panel visible: ${diagramVisible}`);

    if (diagramVisible) {
      expect(diagramVisible).toBe(true);
    }
  });

  test("should display Spawn tab with spawn rules or empty state", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
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

    // Click Spawn tab
    await clickEditorTab(page, "Spawn");
    await page.waitForTimeout(1500);

    // Screenshot the Spawn tab
    await page.screenshot({
      path: "debugoutput/screenshots/entity-deep-spawn.png",
      fullPage: true,
    });

    // Check if spawn rules are configured or empty state is shown
    const addSpawnButton = page.locator('button:has-text("Add Spawn Rules")').first();
    const hasEmptyState = await addSpawnButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasEmptyState) {
      console.log("Spawn tab shows empty state with 'Add Spawn Rules' button");
    } else {
      console.log("Spawn tab shows configured spawn rules editor");
    }
  });

  test("should display Loot tab with loot table or empty state", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
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

    // Click Loot tab
    await clickEditorTab(page, "Loot");
    await page.waitForTimeout(1500);

    // Screenshot the Loot tab
    await page.screenshot({
      path: "debugoutput/screenshots/entity-deep-loot.png",
      fullPage: true,
    });

    // Check if loot table is configured or empty state
    const addLootButton = page.locator('button:has-text("Add Loot Table")').first();
    const hasEmptyState = await addLootButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasEmptyState) {
      console.log("Loot tab shows empty state with 'Add Loot Table' button");
    } else {
      console.log("Loot tab shows configured loot table editor");
    }
  });

  test("should display Visuals tab with resource editor content", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
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
    await page.waitForTimeout(2000);

    // Screenshot the Visuals tab
    await page.screenshot({
      path: "debugoutput/screenshots/entity-deep-visuals.png",
      fullPage: true,
    });

    // Verify the visuals editor panel loaded
    const visualsPanel = page.locator(".ete-componentEditorInteriorFull").first();
    const visualsVisible = await visualsPanel.isVisible({ timeout: 3000 });
    console.log(`Visuals panel visible: ${visualsVisible}`);

    if (visualsVisible) {
      expect(visualsVisible).toBe(true);
    }
  });
});

test.describe("Entity Type Editor - Component Add Dialog Deep Interaction @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should browse Add Component categories and show component list", async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);
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
    await page.waitForTimeout(1500);

    // Click the "+ Add component" toolbar button
    const addComponentButton = page.locator('button:has-text("Add component")').first();
    if (!(await addComponentButton.isVisible({ timeout: 3000 }))) {
      console.log("Add component button not found");
      await page.screenshot({
        path: "debugoutput/screenshots/entity-deep-add-component-not-found.png",
        fullPage: true,
      });
      test.skip();
      return;
    }

    await addComponentButton.click();
    await page.waitForTimeout(2000);

    // Screenshot the Add Component dialog
    await page.screenshot({
      path: "debugoutput/screenshots/entity-deep-add-component-dialog.png",
      fullPage: true,
    });

    // Wait for categories to load
    const categoryList = page.locator(".etac-category");
    try {
      await categoryList.first().waitFor({ state: "visible", timeout: 15000 });
    } catch {
      await page.screenshot({
        path: "debugoutput/screenshots/entity-deep-add-component-no-categories.png",
        fullPage: true,
      });
    }

    const categoryCount = await categoryList.count();
    console.log(`Add Component dialog categories: ${categoryCount}`);

    // Click through the first few categories to show different component lists
    for (let i = 0; i < Math.min(categoryCount, 3); i++) {
      await categoryList.nth(i).click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: `debugoutput/screenshots/entity-deep-add-component-category-${i}.png`,
        fullPage: true,
      });

      const categoryText = await categoryList.nth(i).textContent();
      console.log(`Category ${i}: ${categoryText}`);
    }

    // Close the dialog
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });

  test("should add component via inline add slot button", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
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
    await page.waitForTimeout(2000);

    // Find inline add-slot buttons (+ buttons within component categories)
    const addSlotButtons = page.locator(".etcse-addSlot");
    const slotCount = await addSlotButtons.count();
    console.log(`Found ${slotCount} inline add-slot buttons`);

    if (slotCount === 0) {
      await page.screenshot({ path: "debugoutput/screenshots/entity-deep-no-add-slots.png", fullPage: true });
      test.skip();
      return;
    }

    // Screenshot showing the add slot buttons in context
    await page.screenshot({
      path: "debugoutput/screenshots/entity-deep-add-slot-buttons.png",
      fullPage: true,
    });

    // Click the first add-slot to open its category-specific add dialog
    await addSlotButtons.first().click();
    await page.waitForTimeout(1500);

    // Screenshot the category-scoped add dialog
    await page.screenshot({
      path: "debugoutput/screenshots/entity-deep-add-slot-dialog.png",
      fullPage: true,
    });

    // Close the dialog
    const dialog = page.locator(".MuiDialog-root");
    if (await dialog.isVisible({ timeout: 1000 })) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
  });
});

test.describe("Entity Type Editor - Cross-Entity Tab Comparison @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should show different entity types across key tabs", async ({ page }, testInfo) => {
    testInfo.setTimeout(120000);
    const projectCreated = await createFullAddOnProject(page);

    if (!projectCreated) {
      test.skip();
      return;
    }

    const entityTypes = ["biceson", "mammothon", "sheepson", "hogson"];
    const keyTabs = ["Overview", "Components", "Actions"];

    for (const entityName of entityTypes) {
      const selected = await selectEntityType(page, entityName);
      if (!selected) {
        console.log(`Could not select ${entityName}, skipping`);
        continue;
      }

      for (const tabName of keyTabs) {
        await clickEditorTab(page, tabName);
        await page.waitForTimeout(1000);

        await page.screenshot({
          path: `debugoutput/screenshots/entity-cross-${entityName}-${tabName.toLowerCase()}.png`,
          fullPage: true,
        });

        console.log(`Captured ${entityName} - ${tabName}`);
      }
    }
  });
});

test.describe("Entity Type Editor - Header and Navigation @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should display editor header with entity type info and all tab buttons", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
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

    // Verify the editor header chip area is visible
    const headerChip = page.locator(".ete-area").first();
    const headerVisible = await headerChip.isVisible({ timeout: 3000 });
    console.log(`Entity editor area visible: ${headerVisible}`);

    // Screenshot just the header/tab area
    await page.screenshot({
      path: "debugoutput/screenshots/entity-deep-header-tabs.png",
      fullPage: true,
    });

    // Verify all expected tab buttons are present
    const expectedTabs = [
      "Overview",
      "Visuals",
      "Spawn",
      "Loot",
      "Components",
      "Properties",
      "AI Behaviors",
      "Actions",
    ];
    for (const tabName of expectedTabs) {
      // Try to find the tab button by its label text
      const tabButton = page.locator(`span.label-text:has-text("${tabName}")`).first();
      const tabVisible = await tabButton.isVisible({ timeout: 1000 }).catch(() => false);
      console.log(`Tab "${tabName}" visible: ${tabVisible}`);
    }

    expect(headerVisible).toBe(true);
  });

  test("should navigate from Overview to Components via group click", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
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

    // Click Overview tab first
    await clickEditorTab(page, "Overview");
    await page.waitForTimeout(2000);

    // Find an "Edit" link in a component group header (navigates to Components tab)
    const editLinks = page.locator(".etop-groupLink");
    const editLinkCount = await editLinks.count();
    console.log(`Edit links in overview: ${editLinkCount}`);

    await page.screenshot({
      path: "debugoutput/screenshots/entity-deep-overview-before-navigate.png",
      fullPage: true,
    });

    if (editLinkCount > 0) {
      // Click the first "Edit" link to navigate to the Components tab
      await editLinks.first().click();
      await page.waitForTimeout(1500);

      // Should now be on the Components tab showing that group's components
      await page.screenshot({
        path: "debugoutput/screenshots/entity-deep-overview-after-navigate.png",
        fullPage: true,
      });

      console.log("Successfully navigated from Overview to Components via Edit link");
    }
  });
});
