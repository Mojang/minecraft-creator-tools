import { defineConfig, devices } from "@playwright/test";

/**
 * Locale coverage test configuration.
 *
 * Runs pseudo-locale tests that detect un-localized hardcoded strings
 * by loading the app with ⟦marker⟧-wrapped translations and scanning
 * all visible text for strings missing the markers.
 *
 * Prerequisites:
 *   node scripts/generate-pseudo-locale.mjs
 *
 * Usage:
 *   npx playwright test --config playwright-locale.config.js
 *
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./src/testweb",
  testMatch: "PseudoLocale.spec.ts",

  globalSetup: "./src/testweb/globalSetup.ts",

  timeout: 90000,

  outputDir: "./debugoutput/playwright-locale-test-results",

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,

  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "debugoutput/playwright-locale-test-results-html" }],
  ],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
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

  webServer: {
    command: "npm run web",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
