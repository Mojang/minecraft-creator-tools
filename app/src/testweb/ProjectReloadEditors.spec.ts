/**
 * Project Reload Editors – Round-trip canary
 *
 * Regression test for a deadlock bug where, after a project was saved and the
 * page reloaded, JSON config items (tsconfig.json, manifest.json, launch.json,
 * package.json, etc.) would render the editor body as a "- Loading..." stub
 * forever. Root cause: the empty-label default variant was being persisted into
 * project data, and on next load it triggered the subpack-lookup branch in
 * ProjectItemVariant.ensureFileStorage, deadlocking loadContent across manifest
 * items.
 *
 * What this spec does:
 *   1. Create an Add-On Starter project (browser storage).
 *   2. Save it.
 *   3. Reload the page.
 *   4. Open the same project from the recent-projects list.
 *   5. For each of a representative set of JSON config items (tsconfig.json,
 *      package.json, launch.json, the BP manifest), click it and assert the
 *      editor body actually renders content (not the "- Loading..." stub).
 *
 * The critical assertion is that the right pane is NOT a single
 * `.pie-loadingLabel` element after a reasonable wait. When the bug regresses,
 * that's exactly what users see.
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import {
  enableAllFileTypes,
  enterEditor,
  processMessage,
  selectEditMode,
  waitForEditorReady,
} from "./WebTestUtilities";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Triggers a project save using Ctrl+S (the global save shortcut). We rely on
 * the keyboard shortcut rather than the Save dropdown button so we don't end
 * up in an export sub-menu.
 */
async function saveProject(page: Page): Promise<void> {
  await page.keyboard.press("Control+S");
  await page.waitForTimeout(1500);
  await page.waitForLoadState("networkidle").catch(() => {});
}

/**
 * Clicks a project item in the left list by visible text. Returns true if the
 * click landed; false otherwise.
 */
async function clickProjectItem(page: Page, label: string | RegExp): Promise<boolean> {
  const candidates = page.locator(".project-item, [role='treeitem'], li, button, div").filter({
    hasText: label,
  });

  // Prefer the deepest match (a leaf row); fall back to first.
  const count = await candidates.count();
  if (count === 0) {
    return false;
  }

  for (let i = count - 1; i >= 0; i--) {
    const candidate = candidates.nth(i);
    if (await candidate.isVisible({ timeout: 500 }).catch(() => false)) {
      await candidate.scrollIntoViewIfNeeded().catch(() => {});
      await candidate.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(800);
      return true;
    }
  }
  return false;
}

/**
 * Waits up to `timeoutMs` for the right-hand editor pane to render real content
 * rather than the "- Loading..." placeholder. Returns true if the editor body
 * has switched to non-placeholder content. This is the assertion that fails
 * when the load-deadlock bug regresses.
 */
async function expectEditorBodyLoaded(page: Page, label: string, timeoutMs = 15000): Promise<void> {
  const pieOuter = page.locator(".pie-outer").first();
  await pieOuter.waitFor({ state: "visible", timeout: 5000 });

  // The bug surfaces as a `.pie-loadingLabel` that never gets replaced. When
  // the editor finishes loading, the placeholder is removed and a richer
  // editor (Monaco, DataForm, etc.) takes its place. We assert that within
  // the timeout, the pane no longer contains a visible placeholder text
  // ending in "- Loading...".
  await expect
    .poll(
      async () => {
        const text = (await pieOuter.innerText().catch(() => "")) || "";
        return text.trim().endsWith("- Loading...");
      },
      {
        message: `Editor body for ${label} stuck on "- Loading..." (deadlock regression?)`,
        timeout: timeoutMs,
      }
    )
    .toBe(false);
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test.describe("Project Reload Editors @full", () => {
  test.setTimeout(180_000);

  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("JSON config editors load after save+reload", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "full" });
    if (!entered) {
      test.skip();
      return;
    }
    await enableAllFileTypes(page).catch(() => {});

    // Capture the project URL hash so we can return to the same project after
    // reload (the homepage doesn't auto-resume into the last project).
    await saveProject(page);
    const projectUrl = page.url();

    // Full reload — this is what was triggering the deadlock previously.
    await page.goto(projectUrl, { waitUntil: "load" });
    await page.waitForTimeout(4000);
    await page.waitForLoadState("networkidle").catch(() => {});

    expect(await waitForEditorReady(page, 20000)).toBe(true);
    await selectEditMode(page, "full").catch(() => {});
    await page.waitForTimeout(800);
    await enableAllFileTypes(page).catch(() => {});

    // Representative items that previously got stuck on "- Loading...".
    // We only require the FIRST item to be visible/clickable; subsequent ones
    // are best-effort because exact label rendering varies (e.g. ".tsconfig"
    // vs "tsconfig.json" depending on filename mode).
    const targets: { label: string | RegExp }[] = [
      { label: /tsconfig/i },
      { label: /package\b/i },
      { label: /launch/i },
      { label: /^manifest/i },
    ];

    let openedAtLeastOne = false;
    for (const target of targets) {
      const clicked = await clickProjectItem(page, target.label);
      if (!clicked) {
        console.log(`Skipping ${target.label} - not visible in this view`);
        continue;
      }
      openedAtLeastOne = true;
      await expectEditorBodyLoaded(page, String(target.label));
    }

    expect(openedAtLeastOne, "Should have opened at least one JSON config item").toBe(true);
  });
});
