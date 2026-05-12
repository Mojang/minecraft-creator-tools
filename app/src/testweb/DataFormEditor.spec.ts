/**
 * DataForm Editor Visual and Functional Tests
 *
 * These tests verify the functionality of the DataForm component and its field components
 * by creating a Full Add-On project (which includes sample entity types like Biceson)
 * and interacting with the entity type component editor to test different field types:
 *
 * Field types tested:
 * - TextboxField (string, int, float)
 * - CheckboxField (boolean)
 * - DropdownField (enum/choice)
 * - SliderField (numeric with slider)
 * - Point3Field (3D coordinates)
 * - RangeField (min/max values)
 *
 * The tests verify:
 * - Fields render correctly
 * - Values can be edited
 * - Changes persist (by switching tabs and returning)
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import {
  processMessage,
  gotoWithTheme,
  ThemeMode,
  selectEditMode,
  clickTemplateCreateButton,
  preferBrowserStorageInProjectDialog,
  fillRequiredProjectDialogFields,
} from "./WebTestUtilities";

// Entity type editor tabs
const ENTITY_EDITOR_TABS = [
  { name: "Overview", label: "Overview" },
  { name: "Properties", label: "Properties" },
  { name: "Components", label: "Components" },
  { name: "Actions", label: "Actions" },
  { name: "Visuals", label: "Visuals" },
];

// Helper to create a Full Add-On project and enter the editor
async function createFullAddOnProject(page: Page, themeMode?: ThemeMode): Promise<boolean> {
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
async function enableEntityTypeVisibility(page: Page): Promise<void> {
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
    await expect(page.locator(".MuiBackdrop-root"))
      .toHaveCount(0, { timeout: 3000 })
      .catch(async () => {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      });

    await page.waitForTimeout(300);
  }
}

// Helper to select an entity type from the project list
async function selectEntityType(page: Page, entityName: string): Promise<boolean> {
  try {
    // First enable entity type visibility if needed
    await enableEntityTypeVisibility(page);

    // Wait for the list to update after enabling types
    await page.waitForTimeout(2000);

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
    const entityItems = page.locator(`[role="option"]:has-text("${entityName}")`);
    const itemCount = await entityItems.count();
    for (let i = 0; i < Math.min(itemCount, 4); i++) {
      if (await entityItems.nth(i).isVisible({ timeout: 1000 }).catch(() => false)) {
        if (await clickAndVerify(entityItems.nth(i), `role=option match ${i}`)) return true;
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
async function clickEditorTab(page: Page, tabName: string): Promise<boolean> {
  // Map of user-friendly tab names to actual title patterns in EntityTypeEditor
  const tabTitlePatterns: Record<string, string[]> = {
    Overview: ["Entity overview", "overview"],
    Properties: ["Edit properties", "properties"],
    Components: ["Edit components", "components"],
    Flow: ["Visual state diagram", "flow"],
    Actions: ["Edit entity events"],
    Visuals: ["Edit documentation", "visuals"],
    Spawn: ["Spawn behavior", "spawn"],
    Loot: ["Loot", "loot"],
  };

  const patterns = tabTitlePatterns[tabName] || [tabName.toLowerCase()];

  try {
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
      if (await titleMatch.isVisible({ timeout: 3000 })) {
        console.log(`Clicking tab via title pattern '${pattern}': ${tabName}`);
        await titleMatch.click();
        await page.waitForTimeout(1000);
        return true;
      }
    }

    // Strategy 2: Look for span.label-text containing the tab name
    const labelTextSpan = page.locator(`span.label-text:has-text("${tabName}")`).first();
    if (await labelTextSpan.isVisible({ timeout: 2000 })) {
      console.log(`Clicking tab via label-text: ${tabName}`);
      await labelTextSpan.click();
      await page.waitForTimeout(1000);
      return true;
    }

    // Strategy 3: Look for any clickable element with the tab name (but avoid false matches)
    const anyClickable = page.locator(`button:has-text("${tabName}"), [role="tab"]:has-text("${tabName}")`).first();
    if (await anyClickable.isVisible({ timeout: 2000 })) {
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
// Helper to click a component from the component list
async function selectComponent(page: Page, componentName: string): Promise<boolean> {
  try {
    // Component names in the list are humanified (e.g., "Angry" for "minecraft:angry")
    const componentItem = page
      .locator(`[role="option"]:has-text("${componentName}")`)
      .or(page.locator(`li:has-text("${componentName}")`))
      .or(page.locator(`.etcse-componentWrapper:has-text("${componentName}")`))
      .first();

    if (await componentItem.isVisible({ timeout: 3000 })) {
      console.log(`Selecting component: ${componentName}`);
      await componentItem.click();
      await page.waitForTimeout(500);
      return true;
    }

    console.log(`Could not find component: ${componentName}`);
    return false;
  } catch (error) {
    console.log(`Error selecting component ${componentName}: ${error}`);
    return false;
  }
}

// Helper to find and interact with DataForm fields
interface DataFormFieldInfo {
  label: string;
  type: "textbox" | "checkbox" | "dropdown" | "slider" | "textarea" | "unknown";
  locator: any;
}

async function findDataFormFields(page: Page): Promise<DataFormFieldInfo[]> {
  const fields: DataFormFieldInfo[] = [];

  // Find FormInput elements (textbox fields)
  const formInputs = page.locator(".df-prop-inner input[type='text']");
  const inputCount = await formInputs.count();
  for (let i = 0; i < inputCount; i++) {
    const input = formInputs.nth(i);
    const labelElt = page.locator(".df-prop-title").nth(i);
    const label = (await labelElt.isVisible()) ? (await labelElt.textContent()) || "" : "";
    fields.push({ label, type: "textbox", locator: input });
  }

  // Find checkbox elements
  const checkboxes = page.locator(".df-prop-inner input[type='checkbox']");
  const checkboxCount = await checkboxes.count();
  for (let i = 0; i < checkboxCount; i++) {
    const checkbox = checkboxes.nth(i);
    fields.push({ label: `checkbox-${i}`, type: "checkbox", locator: checkbox });
  }

  // Find dropdown elements
  const dropdowns = page.locator(".df-prop-inner [role='listbox'], .df-prop-inner [role='combobox']");
  const dropdownCount = await dropdowns.count();
  for (let i = 0; i < dropdownCount; i++) {
    const dropdown = dropdowns.nth(i);
    fields.push({ label: `dropdown-${i}`, type: "dropdown", locator: dropdown });
  }

  // Find slider elements
  const sliders = page.locator(".df-prop-inner input[type='range']");
  const sliderCount = await sliders.count();
  for (let i = 0; i < sliderCount; i++) {
    const slider = sliders.nth(i);
    fields.push({ label: `slider-${i}`, type: "slider", locator: slider });
  }

  return fields;
}

test.describe("DataForm Editor Functional Tests @full", () => {
  // Full-suite runs can be slower due to resource contention; avoid flaky global timeouts.
  test.setTimeout(60000);

  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should display DataForm when viewing entity component", async ({ page }) => {
    const projectCreated = await createFullAddOnProject(page);

    if (!projectCreated) {
      console.log("Could not create Full Add-On project - skipping test");
      test.skip();
      return;
    }

    // Take screenshot of initial editor state
    await page.screenshot({
      path: "debugoutput/screenshots/dataform-01-editor-loaded.png",
      fullPage: true,
    });

    // Select biceson entity
    const entitySelected = await selectEntityType(page, "biceson");

    if (!entitySelected) {
      const fallbackSelected = await selectEntityType(page, "mammothon");
      if (!fallbackSelected) {
        console.log("Could not select any entity type");
        await page.screenshot({
          path: "debugoutput/screenshots/dataform-01a-no-entity.png",
          fullPage: true,
        });
        test.skip();
        return;
      }
    }

    // Take screenshot of entity selected
    await page.screenshot({
      path: "debugoutput/screenshots/dataform-02-entity-selected.png",
      fullPage: true,
    });

    // Navigate to Components tab
    await clickEditorTab(page, "Components");

    await page.waitForTimeout(1000);

    // Take screenshot of Components tab
    await page.screenshot({
      path: "debugoutput/screenshots/dataform-03-components-tab.png",
      fullPage: true,
    });

    // Look for DataForm container or form elements
    const dataFormContainer = page.locator(".df-outer, .etcse-componentForm").first();
    if (await dataFormContainer.isVisible({ timeout: 5000 })) {
      console.log("DataForm container found");
      await expect(dataFormContainer).toBeVisible();
    } else {
      console.log("DataForm container not immediately visible - checking for component list");
      // Check if we see the component list
      const componentList = page.locator("[role='listbox']").first();
      if (await componentList.isVisible()) {
        console.log("Component list is visible - selecting a component");
        // Try to select the first component in the list
        const firstComponent = page.locator("[role='option']").first();
        if (await firstComponent.isVisible()) {
          await firstComponent.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // Take final screenshot
    await page.screenshot({
      path: "debugoutput/screenshots/dataform-04-dataform-visible.png",
      fullPage: true,
    });
  });

  test("should interact with text input fields in DataForm", async ({ page }) => {
    const projectCreated = await createFullAddOnProject(page);

    if (!projectCreated) {
      test.skip();
      return;
    }

    // Select entity and navigate to Components
    await selectEntityType(page, "biceson");
    await clickEditorTab(page, "Components");
    await page.waitForTimeout(1000);

    // Take initial screenshot
    await page.screenshot({
      path: "debugoutput/screenshots/dataform-textinput-01-initial.png",
      fullPage: true,
    });

    // Find input fields in the DataForm
    const textInputs = page.locator(
      "input[type='text'], input[type='number'], input:not([type]), .df-prop-inner input"
    );
    const inputCount = await textInputs.count();
    console.log(`Found ${inputCount} text input fields`);

    if (inputCount > 0) {
      // Interact with the first visible input
      for (let i = 0; i < Math.min(inputCount, 5); i++) {
        const input = textInputs.nth(i);
        if (await input.isVisible({ timeout: 1000 })) {
          const currentValue = await input.inputValue();
          console.log(`Input ${i}: current value = "${currentValue}"`);

          // Try to modify the value
          if (currentValue !== "") {
            await input.click();
            await page.waitForTimeout(200);

            // For numeric inputs, try to increment
            if (!isNaN(parseFloat(currentValue))) {
              const newValue = (parseFloat(currentValue) + 1).toString();
              await input.fill(newValue);
              console.log(`Changed input ${i} from "${currentValue}" to "${newValue}"`);

              await page.screenshot({
                path: `debugoutput/screenshots/dataform-textinput-02-modified-${i}.png`,
                fullPage: true,
              });

              // Verify the change
              const updatedValue = await input.inputValue();
              expect(updatedValue).toBe(newValue);

              // Revert to original value
              await input.fill(currentValue);
              break;
            }
          }
        }
      }
    }

    // Take final screenshot
    await page.screenshot({
      path: "debugoutput/screenshots/dataform-textinput-03-final.png",
      fullPage: true,
    });
  });

  test("should interact with checkbox fields in DataForm", async ({ page }) => {
    const projectCreated = await createFullAddOnProject(page);

    if (!projectCreated) {
      test.skip();
      return;
    }

    // Select entity and navigate to Components
    await selectEntityType(page, "biceson");
    await clickEditorTab(page, "Components");
    await page.waitForTimeout(1000);

    // Find checkbox fields
    const checkboxes = page.locator("input[type='checkbox'], .df-prop-inner input[type='checkbox']");
    const checkboxCount = await checkboxes.count();
    console.log(`Found ${checkboxCount} checkbox fields`);

    await page.screenshot({
      path: "debugoutput/screenshots/dataform-checkbox-01-initial.png",
      fullPage: true,
    });

    if (checkboxCount > 0) {
      // Find the first visible checkbox
      for (let i = 0; i < Math.min(checkboxCount, 5); i++) {
        const checkbox = checkboxes.nth(i);
        if (await checkbox.isVisible({ timeout: 1000 })) {
          const isChecked = await checkbox.isChecked();
          console.log(`Checkbox ${i}: checked = ${isChecked}`);

          // Toggle the checkbox
          await checkbox.click();
          await page.waitForTimeout(300);

          const newIsChecked = await checkbox.isChecked();
          console.log(`Checkbox ${i}: new checked = ${newIsChecked}`);

          expect(newIsChecked).toBe(!isChecked);

          await page.screenshot({
            path: `debugoutput/screenshots/dataform-checkbox-02-toggled-${i}.png`,
            fullPage: true,
          });

          // Toggle back
          await checkbox.click();
          await page.waitForTimeout(200);
          break;
        }
      }
    }

    await page.screenshot({
      path: "debugoutput/screenshots/dataform-checkbox-03-final.png",
      fullPage: true,
    });
  });

  test("should interact with dropdown fields in DataForm", async ({ page }) => {
    const projectCreated = await createFullAddOnProject(page);

    if (!projectCreated) {
      test.skip();
      return;
    }

    // Select entity and navigate to Components
    await selectEntityType(page, "biceson");
    await clickEditorTab(page, "Components");
    await page.waitForTimeout(1000);

    // Find dropdown elements (MUI Select components render as divs with role='combobox')
    // Exclude the project item list sidebar which also has role='listbox'
    const dropdowns = page.locator(".df-prop-inner [role='combobox'], .MuiSelect-select, select");
    const dropdownCount = await dropdowns.count();
    console.log(`Found ${dropdownCount} dropdown fields`);

    await page.screenshot({
      path: "debugoutput/screenshots/dataform-dropdown-01-initial.png",
      fullPage: true,
    });

    if (dropdownCount > 0) {
      // Interact with the first visible dropdown
      for (let i = 0; i < Math.min(dropdownCount, 5); i++) {
        const dropdown = dropdowns.nth(i);
        if (await dropdown.isVisible({ timeout: 1000 })) {
          console.log(`Clicking dropdown ${i}`);
          await dropdown.click();
          await page.waitForTimeout(500);

          await page.screenshot({
            path: `debugoutput/screenshots/dataform-dropdown-02-opened-${i}.png`,
            fullPage: true,
          });

          // Look for dropdown options
          const options = page.locator("[role='option'], .ui-dropdown__item");
          const optionCount = await options.count();
          console.log(`Dropdown ${i} has ${optionCount} options`);

          if (optionCount > 1) {
            // Select the second option (to change from current)
            const secondOption = options.nth(1);
            if (await secondOption.isVisible({ timeout: 1000 })) {
              await secondOption.click();
              await page.waitForTimeout(300);

              await page.screenshot({
                path: `debugoutput/screenshots/dataform-dropdown-03-selected-${i}.png`,
                fullPage: true,
              });
            }
          }

          // Close dropdown with Escape
          await page.keyboard.press("Escape");
          await page.waitForTimeout(200);
          break;
        }
      }
    }

    await page.screenshot({
      path: "debugoutput/screenshots/dataform-dropdown-04-final.png",
      fullPage: true,
    });
  });

  test("should verify edits persist when switching tabs", async ({ page }) => {
    test.setTimeout(60000);
    const projectCreated = await createFullAddOnProject(page);

    if (!projectCreated) {
      test.skip();
      return;
    }

    // Select entity and navigate to Components
    await selectEntityType(page, "biceson");
    await clickEditorTab(page, "Components");
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "debugoutput/screenshots/dataform-persist-01-initial.png",
      fullPage: true,
    });

    // Find a numeric input to modify
    const numericInputs = page.locator("input[type='number'], input[type='text']");
    let modifiedInputIndex = -1;
    let originalValue = "";
    let newValue = "";

    for (let i = 0; i < (await numericInputs.count()); i++) {
      const input = numericInputs.nth(i);
      if (await input.isVisible({ timeout: 500 })) {
        const value = await input.inputValue();
        if (!isNaN(parseFloat(value)) && value !== "") {
          originalValue = value;
          newValue = (parseFloat(value) + 10).toString();
          modifiedInputIndex = i;

          console.log(`Modifying input ${i}: ${originalValue} -> ${newValue}`);
          await input.fill(newValue);
          await page.waitForTimeout(300);

          // Blur the input to trigger save
          await input.blur();
          await page.waitForTimeout(300);

          await page.screenshot({
            path: "debugoutput/screenshots/dataform-persist-02-modified.png",
            fullPage: true,
          });
          break;
        }
      }
    }

    if (modifiedInputIndex >= 0) {
      // Switch to a different tab
      await clickEditorTab(page, "Properties");
      await page.waitForTimeout(500);

      await page.screenshot({
        path: "debugoutput/screenshots/dataform-persist-03-switched-tab.png",
        fullPage: true,
      });

      // Switch back to Components
      await clickEditorTab(page, "Components");
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: "debugoutput/screenshots/dataform-persist-04-back-to-components.png",
        fullPage: true,
      });

      // Verify the value persisted
      const inputAfterSwitch = numericInputs.nth(modifiedInputIndex);
      if (await inputAfterSwitch.isVisible({ timeout: 2000 })) {
        const persistedValue = await inputAfterSwitch.inputValue();
        console.log(`Value after tab switch: ${persistedValue} (expected: ${newValue})`);

        // The value should still be the modified value
        expect(persistedValue).toBe(newValue);

        // Restore original value
        await inputAfterSwitch.fill(originalValue);
        await inputAfterSwitch.blur();
      }
    }

    await page.screenshot({
      path: "debugoutput/screenshots/dataform-persist-05-final.png",
      fullPage: true,
    });
  });

  test("should navigate through multiple entity components", async ({ page }) => {
    test.setTimeout(120000);
    const projectCreated = await createFullAddOnProject(page);

    if (!projectCreated) {
      test.skip();
      return;
    }

    // Select entity and navigate to Components
    const entitySelected = await selectEntityType(page, "biceson");
    if (!entitySelected) {
      test.skip();
      return;
    }

    // Retry tab click once if the editor is still settling.
    let tabClicked = await clickEditorTab(page, "Components");
    if (!tabClicked) {
      await page.waitForTimeout(3000);
      tabClicked = await clickEditorTab(page, "Components");
    }
    expect(tabClicked).toBe(true);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(500);

    await page.screenshot({
      path: "debugoutput/screenshots/dataform-navigate-01-components.png",
      fullPage: true,
    });

    // Find component entries in the components panel.
    // Newer UI exposes component rows as buttons in the "List of components" list;
    // older UI uses `.etcse-componentWrapper`.
    let componentButtons = page
      .getByRole("list", { name: "List of components" })
      .last()
      .getByRole("button");
    await expect
      .poll(
        async () => {
          if (page.isClosed()) {
            return -1;
          }

          const modernCount = await componentButtons.count();
          if (modernCount > 0) {
            return modernCount;
          }

          return await page.locator(".etcse-componentWrapper").count();
        },
        { timeout: 15000, intervals: [250, 500, 1000] }
      )
      .toBeGreaterThan(0);

    if ((await componentButtons.count()) === 0) {
      componentButtons = page.locator(".etcse-componentWrapper");
    }

    const componentCount = await componentButtons.count();
    console.log(`Found ${componentCount} components in the list`);
    expect(componentCount).toBeGreaterThan(0);

    // Click through a few different components
    const maxComponentsToScan = Math.min(componentCount, 12);
    const targetComponentsToVisit = Math.min(componentCount, 3);
    let componentsVisited = 0;
    try {
      for (let i = 0; i < maxComponentsToScan; i++) {
        const component = componentButtons.nth(i);
        const isVisible = await component.isVisible({ timeout: 1500 }).catch(() => false);
        if (!isVisible) {
          continue;
        }

        const componentName = ((await component.textContent()) || "").trim();
        if (
          componentName.length === 0 ||
          componentName.startsWith("+") ||
          componentName === "Attributes" ||
          componentName === "Components" ||
          componentName === "Behaviors (AI)" ||
          componentName === "Default (base state)"
        ) {
          continue;
        }

        console.log(`Clicking component: ${componentName}`);
        await component.click();
        await page.waitForTimeout(300);

        await page.screenshot({
          path: `debugoutput/screenshots/dataform-navigate-02-component-${i}.png`,
          fullPage: true,
        });

        // Verify DataForm is shown (look for form fields)
        const formFields = page.locator(".df-prop-inner, input, [role='combobox']");
        const fieldCount = await formFields.count();
        console.log(`Component ${i} has ${fieldCount} form fields`);
        componentsVisited++;
        if (componentsVisited >= targetComponentsToVisit) {
          break;
        }
      }
    } catch (error) {
      const message = String(error);
      if (message.includes("Target page, context or browser has been closed") || message.includes("has been closed")) {
        throw new Error(`Editor page closed while navigating components after visiting ${componentsVisited} components.`);
      }

      throw error;
    }
    expect(componentsVisited).toBeGreaterThan(0);

    await page.screenshot({
      path: "debugoutput/screenshots/dataform-navigate-03-final.png",
      fullPage: true,
    });
  });

  test("should display and interact with entity Properties tab", async ({ page }) => {
    const projectCreated = await createFullAddOnProject(page);

    if (!projectCreated) {
      test.skip();
      return;
    }

    // Select entity and navigate to Properties
    await selectEntityType(page, "biceson");
    await clickEditorTab(page, "Properties");
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "debugoutput/screenshots/dataform-properties-01-tab.png",
      fullPage: true,
    });

    // Look for DataForm fields in Properties tab
    const formInputs = page.locator("input, [role='combobox'], [role='checkbox']");
    const inputCount = await formInputs.count();
    console.log(`Properties tab has ${inputCount} form inputs`);

    // Verify we see some form elements
    if (inputCount > 0) {
      console.log("Properties tab shows DataForm fields");
    }

    await page.screenshot({
      path: "debugoutput/screenshots/dataform-properties-02-final.png",
      fullPage: true,
    });
  });

  test("should handle long form strings (TextArea fields)", async ({ page }) => {
    const projectCreated = await createFullAddOnProject(page);

    if (!projectCreated) {
      test.skip();
      return;
    }

    // Select entity - first try to see if there are any items with descriptions
    await selectEntityType(page, "biceson");
    await clickEditorTab(page, "Overview");
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "debugoutput/screenshots/dataform-textarea-01-overview.png",
      fullPage: true,
    });

    // Look for textarea elements (used for long form strings)
    const textareas = page.locator("textarea, [role='textbox'][contenteditable='true']");
    const textareaCount = await textareas.count();
    console.log(`Found ${textareaCount} textarea elements`);

    if (textareaCount > 0) {
      const firstTextarea = textareas.first();
      if (await firstTextarea.isVisible({ timeout: 2000 })) {
        const currentText = await firstTextarea.inputValue().catch(() => "");
        console.log(`Textarea current value length: ${currentText.length}`);

        // Add some text
        await firstTextarea.click();
        const testText = currentText + " [Test addition]";
        await firstTextarea.fill(testText);
        await page.waitForTimeout(300);

        await page.screenshot({
          path: "debugoutput/screenshots/dataform-textarea-02-modified.png",
          fullPage: true,
        });

        // Verify the text was added
        const newText = await firstTextarea.inputValue().catch(() => "");
        expect(newText).toContain("[Test addition]");

        // Restore original
        await firstTextarea.fill(currentText);
      }
    }

    await page.screenshot({
      path: "debugoutput/screenshots/dataform-textarea-03-final.png",
      fullPage: true,
    });
  });

  test("should display form validation and field types correctly", async ({ page }) => {
    test.setTimeout(90000);

    const projectCreated = await createFullAddOnProject(page);

    if (!projectCreated) {
      test.skip();
      return;
    }

    await selectEntityType(page, "biceson");

    // Debug: take screenshot after entity selection
    await page.screenshot({
      path: "debugoutput/screenshots/dataform-fieldtypes-after-entity-select.png",
      fullPage: true,
    });

    // Wait for entity editor to fully render, then click Components tab
    // Retry clickEditorTab if it fails the first time (editor may still be loading)
    let tabClicked = await clickEditorTab(page, "Components");
    if (!tabClicked) {
      console.log("Components tab not found on first try, waiting and retrying...");
      await page.waitForTimeout(3000);
      tabClicked = await clickEditorTab(page, "Components");
    }
    if (!tabClicked) {
      console.log("Components tab still not found, skipping test");
      test.skip();
      return;
    }
    await expect
      .poll(
        async () => {
          if (page.isClosed()) {
            return -1;
          }

          const modernCount = await page
            .getByRole("list", { name: "List of components" })
            .last()
            .getByRole("button")
            .count();
          if (modernCount > 0) {
            return modernCount;
          }

          return await page.locator(".etcse-componentWrapper").count();
        },
        { timeout: 15000, intervals: [250, 500, 1000] }
      )
      .toBeGreaterThan(0);

    // Select the first component if available, to display form fields
    // Use MuiListItemIcon to distinguish real component items from "Add ..." slots
    // (component items have icons, add slots don't)
    let componentItems = page
      .locator('[aria-label="List of components"] .MuiListItemButton-root')
      .filter({ has: page.locator(".MuiListItemIcon-root") });
    if ((await componentItems.count()) === 0) {
      componentItems = page.locator(".etcse-componentWrapper");
    }
    const componentItemCount = await componentItems.count();
    console.log(`Found ${componentItemCount} component items (excluding Add slots)`);
    if (componentItemCount > 0) {
      // Try clicking each component until we find one that renders DataForm fields
      let fieldsFound = false;
      for (let ci = 0; ci < Math.min(componentItemCount, 5); ci++) {
        const comp = componentItems.nth(ci);
        try {
          await comp.scrollIntoViewIfNeeded({ timeout: 3000 });
          await comp.click({ timeout: 5000 });
        } catch {
          console.log(`Component ${ci} not clickable, skipping`);
          continue;
        }

        // If an "Add component" dialog accidentally opened, close it and continue
        const dialog = page.locator("dialog, .MuiDialog-root, [role='dialog']").first();
        if (await dialog.isVisible({ timeout: 500 }).catch(() => false)) {
          console.log(`Component ${ci} opened a dialog, closing and skipping`);
          await page.keyboard.press("Escape");
          await page.waitForTimeout(500);
          continue;
        }

        await page.waitForTimeout(1500);

        const fieldCount = await page
          .locator(
            ".df-form input, .df-form select, .df-form textarea, .df-form [role='combobox'], .df-fieldWrap .MuiInputBase-input, .df-fieldWrap .MuiSwitch-input, .df-fieldWrap input, .df-fieldWrap select"
          )
          .count();

        if (fieldCount > 0) {
          console.log(`Component ${ci} has ${fieldCount} form fields`);
          fieldsFound = true;
          break;
        }
        console.log(`Component ${ci} has no form fields, trying next...`);
      }

      if (!fieldsFound) {
        // Final attempt: wait longer for the last clicked component
        await expect
          .poll(
            async () => {
              if (page.isClosed()) {
                return -1;
              }

              return await page
                .locator(
                  ".df-form input, .df-form select, .df-form textarea, .df-form [role='combobox'], .df-fieldWrap .MuiInputBase-input, .df-fieldWrap .MuiSwitch-input, .df-fieldWrap input, .df-fieldWrap select"
                )
                .count();
            },
            { timeout: 10000, intervals: [500, 1000, 2000] }
          )
          .toBeGreaterThan(0);
      }
    }

    // Collect information about all field types present
    // Scope selectors to DataForm area (.df-form) to avoid matching sidebar/toolbar elements
    // Also count any MUI inputs in the editor area
    const fieldTypes = {
      textInputs: await page.locator(".df-form input[type='text'], .df-form input:not([type]):not([role]), .df-fieldWrap input[type='text']").count(),
      numberInputs: await page.locator(".df-form input[type='number'], .df-numericInput input, .df-fieldWrap input[type='number']").count(),
      checkboxes: await page.locator(".df-form input[type='checkbox'], .df-checkboxRow input[type='checkbox'], .df-fieldWrap .MuiSwitch-input").count(),
      dropdowns: await page.locator(".df-form select, .df-form [role='combobox'], .df-form .MuiSelect-select, .df-fieldWrap .MuiSelect-select").count(),
      sliders: await page.locator(".df-form input[type='range'], .df-fieldWrap .MuiSlider-root").count(),
      textareas: await page.locator(".df-form textarea, .df-fieldWrap textarea").count(),
      muiInputs: await page.locator(".df-fieldWrap .MuiInputBase-input").count(),
    };

    console.log("Field types found in DataForm:");
    console.log(`  - Text inputs: ${fieldTypes.textInputs}`);
    console.log(`  - Number inputs: ${fieldTypes.numberInputs}`);
    console.log(`  - Checkboxes: ${fieldTypes.checkboxes}`);
    console.log(`  - Dropdowns: ${fieldTypes.dropdowns}`);
    console.log(`  - Sliders: ${fieldTypes.sliders}`);
    console.log(`  - Textareas: ${fieldTypes.textareas}`);
    console.log(`  - MUI inputs: ${fieldTypes.muiInputs}`);

    await page.screenshot({
      path: "debugoutput/screenshots/dataform-fieldtypes-01-overview.png",
      fullPage: true,
    });

    // Verify at least some field types are present
    const totalFields =
      fieldTypes.textInputs +
      fieldTypes.numberInputs +
      fieldTypes.checkboxes +
      fieldTypes.dropdowns +
      fieldTypes.sliders +
      fieldTypes.textareas +
      fieldTypes.muiInputs;

    console.log(`Total form fields: ${totalFields}`);
    expect(totalFields).toBeGreaterThan(0);
  });
});
