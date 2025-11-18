import { defineConfig, devices } from "@playwright/test";

/**
 * Alternative Playwright configuration for environments where browser downloads fail
 * This configuration attempts to use system browsers when Playwright browsers are not available
 */
export default defineConfig({
  testDir: "./src/testweb",
  outputDir: "./debugoutput/playwright-test-system-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never", outputFolder: "debugoutput/playwright-test-results-html" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium-system",
      use: {
        ...devices["Desktop Chrome"],
        // Try to use system chromium if Playwright browsers aren't available
        channel: "chromium",
        // Longer timeouts for system browsers
        actionTimeout: 10000,
        navigationTimeout: 30000,
      },
    },
  ],

  webServer: {
    command: "npm run web",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
