import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for testing the PRODUCTION BUILD.
 *
 * This config serves the built files from the `build/` folder using the `serve` package,
 * which more closely matches the production deployment environment (GitHub Pages, etc.).
 *
 * Key differences from the development config:
 * - Uses port 3001 to avoid conflicts with the dev server on 3000
 * - Serves static files from `build/` folder (requires `npm run webbuild` first)
 * - Uses `serve` package for static file serving (no hot reload, no source maps)
 * - Tests run against minified, bundled production code
 *
 * Usage:
 *   npm run webbuild           # Build the production bundle first
 *   npm run test-production    # Run tests against production build
 *   npm run serve-production   # Just serve the build folder (for manual testing)
 *
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./src/testweb",

  outputDir: "./debugoutput/playwright-production-results",

  /* Snapshot configuration — output to debugoutput so generated images don't pollute public/ */
  snapshotDir: "./debugoutput/res/snapshots",
  snapshotPathTemplate: "{snapshotDir}/{arg}{ext}",

  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Single worker for production tests to avoid port conflicts */
  workers: 1,
  /* Reporter to use */
  reporter: [["html", { open: "never", outputFolder: "debugoutput/playwright-production-results-html" }]],
  /* Shared settings for all the projects below */
  use: {
    /* Base URL - using port 3001 to avoid conflicts with dev server */
    baseURL: "http://localhost:3001",

    /* Collect trace when retrying the failed test */
    trace: "on-first-retry",

    /* Longer timeouts for production build (no hot reload) */
    actionTimeout: 30 * 1000,
    navigationTimeout: 60 * 1000,
  },

  /* Global timeout - production builds may load slower initially */
  timeout: 60 * 1000,

  /* Configure projects - Chromium only for production testing */
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
      },
    },
  ],

  /* Serve the production build before starting tests */
  webServer: {
    // Use npx serve to serve the build folder on port 3001
    // The -s flag enables single-page app mode (redirects 404s to index.html)
    // The -l flag sets the port
    command: "npx serve build -s -l 3001",
    url: "http://localhost:3001",
    reuseExistingServer: true,
    timeout: 30 * 1000, // Server should start quickly since it's just serving static files
  },
});
