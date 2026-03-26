import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Block Viewer and Mob Viewer visual regression tests.
 *
 * These tests are separated from the primary UI test suite because:
 * - They render 3D content via Babylon.js which requires longer timeouts
 * - They generate ~130+ visual regression snapshots (expensive and slow)
 * - They are not UX/workflow tests — they validate rendering correctness
 * - They frequently time out in CI, blocking the primary UI test suite
 *
 * Run with: npm run test-viewers
 * Update snapshots: npm run test-viewers-update
 * Headed mode: npm run test-viewers-headed
 *
 * See also: npm run test-extra for CLI-based rendering tests.
 */
export default defineConfig({
  testDir: "./src/testviewers",

  outputDir: "./debugoutput/playwright-viewer-results",

  /* Snapshot configuration — output to debugoutput so generated images don't pollute public/ */
  snapshotDir: "./debugoutput/res/snapshots",
  snapshotPathTemplate: "{snapshotDir}/{arg}{ext}",

  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Limit parallelism — 3D rendering is GPU-intensive */
  workers: process.env.CI ? 1 : 2,

  /* Longer timeout for 3D rendering tests (WebGL + texture loading) */
  timeout: 60_000,

  /* Reporter to use */
  reporter: [["html", { open: "never", outputFolder: "debugoutput/playwright-viewer-results-html" }]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "npm run web",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
