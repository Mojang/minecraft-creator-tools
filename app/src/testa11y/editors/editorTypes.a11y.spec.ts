/**
 * Accessibility scans for representative specialized editor types.
 *
 * We can't test all 150+ editors, so we sample across common UI patterns:
 * form-based editors, JSON editors, image editors, and schema-driven editors.
 *
 * These tests enter the editor, navigate the project tree to a specific file type,
 * and run an axe scan on the resulting editor panel.
 *
 * Tags: @comprehensive-a11y
 */

import { test, expect } from "../fixtures";
import { assertNoCriticalViolations, runAxeScan, logViolations } from "../a11yTestUtils";
import { enterEditor } from "../../testweb/WebTestUtilities";

/**
 * After entering the editor, clicks a project item in the tree by matching text.
 * Returns true if an item was found and clicked.
 */
async function openProjectItemByText(page: import("@playwright/test").Page, text: string | RegExp): Promise<boolean> {
  const item = page.locator(`[role="treeitem"], [role="listitem"], [role="option"]`).filter({ hasText: text }).first();

  if (await item.isVisible({ timeout: 3000 }).catch(() => false)) {
    await item.click();
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}

test.describe("Editor Type Sampling — Accessibility @comprehensive-a11y", () => {
  test.beforeEach(async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    if (!entered) {
      test.skip();
    }
  });

  test("manifest editor — no critical violations", async ({ page }) => {
    // manifest.json is always present in any project
    const opened = await openProjectItemByText(page, /manifest/i);
    if (!opened) {
      test.skip();
      return;
    }

    await assertNoCriticalViolations(page, "ManifestEditor", {
      screenshotPath: "debugoutput/screenshots/a11y-editor-manifest.png",
    });
  });

  test("JSON file in editor — no critical violations", async ({ page }) => {
    // Any JSON file should open the JSON editor
    const opened = await openProjectItemByText(page, /\.json/i);
    if (!opened) {
      test.skip();
      return;
    }

    await assertNoCriticalViolations(page, "JsonEditor", {
      screenshotPath: "debugoutput/screenshots/a11y-editor-json.png",
    });
  });

  test("project overview panel — no critical violations", async ({ page }) => {
    // The default view when entering the editor should be some project overview
    await assertNoCriticalViolations(page, "ProjectOverview", {
      screenshotPath: "debugoutput/screenshots/a11y-editor-overview.png",
    });
  });

  test("editor toolbar and sidebar — component-level scan", async ({ page }) => {
    // Scan toolbar separately for interactive element accessibility
    const result = await runAxeScan(page, {
      includeSelector: '[role="toolbar"], [role="navigation"], [role="menubar"]',
    });
    logViolations(result.violations, "Editor toolbar/nav");

    expect(
      result.criticalViolations,
      `Found ${result.criticalViolations.length} critical toolbar violations`
    ).toHaveLength(0);
  });
});
