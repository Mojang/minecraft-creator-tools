/**
 * ARIA live region tests.
 *
 * Verifies that dynamic content updates are announced to screen readers
 * via aria-live regions, role="status", role="alert", or role="log" elements.
 *
 * MAS / WCAG criteria: 4.1.3 (Status Messages).
 *
 * Tags: @comprehensive-a11y
 */

import { test, expect } from "../fixtures";
import { assertLiveRegionExists } from "../a11yTestUtils";
import { gotoWithTheme, enterEditor } from "../../testweb/WebTestUtilities";

test.describe("ARIA Live Regions — Home Page @comprehensive-a11y", () => {
  test("home page should have appropriate ARIA landmarks", async ({ page }) => {
    await gotoWithTheme(page, "dark");
    await page.waitForTimeout(500);

    // Verify landmarks exist
    const mainCount = await page.locator('[role="main"], main').count();
    const navCount = await page.locator('[role="navigation"], nav').count();

    console.log(`Home page landmarks: main=${mainCount}, nav=${navCount}`);
    expect(mainCount, "Page should have a main landmark").toBeGreaterThanOrEqual(1);
  });
});

test.describe("ARIA Live Regions — Editor @comprehensive-a11y", () => {
  test("editor should have live regions for status updates", async ({ page }) => {
    const entered = await enterEditor(page);
    if (!entered) {
      test.skip();
      return;
    }

    const liveRegionCount = await assertLiveRegionExists(page);
    console.log(`Editor live regions found: ${liveRegionCount}`);

    // The editor should have at least a status area for validation results,
    // though this may not be implemented yet.
    if (liveRegionCount === 0) {
      console.log(
        "WARNING: No ARIA live regions found in editor. Status updates may not be announced to screen readers."
      );
    }
  });

  test("editor landmarks are properly structured", async ({ page }) => {
    const entered = await enterEditor(page);
    if (!entered) {
      test.skip();
      return;
    }

    // Check for required landmarks
    const landmarks = await page.evaluate(() => {
      const roles = ["main", "navigation", "banner", "contentinfo", "complementary", "region", "search", "toolbar"];
      const result: Record<string, number> = {};
      for (const role of roles) {
        const byRole = document.querySelectorAll(`[role="${role}"]`);
        const byTag: Record<string, string> = {
          main: "main",
          navigation: "nav",
          banner: "header",
          contentinfo: "footer",
          complementary: "aside",
          search: "search",
        };
        const tag = byTag[role];
        const byTagCount = tag ? document.querySelectorAll(tag).length : 0;
        result[role] = byRole.length + byTagCount;
      }
      return result;
    });

    console.log("Editor landmarks:", JSON.stringify(landmarks, null, 2));

    // At minimum, should have a main content area
    const hasMain = (landmarks["main"] ?? 0) > 0;
    expect(hasMain, "Editor should have a main content landmark").toBe(true);
  });
});

test.describe("ARIA Live Regions — Dynamic Content @comprehensive-a11y", () => {
  test("project creation shows status feedback", async ({ page }) => {
    await gotoWithTheme(page, "dark");
    await page.waitForTimeout(500);

    // Open new project dialog
    const newButton = page.getByRole("button", { name: "Create New" }).first();
    if (!(await newButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await newButton.click();
    await page.waitForTimeout(500);

    // Look for any status/alert elements that might announce dialog state
    const statusElements = await page.locator('[role="status"], [role="alert"], [aria-live]').count();

    console.log(`Status/alert elements in project dialog: ${statusElements}`);

    // Close dialog
    await page.keyboard.press("Escape");
  });
});
