/**
 * Shared Playwright test fixtures for MAS accessibility tests.
 *
 * Extends the default Playwright `test` with:
 * - Auto-screenshot on test failure (saved to debugoutput/screenshots/a11y-*)
 * - `axeScan` convenience function pre-configured with project WCAG tags
 *
 * Usage:
 *   import { test, expect } from "./fixtures";
 *   test("my a11y test", async ({ page, axeScan }) => {
 *     await page.goto("/");
 *     const result = await axeScan();
 *     expect(result.criticalViolations).toHaveLength(0);
 *   });
 */

import { test as base } from "@playwright/test";
import { runAxeScan, logViolations, type AxeScanResult } from "./a11yTestUtils";

type A11yFixtures = {
  /** Run an axe scan with project-standard WCAG tags and disabled rules. */
  axeScan: (options?: Parameters<typeof runAxeScan>[1]) => Promise<AxeScanResult>;
};

export const test = base.extend<A11yFixtures>({
  axeScan: async ({ page }, use) => {
    const scan = async (options?: Parameters<typeof runAxeScan>[1]) => {
      const result = await runAxeScan(page, options);
      logViolations(result.violations, "axeScan fixture");
      return result;
    };
    await use(scan);
  },

  // Auto-screenshot on failure
  page: async ({ page }, use, testInfo) => {
    await use(page);

    if (testInfo.status !== testInfo.expectedStatus) {
      const safeName = testInfo.title.replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 60);
      await page
        .screenshot({
          path: `debugoutput/screenshots/a11y-failure-${safeName}.png`,
          fullPage: true,
        })
        .catch(() => {}); // Don't fail teardown if screenshot fails
    }
  },
});

export { expect } from "@playwright/test";
