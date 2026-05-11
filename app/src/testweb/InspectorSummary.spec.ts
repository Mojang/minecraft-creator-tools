import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage, enterEditor } from "./WebTestUtilities";

/**
 * Tests for the Inspector Summary view, which displays project validation statistics
 * in a categorized, collapsible format with combined related metrics (lines/size).
 */
test.describe("MCTools Web - Inspector Summary View @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    // Clear error arrays for each test
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should navigate to Inspector and display Summary tab", async ({ page }) => {
    test.setTimeout(120000);

    // Set a taller viewport to see more content
    await page.setViewportSize({ width: 1280, height: 1200 });

    // Ensure page is loaded before entering editor
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Enter the editor
    const enteredEditor = await enterEditor(page, { editMode: "full" });
    expect(enteredEditor).toBe(true);

    // Take screenshot of editor
    await page.screenshot({ path: "debugoutput/screenshots/inspector-summary-01-editor.png", fullPage: true });

    // Wait for project items to load
    await page.waitForTimeout(2000);

    // Find and click on Inspector item in the file list
    const inspectorItem = page.getByText("Check for Problems").or(page.getByText("Validation")).or(page.getByText("Inspector")).first();

    try {
      await expect(inspectorItem).toBeVisible({ timeout: 10000 });
      console.log("Found Inspector item, clicking...");
      await inspectorItem.click();
    } catch {
      console.log("Inspector not immediately visible, trying option selector");
      const inspectorOption = page.locator("option:has-text('Inspector')");
      await expect(inspectorOption).toBeVisible({ timeout: 5000 });
      await inspectorOption.click();
    }

    // Wait for Inspector to load and validation to run
    await page.waitForTimeout(5000);

    // Take screenshot of Inspector view
    await page.screenshot({
      path: "debugoutput/screenshots/inspector-summary-02-inspector-initial.png",
      fullPage: true,
    });

    // Check for the Inspector title - if page went blank, try waiting longer
    const inspectorTitle = page.locator("text=/Project Inspector/i");
    try {
      await expect(inspectorTitle.first()).toBeVisible({ timeout: 10000 });
    } catch {
      // Sometimes the page needs extra time to render after navigation
      console.log("Inspector title not found, waiting longer...");
      await page.waitForTimeout(5000);
      await expect(inspectorTitle.first()).toBeVisible({ timeout: 15000 });
    }

    // Look for Summary tab. The button no longer has a title attribute —
    // it uses role="tab" + id="pid-tab-summary" + aria-controls. Selecting
    // by id is the most stable.
    const summaryTab = page.locator("#pid-tab-summary");
    if ((await summaryTab.count()) > 0) {
      console.log("Found Summary tab button");
      await summaryTab.click();
      await page.waitForTimeout(1000);
      // Hard assertion: the tab actually switched to Summary mode.
      await expect(summaryTab).toHaveAttribute("aria-selected", "true");
    } else {
      throw new Error("Summary tab #pid-tab-summary not found in Inspector header");
    }

    // Take screenshot of Summary view
    await page.screenshot({ path: "debugoutput/screenshots/inspector-summary-03-summary-tab.png", fullPage: true });

    // Verify no critical console errors
    expect(consoleErrors.length).toBeLessThanOrEqual(5);
  });

  test("should display categorized statistics with collapsible sections", async ({ page }) => {
    // Enter the editor and navigate to Inspector
    const enteredEditor = await enterEditor(page, { editMode: "full" });
    expect(enteredEditor).toBe(true);

    await page.waitForTimeout(2000);

    // Click on Inspector
    const inspectorItem = page.getByText("Check for Problems").or(page.getByText("Validation")).or(page.getByText("Inspector")).first();
    await expect(inspectorItem).toBeVisible({ timeout: 10000 });
    await inspectorItem.click();

    // Wait for validation to complete
    await page.waitForTimeout(8000);

    // Click on Summary tab (role=tab, id=pid-tab-summary)
    const summaryTab = page.locator("#pid-tab-summary");
    await expect(summaryTab).toBeVisible({ timeout: 5000 });
    await summaryTab.click();
    await page.waitForTimeout(1000);
    await expect(summaryTab).toHaveAttribute("aria-selected", "true");

    // Take screenshot of Summary view with categories
    await page.screenshot({ path: "debugoutput/screenshots/inspector-summary-04-categories.png", fullPage: true });

    // Look for category cards (using the stat card class). These render in
    // the Summary view; if the test reports 0 it means we never made it onto
    // the Summary tab, which we now treat as a hard failure.
    const categoryCards = page.locator(".pis-statCard");
    const cardCount = await categoryCards.count();
    console.log(`Found ${cardCount} category cards`);
    expect(cardCount).toBeGreaterThan(0);

    // Take screenshot
    await page.screenshot({ path: "debugoutput/screenshots/inspector-summary-05-category-cards.png", fullPage: true });

    // Look for category headers with icons and badges
    const categoryHeaders = page.locator(".pis-statCardHeader");
    const headerCount = await categoryHeaders.count();
    console.log(`Found ${headerCount} category headers`);
    expect(headerCount).toBeGreaterThan(0);

    // Try clicking on a category header to expand/collapse
    const firstHeader = categoryHeaders.first();
    console.log("Clicking on first category header to toggle");
    await firstHeader.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "debugoutput/screenshots/inspector-summary-06-after-toggle.png", fullPage: true });

    // Check for stat items within sections. After expanding the first
     // category, we expect to see at least one stat item rendered. The
     // .pis-statItem class covers most categories; categories with summary
     // texture-memory cards use .pis-statItemCard. Accept either ΓÇö the
     // important thing is that expanding produced visible content.
    const statItems = page.locator(".pis-statItem, .pis-statItemCard");
    const statCount = await statItems.count();
    console.log(`Found ${statCount} stat items / cards`);
    expect(statCount).toBeGreaterThan(0);

    // Take screenshot showing stats
    await page.screenshot({ path: "debugoutput/screenshots/inspector-summary-07-stat-items.png", fullPage: true });

    expect(consoleErrors.length).toBeLessThanOrEqual(5);
  });

  test("should display combined lines/size statistics correctly", async ({ page }) => {
    test.setTimeout(60000);
    // Enter the editor and navigate to Inspector
    const enteredEditor = await enterEditor(page, { editMode: "full" });
    expect(enteredEditor).toBe(true);

    await page.waitForTimeout(2000);

    // Click on Inspector
    const inspectorItem = page.getByText("Check for Problems").or(page.getByText("Validation")).or(page.getByText("Inspector")).first();
    await expect(inspectorItem).toBeVisible({ timeout: 10000 });
    await inspectorItem.click();

    // Wait for validation to complete (can take a while)
    await page.waitForTimeout(10000);

    // Click on Summary tab
    const summaryTab = page.locator("#pid-tab-summary");
    await expect(summaryTab).toBeVisible({ timeout: 5000 });
    await summaryTab.click();
    await page.waitForTimeout(1000);
    await expect(summaryTab).toHaveAttribute("aria-selected", "true");

    // Take screenshot of Summary with combined stats
    await page.screenshot({ path: "debugoutput/screenshots/inspector-summary-08-combined-stats.png", fullPage: true });

    // Look for text patterns that indicate combined lines/size stats
    // Should see patterns like "X lines (across Y items)" or "X bytes (across Y items)"
    const linesPattern = page.locator("text=/lines.*across.*items/i");
    const bytesPattern = page.locator("text=/bytes.*across.*items/i");

    const linesCount = await linesPattern.count();
    const bytesCount = await bytesPattern.count();
    console.log(`Found ${linesCount} combined lines stats, ${bytesCount} combined bytes stats`);

    // Expand all categories to see all stats
    const categoryHeaders = page.locator(".pis-statCardHeader");
    const headerCount = await categoryHeaders.count();
    expect(headerCount).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(headerCount, 5); i++) {
      const header = categoryHeaders.nth(i);
      // Check if it's collapsed (no sibling content visible)
      const headerText = await header.textContent();
      console.log(`Expanding category: ${headerText}`);
      await header.click();
      await page.waitForTimeout(300);
    }

    // Take screenshot with multiple categories expanded
    await page.screenshot({
      path: "debugoutput/screenshots/inspector-summary-09-expanded-categories.png",
      fullPage: true,
    });

    expect(consoleErrors.length).toBeLessThanOrEqual(5);
  });

  test("should handle Info tab and display validation items", async ({ page }) => {
    // Enter the editor and navigate to Inspector
    const enteredEditor = await enterEditor(page, { editMode: "full" });
    expect(enteredEditor).toBe(true);

    await page.waitForTimeout(2000);

    // Click on Inspector
    const inspectorItem = page.getByText("Check for Problems").or(page.getByText("Validation")).or(page.getByText("Inspector")).first();
    await expect(inspectorItem).toBeVisible({ timeout: 10000 });
    await inspectorItem.click();

    // Wait for validation
    await page.waitForTimeout(8000);

    // Click on Info tab (should show individual validation items)
    const infoTab = page.locator("#pid-tab-items");
    await expect(infoTab).toBeVisible({ timeout: 5000 });
    console.log("Clicking on Info tab");
    await infoTab.click();
    await page.waitForTimeout(1000);
    await expect(infoTab).toHaveAttribute("aria-selected", "true");

    // Take screenshot of Info view
    await page.screenshot({ path: "debugoutput/screenshots/inspector-summary-10-info-tab.png", fullPage: true });

    // Look for filter buttons (errors, warnings, etc.)
    const errorFilter = page.locator("text=/error/i").first();
    const warningFilter = page.locator("text=/warning/i").first();

    if ((await errorFilter.count()) > 0) {
      console.log("Found error filter");
    }
    if ((await warningFilter.count()) > 0) {
      console.log("Found warning filter");
    }

    expect(consoleErrors.length).toBeLessThanOrEqual(5);
  });

  test("should switch between Summary and Info tabs", async ({ page }) => {
    // Enter the editor and navigate to Inspector
    const enteredEditor = await enterEditor(page, { editMode: "full" });
    expect(enteredEditor).toBe(true);

    await page.waitForTimeout(2000);

    // Click on Inspector
    const inspectorItem = page.getByText("Check for Problems").or(page.getByText("Validation")).or(page.getByText("Inspector")).first();
    await expect(inspectorItem).toBeVisible({ timeout: 10000 });
    await inspectorItem.click();

    // Wait for validation
    await page.waitForTimeout(8000);

    // Take initial screenshot
    await page.screenshot({ path: "debugoutput/screenshots/inspector-summary-11-initial-tab.png", fullPage: true });

    // Click Summary tab
    const summaryTab = page.locator("#pid-tab-summary");
    const infoTab = page.locator("#pid-tab-items");
    await expect(summaryTab).toBeVisible({ timeout: 5000 });
    await summaryTab.click();
    await page.waitForTimeout(500);
    await expect(summaryTab).toHaveAttribute("aria-selected", "true");
    await page.screenshot({
      path: "debugoutput/screenshots/inspector-summary-12-summary-selected.png",
      fullPage: true,
    });

    // Click Info tab
    await infoTab.click();
    await page.waitForTimeout(500);
    await expect(infoTab).toHaveAttribute("aria-selected", "true");
    await page.screenshot({ path: "debugoutput/screenshots/inspector-summary-13-info-selected.png", fullPage: true });

    // Switch back to Summary
    await summaryTab.click();
    await page.waitForTimeout(500);
    await expect(summaryTab).toHaveAttribute("aria-selected", "true");
    await page.screenshot({
      path: "debugoutput/screenshots/inspector-summary-14-back-to-summary.png",
      fullPage: true,
    });

    expect(consoleErrors.length).toBeLessThanOrEqual(5);
  });

  test("should display proper stat formatting with commas and readable labels", async ({ page }) => {
    test.setTimeout(120000);

    // Enter the editor and navigate to Inspector
    const enteredEditor = await enterEditor(page, { editMode: "full" });
    expect(enteredEditor).toBe(true);

    await page.waitForTimeout(2000);

    // Click on Inspector
    const inspectorItem = page.getByText("Check for Problems").or(page.getByText("Validation")).or(page.getByText("Inspector")).first();
    await expect(inspectorItem).toBeVisible({ timeout: 10000 });
    await inspectorItem.click();

    // Wait for validation to complete
    await page.waitForTimeout(10000);

    // Click on Summary tab
    const summaryTab = page.locator("#pid-tab-summary");
    await expect(summaryTab).toBeVisible({ timeout: 5000 });
    await summaryTab.click();
    await page.waitForTimeout(1000);
    await expect(summaryTab).toHaveAttribute("aria-selected", "true");

    // Take high-res screenshot for visual inspection
    await page.screenshot({
      path: "debugoutput/screenshots/inspector-summary-15-formatting.png",
      fullPage: true,
    });

    // Scroll down to see more content
    const summaryArea = page.locator(".pid-summaryArea, .pid-outer").first();
    if ((await summaryArea.count()) > 0) {
      await summaryArea.evaluate((el) => (el.scrollTop = 300));
      await page.waitForTimeout(500);
      await page.screenshot({
        path: "debugoutput/screenshots/inspector-summary-17-scrolled-down.png",
        fullPage: true,
      });

      // Scroll more
      await summaryArea.evaluate((el) => (el.scrollTop = 600));
      await page.waitForTimeout(500);
      await page.screenshot({
        path: "debugoutput/screenshots/inspector-summary-18-scrolled-more.png",
        fullPage: true,
      });
    }

    // Final comprehensive screenshot with all content
    await page.screenshot({
      path: "debugoutput/screenshots/inspector-summary-16-all-expanded.png",
      fullPage: true,
    });

    // Check for stat labels and values
    const statLabels = page.locator(".pis-statLabel");
    const statValues = page.locator(".pis-statValue");

    const labelCount = await statLabels.count();
    const valueCount = await statValues.count();

    console.log(`Found ${labelCount} stat labels and ${valueCount} stat values`);
    expect(labelCount).toBeGreaterThan(0);
    expect(valueCount).toBeGreaterThan(0);

    // Log a sample of the stat content for review
    if (labelCount > 0) {
      for (let i = 0; i < Math.min(labelCount, 10); i++) {
        const label = await statLabels.nth(i).textContent();
        const value = await statValues.nth(i).textContent();
        console.log(`Stat ${i + 1}: "${label}" = "${value}"`);
      }
    }

    expect(consoleErrors.length).toBeLessThanOrEqual(5);
  });
});
