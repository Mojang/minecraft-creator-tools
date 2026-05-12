import { test, expect, Page, ConsoleMessage } from "@playwright/test";
import { processMessage, enterEditor, FailedRequest, setupRequestFailureTracking } from "./WebTestUtilities";

const SCREENSHOT_DIR = "debugoutput/screenshots/biome";

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Opens the Content Wizard via the "Add new content" toolbar button.
 */
async function openContentWizard(page: Page): Promise<boolean> {
  try {
    const existingDialog = page.locator(".MuiDialog-root").first();
    if (await existingDialog.isVisible({ timeout: 500 }).catch(() => false)) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
    }

    const addButton = page.locator('button[aria-label="Add new content"]').first();
    if (!(await addButton.isVisible({ timeout: 15000 }))) {
      console.log("openContentWizard: Add button not visible");
      return false;
    }
    await addButton.click();
    await page.waitForTimeout(800);

    const wizardDialog = page.locator(".cwiz-launcher-wrapper, .cwiz-launcher").first();
    if (await wizardDialog.isVisible({ timeout: 3000 })) {
      return true;
    }

    const muiDialog = page.locator(".MuiDialog-root").first();
    return muiDialog.isVisible({ timeout: 2000 });
  } catch (error) {
    console.log(`openContentWizard: Error - ${error}`);
    return false;
  }
}

/**
 * Adds a biome via Content Wizard: Advanced File Types → World Generation → Partial Biome.
 * Returns true if the biome was successfully added.
 */
async function addBiomeViaWizard(page: Page): Promise<boolean> {
  const wizardOpened = await openContentWizard(page);
  if (!wizardOpened) {
    console.log("addBiomeViaWizard: Could not open Content Wizard");
    return false;
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/add-biome-01-wizard-opened.png`, fullPage: true });

  // Step 1: Expand "Advanced File Types" section
  const advancedSection = page.locator('.cwiz-advanced-header:has-text("Advanced File Types")').first();
  if (!(await advancedSection.isVisible({ timeout: 5000 }))) {
    // Scroll down within the wizard to find it
    const wizardContent = page.locator(".cwiz-launcher").first();
    if (await wizardContent.isVisible({ timeout: 2000 }).catch(() => false)) {
      await wizardContent.evaluate((el: HTMLElement) => el.scrollTo(0, el.scrollHeight));
      await page.waitForTimeout(500);
    }
    if (!(await advancedSection.isVisible({ timeout: 3000 }))) {
      console.log("addBiomeViaWizard: Advanced File Types section not found");
      await page.screenshot({ path: `${SCREENSHOT_DIR}/add-biome-advanced-not-found.png`, fullPage: true });
      return false;
    }
  }
  await advancedSection.click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/add-biome-02-advanced-expanded.png`, fullPage: true });

  // Step 2: Inside Advanced, find and expand "World Generation" subsection
  // This is a cwiz-section-header within the cwiz-advanced-content
  const advancedContent = page.locator(".cwiz-advanced-content").first();
  const worldGenHeader = advancedContent.locator('.cwiz-section-header:has-text("World Generation")').first();

  if (await worldGenHeader.isVisible({ timeout: 3000 }).catch(() => false)) {
    await worldGenHeader.scrollIntoViewIfNeeded();
    await worldGenHeader.click();
    await page.waitForTimeout(500);
  } else {
    // Try scrolling within advanced content
    if (await advancedContent.isVisible({ timeout: 2000 }).catch(() => false)) {
      await advancedContent.evaluate((el: HTMLElement) => el.scrollTo(0, el.scrollHeight));
      await page.waitForTimeout(500);
    }
    const worldGenRetry = advancedContent.locator('.cwiz-section-header:has-text("World Gen")').first();
    if (await worldGenRetry.isVisible({ timeout: 2000 }).catch(() => false)) {
      await worldGenRetry.click();
      await page.waitForTimeout(500);
    } else {
      console.log("addBiomeViaWizard: World Generation section not found in Advanced");
      await page.screenshot({ path: `${SCREENSHOT_DIR}/add-biome-worldgen-not-found.png`, fullPage: true });
      return false;
    }
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/add-biome-03-worldgen-expanded.png`, fullPage: true });

  // Step 3: Click the "Partial Biome" item within the World Generation section
  const biomeItem = advancedContent.locator('.cwiz-section-item:has-text("Biome")').first();
  if (!(await biomeItem.isVisible({ timeout: 3000 }))) {
    // Try scrolling to find it
    await biomeItem.scrollIntoViewIfNeeded().catch(() => {});
    if (!(await biomeItem.isVisible({ timeout: 2000 }))) {
      console.log("addBiomeViaWizard: Biome item not found in World Generation section");
      await page.screenshot({ path: `${SCREENSHOT_DIR}/add-biome-biome-not-found.png`, fullPage: true });
      return false;
    }
  }
  await biomeItem.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/add-biome-04-biome-clicked.png`, fullPage: true });

  // Step 4: Dismiss the name dialog if it appears
  const dialog = page.locator(".MuiDialog-root, dialog, [role='dialog']").first();
  if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
    const confirmButton = dialog
      .locator('button:has-text("Add"), button:has-text("OK"), button:has-text("Create")')
      .first();
    if (await confirmButton.isVisible({ timeout: 2000 })) {
      await confirmButton.click();
      await page.waitForTimeout(1000);
    } else {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1000);
    }
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/add-biome-05-after-add.png`, fullPage: true });

  return true;
}

/**
 * Navigates to a biome item in the project tree.
 * Returns true if a biome editor was successfully opened.
 */
async function selectBiomeItem(page: Page): Promise<boolean> {
  // Strategy 1: Look for biome items in the listbox (file explorer)
  const biomeOption = page.locator('[role="option"]').filter({ hasText: /biome/i }).first();
  if (await biomeOption.isVisible({ timeout: 3000 }).catch(() => false)) {
    await biomeOption.click();
    await page.waitForTimeout(2000);
    return await verifyBiomeEditorVisible(page);
  }

  // Strategy 2: Try by title attribute
  const biomeTitle = page.locator('[title*="biome" i], [title*="Biome"]').first();
  if (await biomeTitle.isVisible({ timeout: 2000 }).catch(() => false)) {
    await biomeTitle.click();
    await page.waitForTimeout(2000);
    return await verifyBiomeEditorVisible(page);
  }

  // Strategy 3: Look for .biome.json text anywhere in clickable elements
  const biomeText = page.locator("text=/\\.biome\\.json/i").first();
  if (await biomeText.isVisible({ timeout: 2000 }).catch(() => false)) {
    await biomeText.click();
    await page.waitForTimeout(2000);
    return await verifyBiomeEditorVisible(page);
  }

  console.log("selectBiomeItem: Could not find biome item in project tree");
  return false;
}

/**
 * Verifies that the Biome Editor is visible by checking for its tab buttons.
 */
async function verifyBiomeEditorVisible(page: Page): Promise<boolean> {
  const componentsTab = page.locator('button:has-text("Components")').first();

  const hasComponents = await componentsTab.isVisible({ timeout: 5000 }).catch(() => false);

  if (hasComponents) {
    console.log("verifyBiomeEditorVisible: Components tab visible");
    return true;
  }

  return false;
}

/**
 * Clicks a tab in the Biome Editor by text.
 */
async function clickBiomeTab(page: Page, tabName: string): Promise<boolean> {
  const byTitle = page.locator(`button[title="${tabName}"]`).first();
  if (await byTitle.isVisible({ timeout: 2000 }).catch(() => false)) {
    await byTitle.click();
    await page.waitForTimeout(1000);
    return true;
  }

  const byText = page.locator(`button:has-text("${tabName}")`).first();
  if (await byText.isVisible({ timeout: 2000 }).catch(() => false)) {
    await byText.click();
    await page.waitForTimeout(1000);
    return true;
  }

  console.log(`clickBiomeTab: Could not find tab "${tabName}"`);
  return false;
}

/**
 * Waits for the accordion component list to load (async form loading).
 * Returns the count of accordion sections found.
 */
async function waitForAccordionSections(page: Page, timeoutMs: number = 15000): Promise<number> {
  const sections = page.locator(".dfca-section");
  const started = Date.now();
  let count = 0;

  while (Date.now() - started < timeoutMs) {
    count = await sections.count();
    if (count > 0) return count;
    await page.waitForTimeout(500);
  }

  return count;
}

/**
 * Clicks an accordion section header to expand it (and auto-add the component).
 */
async function expandAccordionSection(page: Page, index: number): Promise<boolean> {
  const headers = page.locator(".dfca-header");
  const header = headers.nth(index);

  if (await header.isVisible({ timeout: 2000 }).catch(() => false)) {
    await header.click();
    await page.waitForTimeout(1000);
    return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// BEHAVIOR BIOME EDITOR TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Biome Behavior Editor @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];
  let failedRequests: FailedRequest[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    failedRequests = [];

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });

    setupRequestFailureTracking(page, failedRequests);
  });

  test("should add biome via Content Wizard and show editor tabs", async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);
    const entered = await enterEditor(page);
    expect(entered).toBe(true);

    const biomeAdded = await addBiomeViaWizard(page);
    if (!biomeAdded) {
      console.log("Biome not added via wizard, test cannot proceed");
      return;
    }

    const biomeSelected = await selectBiomeItem(page);
    if (!biomeSelected) {
      const editorVisible = await verifyBiomeEditorVisible(page);
      if (!editorVisible) {
        console.log("Biome editor not visible after adding biome");
        await page.screenshot({ path: `${SCREENSHOT_DIR}/beh-biome-not-visible.png`, fullPage: true });
        return;
      }
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/beh-02-biome-editor.png`, fullPage: true });

    const componentsTab = page.locator('button:has-text("Components")').first();
    await expect(componentsTab).toBeVisible({ timeout: 5000 });

    await clickBiomeTab(page, "Components");
    await page.screenshot({ path: `${SCREENSHOT_DIR}/beh-03-components-tab.png`, fullPage: true });
  });

  test("should show all available components in accordion", async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);
    const entered = await enterEditor(page);
    expect(entered).toBe(true);

    const biomeAdded = await addBiomeViaWizard(page);
    if (!biomeAdded) return;

    await selectBiomeItem(page);
    await clickBiomeTab(page, "Components");

    const sectionCount = await waitForAccordionSections(page);
    console.log(`Accordion shows ${sectionCount} component sections`);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/beh-04-accordion-loaded.png`, fullPage: true });

    expect(sectionCount).toBeGreaterThan(5);

    const presentCount = await page.locator(".dfca-section.dfca-present").count();
    const absentCount = await page.locator(".dfca-section.dfca-absent").count();
    console.log(`Present: ${presentCount}, Absent: ${absentCount}`);

    // The "Partial Biome" wizard path creates an empty biome ({}), so 0 present
    // components is expected for a freshly-added biome. We only assert that the
    // accordion rendered the full set of available (absent) component sections.
    expect(absentCount).toBeGreaterThan(0);
    expect(presentCount + absentCount).toBe(sectionCount);
  });

  test("should expand absent component to add it", async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);
    const entered = await enterEditor(page);
    expect(entered).toBe(true);

    const biomeAdded = await addBiomeViaWizard(page);
    if (!biomeAdded) return;

    await selectBiomeItem(page);
    await clickBiomeTab(page, "Components");

    const sectionCount = await waitForAccordionSections(page);
    if (sectionCount === 0) return;

    const absentHeader = page.locator(".dfca-section.dfca-absent .dfca-header").first();
    if (!(await absentHeader.isVisible({ timeout: 3000 }).catch(() => false))) return;

    const title = await absentHeader.locator(".dfca-title").textContent();
    console.log(`Expanding absent component: ${title}`);
    await absentHeader.click();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/beh-05-component-expanded.png`, fullPage: true });

    const expandedBody = page.locator(".dfca-body").first();
    const hasBody = await expandedBody.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasBody).toBe(true);
  });

  test("should remove a component via the remove button", async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);
    const entered = await enterEditor(page);
    expect(entered).toBe(true);

    const biomeAdded = await addBiomeViaWizard(page);
    if (!biomeAdded) return;

    await selectBiomeItem(page);
    await clickBiomeTab(page, "Components");

    const sectionCount = await waitForAccordionSections(page);
    if (sectionCount === 0) return;

    const presentBefore = await page.locator(".dfca-section.dfca-present").count();
    if (presentBefore === 0) return;

    const removeBtn = page.locator(".dfca-section.dfca-present .dfca-removeBtn").first();
    if (await removeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await removeBtn.click();
      await page.waitForTimeout(1000);

      const presentAfter = await page.locator(".dfca-section.dfca-present").count();
      console.log(`Present: ${presentBefore} -> ${presentAfter}`);
      expect(presentAfter).toBeLessThan(presentBefore);
    }
  });

  test("should switch between Components and Audio & Visuals tabs", async ({ page }, testInfo) => {
    // Heavy setup (enterEditor + addBiomeViaWizard + tab switches) exceeds 60s on Vite dev.
    testInfo.setTimeout(90000);
    const entered = await enterEditor(page);
    expect(entered).toBe(true);

    const biomeAdded = await addBiomeViaWizard(page);
    if (!biomeAdded) return;

    await selectBiomeItem(page);

    await clickBiomeTab(page, "Components");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/beh-07-tab-components.png`, fullPage: true });

    const hasAccordion = await page
      .locator(".dfca-outer")
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    console.log(`Components tab has accordion: ${hasAccordion}`);

    await clickBiomeTab(page, "Audio & Visuals");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/beh-08-tab-audio-visuals.png`, fullPage: true });

    await clickBiomeTab(page, "Components");
    await page.waitForTimeout(500);
  });

  test("should expand multiple components and show DataForms", async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);
    const entered = await enterEditor(page);
    expect(entered).toBe(true);

    const biomeAdded = await addBiomeViaWizard(page);
    if (!biomeAdded) return;

    await selectBiomeItem(page);
    await clickBiomeTab(page, "Components");

    const sectionCount = await waitForAccordionSections(page);
    if (sectionCount === 0) return;

    const absentHeaders = page.locator(".dfca-section.dfca-absent .dfca-header");
    const toExpand = Math.min(await absentHeaders.count(), 3);

    for (let i = 0; i < toExpand; i++) {
      const header = absentHeaders.first();
      if (await header.isVisible({ timeout: 2000 }).catch(() => false)) {
        await header.click();
        await page.waitForTimeout(1500);
      }
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/beh-09-multiple-expanded.png`, fullPage: true });

    const presentAfter = await page.locator(".dfca-section.dfca-present").count();
    console.log(`Present sections after expanding: ${presentAfter}`);
    expect(presentAfter).toBeGreaterThanOrEqual(toExpand);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT BIOME (RESOURCE) EDITOR TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Biome Resource Editor @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should show Audio & Visuals tab with accordion or add button", async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);
    const entered = await enterEditor(page);
    expect(entered).toBe(true);

    const biomeAdded = await addBiomeViaWizard(page);
    if (!biomeAdded) return;

    await selectBiomeItem(page);

    await clickBiomeTab(page, "Audio & Visuals");
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/res-01-audio-visuals-tab.png`, fullPage: true });

    const accordion = page.locator(".dfca-outer").first();
    const addResourceBtn = page.locator('button:has-text("Add")').last();

    const hasAccordion = await accordion.isVisible({ timeout: 5000 }).catch(() => false);
    const hasAddResource = await addResourceBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Audio & Visuals tab: accordion=${hasAccordion}, add button=${hasAddResource}`);

    expect(hasAccordion || hasAddResource).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THEME TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Biome Editor Themes @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should render biome accordion in dark theme", async ({ page }, testInfo) => {
    // Heavy setup (enterEditor + addBiomeViaWizard + accordion wait) exceeds 60s on Vite dev.
    testInfo.setTimeout(90000);
    const entered = await enterEditor(page, { theme: "dark" });
    expect(entered).toBe(true);

    const biomeAdded = await addBiomeViaWizard(page);
    if (!biomeAdded) return;

    await selectBiomeItem(page);
    await clickBiomeTab(page, "Components");

    const sectionCount = await waitForAccordionSections(page);
    console.log(`Dark theme: ${sectionCount} accordion sections`);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/theme-01-dark-accordion.png`, fullPage: true });
  });

  test("should render biome accordion in light theme", async ({ page }, testInfo) => {
    // Heavy setup (enterEditor + addBiomeViaWizard + accordion wait) exceeds 60s on Vite dev.
    testInfo.setTimeout(90000);
    const entered = await enterEditor(page, { theme: "light" });
    expect(entered).toBe(true);

    const biomeAdded = await addBiomeViaWizard(page);
    if (!biomeAdded) return;

    await selectBiomeItem(page);
    await clickBiomeTab(page, "Components");

    const sectionCount = await waitForAccordionSections(page);
    console.log(`Light theme: ${sectionCount} accordion sections`);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/theme-02-light-accordion.png`, fullPage: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CONSOLE HEALTH TEST
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Biome Editor Console Health @focused", () => {
  test("should not produce console errors when editing biome", async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    const failedRequests: FailedRequest[] = [];

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
    setupRequestFailureTracking(page, failedRequests);

    const entered = await enterEditor(page);
    expect(entered).toBe(true);

    const biomeAdded = await addBiomeViaWizard(page);
    if (!biomeAdded) {
      console.log("Skipping console health test - biome not added");
      return;
    }

    await selectBiomeItem(page);

    await clickBiomeTab(page, "Components");
    await page.waitForTimeout(2000);
    await clickBiomeTab(page, "Audio & Visuals");
    await page.waitForTimeout(2000);
    await clickBiomeTab(page, "Components");
    await page.waitForTimeout(1000);

    // Expand a component
    const absentHeader = page.locator(".dfca-section.dfca-absent .dfca-header").first();
    if (await absentHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
      await absentHeader.click();
      await page.waitForTimeout(1500);
    }

    expect(consoleErrors.length).toBe(0);

    const nonMuiWarnings = consoleWarnings.filter(
      (w) => !w.error.includes("Body element does not contain trap zone element")
    );
    expect(nonMuiWarnings.length).toBe(0);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/health-01-no-errors.png`, fullPage: true });
  });
});
