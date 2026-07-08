import { defineConfig, devices } from "@playwright/test";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./src/testweb",

  // Warm up Vite dev server before running tests — prevents cold-start timeouts
  globalSetup: "./src/testweb/globalSetup.ts",

  // Default test timeout. The Vite dev server serves the app as ~1300 unbundled
  // ESM modules on demand, so a cold page load in a fresh browser context can take
  // 30-60s under parallel-worker contention (see globalSetup.ts). 90s gives a
  // lightweight test enough budget for a slow enterEditor() navigation plus its UI
  // work. Individual heavier tests still override with test.setTimeout().
  timeout: 90000,

  // Exclude ServerUI tests - they require a running MCT server and have their own config
  // Run ServerUI tests separately with: npm run test-server-ui
  testIgnore: ["**/ServerUI.spec.ts"],

  outputDir: "./debugoutput/playwright-test-results",

  /* Snapshot configuration — output to debugoutput so generated images don't pollute public/ */
  snapshotDir: "./debugoutput/res/snapshots",
  snapshotPathTemplate: "{snapshotDir}/{arg}{ext}",

  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Limit parallel workers to avoid resource contention with WebGL-heavy tests */
  workers: process.env.CI ? 1 : 4,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [["html", { open: "never", outputFolder: "debugoutput/playwright-test-results-html" }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:3000",

    // Page navigations (page.goto / waitForLoadState) default to a 30s timeout in
    // Playwright. That is too tight for this app's Vite dev cold load — the home
    // page eagerly pulls the full editor + Minecraft definition module graph
    // (~1300 requests), which routinely exceeds 30s under 4-worker contention and
    // makes enterEditor()'s `page.goto("/", { waitUntil: "load" })` throw. 90s lets
    // those legitimate-but-slow loads complete instead of failing the whole suite.
    navigationTimeout: 90000,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    // Default project: runs tests NOT tagged @focused or @full.
    // Tagged tests have their own dedicated projects below, so excluding
    // them here avoids running each tagged test twice per suite.
    {
      name: "chromium",
      grepInvert: /@focused|@full/,
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
      },
    },

    // Focused mode suite: runs only tests tagged @focused
    // These validate the default creator experience with simplified UI
    {
      name: "focused",
      grep: /@focused/,
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
      },
    },

    // Full mode suite: runs only tests tagged @full
    // These validate advanced editor features requiring full item visibility
    {
      name: "full",
      grep: /@full/,
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
      },
    },

    // Only enable other browsers if they are available
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "npm run web",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
