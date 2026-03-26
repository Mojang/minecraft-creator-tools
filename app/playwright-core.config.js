import { defineConfig, devices } from "@playwright/test";

/**
 * Core web test configuration — a fast subset of tests for CI/build validation.
 *
 * Runs only tests tagged with @focused, which cover the primary creator UX:
 *   - Basic page load, navigation, React rendering
 *   - Focused-mode editors (biome, feature, entity, etc.)
 *   - Editor interactions, modes, and command workflows
 *   - Accessibility checks, status area, deploy toolbar
 *   - Import, download/export
 *
 * For the full suite (including @full, usability, untagged tests), use:
 *   npm run test-web
 *
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./src/testweb",

  // Warm up Vite dev server before running tests — prevents cold-start timeouts
  globalSetup: "./src/testweb/globalSetup.ts",

  // Match the default config timeout — 60s accommodates enterEditor() waits,
  // axe-core accessibility scans, and cold-start Vite dev server startup.
  timeout: 60000,

  // Only run tests tagged @focused
  grep: /@focused/,

  // Exclude ServerUI tests — they require a running MCT server
  testIgnore: ["**/ServerUI.spec.ts"],

  outputDir: "./debugoutput/playwright-core-test-results",

  /* Snapshot configuration — output to debugoutput so generated images don't pollute public/ */
  snapshotDir: "./debugoutput/res/snapshots",
  snapshotPathTemplate: "{snapshotDir}/{arg}{ext}",

  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Limit parallel workers on CI */
  workers: process.env.CI ? 1 : 4,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [["html", { open: "never", outputFolder: "debugoutput/playwright-core-test-results-html" }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:3000",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
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
