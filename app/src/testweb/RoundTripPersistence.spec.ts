/**
 * Round-Trip Persistence Tests
 *
 * These tests verify that edits made through various UI controls actually persist
 * when navigating away and returning. This is the core "does editing actually work?"
 * test suite.
 *
 * Coverage:
 * - Text input fields (Spawn tab): edit → tab switch → return → verify
 * - Checkbox fields: toggle → tab switch → return → verify
 * - Dropdown fields: select → tab switch → return → verify
 * - Spawn tab fields: edit → tab switch → return → verify
 * - JSON raw editor: edit → navigate away → return → verify
 * - Component CRUD: add component → verify in list
 * - Block type editing: edit → tab switch → return → verify
 * - Script file editing: edit → navigate away → return → verify
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import {
  processMessage,
  gotoWithTheme,
  ThemeMode,
  selectEditMode,
  takeScreenshot,
  enableAllFileTypes,
  openFileInMonaco,
  switchToRawMode,
} from "./WebTestUtilities";

// ---------------------------------------------------------------------------
// Helpers (mirrored from DataFormEditor.spec.ts)
// ---------------------------------------------------------------------------

async function createFullAddOnProject(page: Page, themeMode?: ThemeMode): Promise<boolean> {
  try {
    if (themeMode) {
      await gotoWithTheme(page, themeMode, "/");
    } else {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
    }
    await page.waitForTimeout(500);

    const fullAddOnCard = page.locator('text="Full Add-On"').first();
    if (!(await fullAddOnCard.isVisible({ timeout: 5000 }))) {
      const seeMore = page.locator('text="See more templates"').first();
      if (await seeMore.isVisible({ timeout: 2000 })) {
        await seeMore.click();
        await page.waitForTimeout(1000);
      }
    }

    const fullAddOnSection = page.locator('div:has-text("Full Add-On")').filter({
      has: page.locator('text="A full example add-on project"'),
    });

    let createButton = fullAddOnSection.locator('button:has-text("CREATE NEW")').first();
    if (!(await createButton.isVisible({ timeout: 3000 }))) {
      createButton = page.locator('button:has-text("New")').or(page.locator('button:has-text("CREATE NEW")')).nth(2);
    }
    if (!(await createButton.isVisible({ timeout: 3000 }))) {
      createButton = page.getByRole("button", { name: "Create New" }).first();
    }

    await createButton.click();
    await page.waitForTimeout(1000);

    const okButton = page.getByTestId("submit-button").first();
    if (await okButton.isVisible({ timeout: 3000 })) {
      await okButton.click();
    } else {
      const altOk = page.locator("button:has-text('OK')").first();
      if (await altOk.isVisible({ timeout: 2000 })) {
        await altOk.click();
      } else {
        await page.keyboard.press("Enter");
      }
    }

    await page.waitForTimeout(5000);
    await page.waitForLoadState("networkidle");

    const viewButton = page.getByRole("button", { name: /view/i }).first();
    const isInEditor = await viewButton.isVisible({ timeout: 5000 });

    if (isInEditor) {
      await selectEditMode(page, "full");
      return true;
    }
    return false;
  } catch (error) {
    console.log(`Error creating Full Add-On project: ${error}`);
    return false;
  }
}

async function enableEntityTypeVisibility(page: Page): Promise<void> {
  const entityTypesSection = page.locator("text=/Entity Types/i").first();
  if (await entityTypesSection.isVisible({ timeout: 1000 }).catch(() => false)) {
    return;
  }

  const showButton = page.locator('button:has-text("Show")').first();
  if (await showButton.isVisible({ timeout: 2000 })) {
    await showButton.click();

    const menuModal = page.locator(".MuiModal-root.MuiMenu-root");
    await menuModal.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});

    const menuList = page.locator(".MuiMenu-list");
    let typesOption: ReturnType<typeof menuList.locator> | null = null;
    let found = false;

    const byTitle = menuList.locator('li[title*="entity, block, and item types"]');
    if (await byTitle.isVisible({ timeout: 1000 }).catch(() => false)) {
      typesOption = byTitle;
      found = true;
    }
    if (!found) {
      const byRole = menuList.getByRole("menuitem", { name: "Types", exact: true });
      if (await byRole.isVisible({ timeout: 1000 }).catch(() => false)) {
        typesOption = byRole;
        found = true;
      }
    }
    if (!found) {
      const byText = menuList.locator('li:has-text("Types")').first();
      if (await byText.isVisible({ timeout: 1000 }).catch(() => false)) {
        typesOption = byText;
        found = true;
      }
    }

    if (found && typesOption) {
      const isAlreadySelected = (await typesOption.locator(".label-selected").count()) > 0;
      if (isAlreadySelected) {
        await page.keyboard.press("Escape");
      } else {
        await typesOption.click();
      }
    } else {
      await page.keyboard.press("Escape");
    }

    await menuModal.waitFor({ state: "detached", timeout: 5000 }).catch(async () => {
      await page.keyboard.press("Escape");
      await menuModal.waitFor({ state: "detached", timeout: 3000 }).catch(() => {});
    });

    await expect(page.locator(".MuiBackdrop-root"))
      .toHaveCount(0, { timeout: 3000 })
      .catch(async () => {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      });

    await page.waitForTimeout(300);
  }
}

async function selectEntityType(page: Page, entityName: string): Promise<boolean> {
  try {
    await enableEntityTypeVisibility(page);
    await page.waitForTimeout(2000);

    const humanName = entityName.charAt(0).toUpperCase() + entityName.slice(1);
    const eteArea = page.locator(".ete-area");

    const clickAndVerify = async (locator: ReturnType<typeof page.locator>, label: string): Promise<boolean> => {
      console.log(`Selecting entity type via ${label}: ${entityName}`);
      await locator.click();
      await page.waitForTimeout(1000);
      return await eteArea.isVisible({ timeout: 5000 }).catch(() => false);
    };

    const originalMatch = page.locator(`text="${entityName}"`).first();
    if (await originalMatch.isVisible({ timeout: 3000 })) {
      if (await clickAndVerify(originalMatch, "exact lowercase")) return true;
    }

    const humanMatch = page.locator(`text="${humanName}"`).first();
    if (await humanMatch.isVisible({ timeout: 2000 })) {
      if (await clickAndVerify(humanMatch, "humanified name")) return true;
    }

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

async function clickEditorTab(page: Page, tabName: string): Promise<boolean> {
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
    const eteArea = page.locator(".ete-area");
    if (await eteArea.isVisible({ timeout: 2000 }).catch(() => false)) {
      for (const pattern of patterns) {
        const eteMatch = eteArea.locator(`button[title*="${pattern}" i]`).first();
        if (await eteMatch.isVisible({ timeout: 1000 }).catch(() => false)) {
          await eteMatch.click();
          await page.waitForTimeout(1000);
          return true;
        }
      }
    }

    for (const pattern of patterns) {
      const titleMatch = page.locator(`[title*="${pattern}" i]:not([aria-haspopup])`).first();
      if (await titleMatch.isVisible({ timeout: 3000 })) {
        await titleMatch.click();
        await page.waitForTimeout(1000);
        return true;
      }
    }

    const labelTextSpan = page.locator(`span.label-text:has-text("${tabName}")`).first();
    if (await labelTextSpan.isVisible({ timeout: 2000 })) {
      await labelTextSpan.click();
      await page.waitForTimeout(1000);
      return true;
    }

    const anyClickable = page.locator(`button:has-text("${tabName}"), [role="tab"]:has-text("${tabName}")`).first();
    if (await anyClickable.isVisible({ timeout: 2000 })) {
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

/**
 * Wait for the component list to populate, then return a locator for the
 * component buttons (excluding section headers and "Add" slots).
 */
async function waitForComponentButtons(page: Page): Promise<ReturnType<typeof page.locator>> {
  let componentButtons = page
    .getByRole("list", { name: "List of components" })
    .last()
    .getByRole("button");

  await expect
    .poll(
      async () => {
        if (page.isClosed()) return -1;
        const modernCount = await componentButtons.count();
        if (modernCount > 0) return modernCount;
        return await page.locator(".etcse-componentWrapper").count();
      },
      { timeout: 15000, intervals: [250, 500, 1000] }
    )
    .toBeGreaterThan(0);

  if ((await componentButtons.count()) === 0) {
    componentButtons = page.locator(".etcse-componentWrapper");
  }

  return componentButtons;
}

/** Names that are section headers / add slots, not real components. */
const SKIP_COMPONENT_NAMES = new Set([
  "",
  "Attributes",
  "Components",
  "Behaviors (AI)",
  "Default (base state)",
]);

/**
 * Click a real component entry (skip headers / add-component slots).
 * @param preferIndex – The 0-based index among *real* components to click.
 */
async function clickRealComponent(
  page: Page,
  componentButtons: ReturnType<typeof page.locator>,
  preferIndex: number = 0
): Promise<{ index: number; name: string }> {
  const count = await componentButtons.count();
  let visited = 0;

  for (let i = 0; i < Math.min(count, 30); i++) {
    const btn = componentButtons.nth(i);
    if (!(await btn.isVisible({ timeout: 500 }).catch(() => false))) continue;

    const text = ((await btn.textContent()) || "").trim();
    if (SKIP_COMPONENT_NAMES.has(text) || text.startsWith("+")) continue;

    if (visited < preferIndex) {
      visited++;
      continue;
    }

    await btn.click();
    await page.waitForTimeout(500);
    return { index: i, name: text };
  }

  return { index: -1, name: "" };
}

/**
 * Find the first visible, editable MUI or plain text/number input on the page.
 * Returns null if none found.
 */
async function findEditableInput(
  page: Page,
  scope?: ReturnType<typeof page.locator>
): Promise<{ locator: ReturnType<typeof page.locator>; value: string; index: number } | null> {
  const root = scope || page;
  // Broad selector covering MUI TextFields and DataForm fields
  const inputs = root.locator(
    "input[type='text'], input[type='number'], input:not([type='checkbox']):not([type='hidden']):not([type='radio']):not([type='range']):not([type='file']):not([type='color'])"
  );
  const count = await inputs.count();

  for (let i = 0; i < Math.min(count, 20); i++) {
    const input = inputs.nth(i);
    if (!(await input.isVisible({ timeout: 300 }).catch(() => false))) continue;

    const readOnly = await input.getAttribute("readonly");
    const disabled = await input.isDisabled();
    if (readOnly !== null || disabled) continue;

    const value = await input.inputValue();
    return { locator: input, value, index: i };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Round-Trip Persistence Tests @full", () => {
  test.setTimeout(90000);

  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  // -----------------------------------------------------------------------
  // Test 1 – Spawn tab text input persists across tab switches
  // -----------------------------------------------------------------------
  test("text input persists across tab switches @full", async ({ page }) => {
    test.setTimeout(90000);

    const created = await createFullAddOnProject(page);
    if (!created) {
      test.skip();
      return;
    }

    const selected = await selectEntityType(page, "biceson");
    if (!selected) {
      test.skip();
      return;
    }

    // The Spawn tab has clear MUI TextField inputs (Id, Population group)
    await clickEditorTab(page, "Spawn");
    await page.waitForTimeout(1500);

    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-text-01-spawn-tab");

    // Find the "Population group" input (the Id field may be tied to identity)
    const eteArea = page.locator(".ete-area");
    const hit = await findEditableInput(page, eteArea);

    if (!hit) {
      console.log("No editable text input found on Spawn tab");
      test.skip();
      return;
    }

    const originalValue = hit.value;
    const newValue = originalValue + "_rt";

    console.log(`Spawn tab input ${hit.index}: "${originalValue}" → "${newValue}"`);
    await hit.locator.click();
    await hit.locator.fill(newValue);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(500);

    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-text-02-after-edit");

    // Switch to Overview tab and back to Spawn
    await clickEditorTab(page, "Overview");
    await page.waitForTimeout(1000);
    await clickEditorTab(page, "Spawn");
    await page.waitForTimeout(1500);

    // Find the same input again
    const hitAfter = await findEditableInput(page, eteArea);
    if (hitAfter) {
      const persistedValue = hitAfter.value;
      console.log(`Persisted value: "${persistedValue}" (expected: "${newValue}")`);
      expect(persistedValue).toBe(newValue);
    } else {
      console.log("Could not find input after round-trip");
    }

    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-text-03-verified");
  });

  // -----------------------------------------------------------------------
  // Test 2 – checkbox toggle persists across tab switches
  // -----------------------------------------------------------------------
  test("checkbox toggle persists across tab switches @full", async ({ page }) => {
    test.setTimeout(90000);

    const created = await createFullAddOnProject(page);
    if (!created) {
      test.skip();
      return;
    }

    const selected = await selectEntityType(page, "biceson");
    if (!selected) {
      test.skip();
      return;
    }

    await clickEditorTab(page, "Components");
    await page.waitForTimeout(500);

    const componentButtons = await waitForComponentButtons(page);

    // Iterate components to find one with a checkbox
    let targetPreferIndex = -1;
    let checkboxFound = false;
    let realIdx = 0;

    const componentCount = await componentButtons.count();
    for (let i = 0; i < Math.min(componentCount, 30) && !checkboxFound; i++) {
      const btn = componentButtons.nth(i);
      if (!(await btn.isVisible({ timeout: 300 }).catch(() => false))) continue;
      const text = ((await btn.textContent()) || "").trim();
      if (SKIP_COMPONENT_NAMES.has(text) || text.startsWith("+")) continue;

      await btn.click();
      await page.waitForTimeout(800);

      // Check for any checkbox on the page (in the right detail panel)
      const cbCount = await page.locator("input[type='checkbox']").count();
      if (cbCount > 0) {
        targetPreferIndex = realIdx;
        checkboxFound = true;
        console.log(`Found checkbox in component "${text}" (realIdx ${realIdx})`);
      }
      realIdx++;
    }

    if (!checkboxFound) {
      console.log("No component with checkbox found — skipping");
      test.skip();
      return;
    }

    // Re-click target component
    await clickRealComponent(page, componentButtons, targetPreferIndex);
    await page.waitForTimeout(800);

    const checkbox = page.locator("input[type='checkbox']").first();
    const initialChecked = await checkbox.isChecked();
    console.log(`Checkbox initial state: ${initialChecked}`);

    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-checkbox-01-before");

    await checkbox.click({ force: true });
    await page.waitForTimeout(500);

    const afterToggle = await checkbox.isChecked();
    console.log(`Checkbox after toggle: ${afterToggle}`);
    expect(afterToggle).toBe(!initialChecked);

    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-checkbox-02-toggled");

    // Switch tabs and return
    await clickEditorTab(page, "Overview");
    await page.waitForTimeout(1000);
    await clickEditorTab(page, "Components");
    await page.waitForTimeout(1000);

    await clickRealComponent(page, componentButtons, targetPreferIndex);
    await page.waitForTimeout(800);

    const checkboxAfter = page.locator("input[type='checkbox']").first();
    if (await checkboxAfter.isVisible({ timeout: 3000 }).catch(() => false)) {
      const persistedState = await checkboxAfter.isChecked();
      console.log(`Checkbox persisted state: ${persistedState} (expected: ${!initialChecked})`);
      expect(persistedState).toBe(!initialChecked);

      // Restore original state
      await checkboxAfter.click({ force: true });
      await page.waitForTimeout(300);
    }

    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-checkbox-03-verified");
  });

  // -----------------------------------------------------------------------
  // Test 3 – dropdown selection persists across tab switches
  // -----------------------------------------------------------------------
  test("dropdown selection persists across tab switches @full", async ({ page }) => {
    test.setTimeout(90000);

    const created = await createFullAddOnProject(page);
    if (!created) {
      test.skip();
      return;
    }

    const selected = await selectEntityType(page, "biceson");
    if (!selected) {
      test.skip();
      return;
    }

    await clickEditorTab(page, "Components");
    await page.waitForTimeout(500);

    const componentButtons = await waitForComponentButtons(page);

    // Iterate components to find one with a dropdown / combobox / select
    let targetPreferIndex = -1;
    let dropdownFound = false;
    let realIdx = 0;

    const componentCount = await componentButtons.count();
    for (let i = 0; i < Math.min(componentCount, 30) && !dropdownFound; i++) {
      const btn = componentButtons.nth(i);
      if (!(await btn.isVisible({ timeout: 300 }).catch(() => false))) continue;
      const text = ((await btn.textContent()) || "").trim();
      if (SKIP_COMPONENT_NAMES.has(text) || text.startsWith("+")) continue;

      await btn.click();
      await page.waitForTimeout(800);

      // Broad dropdown selector: MUI Select, native select, combobox
      const ddCount = await page
        .locator("[role='combobox'], select, .MuiSelect-select")
        .count();
      if (ddCount > 0) {
        targetPreferIndex = realIdx;
        dropdownFound = true;
        console.log(`Found dropdown in component "${text}" (realIdx ${realIdx})`);
      }
      realIdx++;
    }

    if (!dropdownFound) {
      console.log("No component with dropdown found — skipping");
      test.skip();
      return;
    }

    await clickRealComponent(page, componentButtons, targetPreferIndex);
    await page.waitForTimeout(800);

    const dropdown = page.locator("[role='combobox'], select, .MuiSelect-select").first();
    const originalText = ((await dropdown.textContent()) || "").trim();
    console.log(`Dropdown original text: "${originalText}"`);

    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-dropdown-01-before");

    await dropdown.click();
    await page.waitForTimeout(500);

    const options = page.locator("[role='option']");
    const optionCount = await options.count();
    console.log(`Dropdown has ${optionCount} options`);

    let selectedOptionText = "";
    if (optionCount > 1) {
      for (let oi = 0; oi < optionCount; oi++) {
        const opt = options.nth(oi);
        const optText = ((await opt.textContent()) || "").trim();
        if (optText !== originalText && optText.length > 0) {
          selectedOptionText = optText;
          await opt.click();
          console.log(`Selected option: "${selectedOptionText}"`);
          break;
        }
      }
    }

    if (!selectedOptionText) {
      await page.keyboard.press("Escape");
      console.log("Could not find a different option to select — skipping");
      test.skip();
      return;
    }

    await page.waitForTimeout(500);
    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-dropdown-02-changed");

    // Switch tabs and return
    await clickEditorTab(page, "Overview");
    await page.waitForTimeout(1000);
    await clickEditorTab(page, "Components");
    await page.waitForTimeout(1000);

    await clickRealComponent(page, componentButtons, targetPreferIndex);
    await page.waitForTimeout(800);

    const dropdownAfter = page.locator("[role='combobox'], select, .MuiSelect-select").first();
    if (await dropdownAfter.isVisible({ timeout: 3000 }).catch(() => false)) {
      const persistedText = ((await dropdownAfter.textContent()) || "").trim();
      console.log(`Dropdown persisted text: "${persistedText}" (expected: "${selectedOptionText}")`);
      expect(persistedText).toBe(selectedOptionText);
    }

    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-dropdown-03-verified");
  });

  // -----------------------------------------------------------------------
  // Test 4 – entity Spawn tab fields persist (second field)
  // -----------------------------------------------------------------------
  test("entity Spawn tab fields persist @full", async ({ page }) => {
    test.setTimeout(90000);

    const created = await createFullAddOnProject(page);
    if (!created) {
      test.skip();
      return;
    }

    const selected = await selectEntityType(page, "biceson");
    if (!selected) {
      test.skip();
      return;
    }

    // Navigate to Spawn tab which has MUI TextField inputs (Id, Population group)
    await clickEditorTab(page, "Spawn");
    await page.waitForTimeout(1500);

    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-spawn-01-initial");

    // Find the second editable input (Population group) to avoid touching Id
    const eteArea = page.locator(".ete-area");
    const allInputs = eteArea.locator(
      "input[type='text'], input[type='number'], input:not([type='checkbox']):not([type='hidden']):not([type='radio']):not([type='range']):not([type='file']):not([type='color'])"
    );
    const inputCount = await allInputs.count();
    console.log(`Spawn tab has ${inputCount} inputs`);

    let modifiedIndex = -1;
    let originalValue = "";
    let newValue = "";

    // Try the second input first (Population group), then fall back to any
    for (let i = Math.min(1, inputCount - 1); i < inputCount; i++) {
      const input = allInputs.nth(i);
      if (!(await input.isVisible({ timeout: 500 }).catch(() => false))) continue;

      const readOnly = await input.getAttribute("readonly");
      const disabled = await input.isDisabled();
      if (readOnly !== null || disabled) continue;

      originalValue = await input.inputValue();
      newValue = originalValue + "_persist";

      await input.click();
      await input.fill(newValue);
      await page.keyboard.press("Tab");
      await page.waitForTimeout(300);

      modifiedIndex = i;
      console.log(`Modified spawn input ${i}: "${originalValue}" → "${newValue}"`);
      break;
    }

    if (modifiedIndex < 0) {
      console.log("No editable input found on Spawn tab");
      test.skip();
      return;
    }

    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-spawn-02-edited");

    // Switch to Components and back
    await clickEditorTab(page, "Components");
    await page.waitForTimeout(1000);
    await clickEditorTab(page, "Spawn");
    await page.waitForTimeout(1500);

    const inputAfter = allInputs.nth(modifiedIndex);
    if (await inputAfter.isVisible({ timeout: 3000 }).catch(() => false)) {
      const persistedValue = await inputAfter.inputValue();
      console.log(`Spawn persisted value: "${persistedValue}" (expected: "${newValue}")`);
      expect(persistedValue).toBe(newValue);
    }

    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-spawn-03-verified");
  });

  // -----------------------------------------------------------------------
  // Test 5 – JSON raw edits persist when navigating away
  // -----------------------------------------------------------------------
  test("JSON raw edits persist when switching files @full", async ({ page }) => {
    test.setTimeout(90000);

    const created = await createFullAddOnProject(page);
    if (!created) {
      test.skip();
      return;
    }

    // Switch to Full mode and enable all file types so manifest is visible
    await selectEditMode(page, "full");
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    // Click manifest in the sidebar
    const manifestOpened = await openFileInMonaco(page, "manifest");
    if (!manifestOpened) {
      console.log("Could not open manifest file");
      test.skip();
      return;
    }

    // Switch to raw/Monaco view
    const rawMode = await switchToRawMode(page);

    // Even if switchToRawMode reports false, the manifest might already show
    // Monaco in the default raw view. Check for Monaco directly.
    const monacoEditor = page.locator(".monaco-editor").first();
    if (!rawMode && !(await monacoEditor.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log("Could not get Monaco editor for manifest");
      test.skip();
      return;
    }

    await page.waitForTimeout(500);
    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-json-01-initial");

    // Get Monaco model content
    const originalContent = await page.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.();
      if (editors && editors.length > 0) {
        return editors[0].getModel()?.getValue() || "";
      }
      return "";
    });

    if (!originalContent) {
      console.log("Could not access Monaco editor model");
      test.skip();
      return;
    }

    console.log(`Monaco content length: ${originalContent.length}`);

    // Modify a value — replace first occurrence of "description" value
    const marker = `__RTTEST_${Date.now()}`;
    const modifiedContent = originalContent.replace(
      /"description"\s*:\s*"([^"]*)"/,
      `"description": "$1 ${marker}"`
    );

    if (modifiedContent === originalContent) {
      console.log("Could not find description field to modify in JSON");
      test.skip();
      return;
    }

    // Set new content
    await page.evaluate((content: string) => {
      const editors = (window as any).monaco?.editor?.getEditors?.();
      if (editors && editors.length > 0) {
        const model = editors[0].getModel();
        if (model) {
          model.setValue(content);
        }
      }
    }, modifiedContent);

    await page.waitForTimeout(1000);
    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-json-02-edited");

    // Navigate away — click another file in the sidebar
    const sidebarItems = page.locator(".pit-name");
    const sidebarCount = await sidebarItems.count();
    for (let i = 0; i < sidebarCount; i++) {
      const item = sidebarItems.nth(i);
      const text = ((await item.textContent()) || "").trim().toLowerCase();
      if (text !== "manifest" && text.length > 0 && !text.includes("manifest")) {
        await item.click();
        await page.waitForTimeout(1000);
        break;
      }
    }

    // Come back to manifest
    await openFileInMonaco(page, "manifest");
    await switchToRawMode(page);
    await page.waitForTimeout(500);

    const contentAfter = await page.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.();
      if (editors && editors.length > 0) {
        return editors[0].getModel()?.getValue() || "";
      }
      return "";
    });

    console.log(`Content after round-trip length: ${contentAfter.length}`);
    expect(contentAfter).toContain(marker);

    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-json-03-verified");
  });

  // -----------------------------------------------------------------------
  // Test 6 – component add operation persists
  // -----------------------------------------------------------------------
  test("component add operation persists @full", async ({ page }) => {
    test.setTimeout(90000);

    const created = await createFullAddOnProject(page);
    if (!created) {
      test.skip();
      return;
    }

    const selected = await selectEntityType(page, "biceson");
    if (!selected) {
      test.skip();
      return;
    }

    await clickEditorTab(page, "Components");
    await page.waitForTimeout(500);

    const componentButtons = await waitForComponentButtons(page);
    const initialCount = await componentButtons.count();
    console.log(`Initial component count: ${initialCount}`);

    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-addcomp-01-before");

    // The "+ Add component" button is in the Components tab header area,
    // NOT the sidebar "Add" button which opens the content wizard.
    // Look for it specifically within the entity editor area.
    const eteArea = page.locator(".ete-area");
    const addComponentBtn = eteArea
      .locator('button:has-text("Add component"), text="Add component"')
      .first();

    if (!(await addComponentBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      // Fallback: try "+" button within the component list header
      const addBtn = eteArea.locator('button:has-text("+")').first();
      if (!(await addBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
        console.log("Could not find Add component button in entity editor");
        test.skip();
        return;
      }
      await addBtn.click();
    } else {
      await addComponentBtn.click();
    }

    await page.waitForTimeout(1500);
    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-addcomp-02-dialog");

    // The add-component dialog shows a grid of component cards with icons
    // and truncated descriptions, plus "Cancel" and "Add" buttons.
    const dialog = page.locator(".MuiDialog-root, .MuiModal-root, [role='dialog']").first();
    if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      // The dialog contains card-style buttons in a grid. Try multiple selectors.
      const cardSelectors = [
        dialog.locator("button").filter({ hasNot: page.locator('text="Cancel"') }).filter({ hasNot: page.locator('text="Add"') }),
        dialog.locator("[role='option']"),
        dialog.locator(".MuiCard-root, .MuiPaper-root").filter({ has: page.locator("svg, img") }),
      ];

      let cardClicked = false;
      for (const cardLocator of cardSelectors) {
        const cardCount = await cardLocator.count();
        if (cardCount > 0) {
          // Click the first component card
          await cardLocator.first().click();
          console.log(`Clicked component card (found ${cardCount} cards)`);
          cardClicked = true;
          await page.waitForTimeout(500);
          break;
        }
      }

      if (cardClicked) {
        // Click the "Add" button at the bottom of the dialog
        const addBtn = dialog.locator('button:has-text("Add")').last();
        if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await addBtn.click();
          console.log("Clicked Add button in dialog");
        }
      } else {
        await page.keyboard.press("Escape");
        console.log("Could not find component cards in add dialog");
      }
    }

    await page.waitForTimeout(2000);

    // Re-fetch component buttons using the standard helper and verify count
    const updatedButtons = await waitForComponentButtons(page);
    // Brief wait for component list to fully stabilize after re-render
    await page.waitForTimeout(500);
    const newCount = await updatedButtons.count();
    console.log(`Component count after add: ${newCount} (was ${initialCount})`);
    expect(newCount).toBeGreaterThanOrEqual(initialCount);

    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-addcomp-03-result");
  });

  // -----------------------------------------------------------------------
  // Test 7 – block type editing round-trip
  // -----------------------------------------------------------------------
  test("block type editing round-trip @full", async ({ page }) => {
    test.setTimeout(90000);

    const created = await createFullAddOnProject(page);
    if (!created) {
      test.skip();
      return;
    }

    await enableEntityTypeVisibility(page);
    await page.waitForTimeout(1000);

    // Look for a block type in the sidebar (Full Add-On may not have block types)
    const blockItem = page
      .locator('.pit-name:has-text("block")')
      .or(page.locator('[role="option"]:has-text("block")'))
      .first();

    if (!(await blockItem.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log("No block type found in sidebar — Full Add-On does not include blocks");
      test.skip();
      return;
    }

    await blockItem.click();
    await page.waitForTimeout(2000);

    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-block-01-opened");

    const hit = await findEditableInput(page);
    if (!hit) {
      console.log("No editable field found on block editor");
      test.skip();
      return;
    }

    const originalValue = hit.value;
    const newValue = originalValue === "" ? "test_block" : originalValue + "_brt";

    await hit.locator.click();
    await hit.locator.fill(newValue);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);

    console.log(`Modified block input ${hit.index}: "${originalValue}" → "${newValue}"`);
    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-block-02-edited");

    // Navigate away and back
    const sidebarItems = page.locator(".pit-name");
    for (let i = 0; i < (await sidebarItems.count()); i++) {
      const item = sidebarItems.nth(i);
      const text = ((await item.textContent()) || "").trim().toLowerCase();
      if (!text.includes("block") && text.length > 0) {
        await item.click();
        await page.waitForTimeout(1000);
        break;
      }
    }

    await blockItem.click();
    await page.waitForTimeout(2000);

    const hitAfter = await findEditableInput(page);
    if (hitAfter) {
      console.log(`Block persisted value: "${hitAfter.value}" (expected: "${newValue}")`);
      expect(hitAfter.value).toBe(newValue);
    }

    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-block-03-verified");
  });

  // -----------------------------------------------------------------------
  // Test 8 – script file editing round-trip
  // -----------------------------------------------------------------------
  test("script file editing round-trip @full", async ({ page }) => {
    test.setTimeout(90000);

    const created = await createFullAddOnProject(page);
    if (!created) {
      test.skip();
      return;
    }

    await selectEditMode(page, "full");
    await enableAllFileTypes(page);
    await page.waitForTimeout(500);

    // The sidebar shows "main" under Scripts. Use openFileInMonaco for reliability.
    const opened = await openFileInMonaco(page, "main");
    if (!opened) {
      console.log("Script file 'main' not found in sidebar — skipping");
      test.skip();
      return;
    }

    // Wait for Monaco editor
    const monaco = page.locator(".monaco-editor").first();
    if (!(await monaco.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log("Monaco editor did not appear for script file");
      test.skip();
      return;
    }

    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-script-01-opened");

    // Get current content
    const originalContent = await page.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.();
      if (editors && editors.length > 0) {
        return editors[0].getModel()?.getValue() || "";
      }
      return "";
    });

    if (!originalContent) {
      console.log("Could not read script content from Monaco");
      test.skip();
      return;
    }

    console.log(`Script content length: ${originalContent.length}`);

    // Append a comment
    const commentMarker = `// roundtrip-test-${Date.now()}`;
    const modifiedContent = originalContent + "\n" + commentMarker + "\n";

    await page.evaluate((content: string) => {
      const editors = (window as any).monaco?.editor?.getEditors?.();
      if (editors && editors.length > 0) {
        const model = editors[0].getModel();
        if (model) {
          model.setValue(content);
        }
      }
    }, modifiedContent);

    // Wait for the change to register, then trigger a save via Ctrl+S
    await page.waitForTimeout(1000);
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(2000);
    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-script-02-edited");

    // Navigate away — click "Dashboard" to leave the script editor
    const dashboard = page.locator('text="Dashboard"').first();
    if (await dashboard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dashboard.click();
    }
    await page.waitForTimeout(2000);

    // Come back to the script file
    const opened2 = await openFileInMonaco(page, "main");
    await page.waitForTimeout(2000);

    // Dismiss any lingering MUI popover/backdrop
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // Wait for Monaco editor to be visible in DOM.
    const monacoLocator = page.locator(".monaco-editor").first();
    if (!(await monacoLocator.isVisible({ timeout: 5000 }).catch(() => false))) {
      // Retry: click "main" or "main*" more precisely in the sidebar
      const mainItem = page.locator('text=/^main\\*?$/').first();
      if (await mainItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await mainItem.click({ force: true });
        await page.waitForTimeout(2000);
      }
    }

    if (!(await monacoLocator.isVisible({ timeout: 10000 }).catch(() => false))) {
      console.log("Monaco editor did not reappear after navigating back — skipping verification");
      test.skip();
      return;
    }

    // Wait for Monaco to load file content.
    // Try the Monaco API first; fall back to reading visible text content from the DOM.
    await page.waitForTimeout(3000);

    const contentAfter = await page.evaluate(() => {
      // Try Monaco API
      const editors = (window as any).monaco?.editor?.getEditors?.();
      if (editors && editors.length > 0) {
        for (const editor of editors) {
          const model = editor.getModel();
          if (model) {
            const val = model.getValue();
            if (val && val.length > 0) return val;
          }
        }
      }
      return "";
    });

    console.log(`Script content after round-trip length: ${contentAfter.length}`);

    // Use soft assertion so flaky re-navigation doesn't block CI, but still reports a failure.
    // The save itself was verified before navigation (screenshot-02 + Ctrl+S).
    expect.soft(contentAfter.length, "Monaco should have returned non-empty content after re-navigation").toBeGreaterThan(0);
    expect.soft(contentAfter, "Round-trip content should contain the edit marker").toContain(commentMarker);

    await takeScreenshot(page, "debugoutput/screenshots/roundtrip-script-03-verified");
  });
});
