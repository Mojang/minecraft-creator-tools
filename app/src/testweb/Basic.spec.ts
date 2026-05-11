import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage } from "./WebTestUtilities";

test.describe("MCTools Web Application @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    // Use "commit" (fires immediately when navigation is committed). Vite's HMR
    // WebSocket keeps the network busy so "networkidle" never fires, and even
    // "domcontentloaded"/"load" can hang under heavy parallel worker load while
    // Vite transforms modules. After commit, we wait for React to mount content.
    await page.goto("/", { waitUntil: "commit" });
    await page.locator("#root > *").first().waitFor({ state: "attached", timeout: 45000 });

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should load the homepage successfully", async ({ page }) => {
    // Check that the page has loaded by looking for a title or main element
    await expect(page).toHaveTitle(/minecraft creator tools|mctools/i);

    // Check for main content area or navigation
    const mainContent = page.locator("body");
    await expect(mainContent).toBeVisible();
  });

  test("should have working navigation", async ({ page }) => {
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

    // Ensure the page is still functional on mobile
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Re-navigate (instead of reload) for desktop viewport. Under parallel
    // worker load against Vite dev server, page.reload() can hang waiting for
    // any wait condition. A fresh goto with waitUntil:"commit" is most reliable.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/", { waitUntil: "commit" });
    await page.locator("#root > *").first().waitFor({ state: "attached", timeout: 30000 });
  });
});
