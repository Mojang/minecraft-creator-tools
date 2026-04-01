import { defineConfig } from "@playwright/test";

/**
 * Playwright configuration for mobile viewport UX tests.
 *
 * Emulates a modern mobile phone in portrait orientation (iPhone 14 — 390×844)
 * with Retina display (deviceScaleFactor 2), touch input, and mobile user-agent
 * behavior.  These tests walk through nearly every screen of the application
 * at mobile width, capturing screenshots for visual review by the
 * mobile-ux-reviewer agent.
 *
 * Run with:          npm run test-mobile
 * Headed mode:       npm run test-mobile-headed
 * Debug mode:        npm run test-mobile-debug
 */
export default defineConfig({
  testDir: "./src/testmobile",

  globalSetup: "./src/testweb/globalSetup.ts",

  timeout: 90000,

  outputDir: "./debugoutput/playwright-mobile-results",

  fullyParallel: false, // Sequential — tests navigate through screens in order
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker — tests share navigation state within describe blocks

  reporter: [["html", { open: "never", outputFolder: "debugoutput/playwright-mobile-results-html" }]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "mobile-portrait",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
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
