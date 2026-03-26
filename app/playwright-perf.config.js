import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for editor performance tests.
 *
 * Loads large projects (e.g., vanilla Minecraft content) into the web editor
 * and measures timing for key loading phases:
 * - Time until the project editor opens
 * - Time until the UI is fully responsive (item list populated)
 * - Time until project item relations are complete
 * - Time until validation is complete
 *
 * Run with: npm run test-perf
 * Headed mode: npm run test-perf-headed
 * Debug mode: npm run test-perf-debug
 */
export default defineConfig({
  testDir: "./src/testperf",

  outputDir: "./debugoutput/playwright-perf-results",

  /* Run tests serially for deterministic timing measurements */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* No retries — perf tests should be deterministic */
  retries: 0,

  /* Single worker for consistent timing */
  workers: 1,

  /* Long timeout: large projects can take several minutes to fully validate */
  timeout: 600_000, // 10 minutes

  /* Reporter */
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "debugoutput/playwright-perf-results-html" }],
  ],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    /* Large viewport for realistic rendering */
    viewport: { width: 1920, height: 1080 },
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],

  /* Reuse existing dev server if running */
  webServer: {
    command: "npm run web",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
