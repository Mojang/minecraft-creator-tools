import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for comprehensive MAS (Microsoft Accessibility Standards)
 * accessibility testing.
 *
 * This runs the full accessibility test suite covering all AppModes, keyboard workflows,
 * focus management, high contrast, reduced motion, text spacing, and ARIA live regions.
 *
 * The core CI subset remains in src/testweb/Accessibility.spec.ts (run via test-web).
 * This config runs the comprehensive suite for pre-release/nightly validation.
 *
 * Run with:          npm run test-a11y
 * Headed mode:       npm run test-a11y-headed
 * Debug mode:        npm run test-a11y-debug
 *
 * See docs/AccessibilityTestCoverage.md for MAS criterion mapping.
 */
export default defineConfig({
  testDir: "./src/testa11y",

  globalSetup: "./src/testweb/globalSetup.ts",

  timeout: 90000, // Longer timeout — a11y scans + keyboard workflows take more time

  outputDir: "./debugoutput/playwright-a11y-results",

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 3,

  reporter: [["html", { open: "never", outputFolder: "debugoutput/playwright-a11y-results-html" }]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "a11y-default",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
      },
    },
    {
      name: "a11y-high-contrast",
      grep: /@high-contrast/,
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
        colorScheme: "dark",
      },
    },
    {
      name: "a11y-reduced-motion",
      grep: /@reduced-motion/,
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
        reducedMotion: "reduce",
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
