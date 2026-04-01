/**
 * UsabilityStudy.spec.ts
 *
 * Comprehensive usability study of Minecraft Creator Tools web app.
 * Tests 8 user flows from a beginning creator's perspective.
 *
 * Run with: npx playwright test UsabilityStudy.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import {
  processMessage,
  preferBrowserStorageInProjectDialog,
  selectEditMode,
  waitForEditorReady,
  setupRequestFailureTracking,
  FailedRequest,
  isIgnorable404Url,
} from "./WebTestUtilities";

const SCREENSHOT_DIR = "debugoutput/screenshots/usability-study";

/** Filter benign console warnings that don't represent real issues */
function filterBenignWarnings(warnings: { url: string; error: string }[]): { url: string; error: string }[] {
  return warnings.filter(
    (w) =>
      !w.error.includes("Body element does not contain trap zone element") &&
      !w.error.includes("out-of-range value") &&
      !w.error.includes("Each child in a list should have a unique") &&
      !w.error.includes("validateDOMNesting") &&
      !w.error.includes("aria-hidden") &&
      !w.error.includes("MUI:") &&
      !w.error.includes("Material-UI") &&
      !w.error.includes("React does not recognize") &&
      !w.error.includes("is not a valid") &&
      !w.error.includes("component is changing") &&
      !w.error.includes("findDOMNode") &&
      !w.error.includes("deprecated") &&
      !w.error.includes("MISSING_TRANSLATION") &&
      !w.error.includes("defaultProps") &&
      !w.error.includes("unique \"key\" prop") &&
      !w.error.includes("value and defaultValue")
  );
}

/** Open the Content Wizard by clicking the Add button */
async function openContentWizard(page: Page): Promise<boolean> {
  try {
    // Dismiss any lingering dialog
    const existingDialog = page.locator(".MuiDialog-root").first();
    if (await existingDialog.isVisible({ timeout: 500 }).catch(() => false)) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
    }

    const addButton = page.locator('button[aria-label="Add new content"]').first();
    if (!(await addButton.isVisible({ timeout: 3000 }))) {
      // Fallback: look for button with "Add" text or plus icon in toolbar
      const addFallback = page.locator('button:has-text("Add")').first();
      if (await addFallback.isVisible({ timeout: 2000 })) {
        await addFallback.click();
        await page.waitForTimeout(800);
        return true;
      }
      console.log("openContentWizard: Add button not visible");
      return false;
    }
    await addButton.click();
    await page.waitForTimeout(800);

    const wizardDialog = page.locator(".cwiz-launcher-wrapper, .cwiz-launcher, .MuiDialog-root").first();
    return await wizardDialog.isVisible({ timeout: 3000 });
  } catch (error) {
    console.log(`openContentWizard: Error - ${error}`);
    return false;
  }
}

/** Click a quick-action card in the Content Wizard */
async function clickWizardQuickAction(page: Page, label: string): Promise<boolean> {
  try {
    const quickAction = page.locator(`.cwiz-main-option:has-text("${label}")`).first();
    if (await quickAction.isVisible({ timeout: 3000 })) {
      await quickAction.click();
      await page.waitForTimeout(600);
      return true;
    }
    const fallback = page.getByText(label, { exact: false }).first();
    if (await fallback.isVisible({ timeout: 2000 })) {
      await fallback.click();
      await page.waitForTimeout(600);
      return true;
    }
    console.log(`clickWizardQuickAction: Could not find "${label}"`);
    return false;
  } catch (error) {
    console.log(`clickWizardQuickAction: Error - ${error}`);
    return false;
  }
}

/** Dismiss a name dialog by clicking Add/OK/Create */
async function dismissNameDialog(page: Page): Promise<boolean> {
  try {
    const dialog = page.locator(".MuiDialog-root, dialog, [role='dialog']").first();
    if (!(await dialog.isVisible({ timeout: 3000 }))) {
      return true;
    }

    // Wait for gallery items to load
    const galleryItem = dialog.locator(".itbi-outer").first();
    try {
      await expect(galleryItem).toBeVisible({ timeout: 8000 });
      await page.waitForTimeout(500);
    } catch {
      console.log("dismissNameDialog: Gallery items did not appear, proceeding");
    }

    const addButton = dialog.locator('button:has-text("Add")').first();
    if (await addButton.isVisible({ timeout: 2000 })) {
      await addButton.click();
      await page.waitForTimeout(1500);
      return true;
    }

    const submitButton = dialog
      .locator('button:has-text("OK"), button:has-text("Create"), [data-testid="submit-button"]')
      .first();
    if (await submitButton.isVisible({ timeout: 2000 })) {
      await submitButton.click();
      await page.waitForTimeout(1500);
      return true;
    }

    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);
    return true;
  } catch {
    return false;
  }
}

test.describe("Usability Study @usability", () => {
  // ═══════════════════════════════════════════════════════════════════
  //  Flow 1: Landing Page / Home Screen
  // ═══════════════════════════════════════════════════════════════════
  test("Flow 1: Landing Page / Home Screen", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);

    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    const failedRequests: FailedRequest[] = [];

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
    setupRequestFailureTracking(page, failedRequests);

    // Step 1: Navigate to home page
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow1-step01-homepage-landing.png`, fullPage: true });

    // Step 2: Check page title and basic content
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);

    // Step 3: Look for key UI elements
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log(`Home page text length: ${bodyText.length} chars`);

    // Step 4: Look for template cards / project options
    const createNewButtons = page.getByRole("button", { name: "Create New" });
    const createNewCount = await createNewButtons.count();
    console.log(`"Create New" buttons found: ${createNewCount}`);

    // Step 5: Look for file upload / import options
    const fileInputs = page.locator('input[type="file"]');
    const fileInputCount = await fileInputs.count();
    console.log(`File inputs found: ${fileInputCount}`);

    // Step 6: Check for gallery/gallery-like elements
    const galleryItems = page.locator(".home-area, .home-gallery, .gallery-item, .hp-gallery, .hp-templateCard");
    const galleryCount = await galleryItems.count();
    console.log(`Gallery-like elements found: ${galleryCount}`);

    // Step 7: Check for any welcome/info text
    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow1-step02-homepage-full.png`, fullPage: true });

    // Step 8: Capture viewport-only screenshot (what user actually sees first)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow1-step03-homepage-viewport.png`, fullPage: false });

    // Step 9: Look for navigation elements
    const allButtons = page.locator("button");
    const buttonCount = await allButtons.count();
    console.log(`Total buttons on home page: ${buttonCount}`);

    // Capture button texts for analysis
    const buttonTexts: string[] = [];
    for (let i = 0; i < Math.min(buttonCount, 30); i++) {
      const text = await allButtons.nth(i).innerText().catch(() => "");
      const ariaLabel = await allButtons.nth(i).getAttribute("aria-label").catch(() => "");
      if (text || ariaLabel) {
        buttonTexts.push(`[${i}] text="${text}" aria-label="${ariaLabel}"`);
      }
    }
    console.log("Home page buttons:\n" + buttonTexts.join("\n"));

    // Step 10: Check for links
    const allLinks = page.locator("a");
    const linkCount = await allLinks.count();
    console.log(`Total links on home page: ${linkCount}`);

    // Log JS errors
    const realErrors = consoleErrors.filter(
      (e) =>
        !e.error.includes("404") &&
        !e.error.includes("favicon") &&
        !e.error.includes("manifest")
    );
    console.log(`Console errors: ${realErrors.length}`);
    for (const err of realErrors) {
      console.log(`  ERROR: ${err.error.substring(0, 200)}`);
    }

    const unexpectedFailures = failedRequests.filter((r) => !isIgnorable404Url(r.url));
    console.log(`Unexpected failed requests: ${unexpectedFailures.length}`);
    for (const req of unexpectedFailures) {
      console.log(`  FAILED: ${req.status} ${req.url.substring(0, 150)}`);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Flow 2: Create a New Project
  // ═══════════════════════════════════════════════════════════════════
  test("Flow 2: Create a New Project", async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);

    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    const failedRequests: FailedRequest[] = [];

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
    setupRequestFailureTracking(page, failedRequests);

    // Step 1: Navigate to home
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow2-step01-homepage.png`, fullPage: true });

    // Step 2: Find and click Create New
    const createNewButton = page.getByRole("button", { name: "Create New" }).first();
    await expect(createNewButton).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow2-step02-before-create-click.png`, fullPage: true });
    await createNewButton.click();
    await page.waitForTimeout(1500);

    // Step 3: Screenshot the project creation dialog
    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow2-step03-project-creation-dialog.png`, fullPage: true });

    // Step 4: Explore what's in the dialog
    const dialog = page.locator(".MuiDialog-root, dialog, [role='dialog']").first();
    const dialogVisible = await dialog.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Project dialog visible: ${dialogVisible}`);

    // Step 5: Look for form fields
    const nameInput = page.locator('input[type="text"]').first();
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Try to fill in the project name
      await nameInput.clear();
      await nameInput.fill("My Test Add-On");
      console.log("Filled project name");
    }

    // Try to find and fill creator/description fields
    const allInputs = page.locator('input[type="text"], textarea');
    const inputCount = await allInputs.count();
    console.log(`Text inputs in dialog: ${inputCount}`);

    // Look for labeled inputs
    for (let i = 0; i < inputCount; i++) {
      const label = await allInputs.nth(i).getAttribute("aria-label").catch(() => "");
      const placeholder = await allInputs.nth(i).getAttribute("placeholder").catch(() => "");
      const id = await allInputs.nth(i).getAttribute("id").catch(() => "");
      console.log(`  Input[${i}]: label="${label}" placeholder="${placeholder}" id="${id}"`);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow2-step04-dialog-fields.png`, fullPage: true });

    // Step 6: Select browser storage
    await preferBrowserStorageInProjectDialog(page);
    await page.waitForTimeout(300);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow2-step05-storage-selected.png`, fullPage: true });

    // Step 7: Submit the dialog
    const submitButton = page.getByTestId("submit-button").first();
    if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitButton.click();
      console.log("Clicked submit button");
    } else {
      const createBtn = page.locator('button:has-text("Create Project"), button:has-text("Create"), button:has-text("OK")').first();
      if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createBtn.click();
        console.log("Clicked Create/OK button");
      }
    }

    // Step 8: Wait for editor to load
    await page.waitForTimeout(9000);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow2-step06-after-project-creation.png`, fullPage: true });

    // Step 9: Check if we landed in the editor
    const editorReady = await waitForEditorReady(page, 15000);
    console.log(`Editor ready: ${editorReady}`);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow2-step07-editor-loaded.png`, fullPage: true });

    // Log errors
    const realErrors = consoleErrors.filter(
      (e) => !e.error.includes("404") && !e.error.includes("favicon")
    );
    console.log(`Flow 2 console errors: ${realErrors.length}`);
    for (const err of realErrors) {
      console.log(`  ERROR: ${err.error.substring(0, 200)}`);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Flow 3: Explore Project Editor
  // ═══════════════════════════════════════════════════════════════════
  test("Flow 3: Explore Project Editor", async ({ page }, testInfo) => {
    testInfo.setTimeout(120000);

    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    const failedRequests: FailedRequest[] = [];

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
    setupRequestFailureTracking(page, failedRequests);

    // Enter the editor via project creation
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const createNewButton = page.getByRole("button", { name: "Create New" }).first();
    await expect(createNewButton).toBeVisible({ timeout: 10000 });
    await createNewButton.click();
    await page.waitForTimeout(1000);
    await preferBrowserStorageInProjectDialog(page);

    const submitButton = page.getByTestId("submit-button").first();
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();

    await page.waitForTimeout(9000);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Step 1: Screenshot the initial editor state (with FRE panel if visible)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow3-step01-editor-initial-fre.png`, fullPage: true });

    // Step 2: Select Focused mode
    await selectEditMode(page, "focused");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow3-step02-focused-mode.png`, fullPage: true });

    // Step 3: Explore the sidebar - list all visible items
    const sidebarItems = page.locator(".pil-outer .pit-name, .pil-outer .pit-label, [class*='sidebar'] [class*='item'], [class*='tree'] [class*='label']");
    const sidebarCount = await sidebarItems.count();
    console.log(`Sidebar items found: ${sidebarCount}`);
    for (let i = 0; i < Math.min(sidebarCount, 20); i++) {
      const text = await sidebarItems.nth(i).innerText().catch(() => "");
      console.log(`  Sidebar[${i}]: "${text}"`);
    }

    // Step 4: Click on first sidebar item (usually Dashboard/Getting Started)
    if (sidebarCount > 0) {
      await sidebarItems.first().click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/flow3-step03-first-sidebar-item.png`, fullPage: true });
    }

    // Step 5: Look for and explore toolbar buttons
    const toolbarButtons = page.locator('.pe-toolbar button, [aria-label*="toolbar"] button, .MuiToolbar-root button');
    const toolbarCount = await toolbarButtons.count();
    console.log(`Toolbar buttons found: ${toolbarCount}`);
    for (let i = 0; i < Math.min(toolbarCount, 20); i++) {
      const text = await toolbarButtons.nth(i).innerText().catch(() => "");
      const label = await toolbarButtons.nth(i).getAttribute("aria-label").catch(() => "");
      console.log(`  Toolbar[${i}]: text="${text}" label="${label}"`);
    }

    // Step 6: Take a viewport screenshot of the editor layout
    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow3-step04-editor-viewport.png`, fullPage: false });

    // Step 7: Try switching to Full mode
    await selectEditMode(page, "full");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow3-step05-full-mode.png`, fullPage: true });

    // Step 8: Explore sidebar in Full mode - should show more items
    const fullSidebarItems = page.locator(".pil-outer .pit-name");
    const fullSidebarCount = await fullSidebarItems.count();
    console.log(`Full mode sidebar items: ${fullSidebarCount}`);
    for (let i = 0; i < Math.min(fullSidebarCount, 25); i++) {
      const text = await fullSidebarItems.nth(i).innerText().catch(() => "");
      console.log(`  Full sidebar[${i}]: "${text}"`);
    }

    // Step 9: Click through a few sidebar items in full mode
    for (let i = 0; i < Math.min(fullSidebarCount, 3); i++) {
      const text = await fullSidebarItems.nth(i).innerText().catch(() => "");
      await fullSidebarItems.nth(i).click();
      await page.waitForTimeout(1500);
      const safeName = text.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/flow3-step06-sidebar-${safeName}.png`,
        fullPage: true,
      });
    }

    // Step 10: Switch back to Focused mode
    await selectEditMode(page, "focused");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow3-step07-back-to-focused.png`, fullPage: true });

    console.log(`Flow 3 console errors: ${consoleErrors.length}`);
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Flow 4: Edit Project Settings
  // ═══════════════════════════════════════════════════════════════════
  test("Flow 4: Edit Project Settings", async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);

    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    const failedRequests: FailedRequest[] = [];

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
    setupRequestFailureTracking(page, failedRequests);

    // Enter editor
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const createNewButton = page.getByRole("button", { name: "Create New" }).first();
    await expect(createNewButton).toBeVisible({ timeout: 10000 });
    await createNewButton.click();
    await page.waitForTimeout(1000);
    await preferBrowserStorageInProjectDialog(page);

    const submitButton = page.getByTestId("submit-button").first();
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();

    await page.waitForTimeout(9000);
    await page.waitForLoadState("networkidle");

    await selectEditMode(page, "focused");
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow4-step01-editor-ready.png`, fullPage: true });

    // Step 2: Try to find project settings or properties
    // Look for settings in sidebar
    const settingsItem = page.locator('text=/Settings|Properties|Project Info|Project Settings/i').first();
    if (await settingsItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingsItem.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/flow4-step02-settings-panel.png`, fullPage: true });
    } else {
      console.log("Settings item not found in sidebar, trying sidebar clicks");

      // Try clicking sidebar items to find settings
      const sidebarItems = page.locator(".pil-outer .pit-name");
      const count = await sidebarItems.count();
      for (let i = 0; i < count; i++) {
        const text = await sidebarItems.nth(i).innerText().catch(() => "");
        if (text.toLowerCase().includes("setting") || text.toLowerCase().includes("propert") || text.toLowerCase().includes("info")) {
          await sidebarItems.nth(i).click();
          await page.waitForTimeout(1500);
          await page.screenshot({ path: `${SCREENSHOT_DIR}/flow4-step02-settings-panel.png`, fullPage: true });
          break;
        }
      }
    }

    // Step 3: Try the Settings toolbar button directly
    const settingsToolbarBtn = page.getByRole("button", { name: "Settings" }).first();
    if (await settingsToolbarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingsToolbarBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/flow4-step03-settings-menu.png`, fullPage: true });
      
      // Look for menu items inside the settings popover
      const menuItems = page.locator('.MuiMenuItem-root, [role="menuitem"]');
      const menuCount = await menuItems.count();
      console.log(`Settings menu items: ${menuCount}`);
      for (let i = 0; i < Math.min(menuCount, 10); i++) {
        const text = await menuItems.nth(i).innerText().catch(() => "");
        console.log(`  Settings menu[${i}]: "${text}"`);
      }
      
      // Click the first settings-related menu item if available
      if (menuCount > 0) {
        await menuItems.first().click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/flow4-step04-settings-panel.png`, fullPage: true });
      } else {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
    }

    // Step 3b: Try the View menu
    const viewButton = page.getByRole("button", { name: /view/i }).first();
    if (await viewButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await viewButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/flow4-step03b-view-menu.png`, fullPage: true });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    // Step 4: Switch to Full mode to find project settings in sidebar
    await selectEditMode(page, "full");
    await page.waitForTimeout(2000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow4-step05-full-mode-for-settings.png`, fullPage: true });

    // Look for manifest or project info items
    const fullSidebarItems = page.locator(".pil-outer .pit-name");
    const fullCount = await fullSidebarItems.count();
    for (let i = 0; i < fullCount; i++) {
      const text = await fullSidebarItems.nth(i).innerText().catch(() => "");
      if (
        text.toLowerCase().includes("manifest") ||
        text.toLowerCase().includes("setting") ||
        text.toLowerCase().includes("pack") ||
        text.toLowerCase().includes("project")
      ) {
        console.log(`Found potential settings item: "${text}"`);
        await fullSidebarItems.nth(i).click();
        await page.waitForTimeout(1500);
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/flow4-step06-project-item-${i}.png`,
          fullPage: true,
        });
        break;
      }
    }

    console.log(`Flow 4 console errors: ${consoleErrors.length}`);
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Flow 5: Create a Mob/Entity
  // ═══════════════════════════════════════════════════════════════════
  test("Flow 5: Create a Mob/Entity", async ({ page }, testInfo) => {
    testInfo.setTimeout(120000);

    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    const failedRequests: FailedRequest[] = [];

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
    setupRequestFailureTracking(page, failedRequests);

    // Enter editor
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const createNewButton = page.getByRole("button", { name: "Create New" }).first();
    await expect(createNewButton).toBeVisible({ timeout: 10000 });
    await createNewButton.click();
    await page.waitForTimeout(1000);
    await preferBrowserStorageInProjectDialog(page);

    const submitButton = page.getByTestId("submit-button").first();
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();

    await page.waitForTimeout(9000);
    await page.waitForLoadState("networkidle");

    await selectEditMode(page, "focused");
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow5-step01-editor-ready.png`, fullPage: true });

    // Step 2: Open Content Wizard
    const wizardOpened = await openContentWizard(page);
    console.log(`Content Wizard opened: ${wizardOpened}`);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow5-step02-content-wizard.png`, fullPage: true });

    // Step 3: Look for entity/mob creation option
    const mobOptions = page.locator('text=/Mob|Entity|Creature|Monster/i');
    const mobCount = await mobOptions.count();
    console.log(`Mob/Entity related options: ${mobCount}`);
    for (let i = 0; i < mobCount; i++) {
      const text = await mobOptions.nth(i).innerText().catch(() => "");
      console.log(`  Mob option[${i}]: "${text}"`);
    }

    // Step 4: Click on mob/entity creation
    const mobCreated = await clickWizardQuickAction(page, "Mob");
    if (!mobCreated) {
      // Try "Entity" 
      const entityCreated = await clickWizardQuickAction(page, "Entity");
      if (!entityCreated) {
        console.log("Could not find Mob or Entity option, trying broader search");
        // Take screenshot of what's available
        await page.screenshot({ path: `${SCREENSHOT_DIR}/flow5-step03-wizard-options.png`, fullPage: true });
      }
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow5-step04-after-mob-click.png`, fullPage: true });

    // Step 5: Handle the name dialog
    const dialog = page.locator(".MuiDialog-root, [role='dialog']").first();
    if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Try to enter a custom name
      const nameInput = dialog.locator('input[type="text"]').first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.clear();
        await nameInput.fill("cool_zombie");
        console.log("Entered entity name: cool_zombie");
      }

      await page.screenshot({ path: `${SCREENSHOT_DIR}/flow5-step05-entity-name-dialog.png`, fullPage: true });

      // Look for gallery/template items
      const galleryItems = dialog.locator(".itbi-outer, .gallery-item, [class*='template']");
      const galleryCount = await galleryItems.count();
      console.log(`Template gallery items: ${galleryCount}`);

      // Dismiss the dialog
      await dismissNameDialog(page);
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow5-step06-entity-created.png`, fullPage: true });

    // Step 6: Explore the entity editor
    // Look for editor tabs
    const editorTabs = page.locator('.eht-outerStack button, .eht-outer button, [role="tab"]');
    const tabCount = await editorTabs.count();
    console.log(`Entity editor tabs: ${tabCount}`);
    for (let i = 0; i < Math.min(tabCount, 15); i++) {
      const text = await editorTabs.nth(i).innerText().catch(() => "");
      console.log(`  Tab[${i}]: "${text}"`);
    }

    // Step 7: Click through each tab
    for (let i = 0; i < Math.min(tabCount, 6); i++) {
      const text = await editorTabs.nth(i).innerText().catch(() => "");
      await editorTabs.nth(i).click();
      await page.waitForTimeout(1000);
      const safeName = text.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 20);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/flow5-step07-tab-${safeName}.png`,
        fullPage: true,
      });
    }

    console.log(`Flow 5 console errors: ${consoleErrors.length}`);
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Flow 6: Create an Item
  // ═══════════════════════════════════════════════════════════════════
  test("Flow 6: Create an Item", async ({ page }, testInfo) => {
    testInfo.setTimeout(120000);

    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    const failedRequests: FailedRequest[] = [];

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
    setupRequestFailureTracking(page, failedRequests);

    // Enter editor
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const createNewButton = page.getByRole("button", { name: "Create New" }).first();
    await expect(createNewButton).toBeVisible({ timeout: 10000 });
    await createNewButton.click();
    await page.waitForTimeout(1000);
    await preferBrowserStorageInProjectDialog(page);

    const submitButton = page.getByTestId("submit-button").first();
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();

    await page.waitForTimeout(9000);
    await page.waitForLoadState("networkidle");

    await selectEditMode(page, "focused");
    await page.waitForTimeout(1000);

    // Step 1: Open Content Wizard for item
    const wizardOpened = await openContentWizard(page);
    console.log(`Content Wizard opened for item: ${wizardOpened}`);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow6-step01-content-wizard.png`, fullPage: true });

    // Step 2: Click on item creation
    const itemCreated = await clickWizardQuickAction(page, "Item");
    console.log(`Item quick action found: ${itemCreated}`);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow6-step02-after-item-click.png`, fullPage: true });

    // Step 3: Handle name dialog
    const dialog = page.locator(".MuiDialog-root, [role='dialog']").first();
    if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      const nameInput = dialog.locator('input[type="text"]').first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.clear();
        await nameInput.fill("magic_sword");
        console.log("Entered item name: magic_sword");
      }

      await page.screenshot({ path: `${SCREENSHOT_DIR}/flow6-step03-item-name-dialog.png`, fullPage: true });

      // Check gallery items
      const galleryItems = dialog.locator(".itbi-outer");
      const galleryCount = await galleryItems.count();
      console.log(`Item template gallery items: ${galleryCount}`);

      await dismissNameDialog(page);
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow6-step04-item-created.png`, fullPage: true });

    // Step 4: Explore item editor tabs
    const editorTabs = page.locator('.eht-outerStack button, .eht-outer button, [role="tab"]');
    const tabCount = await editorTabs.count();
    console.log(`Item editor tabs: ${tabCount}`);
    for (let i = 0; i < Math.min(tabCount, 10); i++) {
      const text = await editorTabs.nth(i).innerText().catch(() => "");
      console.log(`  Item Tab[${i}]: "${text}"`);
    }

    // Click through tabs
    for (let i = 0; i < Math.min(tabCount, 5); i++) {
      const text = await editorTabs.nth(i).innerText().catch(() => "");
      await editorTabs.nth(i).click();
      await page.waitForTimeout(1000);
      const safeName = text.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 20);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/flow6-step05-itemtab-${safeName}.png`,
        fullPage: true,
      });
    }

    console.log(`Flow 6 console errors: ${consoleErrors.length}`);
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Flow 7: Create a Block
  // ═══════════════════════════════════════════════════════════════════
  test("Flow 7: Create a Block", async ({ page }, testInfo) => {
    testInfo.setTimeout(120000);

    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    const failedRequests: FailedRequest[] = [];

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
    setupRequestFailureTracking(page, failedRequests);

    // Enter editor
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const createNewButton = page.getByRole("button", { name: "Create New" }).first();
    await expect(createNewButton).toBeVisible({ timeout: 10000 });
    await createNewButton.click();
    await page.waitForTimeout(1000);
    await preferBrowserStorageInProjectDialog(page);

    const submitButton = page.getByTestId("submit-button").first();
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();

    await page.waitForTimeout(9000);
    await page.waitForLoadState("networkidle");

    await selectEditMode(page, "focused");
    await page.waitForTimeout(1000);

    // Step 1: Open Content Wizard for block
    const wizardOpened = await openContentWizard(page);
    console.log(`Content Wizard opened for block: ${wizardOpened}`);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow7-step01-content-wizard.png`, fullPage: true });

    // Step 2: Click on block creation
    const blockCreated = await clickWizardQuickAction(page, "Block");
    console.log(`Block quick action found: ${blockCreated}`);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow7-step02-after-block-click.png`, fullPage: true });

    // Step 3: Handle name dialog
    const dialog = page.locator(".MuiDialog-root, [role='dialog']").first();
    if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      const nameInput = dialog.locator('input[type="text"]').first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.clear();
        await nameInput.fill("crystal_ore");
        console.log("Entered block name: crystal_ore");
      }

      await page.screenshot({ path: `${SCREENSHOT_DIR}/flow7-step03-block-name-dialog.png`, fullPage: true });

      const galleryItems = dialog.locator(".itbi-outer");
      const galleryCount = await galleryItems.count();
      console.log(`Block template gallery items: ${galleryCount}`);

      await dismissNameDialog(page);
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow7-step04-block-created.png`, fullPage: true });

    // Step 4: Explore block editor tabs
    const editorTabs = page.locator('.eht-outerStack button, .eht-outer button, [role="tab"]');
    const tabCount = await editorTabs.count();
    console.log(`Block editor tabs: ${tabCount}`);
    for (let i = 0; i < Math.min(tabCount, 10); i++) {
      const text = await editorTabs.nth(i).innerText().catch(() => "");
      console.log(`  Block Tab[${i}]: "${text}"`);
    }

    for (let i = 0; i < Math.min(tabCount, 5); i++) {
      const text = await editorTabs.nth(i).innerText().catch(() => "");
      await editorTabs.nth(i).click();
      await page.waitForTimeout(1000);
      const safeName = text.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 20);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/flow7-step05-blocktab-${safeName}.png`,
        fullPage: true,
      });
    }

    console.log(`Flow 7 console errors: ${consoleErrors.length}`);
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Flow 8: Test Export/Validation
  // ═══════════════════════════════════════════════════════════════════
  test("Flow 8: Test Export and Validation", async ({ page }, testInfo) => {
    testInfo.setTimeout(120000);

    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    const failedRequests: FailedRequest[] = [];

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
    setupRequestFailureTracking(page, failedRequests);

    // Enter editor
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const createNewButton = page.getByRole("button", { name: "Create New" }).first();
    await expect(createNewButton).toBeVisible({ timeout: 10000 });
    await createNewButton.click();
    await page.waitForTimeout(1000);
    await preferBrowserStorageInProjectDialog(page);

    const submitButton = page.getByTestId("submit-button").first();
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();

    await page.waitForTimeout(9000);
    await page.waitForLoadState("networkidle");

    await selectEditMode(page, "focused");
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow8-step01-editor-ready.png`, fullPage: true });

    // Step 2: Look for export/share button in toolbar
    const exportButton = page.getByRole("button", { name: /^(Share|Export)( \(.+\))?$/i }).first();
    const exportVisible = await exportButton.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Export/Share button visible: ${exportVisible}`);

    if (exportVisible) {
      await page.screenshot({ path: `${SCREENSHOT_DIR}/flow8-step02-before-export-click.png`, fullPage: true });
      await exportButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/flow8-step03-export-menu.png`, fullPage: true });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    // Step 3: Look for dashboard export options
    const dashboardExport = page.locator("button").filter({ hasText: /Install in Minecraft|Download.*\.mcaddon|Export/i }).first();
    if (await dashboardExport.isVisible({ timeout: 3000 }).catch(() => false)) {
      const exportText = await dashboardExport.innerText().catch(() => "");
      console.log(`Dashboard export button: "${exportText}"`);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/flow8-step04-dashboard-export.png`, fullPage: true });
    }

    // Step 4: Look for validate/inspect functionality
    const inspectButton = page.locator('button:has-text("Inspect"), button:has-text("Validate"), button:has-text("Check")').first();
    if (await inspectButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await inspectButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/flow8-step05-validation-results.png`, fullPage: true });
    } else {
      console.log("No direct Inspect/Validate button found, trying sidebar");

      // Look in sidebar for inspector
      const inspectorItem = page.locator('text=/Inspector|Validate|Issues|Errors/i').first();
      if (await inspectorItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await inspectorItem.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/flow8-step05-validation-results.png`, fullPage: true });
      }
    }

    // Step 5: Try the toolbar test/run button
    const testButton = page.getByRole("button", { name: /^(Run|Test)$/i }).first();
    if (await testButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await testButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/flow8-step06-test-menu.png`, fullPage: true });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    // Step 6: Look for Actions menu
    const actionsButton = page.locator('button:has-text("Actions"), button:has-text("Tools")').first();
    if (await actionsButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await actionsButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/flow8-step07-actions-menu.png`, fullPage: true });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    // Step 7: Final screenshot of complete editor state
    await page.screenshot({ path: `${SCREENSHOT_DIR}/flow8-step08-final-state.png`, fullPage: true });

    console.log(`Flow 8 console errors: ${consoleErrors.length}`);
    for (const err of consoleErrors) {
      console.log(`  ERROR: ${err.error.substring(0, 200)}`);
    }
  });
});
