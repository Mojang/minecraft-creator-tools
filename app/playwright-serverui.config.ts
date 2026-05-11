import { defineConfig, devices } from "@playwright/test";
import * as path from "path";

/**
 * Playwright configuration for MCTools Server UI Tests
 *
 * These tests automatically start and stop the MCT HTTP server on a random port
 * in the range 6246-6346. The server is started with a test admin passcode.
 *
 * Run tests with:
 *
 *   npx playwright test --config=playwright-serverui.config.ts
 *
 * Or use the npm script:
 *
 *   npm run test-server-ui
 *
 * The globalSetup starts the server, and globalTeardown stops it.
 * Tests read the port from a file written by globalSetup.
 */
export default defineConfig({
  testDir: "./src/testweb",

  // Only run server UI tests
  testMatch: ["ServerUI.spec.ts", "PseudoLocaleServerUI.spec.ts"],

  outputDir: "./debugoutput/playwright-serverui-results",

  // Global setup starts the MCT server
  globalSetup: path.resolve(__dirname, "./src/testweb/serverui-global-setup.ts"),

  // Global teardown stops the MCT server
  globalTeardown: path.resolve(__dirname, "./src/testweb/serverui-global-teardown.ts"),

  /* Run tests in files in parallel */
  fullyParallel: false, // Run serially since we're testing a shared server

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Single worker since we're testing against a shared server */
  workers: 1,

  /* Reporter to use */
  reporter: [["html", { open: "never", outputFolder: "debugoutput/playwright-serverui-results-html" }]],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL - will be overridden by tests reading the port file */
    baseURL: "http://localhost:6126",

    /* Collect trace when retrying the failed test */
    trace: "on-first-retry",

    /* Take screenshot on failure */
    screenshot: "only-on-failure",
  },

  /* Configure projects for browsers */
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
      },
    },
  ],

  /* Longer timeout since the server may need to initialize */
  timeout: 60000,
});
