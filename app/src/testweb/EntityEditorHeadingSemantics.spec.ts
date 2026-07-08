/**
 * Text that is visually styled as a heading in the entity editor must be marked
 * up with real heading tags so screen-reader heading navigation can reach it
 * (MAS 1.3.1 Info & Relationships):
 *   - the editor title is the page's <h1>,
 *   - the section panels ("Model Preview", "Behaviors") rendered by the shared
 *     EditorContentPanel are <h2>.
 *
 * Run (from app/): npx playwright test EntityEditorHeadingSemantics.spec.ts --project=chromium
 */

import { test, expect, Page } from "@playwright/test";

/** Walk the "Make a Mob" wizard until the entity editor opens. */
async function makeMobAndOpenEditor(page: Page) {
  await page.goto("/", { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await page.getByRole("heading", { name: "Make a Mob" }).click();
  await page.waitForTimeout(1500);

  const title = page.locator(".editor-header-title").first();
  for (let i = 0; i < 10; i++) {
    if (await title.isVisible().catch(() => false)) break;
    const next = page.getByRole("button", { name: "Next" }).first();
    if ((await next.isVisible({ timeout: 1500 }).catch(() => false)) && (await next.isEnabled().catch(() => false))) {
      await next.click();
    } else {
      const finish = page.getByRole("button", { name: /^(Create|Create Project|Finish|Done)$/i }).first();
      if (await finish.isVisible({ timeout: 1500 }).catch(() => false)) await finish.click();
    }
    await page.waitForTimeout(2000);
  }
  await expect(title).toBeVisible({ timeout: 30000 });
}

test.describe("Entity editor heading semantics", () => {
  test("editor title is an h1 and section panels are headings", async ({ page }) => {
    test.setTimeout(120000);

    await makeMobAndOpenEditor(page);

    // The editor title is the page's top-level heading.
    await expect(page.locator("h1.editor-header-title")).toBeVisible();

    // EditorContentPanel section headers (the shared control) are headings.
    await expect(page.getByRole("heading", { name: /Model Preview/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Behaviors", exact: true }).first()).toBeVisible();
  });
});
