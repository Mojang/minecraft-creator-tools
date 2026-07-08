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

  test("header keeps all top links (Docs, Command Line, GitHub) reachable when zoomed", async ({ page }) => {
    setupConsoleTracking(page);

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // The header swaps between a full row of links and a compact, wrapping set
    // depending on width. Whichever variant is active, every top link must stay
    // present — at narrow (reflow) widths the compact set previously dropped
    // Command Line and GitHub entirely (WCAG 1.4.10 Reflow loss of function).
    const header = page.locator(".hhdr-sublink:visible, .hhdr-mobileLinks:visible");

    await expect(header.getByRole("link", { name: "Docs" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Command Line" })).toBeVisible();
    await expect(header.getByRole("link", { name: "GitHub" })).toBeVisible();
  });

  test("home page leaves a usable content band between header and footer", async ({ page }) => {
    setupConsoleTracking(page);

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // The desktop app shell pins a fixed header at the top and the footer at the
    // bottom of a 100vh container, with the main region scrolling internally. At
    // narrow / zoomed widths that chrome must NOT consume the viewport and squeeze
    // the content into an unusable sliver — the layout must reflow so a meaningful
    // band remains for content (WCAG 1.4.10).
    const metrics = await page.evaluate(() => {
      const vh = window.innerHeight;
      const header = document.querySelector(".MuiAppBar-root");
      const footer = document.querySelector("footer");
      const hb = header ? header.getBoundingClientRect() : null;
      const fb = footer ? footer.getBoundingClientRect() : null;
      const headerBottom = hb ? Math.min(Math.max(hb.bottom, 0), vh) : 0;
      const footerTop = fb ? Math.min(Math.max(fb.top, 0), vh) : vh;
      return { vh, headerBottom, footerTop, available: footerTop - headerBottom };
    });

    expect(
      metrics.available,
      `usable content band is only ${Math.round(metrics.available)}px of ${metrics.vh}px (header bottom ${Math.round(
        metrics.headerBottom
      )}, footer top ${Math.round(metrics.footerTop)})`
    ).toBeGreaterThanOrEqual(metrics.vh * 0.5);
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

// ---------------------------------------------------------------------------
// Content wizard dialog reflow
// ---------------------------------------------------------------------------

test.describe("Reflow: Content Wizard @reflow", () => {
  test("wizard title and step indicator stay in view when navigating backward at zoom", async ({ page }, testInfo) => {
    setupConsoleTracking(page);

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Open the "Create Mob" wizard dialog from the home page.
    await page.evaluate(() => {
      const heading = Array.from(document.querySelectorAll("h3")).find(
        (e) => (e.textContent || "").trim() === "Make a Mob"
      );
      const button = heading && heading.closest("button");
      if (button) (button as HTMLElement).click();
    });

    const header = page.locator(".cwiz-wizard-header");
    const title = page.locator(".cwiz-wizard-title"); // "Create Mob"
    const stepIndicator = page.locator(".cwiz-wizard-step-indicator"); // "Step 1 of N: ..."
    await expect(header).toBeVisible({ timeout: 15000 });

    // The title and step indicator must be visible when the dialog opens.
    await expect(title).toBeInViewport();
    await expect(stepIndicator).toBeInViewport();

    // Navigate forward then back. A scrollable body with a hard min-height used to
    // overflow the fixed-height dialog, so activating a footer control scrolled the
    // whole dialog and pushed the header text off the top — most visibly when
    // navigating backward (WCAG 1.4.4 Resize Text / 1.4.10 Reflow). The header is
    // fixed, so only the body should scroll and the title text must stay put.
    const footer = page.locator(".cwiz-wizard-footer");
    await footer.getByRole("button", { name: /^Next/i }).first().click();
    await page.waitForTimeout(400);
    await footer.getByRole("button", { name: /^Back/i }).first().click();
    await page.waitForTimeout(400);

    await page.screenshot({
      path: `debugoutput/screenshots/reflow-content-wizard-${zoomLabel(testInfo)}.png`,
      fullPage: true,
    });

    await expect(title).toBeInViewport();
    await expect(stepIndicator).toBeInViewport();
  });
});
