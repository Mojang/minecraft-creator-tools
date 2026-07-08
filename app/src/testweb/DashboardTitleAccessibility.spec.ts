/**
 * Accessibility coverage for the Dashboard project title heading (WCAG 4.1.2).
 *
 * The project title is rendered via LocTokenBox, which used to wrap its text in
 * `<span role="button" tabindex="0">` even though its click handler is a no-op.
 * Inside the <h1> that made assistive technology announce a non-functional
 * button and added a stray tab stop. LocTokenBox is now display-only, so the
 * heading is a plain heading.
 *
 * Run (from app/):
 *   npx playwright test DashboardTitleAccessibility.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage, enterEditor, takeScreenshot } from "./WebTestUtilities";

test("Dashboard project title heading does not contain a button", async ({ page }) => {
  test.setTimeout(90000);
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];
  page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

  expect(await enterEditor(page, { editMode: "full" })).toBe(true);

  // The Dashboard (ProjectActions) is the default landing; its hero shows the
  // project title as an <h1 class="pact-projectTitle">.
  const title = page.locator("h1.pact-projectTitle");
  await expect(title).toBeVisible({ timeout: 20000 });

  // The heading must not contain any role="button" (or focusable tab stop): a
  // heading is not interactive.
  await expect(title.locator('[role="button"]')).toHaveCount(0);
  await expect(title.locator('[tabindex="0"]')).toHaveCount(0);

  // The title text itself must still render.
  await expect(title).toContainText(/\S/);

  await takeScreenshot(page, "debugoutput/screenshots/dashboard-title-heading");
});
