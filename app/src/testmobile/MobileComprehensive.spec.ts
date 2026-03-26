/**
 * Comprehensive mobile-viewport UX test for Minecraft Creator Tools.
 *
 * Walks through nearly every screen of the application at a mobile portrait
 * viewport (390×844 — iPhone 14) and captures annotated screenshots to
 * `debugoutput/screenshots/mobile/`.  These screenshots are then examined
 * by the mobile-ux-reviewer agent to identify responsive layout issues,
 * cropped text, inaccessible controls, and other mobile-specific problems.
 *
 * Viewport configured in playwright-mobile.config.js:
 *   width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true
 *
 * Run with:  npm run test-mobile          (from app/)
 * Headed:    npm run test-mobile-headed
 * Debug:     npm run test-mobile-debug
 */

import { test, expect, Page, ConsoleMessage } from "@playwright/test";
import {
  processMessage,
  enterEditor,
  gotoWithTheme,
  takeScreenshot,
  enableAllFileTypes,
  preferBrowserStorageInProjectDialog,
  openFileInMonaco,
} from "../testweb/WebTestUtilities";

const SCREENSHOT_DIR = "debugoutput/screenshots/mobile";

/** Collect console errors for a page. */
function setupConsoleTracking(page: Page) {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  page.on("console", (msg: ConsoleMessage) => {
    processMessage(msg, page, consoleErrors, consoleWarnings);
  });

  return { consoleErrors, consoleWarnings };
}

/** Assert no meaningful horizontal overflow (reflow compliance). */
async function assertNoHorizontalOverflow(page: Page, tolerance = 2) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + tolerance);
}

// ---------------------------------------------------------------------------
// Group 1: Home Page
// ---------------------------------------------------------------------------

test.describe("Mobile: Home Page @mobile", () => {
  test("home page — light theme", async ({ page }) => {
    setupConsoleTracking(page);
    await gotoWithTheme(page, "light", "/");
    await page.waitForTimeout(1500);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-home-light.png`, fullPage: true });
    await assertNoHorizontalOverflow(page);
  });

  test("home page — dark theme", async ({ page }) => {
    setupConsoleTracking(page);
    await gotoWithTheme(page, "dark", "/");
    await page.waitForTimeout(1500);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-home-dark.png`, fullPage: true });
    await assertNoHorizontalOverflow(page);
  });

  test("home page — scroll to template gallery", async ({ page }) => {
    setupConsoleTracking(page);
    await gotoWithTheme(page, "light", "/");
    await page.waitForTimeout(1500);

    // Scroll to bottom to reveal the full template gallery
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-home-scrolled-light.png`, fullPage: true });
    await assertNoHorizontalOverflow(page);
  });
});

// ---------------------------------------------------------------------------
// Group 2: New Project Dialog
// ---------------------------------------------------------------------------

test.describe("Mobile: New Project Dialog @mobile", () => {
  test("new project dialog at mobile width", async ({ page }) => {
    const { consoleErrors } = setupConsoleTracking(page);
    await gotoWithTheme(page, "light", "/");
    await page.waitForTimeout(1500);

    // Click "Create New"
    const newButton = page.getByRole("button", { name: "Create New" }).first();
    await expect(newButton).toBeVisible({ timeout: 10000 });
    await newButton.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-new-project-dialog-light.png`, fullPage: true });
    await assertNoHorizontalOverflow(page);

    // Fill the project title
    const titleInput = page.getByLabel("Title");
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill("Mobile Test Project");
    }

    await preferBrowserStorageInProjectDialog(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-new-project-filled-light.png`, fullPage: true });

    expect(consoleErrors.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Group 3: Project Editor — Focused Mode
// ---------------------------------------------------------------------------

test.describe("Mobile: Editor — Focused Mode @mobile", () => {
  test("editor focused mode overview", async ({ page }) => {
    const { consoleErrors } = setupConsoleTracking(page);

    const entered = await enterEditor(page, { theme: "light", editMode: "focused" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping");
      return;
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-editor-focused-overview-light.png`, fullPage: true });
    await assertNoHorizontalOverflow(page, 50);

    // Capture the toolbar area specifically
    await takeScreenshot(page, `${SCREENSHOT_DIR}/mobile-editor-focused-toolbar-light`);

    expect(consoleErrors.length).toBe(0);
  });

  test("editor focused mode — status area", async ({ page }) => {
    setupConsoleTracking(page);

    const entered = await enterEditor(page, { theme: "light", editMode: "focused" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping");
      return;
    }

    // Try to expand the status area
    const expandButton = page
      .getByRole("button", { name: /Show more information in the status area/i })
      .or(page.locator('[title="Show more information in the status area"]'))
      .first();

    if (await expandButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expandButton.click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-editor-focused-statusarea-light.png`, fullPage: true });
    await assertNoHorizontalOverflow(page, 50);
  });

  test("editor focused mode — view button dropdown", async ({ page }) => {
    setupConsoleTracking(page);

    const entered = await enterEditor(page, { theme: "light", editMode: "focused" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping");
      return;
    }

    const viewButton = page.getByRole("button", { name: /^View$/i }).first();
    if (await viewButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await viewButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/mobile-editor-focused-view-dropdown-light.png`,
        fullPage: true,
      });
      await page.keyboard.press("Escape");
    }
  });

  test("editor focused mode — export/share button", async ({ page }) => {
    setupConsoleTracking(page);

    const entered = await enterEditor(page, { theme: "light", editMode: "focused" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping");
      return;
    }

    const exportButton = page.getByRole("button", { name: /^(Share|Export)( \(.+\))?$/i }).first();
    if (await exportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await exportButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-editor-focused-export-light.png`, fullPage: true });
      await assertNoHorizontalOverflow(page, 50);
    }
  });
});

// ---------------------------------------------------------------------------
// Group 4: Project Editor — Full Mode
// ---------------------------------------------------------------------------

test.describe("Mobile: Editor — Full Mode @mobile", () => {
  test("editor full mode overview", async ({ page }) => {
    const { consoleErrors } = setupConsoleTracking(page);

    const entered = await enterEditor(page, { theme: "light", editMode: "full" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping");
      return;
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-editor-full-overview-light.png`, fullPage: true });
    await assertNoHorizontalOverflow(page, 50);
    expect(consoleErrors.length).toBe(0);
  });

  test("editor full mode — items panel", async ({ page }) => {
    setupConsoleTracking(page);

    const entered = await enterEditor(page, { theme: "light", editMode: "full" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping");
      return;
    }

    // Click Items toolbar button
    const itemsButton = page.getByRole("button", { name: /Items/i }).first();
    if (await itemsButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await itemsButton.click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-editor-full-items-light.png`, fullPage: true });
    await assertNoHorizontalOverflow(page, 50);
  });
});

// ---------------------------------------------------------------------------
// Group 5: Individual Editors (via project tree navigation)
// ---------------------------------------------------------------------------

test.describe("Mobile: Individual Editors @mobile", () => {
  test("entity type editor", async ({ page }) => {
    setupConsoleTracking(page);

    const entered = await enterEditor(page, { theme: "light", editMode: "full" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping");
      return;
    }

    // Try to open an entity file
    const opened = await openFileInMonaco(page, "entity");
    if (opened) {
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-editor-entity-light.png`, fullPage: true });
    await assertNoHorizontalOverflow(page, 50);
  });

  test("manifest editor", async ({ page }) => {
    setupConsoleTracking(page);

    const entered = await enterEditor(page, { theme: "light", editMode: "full" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping");
      return;
    }

    await enableAllFileTypes(page);
    const opened = await openFileInMonaco(page, "manifest");
    if (opened) {
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-editor-manifest-light.png`, fullPage: true });
    await assertNoHorizontalOverflow(page, 50);
  });

  test("function file editor", async ({ page }) => {
    setupConsoleTracking(page);

    const entered = await enterEditor(page, { theme: "light", editMode: "full" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping");
      return;
    }

    const opened = await openFileInMonaco(page, ".mcfunction");
    if (!opened) {
      // Also try finding a file with "function" in the name
      await openFileInMonaco(page, "function");
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-editor-function-light.png`, fullPage: true });
    await assertNoHorizontalOverflow(page, 50);
  });

  test("pack icon / image file", async ({ page }) => {
    setupConsoleTracking(page);

    const entered = await enterEditor(page, { theme: "light", editMode: "full" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping");
      return;
    }

    await enableAllFileTypes(page);
    const opened = await openFileInMonaco(page, "pack_icon");
    if (opened) {
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-editor-packicon-light.png`, fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// Group 6: Inspector / Validation
// ---------------------------------------------------------------------------

test.describe("Mobile: Inspector & Validation @mobile", () => {
  test("inspector panel at mobile width", async ({ page }) => {
    setupConsoleTracking(page);

    const entered = await enterEditor(page, { theme: "light", editMode: "focused" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping");
      return;
    }

    // Click the validate/inspect button (may be labeled "Test" or "Run")
    const testButton = page.getByRole("button", { name: /^(Run|Test)$/i }).first();
    if (await testButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testButton.click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-inspector-light.png`, fullPage: true });
    await assertNoHorizontalOverflow(page, 50);
  });
});

// ---------------------------------------------------------------------------
// Group 7: Export / Download
// ---------------------------------------------------------------------------

test.describe("Mobile: Export & Download @mobile", () => {
  test("export dialog at mobile width", async ({ page }) => {
    setupConsoleTracking(page);

    const entered = await enterEditor(page, { theme: "light", editMode: "focused" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping");
      return;
    }

    // Navigate to export — click Share/Export button then look for export options
    const exportButton = page.getByRole("button", { name: /^(Share|Export)( \(.+\))?$/i }).first();
    if (await exportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await exportButton.click();
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-export-dialog-light.png`, fullPage: true });
    await assertNoHorizontalOverflow(page, 50);
  });
});

// ---------------------------------------------------------------------------
// Group 9: Import from URL
// ---------------------------------------------------------------------------

test.describe("Mobile: Import from URL @mobile", () => {
  test("import from URL page at mobile width", async ({ page }) => {
    setupConsoleTracking(page);
    await gotoWithTheme(page, "light", "/#importfromurl");
    await page.waitForTimeout(2000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-import-url-light.png`, fullPage: true });
    await assertNoHorizontalOverflow(page);
  });
});

// ---------------------------------------------------------------------------
// Group 10: Standalone Viewers (layout/chrome only)
// ---------------------------------------------------------------------------

test.describe("Mobile: Standalone Viewers @mobile", () => {
  test("block viewer at mobile width", async ({ page }) => {
    setupConsoleTracking(page);
    await gotoWithTheme(page, "light", "/#blockviewer");
    await page.waitForTimeout(3000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-blockviewer-light.png`, fullPage: true });
    await assertNoHorizontalOverflow(page, 50);
  });

  test("mob viewer at mobile width", async ({ page }) => {
    setupConsoleTracking(page);
    await gotoWithTheme(page, "light", "/#mobviewer");
    await page.waitForTimeout(3000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-mobviewer-light.png`, fullPage: true });
    await assertNoHorizontalOverflow(page, 50);
  });
});

// ---------------------------------------------------------------------------
// Group 11: Dark Theme Pass (repeat key screens)
// ---------------------------------------------------------------------------

test.describe("Mobile: Dark Theme @mobile", () => {
  test("editor focused mode — dark theme", async ({ page }) => {
    const { consoleErrors } = setupConsoleTracking(page);

    const entered = await enterEditor(page, { theme: "dark", editMode: "focused" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping");
      return;
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-editor-focused-overview-dark.png`, fullPage: true });
    await assertNoHorizontalOverflow(page, 50);
    expect(consoleErrors.length).toBe(0);
  });

  test("editor full mode — dark theme", async ({ page }) => {
    setupConsoleTracking(page);

    const entered = await enterEditor(page, { theme: "dark", editMode: "full" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping");
      return;
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-editor-full-overview-dark.png`, fullPage: true });
    await assertNoHorizontalOverflow(page, 50);
  });

  test("editor status area — dark theme", async ({ page }) => {
    setupConsoleTracking(page);

    const entered = await enterEditor(page, { theme: "dark", editMode: "focused" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping");
      return;
    }

    const expandButton = page
      .getByRole("button", { name: /Show more information in the status area/i })
      .or(page.locator('[title="Show more information in the status area"]'))
      .first();

    if (await expandButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expandButton.click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-editor-statusarea-dark.png`, fullPage: true });
    await assertNoHorizontalOverflow(page, 50);
  });

  test("new project dialog — dark theme", async ({ page }) => {
    setupConsoleTracking(page);
    await gotoWithTheme(page, "dark", "/");
    await page.waitForTimeout(1500);

    const newButton = page.getByRole("button", { name: "Create New" }).first();
    if (await newButton.isVisible({ timeout: 10000 }).catch(() => false)) {
      await newButton.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-new-project-dialog-dark.png`, fullPage: true });
    await assertNoHorizontalOverflow(page);
  });
});

// ---------------------------------------------------------------------------
// Group 12: Editor — Raw Mode (JSON editing)
// ---------------------------------------------------------------------------

test.describe("Mobile: Editor — Raw Mode @mobile", () => {
  test("raw JSON editor at mobile width", async ({ page }) => {
    setupConsoleTracking(page);

    const entered = await enterEditor(page, { theme: "light", editMode: "raw" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping");
      return;
    }

    await enableAllFileTypes(page);

    // Try to open a JSON file to get the Monaco editor
    const opened = await openFileInMonaco(page, "manifest");
    if (opened) {
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-editor-raw-json-light.png`, fullPage: true });
    await assertNoHorizontalOverflow(page, 50);
  });
});

// ---------------------------------------------------------------------------
// Group 13: Content Wizard (if accessible)
// ---------------------------------------------------------------------------

test.describe("Mobile: Content Wizard @mobile", () => {
  test("content wizard at mobile width", async ({ page }) => {
    setupConsoleTracking(page);
    await gotoWithTheme(page, "light", "/");
    await page.waitForTimeout(1500);

    // Look for the Content Wizard or "New from Wizard" type button
    const wizardButton = page.getByRole("button", { name: /wizard|generate|create.*content/i }).first();

    if (await wizardButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await wizardButton.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-contentwizard-light.png`, fullPage: true });
      await assertNoHorizontalOverflow(page);
    } else {
      // Wizard may not be accessible from home — screenshot showing it's absent
      await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-home-no-wizard-light.png`, fullPage: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Group 14: File Import
// ---------------------------------------------------------------------------

test.describe("Mobile: File Import @mobile", () => {
  test("import files page at mobile width", async ({ page }) => {
    setupConsoleTracking(page);
    await gotoWithTheme(page, "light", "/#importfiles");
    await page.waitForTimeout(2000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-import-files-light.png`, fullPage: true });
    await assertNoHorizontalOverflow(page);
  });
});

// ---------------------------------------------------------------------------
// Group 15: Editor Tab Switching
// ---------------------------------------------------------------------------

test.describe("Mobile: Editor Tab Switching @mobile", () => {
  test("switching tabs at mobile width", async ({ page }) => {
    setupConsoleTracking(page);

    const entered = await enterEditor(page, { theme: "light", editMode: "full" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping");
      return;
    }

    // Open multiple files to create tabs
    await openFileInMonaco(page, "manifest");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-editor-tab1-light.png`, fullPage: true });

    await openFileInMonaco(page, "entity");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-editor-tab2-light.png`, fullPage: true });

    await assertNoHorizontalOverflow(page, 50);
  });
});
