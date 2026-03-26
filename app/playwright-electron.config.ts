/**
 * Playwright configuration for Electron app testing
 *
 * This configuration is specifically for testing the Electron application.
 * It differs from the web tests in that it launches the actual Electron app
 * rather than testing in a browser.
 *
 * Prerequisites:
 *   npm run webbuild && npm run jsncorebuild
 *   OR: npm run test-electron-full (builds and runs automatically)
 *
 * Run with: npm run test-electron
 * Dev mode: npm run test-electron-dev (uses Vite at localhost:3000)
 */

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/testelectron",
  testMatch: "**/*.spec.ts",

  // Electron tests can be slower due to app startup; professional editor tests need
  // extra time for inspector/validation which can take 30-60s to render
  timeout: 90000,
  expect: {
    timeout: 10000,
  },

  // Run tests serially - Electron app is a singleton
  fullyParallel: false,
  workers: 1,

  // Fail fast on CI
  forbidOnly: !!process.env.CI,

  // Retry failed tests
  retries: process.env.CI ? 1 : 0,

  // Reporter configuration
  reporter: [["html", { outputFolder: "debugoutput/playwright-electron-results-html", open: "never" }], ["list"]],

  // Output directory for test artifacts
  outputDir: "debugoutput/playwright-electron-results",

  // Global setup validates prerequisites (toolbuild, build/ assets)
  globalSetup: "./src/testelectron/global-setup.ts",

  // Global teardown cleans up stale test directories from crashed/interrupted test runs
  globalTeardown: "./src/testelectron/global-teardown.ts",

  use: {
    // Trace on first retry
    trace: "on-first-retry",

    // Always capture screenshots — every test should also emit explicit takeScreenshot() calls
    // to debugoutput/screenshots/ but this provides a safety net for any missed tests
    screenshot: "on",

    // Video on failure
    video: "on-first-retry",
  },

  // No projects needed - Electron tests don't run in browsers
  // The Electron app is launched directly via electron.launch()
});
