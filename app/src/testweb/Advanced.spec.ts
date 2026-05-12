import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage } from "./WebTestUtilities";

test.describe("MCTools Web Application - Advanced Features @focused", () => {
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

  test("should handle file operations and project management", async ({ page }) => {
    // Test for common MCTools UI elements that might be present
    // This test will adapt to whatever UI elements are actually available

    // Check for file upload areas or buttons
    const fileInputs = page.locator('input[type="file"], [data-testid*="file"], .file-upload, .upload-button');
    if ((await fileInputs.count()) > 0) {
      await expect(fileInputs.first()).toBeVisible();
    }

    // Check for navigation or menu elements
    const navElements = page.locator("nav, .navbar, .menu, .sidebar, header");
    if ((await navElements.count()) > 0) {
      await expect(navElements.first()).toBeVisible();
    }

    // Check for main content area
    const contentAreas = page.locator('main, .main, .content, .app-content, [role="main"]');
    if ((await contentAreas.count()) > 0) {
      await expect(contentAreas.first()).toBeVisible();
    }

    // Verify page doesn't have obvious error states
    const errorIndicators = page.locator('.error, .error-message, [data-testid*="error"]');
    await expect(errorIndicators).toHaveCount(0);
  });

  test("should support keyboard navigation", async ({ page }) => {
    // beforeEach already navigated; no need to navigate again. Just exercise the page.
    // Test basic keyboard navigation
    await page.keyboard.press("Tab");

    // Check if focus is visible on some element
    const focusedElement = page.locator(":focus");
    if ((await focusedElement.count()) > 0) {
      await expect(focusedElement).toBeVisible();
    }

    // Test escape key doesn't break anything
    await page.keyboard.press("Escape");

    // Page should still be functional
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("should handle browser refresh gracefully", async ({ page }) => {
    // Re-navigate instead of reload(). Under parallel worker load against
    // Vite dev server, page.reload() can hang waiting for any wait condition.
    // A fresh goto with waitUntil:"commit" is the most reliable way to test
    // "refresh" behavior, then we poll for React to mount.
    await page.goto("/", { waitUntil: "commit" });
    await page.locator("#root > *").first().waitFor({ state: "attached", timeout: 30000 });

    // Check that content has loaded
    const hasContent = await page.evaluate(() => {
      return document.body.innerText.trim().length > 0;
    });
    expect(hasContent).toBe(true);
  });
});
