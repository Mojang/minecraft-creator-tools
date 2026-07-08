/**
 * Accessibility coverage for the Project Settings view (WCAG 1.3.1, Info &
 * Relationships).
 *
 * The view title and its section headers look like headings (green accent bar /
 * uppercase section labels) but were rendered as plain <div>s, so assistive
 * technology could not reach them via heading navigation. The title is now an
 * <h1> and each section header an <h2>.
 *
 * Run (from app/):
 *   npx playwright test ProjectSettingsAccessibility.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage, enterEditor, takeScreenshot } from "./WebTestUtilities";

test("Project Settings view title is a semantic heading", async ({ page }) => {
  test.setTimeout(90000);
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];
  page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

  expect(await enterEditor(page, { editMode: "full" })).toBe(true);

  // Open the Project Settings panel from the left nav.
  const projectSettings = page.getByRole("treeitem", { name: /Project Settings/i }).first();
  await expect(projectSettings).toBeVisible({ timeout: 20000 });
  await projectSettings.click();

  // The view title (.ppe-header "Project Settings") must be a heading element,
  // not a styled <div>.
  const header = page.locator(".ppe-header");
  await expect(header).toBeVisible({ timeout: 20000 });

  const tagName = await header.evaluate((el) => el.tagName.toLowerCase());
  expect(tagName, `view title should be a heading, not a <${tagName}>`).toMatch(/^h[1-6]$/);

  // And it must be reachable by heading role.
  await expect(page.getByRole("heading", { name: /Project Settings/i }).first()).toBeVisible();

  // Section headers (e.g. "Basic Information") are also exposed as headings.
  await expect(page.getByRole("heading", { name: /Basic Information/i }).first()).toBeVisible();

  await takeScreenshot(page, "debugoutput/screenshots/project-settings-headings");
});
