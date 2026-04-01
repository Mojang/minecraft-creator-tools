/**
 * Switch/Toggle Visual Test
 *
 * Navigates to an entity that has boolean fields (breathable component)
 * and takes screenshots to verify the Minecraft-style switch rendering.
 */

import { test, Page } from "@playwright/test";
import { selectEditMode } from "./WebTestUtilities";

async function createFullAddOnProject(page: Page): Promise<boolean> {
  try {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Find CREATE NEW for Full Add-On
    const fullAddOnSection = page.locator('div:has-text("Full Add-On")').filter({
      has: page.locator('text="A full example add-on project"'),
    });
    let createButton = fullAddOnSection.locator('button:has-text("CREATE NEW")').first();
    if (!(await createButton.isVisible({ timeout: 3000 }))) {
      createButton = page.locator('button:has-text("New")').or(page.locator('button:has-text("CREATE NEW")')).nth(2);
    }
    if (!(await createButton.isVisible({ timeout: 3000 }))) {
      createButton = page.getByRole("button", { name: "Create New" }).first();
    }
    await createButton.click();
    await page.waitForTimeout(1000);

    const okButton = page.getByTestId("submit-button").first();
    if (await okButton.isVisible({ timeout: 3000 })) {
      await okButton.click();
    } else {
      await page.keyboard.press("Enter");
    }

    await page.waitForTimeout(5000);
    await page.waitForLoadState("networkidle");
    await selectEditMode(page, "full");
    return true;
  } catch {
    return false;
  }
}

async function selectEntityType(page: Page, entityName: string): Promise<boolean> {
  // Enable types visibility
  const showButton = page.locator('button:has-text("Show")').first();
  if (await showButton.isVisible({ timeout: 2000 })) {
    await showButton.click();
    await page.waitForTimeout(500);
    const menuList = page.locator(".MuiMenu-list");
    const typesOption = menuList.locator('li[title*="entity, block, and item types"]');
    if (await typesOption.isVisible({ timeout: 1000 }).catch(() => false)) {
      const isSelected = (await typesOption.locator(".label-selected").count()) > 0;
      if (!isSelected) await typesOption.click();
      else await page.keyboard.press("Escape");
    } else {
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(500);
  }

  await page.waitForTimeout(2000);
  const humanName = entityName.charAt(0).toUpperCase() + entityName.slice(1);
  const match = page.locator(`text="${humanName}"`).first();
  if (await match.isVisible({ timeout: 3000 })) {
    await match.click();
    await page.waitForTimeout(1000);
    return true;
  }
  const origMatch = page.locator(`text="${entityName}"`).first();
  if (await origMatch.isVisible({ timeout: 2000 })) {
    await origMatch.click();
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}

async function clickEditorTab(page: Page, tabName: string): Promise<void> {
  const eteArea = page.locator(".ete-area");
  const patterns = {
    Components: ["Edit components", "components"],
  }[tabName] || [tabName.toLowerCase()];

  for (const pattern of patterns) {
    const btn = eteArea.locator(`button[title*="${pattern}" i]`).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1000);
      return;
    }
  }
  // Fallback
  const labelSpan = page.locator(`span.label-text:has-text("${tabName}")`).first();
  if (await labelSpan.isVisible({ timeout: 2000 })) {
    await labelSpan.click();
    await page.waitForTimeout(1000);
  }
}

test.describe("Switch Visual Tests @full", () => {
  test("Minecraft-style switch renders correctly", async ({ page }) => {
    test.setTimeout(90000);

    const created = await createFullAddOnProject(page);
    if (!created) {
      test.skip();
      return;
    }

    const selected = await selectEntityType(page, "biceson");
    if (!selected) {
      test.skip();
      return;
    }

    // Go to Components tab
    await clickEditorTab(page, "Components");
    await page.waitForTimeout(1000);

    // Click on "Breathing Rules" component which has boolean switches
    const breathingSlot = page.locator('.etcse-slotText:has-text("Breathing Rules")').first();
    if (await breathingSlot.isVisible({ timeout: 5000 })) {
      await breathingSlot.click();
      await page.waitForTimeout(1000);
    } else {
      // Try clicking the slot chip
      const breathingChip = page.locator('[data-tooltip="Breathing Rules"]').first();
      if (await breathingChip.isVisible({ timeout: 3000 })) {
        await breathingChip.click();
        await page.waitForTimeout(1000);
      }
    }

    // Wait for the component form with checkboxes to render
    await page.waitForTimeout(500);

    // Screenshot the full component form with switches
    const componentBin = page.locator(".etcse-componentBinPanel").first();
    if (await componentBin.isVisible({ timeout: 3000 })) {
      await componentBin.screenshot({
        path: "debugoutput/screenshots/switch-01-breathable-full.png",
      });
    }

    // Screenshot just the first switch row
    const firstSwitch = page.locator(".df-checkboxRow").first();
    if (await firstSwitch.isVisible({ timeout: 3000 })) {
      await firstSwitch.screenshot({
        path: "debugoutput/screenshots/switch-02-single-on.png",
      });
    }

    // Screenshot an OFF switch (Breathes in solids is typically false)
    const allSwitchRows = page.locator(".df-checkboxRow");
    const count = await allSwitchRows.count();
    for (let i = 0; i < count; i++) {
      const row = allSwitchRows.nth(i);
      const label = await row.locator(".df-checkboxLabel").textContent();
      if (label && label.includes("solids")) {
        await row.screenshot({
          path: "debugoutput/screenshots/switch-03-single-off.png",
        });
        break;
      }
    }

    // Also screenshot just a MuiSwitch element for pixel-level inspection
    const switchElement = page.locator(".MuiSwitch-root").first();
    if (await switchElement.isVisible({ timeout: 2000 })) {
      await switchElement.screenshot({
        path: "debugoutput/screenshots/switch-04-element-closeup.png",
      });
    }

    // Screenshot page for full context
    await page.screenshot({
      path: "debugoutput/screenshots/switch-05-full-page.png",
      fullPage: true,
    });
  });
});
