import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for VSCode Web Extension testing.
 *
 * This configuration is specifically designed to test the MCTools VSCode extension
 * running in VS Code for the Web (vscode.dev-style environment).
 *
 * Usage:
 *   npm run test-vscweb           # Run all VSCode web tests
 *   npm run test-vscweb-headed    # Run with visible browser
 *   npm run test-vscweb-debug     # Debug step by step
 *
 * Prerequisites:
 *   1. Build the extension: npm run vscbuild
 *   2. The test will automatically start vscode-test-web server on port 3041
 */
export default defineConfig({
  testDir: "./src/testvscweb",

  outputDir: "./debugoutput/playwright-vscweb-results",

  /* Snapshot configuration */
  snapshotDir: "./debugoutput/screenshots/vscweb",
  snapshotPathTemplate: "{snapshotDir}/{arg}{ext}",

  /* Run tests serially for VSCode - it's a heavy application */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Single worker for VSCode tests - extension state is shared */
  workers: 1,

  /* Reporter to use */
  reporter: [["html", { open: "never", outputFolder: "debugoutput/playwright-vscweb-results-html" }]],

  /* Longer timeout for VSCode tests - extension activation can take time */
  timeout: 60000,

  /* Shared settings */
  use: {
    /* Base URL for VSCode web */
    baseURL: "http://localhost:3041",

    /* Collect trace when retrying the failed test */
    trace: "on-first-retry",

    /* Take screenshot on failure */
    screenshot: "only-on-failure",

    /* Longer action timeout for VSCode UI */
    actionTimeout: 15000,
  },

  /* Configure projects */
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
        // Larger viewport for VSCode
        viewport: { width: 1400, height: 900 },
      },
    },
  ],

  /* Start vscode-test-web server before running tests */
  // NOTE: Pinned to VS Code 1.113.0 (commit cfbea10c5ffb233ea9177d34726e6056e89913dc)
  // to work around upstream breakage in 1.114.0+.
  // See https://github.com/microsoft/vscode-test-web/issues/203 and /issues/204.
  // Remove --commit (and restore plain --quality=stable) once @vscode/test-web is updated.
  webServer: {
    command:
      "npx vscode-test-web --browserType=none --esm --quality=stable --commit=cfbea10c5ffb233ea9177d34726e6056e89913dc --port=3041 --extensionDevelopmentPath=./toolbuild/vsc/ ../samplecontent/diverse_content/",
    url: "http://localhost:3041",
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes to start
  },
});
