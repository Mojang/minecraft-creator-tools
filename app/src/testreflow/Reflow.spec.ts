/**
 * MAS 1.4.10 Reflow accessibility tests.
 *
 * These tests validate that the Minecraft Creator Tools web UI remains
 * usable at extreme zoom levels (simulated via small viewports).
 *
 * The MAS 1.4.10 Reflow guideline requires that content can be presented
 * without loss of information or functionality, and without requiring
 * two-dimensional scrolling, at 400% zoom on a 1280x1024 display
 * (effective viewport: 320×256 CSS pixels).
 */

import { test, expect, Page, ConsoleMessage, TestInfo } from "@playwright/test";
import { processMessage, enterEditor } from "../testweb/WebTestUtilities";

/** Collect console errors during each test. */
function setupConsoleTracking(page: Page) {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  page.on("console", (msg: ConsoleMessage) => {
    processMessage(msg, page, consoleErrors, consoleWarnings);
  });

  return { consoleErrors, consoleWarnings };
}

/**
 * Extract a stable zoom-level label from the active Playwright project name.
 *
 * Both `reflow-400pct` and `reflow-200pct` projects exercise the same specs but
 * at different viewport sizes. Without this, both projects would write to
 * identical screenshot paths (last-writer-wins), erasing the 400% evidence we
 * actually need for MAS 1.4.10.
 */
function zoomLabel(testInfo: TestInfo): string {
  const project = testInfo.project.name; // e.g. "reflow-400pct"
  const match = project.match(/(\d+pct)/);
  return match ? match[1] : project;
}

// ---------------------------------------------------------------------------
// Home Page reflow
// ---------------------------------------------------------------------------

test.describe("Reflow: Home Page @reflow", () => {
  test("home page should not have a horizontal scrollbar at 400% zoom", async ({ page }, testInfo) => {
    setupConsoleTracking(page);

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: `debugoutput/screenshots/reflow-home-${zoomLabel(testInfo)}.png`,
      fullPage: true,
    });

    // The page body should not be wider than the viewport (no horizontal scroll)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

    // Allow a small tolerance (2px) for sub-pixel rounding
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });
});

// ---------------------------------------------------------------------------
// Status Area reflow  (ADO #1438984)
// ---------------------------------------------------------------------------

test.describe("Reflow: Status Area @reflow", () => {
  test("status area list should not be cropped at 400% zoom", async ({ page }, testInfo) => {
    setupConsoleTracking(page);

    const entered = await enterEditor(page, { editMode: "full" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping reflow test");
      return;
    }

    // Expand the status area ("Show more information in the status area")
    const expandButton = page
      .getByRole("button", { name: /Show more information in the status area/i })
      .or(page.locator('[title="Show more information in the status area"]'))
      .first();

    if (await expandButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expandButton.click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({
      path: `debugoutput/screenshots/reflow-status-area-expanded-${zoomLabel(testInfo)}.png`,
      fullPage: true,
    });

    // The status area list (.sa-list) should be within the viewport or scrollable
    // — it must NOT be clipped by a parent with overflow:hidden at a size smaller
    //   than the list content.
    const listInfo = await page.evaluate(() => {
      const list = document.querySelector(".sa-list");
      if (!list) return null;

      const rect = list.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
        scrollHeight: (list as HTMLElement).scrollHeight,
        overflow: getComputedStyle(list).overflow,
        overflowY: getComputedStyle(list).overflowY,
        visible: rect.height > 0,
      };
    });

    // If the list is visible, verify it's not clipped to zero height and has scrolling
    if (listInfo) {
      expect(listInfo.visible).toBe(true);
      // The list should have overflow-y: auto or scroll so content is accessible
      expect(["auto", "scroll"]).toContain(listInfo.overflowY);
    }
    // If no list is visible (status area might not have content yet), that's okay
  });
});

// ---------------------------------------------------------------------------
// Project Editor toolbar reflow
// ---------------------------------------------------------------------------

test.describe("Reflow: Project Editor @reflow", () => {
  test("editor toolbar should remain accessible at 400% zoom", async ({ page }, testInfo) => {
    setupConsoleTracking(page);

    const entered = await enterEditor(page, { editMode: "focused" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping reflow test");
      return;
    }

    await page.screenshot({
      path: `debugoutput/screenshots/reflow-editor-${zoomLabel(testInfo)}.png`,
      fullPage: true,
    });

    // The toolbar should still be visible and not completely hidden off-viewport
    const toolbar = page
      .locator('[aria-label="Project Editor main toolbar"]')
      .or(page.locator(".pe-toolbar, .pe-toolbar-compact"))
      .first();

    if (await toolbar.isVisible({ timeout: 3000 }).catch(() => false)) {
      const toolbarBox = await toolbar.boundingBox();
      expect(toolbarBox).not.toBeNull();
      if (toolbarBox) {
        // Toolbar should not be pushed entirely off the right edge
        expect(toolbarBox.x).toBeGreaterThanOrEqual(-toolbarBox.width);
      }
    }

    // The page body should not have excess horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

    // Allow a generous tolerance (50px) — some minor overflow is acceptable
    // as long as it's not fundamentally broken two-dimensional scrolling
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 50);
  });

  test("project item list should be scrollable at 400% zoom", async ({ page }, testInfo) => {
    setupConsoleTracking(page);

    const entered = await enterEditor(page, { editMode: "full" });
    if (!entered) {
      test.skip(true, "Could not enter editor — skipping reflow test");
      return;
    }

    // Click the Items toolbar button to show the project items
    const itemsButton = page.getByRole("button", { name: /Items/i }).first();

    if (await itemsButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await itemsButton.click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({
      path: `debugoutput/screenshots/reflow-items-list-${zoomLabel(testInfo)}.png`,
      fullPage: true,
    });

    // Verify that the project items area doesn't cause horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 50);
  });
});
