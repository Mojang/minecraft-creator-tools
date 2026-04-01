/**
 * Production Bundle Integrity Tests
 *
 * These tests verify that the production build loads without JavaScript errors.
 * They specifically catch cross-chunk initialization issues caused by the Vite
 * manualChunks configuration splitting interdependent packages into separate
 * chunks.
 *
 * BACKGROUND:
 * Vite splits node_modules into vendor chunks for caching. Packages with
 * circular or tightly-coupled dependencies (e.g., @formatjs, @mui, @emotion)
 * break when split across chunk boundaries because ES module hoisting can
 * leave bindings uninitialized at the time they're first accessed.
 *
 * These errors manifest as:
 *   - "Gk is not a function" (mangled name, cross-chunk reference)
 *   - "Cannot access 'X' before initialization"
 *   - "X.default is not a function"
 *
 * The dev server (Vite) does NOT exhibit these errors because it serves
 * unbundled ESM modules. Only the production build triggers them.
 *
 * IMPORTANT: These tests should run against the PRODUCTION build config
 * (playwright-production.config.js, port 3001). When run against the dev
 * server (playwright.config.js, port 3000), they will pass trivially
 * since Vite doesn't chunk code — they are still useful as a basic smoke
 * test but won't catch chunking regressions.
 *
 * RUN:
 *   npm run webbuild && npm run test-production -- ProductionBundleIntegrity
 */

import { test, expect, Page } from "@playwright/test";

/**
 * Collect all uncaught JS errors and console errors during page load.
 * Returns arrays that the test can assert against.
 */
function attachErrorCollectors(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  // pageerror fires for uncaught exceptions — this is what "Gk is not a function" triggers
  page.on("pageerror", (error) => {
    pageErrors.push(`${error.message}`);
  });

  // console.error captures React error boundaries and explicit error logging
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignore known-benign console errors
      if (text.includes("manifest.json") || text.includes("favicon")) {
        return;
      }
      consoleErrors.push(text);
    }
  });

  return { pageErrors, consoleErrors };
}

test.describe("Production Bundle Integrity", () => {
  test("page loads without uncaught JavaScript errors", async ({ page }) => {
    const { pageErrors, consoleErrors } = attachErrorCollectors(page);

    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });

    // Wait a bit for any deferred module initialization
    await page.waitForTimeout(2000);

    // The critical assertion: no uncaught JS exceptions
    expect(pageErrors, `Uncaught JS errors during page load:\n${pageErrors.join("\n")}`).toHaveLength(0);

    // Secondary: no console.error calls (may indicate React error boundaries)
    expect(consoleErrors, `Console errors during page load:\n${consoleErrors.join("\n")}`).toHaveLength(0);
  });

  test("React app renders content in #root", async ({ page }) => {
    const { pageErrors } = attachErrorCollectors(page);

    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Verify no errors first
    expect(pageErrors, `Uncaught JS errors:\n${pageErrors.join("\n")}`).toHaveLength(0);

    // Then verify the app actually rendered
    const root = page.locator("#root");
    await expect(root).toBeVisible();

    const rootHtml = await root.innerHTML();
    expect(rootHtml.length, "React root should have rendered content").toBeGreaterThan(10);
  });

  test("vendor chunks load without initialization errors", async ({ page }) => {
    const { pageErrors } = attachErrorCollectors(page);
    const loadedScripts: string[] = [];

    // Track which scripts load successfully
    page.on("response", (response) => {
      const url = response.url();
      if (url.endsWith(".js") && url.includes("vendor-")) {
        loadedScripts.push(url.split("/").pop() || url);
      }
    });

    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // All vendor chunks should load without triggering pageerror
    expect(pageErrors, `Vendor chunk initialization errors:\n${pageErrors.join("\n")}`).toHaveLength(0);

    // When running against the Vite dev server, vendor chunks don't exist
    // (Vite serves unbundled ESM modules). Only assert on vendor-misc in production builds.
    if (loadedScripts.length > 0) {
      const hasMiscChunk = loadedScripts.some((s) => s.includes("vendor-misc"));
      expect(hasMiscChunk, "vendor-misc chunk should have loaded").toBe(true);
    } else {
      console.log(
        "No vendor chunks detected — running against Vite dev server (expected). " +
          "Run against production build (playwright-production.config.js) for full chunk validation."
      );
    }
  });
});
