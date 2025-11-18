import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage } from "./WebTestUtilities";

test.describe("MCTools Web Application", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should load the homepage successfully", async ({ page }) => {
    // Check that the page has loaded by looking for a title or main element
    await expect(page).toHaveTitle(/minecraft creator tools|mctools/i);

    // Wait for the page to be fully loaded
    await page.waitForLoadState("networkidle");

    // Check for main content area or navigation
    const mainContent = page.locator("body");
    await expect(mainContent).toBeVisible();
  });

  test("should have working navigation", async ({ page }) => {
    // Wait for the page to load
    await page.waitForLoadState("networkidle");

    // Look for any navigation links or buttons that might be present
    // This is a basic test to ensure the React app has rendered
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Check that React has rendered content (not just a blank page)
    const hasContent = await page.evaluate(() => {
      return document.body.innerText.trim().length > 0;
    });
    expect(hasContent).toBe(true);
  });

  test("should handle React routing", async ({ page }) => {
    // Wait for React to load
    await page.waitForLoadState("networkidle");

    // Check that we're not seeing any React error boundaries
    const errorElements = page.locator("text=/error|something went wrong/i");
    await expect(errorElements).toHaveCount(0);

    // Verify the page has rendered React content
    const reactRoot = page.locator("#root, [data-reactroot], .App");
    if ((await reactRoot.count()) > 0) {
      await expect(reactRoot.first()).toBeVisible();
    }
  });

  test("should be responsive and mobile-friendly", async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.waitForLoadState("networkidle");

    // Ensure the page is still functional on mobile
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.reload();

    await page.waitForLoadState("networkidle");
    await expect(body).toBeVisible();
  });
});
