/**
 * Global setup for Playwright tests — warms up the Vite dev server.
 *
 * Vite starts quickly but the first browser page load triggers on-demand module
 * compilation which can take 30-60+ seconds on large codebases. This setup
 * loads the page in a real browser before any tests run, ensuring Vite's module
 * graph is fully compiled and test timeouts aren't consumed by cold-start compilation.
 */

import { chromium } from "@playwright/test";

const BASE_URL = "http://localhost:3000";
const WARMUP_TIMEOUT_MS = 120_000; // 2 minutes — matches webServer.timeout

async function globalSetup(): Promise<void> {
  console.log("Global setup: warming up Vite dev server with browser load...");

  const start = Date.now();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await page.goto(BASE_URL, { timeout: WARMUP_TIMEOUT_MS, waitUntil: "networkidle" });
    const elapsed = Date.now() - start;
    console.log(`Global setup: Vite warmup complete (${elapsed}ms)`);
    await page.close();
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`Global setup: Vite warmup failed after ${elapsed}ms (${err}), tests will handle startup`);
  } finally {
    await browser.close();
  }
}

export default globalSetup;
