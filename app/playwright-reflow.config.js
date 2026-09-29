import { defineConfig } from "@playwright/test";

/**
 * Playwright configuration for MAS 1.4.10 Reflow accessibility tests.
 *
 * Simulates 400% browser zoom on a 1280x1024 display (100% OS scale),
 * which produces an effective CSS viewport of 320x256.  This validates
 * that content reflows properly and nothing is cropped or requires
 * two-dimensional scrolling at extreme zoom levels.
 *
 * Run with:          npm run test-reflow
 * Headed mode:       npm run test-reflow-headed
 * Debug mode:        npm run test-reflow-debug
 */
export default defineConfig({
  testDir: "./src/testreflow",

  globalSetup: "./src/testweb/globalSetup.ts",

  // Matches playwright.config.js: on the Vite dev server a cold enterEditor()
  // navigation alone can approach a minute, and the editor specs layer their
  // own UI work on top (they raise this further via test.setTimeout).
  timeout: 90000,

  outputDir: "./debugoutput/playwright-reflow-results",

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,

  reporter: [["html", { open: "never", outputFolder: "debugoutput/playwright-reflow-results-html" }]],

  use: {
    baseURL: "http://localhost:3000",

    // Playwright defaults page.goto() to 30s. The home page pulls the full
    // editor + Minecraft definition module graph (~1300 requests) through Vite,
    // which exceeds 30s on a cold dev server and makes enterEditor() bail out
    // before the test gets to assert anything. Mirrors playwright.config.js.
    navigationTimeout: 90000,

    trace: "on-first-retry",
  },

  projects: [
    {
      name: "reflow-400pct",
      use: {
        browserName: "chromium",
        // 400% zoom on 1280x1024 => effective 320x256 CSS pixels
        viewport: { width: 320, height: 256 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: "reflow-200pct",
      use: {
        browserName: "chromium",
        // 200% zoom on 1280x1024 => effective 640x512 CSS pixels
        viewport: { width: 640, height: 512 },
        deviceScaleFactor: 1,
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
