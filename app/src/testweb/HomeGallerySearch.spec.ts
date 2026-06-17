/**
 * HomeGallerySearch.spec.ts - Tests for home page template/snippet search
 *
 * Validates that the gallery search on the home page correctly filters
 * templates and snippets, and shows appropriate "no results" messaging
 * instead of the "Templates couldn't be loaded" error when the gallery
 * is loaded but the search has no matches.
 *
 * Run with: npx playwright test HomeGallerySearch.spec.ts --project=chromium
 */

import { test, expect, Page, ConsoleMessage } from "@playwright/test";
import { processMessage, takeScreenshot } from "./WebTestUtilities";

const SCREENSHOT_DIR = "./debugoutput/screenshots/home-gallery-search";

// ============================================================================
// HELPERS
// ============================================================================

/** Wait for at least one template card to appear on the home page. */
async function waitForTemplates(page: Page, timeoutMs = 15000): Promise<void> {
  await page
    .locator('[data-testid^="template-card-"]')
    .first()
    .waitFor({ state: "visible", timeout: timeoutMs });
}

/** Return the search input in the home page CommandBar. */
function searchInput(page: Page) {
  return page.locator('input[aria-label="search and command bar"]');
}

/** Type a query into the home page search bar. */
async function typeSearch(page: Page, query: string): Promise<void> {
  const input = searchInput(page);
  await input.click();
  await input.fill(query);
  // Allow React state + filtering to settle
  await page.waitForTimeout(400);
}

/** Clear the home page search bar. */
async function clearSearch(page: Page): Promise<void> {
  const input = searchInput(page);
  await input.fill("");
  await page.waitForTimeout(400);
}

/** Count visible template cards. */
async function templateCardCount(page: Page): Promise<number> {
  return page.locator('[data-testid^="template-card-"]').count();
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Home Gallery Search @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "commit" });
    await page.locator("#root > *").first().waitFor({ state: "attached", timeout: 45000 });

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });

    // Wait for the gallery to load
    await waitForTemplates(page);
  });

  test("search with no matches shows 'no templates found' instead of load error", async ({ page }) => {
    const initialCount = await templateCardCount(page);
    expect(initialCount).toBeGreaterThan(0);

    // Type a nonsense query that won't match any template
    await typeSearch(page, "xyznonexistent");
    await takeScreenshot(page, `${SCREENSHOT_DIR}/search-no-match`);

    // Should show zero template cards
    const filteredCount = await templateCardCount(page);
    expect(filteredCount).toBe(0);

    // Should NOT show the "Templates couldn't be loaded" error
    const loadError = page.getByText("Templates couldn't be loaded");
    await expect(loadError).not.toBeVisible();

    // Should show "No templates found."
    const noResults = page.getByText("No templates found.");
    await expect(noResults).toBeVisible();
  });

  test("search filters templates by title", async ({ page }) => {
    const initialCount = await templateCardCount(page);
    expect(initialCount).toBeGreaterThan(0);

    // Get the title of the first template card to use as a search term
    const firstCardTitle = await page
      .locator('[data-testid^="template-card-"]')
      .first()
      .locator("h6, h5, .MuiTypography-root")
      .first()
      .textContent();

    expect(firstCardTitle).toBeTruthy();

    // Use the first few characters of the title (at least 3 to pass queryMinLength)
    const query = firstCardTitle!.trim().substring(0, Math.max(5, firstCardTitle!.trim().length));
    await typeSearch(page, query);
    await takeScreenshot(page, `${SCREENSHOT_DIR}/search-filter-match`);

    // Should have at least one result
    const filteredCount = await templateCardCount(page);
    expect(filteredCount).toBeGreaterThanOrEqual(1);

    // Should NOT show load error
    const loadError = page.getByText("Templates couldn't be loaded");
    await expect(loadError).not.toBeVisible();
  });

  test("clearing search restores all templates", async ({ page }) => {
    const initialCount = await templateCardCount(page);
    expect(initialCount).toBeGreaterThan(0);

    // Search for something that won't match
    await typeSearch(page, "xyznonexistent");
    expect(await templateCardCount(page)).toBe(0);

    // Clear the search
    await clearSearch(page);
    await takeScreenshot(page, `${SCREENSHOT_DIR}/search-cleared`);

    // Templates should be restored
    const restoredCount = await templateCardCount(page);
    expect(restoredCount).toBe(initialCount);
  });

  test("search with fewer than 3 characters does not filter", async ({ page }) => {
    const initialCount = await templateCardCount(page);
    expect(initialCount).toBeGreaterThan(0);

    // Type only 2 characters — should not trigger filtering (queryMinLength = 3)
    await typeSearch(page, "ab");
    await takeScreenshot(page, `${SCREENSHOT_DIR}/search-below-min-length`);

    const count = await templateCardCount(page);
    expect(count).toBe(initialCount);
  });
});
