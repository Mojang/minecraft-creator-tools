/**
 * Global setup for Playwright tests — warms up the Vite dev server.
 *
 * Vite starts quickly but the first browser page load triggers on-demand module
 * compilation which can take 30-60+ seconds on large codebases. This setup
 * loads the page in a real browser before any tests run, ensuring Vite's module
 * graph is fully compiled and test timeouts aren't consumed by cold-start compilation.
 *
 * Two stages are warmed, because they compile two different module graphs:
 *
 *   1. The home page (`/`).
 *   2. The Project Editor, reached the same way enterEditor() does it — "Create
 *      New" → project dialog → Create Project. On a fresh CI runner (clean
 *      `npm ci`, no Vite cache) this leg alone took well over the 45s that
 *      enterEditor() budgets for the editor toolbar, and over the 120s test
 *      timeout of the first editor test in a config. That first test then fails
 *      outright and, since every remaining attempt/spec in the run pays the same
 *      cold-compile cost, a whole job (e.g. web-tests-reflow) can go red even
 *      though nothing is wrong with the UI under test.
 *
 * globalSetup is not bounded by any test timeout, so it is the right place to
 * absorb that one-off cost; the deadline below is deliberately generous. A
 * warmup failure is logged but never fails the run — tests still handle
 * startup themselves, just with less headroom.
 */

import { chromium, Page } from "@playwright/test";
import {
  fillRequiredProjectDialogFields,
  preferBrowserStorageInProjectDialog,
  waitForEditorReady,
} from "./WebTestUtilities";

const webPort = process.env.PLAYWRIGHT_WEB_PORT ?? "3000";
const BASE_URL = `http://localhost:${webPort}`;

// Total budget for both warmup stages. Cold compile of home + editor has been
// measured at 3-4 minutes on a dev machine that had to rebuild Vite's module
// graph from scratch; CI self-hosted runners start from a clean `npm ci`.
const WARMUP_TIMEOUT_MS = 300_000;

/**
 * Drives the home page into the Project Editor so the editor's (much larger)
 * module graph — plus the starter sample content the "Create New" flow loads —
 * is compiled and cached by Vite before the first real test needs it.
 */
async function warmEditor(page: Page, remainingTimeout: () => number): Promise<boolean> {
  const newButton = page.getByRole("button", { name: "Create New" }).first();
  await newButton.waitFor({ state: "visible", timeout: remainingTimeout() });
  await newButton.click();

  const projectDialog = page.locator("dialog").or(page.locator('[role="dialog"]')).first();
  await projectDialog.waitFor({ state: "visible", timeout: remainingTimeout() });

  await preferBrowserStorageInProjectDialog(page);
  await fillRequiredProjectDialogFields(page);

  const createButton = page.getByTestId("submit-button");
  await createButton.waitFor({ state: "visible", timeout: Math.min(5000, remainingTimeout()) });
  await createButton.click();

  return waitForEditorReady(page, remainingTimeout());
}

async function globalSetup(): Promise<void> {
  console.log("Global setup: warming up Vite dev server with browser load...");

  const start = Date.now();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    const deadline = Date.now() + WARMUP_TIMEOUT_MS;
    const remainingTimeout = () => Math.max(0, deadline - Date.now());

    await page.goto(BASE_URL, { timeout: remainingTimeout(), waitUntil: "load" });
    await page.locator("#root > *").first().waitFor({ state: "attached", timeout: remainingTimeout() });
    console.log(`Global setup: home page warm (${Date.now() - start}ms)`);

    try {
      const editorReady = await warmEditor(page, remainingTimeout);
      console.log(
        editorReady
          ? `Global setup: editor warm (${Date.now() - start}ms)`
          : `Global setup: editor did not become ready within the warmup budget (${Date.now() - start}ms)`
      );
    } catch (err) {
      console.log(`Global setup: editor warmup failed after ${Date.now() - start}ms (${err}), continuing`);
    }

    console.log(`Global setup: Vite warmup complete (${Date.now() - start}ms)`);
    await page.close();
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`Global setup: Vite warmup failed after ${elapsed}ms (${err}), tests will handle startup`);
  } finally {
    await browser.close();
  }
}

export default globalSetup;
