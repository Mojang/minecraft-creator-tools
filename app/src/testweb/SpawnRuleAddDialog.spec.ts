/**
 * Adding a namespaced definition (e.g. a spawn rule) from the project item list
 * opens a name/namespace dialog whose Add button creates the item and must then
 * close the dialog. The create handler used to run the dialog-closing setState
 * only after awaiting project.save(); if the save rejected, the item was created
 * but the dialog stayed stuck open. This drives the real "Add new spawn rule"
 * dialog and asserts it closes after Add.
 *
 * Run (from app/):
 *   npx playwright test SpawnRuleAddDialog.spec.ts --project=chromium
 */

import { test, expect } from "@playwright/test";
import { enterEditor } from "./WebTestUtilities";
import { ProjectItemType } from "../app/IProjectItemData";

test("Add new spawn rule dialog closes after clicking Add", async ({ page }) => {
  test.setTimeout(90000);
  expect(await enterEditor(page, { editMode: "full" })).toBe(true);

  // Open the namespaced-definition "Add new spawn rule" dialog directly via the
  // project add button's quick-action event (the per-category "+" entry point),
  // rather than the Content Wizard.
  await page.evaluate((itemType) => {
    window.dispatchEvent(new CustomEvent("mct-project-add-quick-action", { detail: { itemType } }));
  }, ProjectItemType.spawnRuleBehavior);

  // The SetNamespacedId dialog is identifiable by its "should likely be" hint.
  const dialog = page
    .getByRole("dialog")
    .filter({ hasText: /should likely be/i })
    .first();
  await expect(dialog).toBeVisible({ timeout: 15000 });

  await dialog.getByRole("button", { name: /^Add$/i }).click();

  // Once the item is created the dialog must close.
  await expect(dialog).toBeHidden({ timeout: 15000 });
});
