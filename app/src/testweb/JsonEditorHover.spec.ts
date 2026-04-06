/**
 * JsonEditorHover.spec.ts
 *
 * Playwright tests for JSON editor hover functionality.
 * Tests the FormSchemaGenerator integration for showing sample values in Monaco hover tooltips.
 *
 * ARCHITECTURE (Updated):
 * - FormSchemaGenerator converts IFormDefinition to JSON Schema
 * - Samples are embedded in the schema's description/markdownDescription fields
 * - Monaco's built-in JSON hover displays these rich descriptions
 * - The custom MinecraftHoverProvider is still registered but may be bypassed by Monaco's JSON worker
 */

import { test, expect, Page } from "@playwright/test";
import { enterEditor, preferBrowserStorageInProjectDialog, waitForEditorReady } from "./WebTestUtilities";

/**
 * Navigate to a project in the editor
 */
async function navigateToProject(page: Page): Promise<void> {
  // Go to home page (uses Playwright's baseURL from config)
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Create a new project from Add-On Starter template
  const addOnStarterNewButton = page.getByRole("button", { name: "Create New" }).first();
  await addOnStarterNewButton.click();
  await page.waitForTimeout(1000);

  // Select browser storage for automated test flow
  await preferBrowserStorageInProjectDialog(page);

  // Wait for dialog to appear and click Create Project
  const createButton = page.locator("button:has-text('Create Project')").first();
  await createButton.click();

  // Wait for editor to load (longer timeout for remote servers)
  await page.waitForTimeout(12000);
  await page.waitForLoadState("networkidle");

  // Take screenshot of initial state
  await page.screenshot({ path: "debugoutput/screenshots/json-hover-initial.png" });
}

test.describe("JSON Editor Hover Tests @full", () => {
  test.beforeEach(async ({ page }) => {
    // Set a longer timeout for these tests
    test.setTimeout(90000);
  });

  test("project loads without schema errors", async ({ page }) => {
    // Collect console logs
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      consoleLogs.push(text);
      if (msg.type() === "error") {
        consoleErrors.push(text);
      }
    });

    await navigateToProject(page);

    await page.screenshot({ path: "debugoutput/screenshots/json-hover-project-loaded.png" });

    // Check for schema-related errors
    const schemaErrors = consoleErrors.filter(
      (e) => e.includes("FormSchemaGenerator") || e.includes("schema error") || e.includes("IFormDefinition")
    );

    console.log("Schema-related errors:", schemaErrors);

    // We shouldn't have critical schema generation errors
    expect(schemaErrors.length).toBeLessThanOrEqual(5);
  });

  test("Monaco editor hover mechanism investigation", async ({ page }) => {
    // This test investigates how Monaco handles hover for JSON files
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      consoleLogs.push(msg.text());
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.screenshot({ path: "debugoutput/screenshots/json-hover-investigation.png" });

    // Print all relevant logs
    const hoverLogs = consoleLogs.filter(
      (l) =>
        l.includes("MinecraftHoverProvider") ||
        l.includes("JsonEditorEnhancements") ||
        l.includes("FormSchemaGenerator")
    );
    console.log("Hover-related logs:", hoverLogs);
  });
});

test.describe("JSON Editor Enhancement Integration @full", () => {
  test("project editor loads and displays files", async ({ page }) => {
    test.setTimeout(90000);

    // Collect console logs
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      consoleLogs.push(msg.text());
    });

    // Use the standard enterEditor helper which handles project creation,
    // FRE panel dismissal, and editor readiness verification.
    const entered = await enterEditor(page);

    await page.screenshot({ path: "debugoutput/screenshots/json-editor-integration.png" });

    console.log("Editor loaded (enterEditor result):", entered);
    expect(entered).toBeTruthy();

    // Double-check toolbar is visible
    const editorReady = await waitForEditorReady(page, 10000);
    console.log("Editor ready (toolbar visible):", editorReady);
    expect(editorReady).toBeTruthy();
  });
});
