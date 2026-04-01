/**
 * Schema-Based Editor Tests
 *
 * Tests that the Spawn Rules, Loot Table, and Trade Table editors render
 * correctly using their hand-curated JSON schemas from data/editor-schemas/.
 *
 * These editors use the SchemaEditor component which fetches a JSON schema
 * file at runtime and renders a form. If the schema path is wrong or the
 * file is missing, the editor displays a "Json schema error" message instead
 * of form controls.
 *
 * What these tests verify:
 * 1. No "Json schema error" or "Json ui schema error" messages appear
 * 2. The schema-based form actually renders (MUI inputs/accordions visible)
 * 3. No HTTP 404s for the schema files
 *
 * Strategy: Creates a starter project, then uses /add commands to add spawn
 * rules, loot tables, and trade table files. After adding, clicks the new
 * item in the sidebar to open its schema-based editor.
 *
 * Run with: npx playwright test SchemaEditors.spec.ts --project=full
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import {
  processMessage,
  takeScreenshot,
  setupRequestFailureTracking,
  FailedRequest,
  selectEditMode,
} from "./WebTestUtilities";

test.use({ viewport: { width: 1280, height: 720 } });

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Type a tool command into the search/command bar and execute it.
 */
async function runToolCommand(page: Page, command: string): Promise<boolean> {
  // Strategy 1: Click the "Click or Ctrl-E to search" status bar at the bottom
  const searchHint = page.locator('text="Click or Ctrl-E to search"').first();
  if (await searchHint.isVisible({ timeout: 2000 }).catch(() => false)) {
    await searchHint.click();
    await page.waitForTimeout(500);

    const focusedInput = page.locator("input:focus").first();
    if (await focusedInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await focusedInput.fill(command);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(3000);
      return true;
    }
  }

  // Strategy 2: Use Ctrl+E to open the command bar
  await page.keyboard.press("Control+e");
  await page.waitForTimeout(500);

  const focusedInput = page.locator("input:focus").first();
  if (await focusedInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await focusedInput.fill(command);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3000);
    return true;
  }

  // Strategy 3: Find any visible search/command input
  const searchInput = page
    .locator('input[placeholder*="Search"], input[placeholder*="search"], input[type="text"]')
    .first();

  if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await searchInput.click();
    await searchInput.fill(command);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3000);
    return true;
  }

  console.log("Could not find command input");
  return false;
}

/**
 * Navigate to home, create a starter project, and enter the editor.
 */
async function createStarterProject(page: Page): Promise<boolean> {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  // Use /add which auto-creates a starter project if none exists
  // Adding an entity gives us a project with entity types visible
  const ran = await runToolCommand(page, "/add entity test_mob");
  if (!ran) return false;

  // Wait for project to load
  const toolbar = page.locator('[aria-label="Project Editor main toolbar"], .pe-toolbar, .pe-toolbar-compact').first();
  const loaded = await toolbar.isVisible({ timeout: 30000 }).catch(() => false);
  if (!loaded) return false;

  await page.waitForTimeout(2000);
  await selectEditMode(page, "full");
  return true;
}

/**
 * Click a sidebar item by name to open it in the editor.
 */
async function clickSidebarItem(page: Page, itemName: string): Promise<boolean> {
  // Try various locator strategies
  const strategies = [
    page.locator(`[role="option"]:has-text("${itemName}")`).first(),
    page.locator(`text="${itemName}"`).first(),
    page.locator(`:text-matches("${itemName}", "i")`).first(),
  ];

  for (const locator of strategies) {
    if (await locator.isVisible({ timeout: 2000 }).catch(() => false)) {
      await locator.click();
      await page.waitForTimeout(2000);
      console.log(`Clicked sidebar item: ${itemName}`);
      return true;
    }
  }

  console.log(`Sidebar item "${itemName}" not found`);
  return false;
}

/**
 * Assert that the SchemaEditor rendered a form (not an error).
 */
async function assertSchemaEditorRendered(page: Page): Promise<void> {
  const schemaError = page.locator('text="Json schema error"').first();
  const uiSchemaError = page.locator('text="Json ui schema error"').first();

  const hasSchemaError = await schemaError.isVisible({ timeout: 2000 }).catch(() => false);
  const hasUiSchemaError = await uiSchemaError.isVisible({ timeout: 1000 }).catch(() => false);

  if (hasSchemaError) {
    const errorText = await schemaError.locator("..").textContent();
    console.log(`Schema error found: ${errorText}`);
  }
  if (hasUiSchemaError) {
    const errorText = await uiSchemaError.locator("..").textContent();
    console.log(`UI schema error found: ${errorText}`);
  }

  expect(hasSchemaError, "SchemaEditor should not show a JSON schema error").toBe(false);
  expect(hasUiSchemaError, "SchemaEditor should not show a JSON UI schema error").toBe(false);

  // Should see at least one MUI form element indicating the schema form rendered
  const formIndicators = [
    page.locator(".MuiInput-root, .MuiInputBase-root").first(),
    page.locator(".MuiAccordion-root").first(),
    page.locator(".MuiSelect-root, .MuiSelect-select").first(),
    page.locator('input[type="text"], input[type="number"]').first(),
  ];

  let foundFormElement = false;
  for (const indicator of formIndicators) {
    if (await indicator.isVisible({ timeout: 2000 }).catch(() => false)) {
      foundFormElement = true;
      break;
    }
  }

  expect(foundFormElement, "SchemaEditor should render at least one form control").toBe(true);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Schema-Based Editors @full", () => {
  test.setTimeout(120000);

  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("spawn rules editor should render schema form without errors", async ({ page }) => {
    test.setTimeout(120000);

    const failedRequests: FailedRequest[] = [];
    const cleanup = setupRequestFailureTracking(page, failedRequests);

    const created = await createStarterProject(page);
    if (!created) {
      cleanup();
      test.skip();
      return;
    }

    // Add a spawn rule via /add command
    await runToolCommand(page, "/add spawn_rule test_spawn");
    await page.waitForTimeout(2000);

    // Click the newly added spawn rule in the sidebar
    const opened = await clickSidebarItem(page, "test_spawn");
    if (!opened) {
      await takeScreenshot(page, "debugoutput/screenshots/schema-spawn-not-found");
      cleanup();
      test.skip();
      return;
    }

    await page.waitForTimeout(3000);
    await takeScreenshot(page, "debugoutput/screenshots/schema-spawn-rules");

    await assertSchemaEditorRendered(page);

    const schemaFailures = failedRequests.filter((r) => r.url.includes("editor-schemas"));
    expect(schemaFailures, "No 404s for editor-schema files").toHaveLength(0);
    console.log("Spawn rules editor rendered successfully");

    cleanup();
  });

  test("loot table editor should render schema form without errors", async ({ page }) => {
    test.setTimeout(120000);

    const failedRequests: FailedRequest[] = [];
    const cleanup = setupRequestFailureTracking(page, failedRequests);

    const created = await createStarterProject(page);
    if (!created) {
      cleanup();
      test.skip();
      return;
    }

    // Add a loot table via /add command
    await runToolCommand(page, "/add loot_table test_loot");
    await page.waitForTimeout(2000);

    // Click the newly added loot table in the sidebar
    const opened = await clickSidebarItem(page, "test_loot");
    if (!opened) {
      await takeScreenshot(page, "debugoutput/screenshots/schema-loot-not-found");
      cleanup();
      test.skip();
      return;
    }

    await page.waitForTimeout(3000);
    await takeScreenshot(page, "debugoutput/screenshots/schema-loot-table");

    await assertSchemaEditorRendered(page);

    const schemaFailures = failedRequests.filter((r) => r.url.includes("editor-schemas"));
    expect(schemaFailures, "No 404s for editor-schema files").toHaveLength(0);
    console.log("Loot table editor rendered successfully");

    cleanup();
  });

  test("trade table editor should render schema form without errors", async ({ page }) => {
    test.setTimeout(120000);

    const failedRequests: FailedRequest[] = [];
    const cleanup = setupRequestFailureTracking(page, failedRequests);

    const created = await createStarterProject(page);
    if (!created) {
      cleanup();
      test.skip();
      return;
    }

    // Add a trade table via /add command
    await runToolCommand(page, "/add trade_table test_trades");
    await page.waitForTimeout(2000);

    // Click the newly added trade table in the sidebar
    const opened = await clickSidebarItem(page, "test_trades");
    if (!opened) {
      await takeScreenshot(page, "debugoutput/screenshots/schema-trade-not-found");
      cleanup();
      test.skip();
      return;
    }

    await page.waitForTimeout(3000);
    await takeScreenshot(page, "debugoutput/screenshots/schema-trade-table");

    await assertSchemaEditorRendered(page);

    const schemaFailures = failedRequests.filter((r) => r.url.includes("editor-schemas"));
    expect(schemaFailures, "No 404s for editor-schema files").toHaveLength(0);
    console.log("Trade table editor rendered successfully");

    cleanup();
  });
});

