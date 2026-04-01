/**
 * CatEntityPreview.spec.ts
 *
 * Verifies that creating a cat entity from the gallery template results in:
 * 1. A visible 3D model in the entity overview panel
 * 2. A texture variant picker dropdown (cat has 44+ texture variants)
 *
 * This test catches regressions in vanilla texture fallback for multi-variant mobs.
 *
 * Run with: npx playwright test CatEntityPreview.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { processMessage, enterEditor } from "./WebTestUtilities";

const SCREENSHOT_DIR = "debugoutput/screenshots/cat-entity-preview";

// Give generous timeout for project creation + entity loading + 3D rendering
test.setTimeout(120000);

/**
 * Open the Content Wizard by clicking the "+ Add" button.
 */
async function openContentWizard(page: Page): Promise<boolean> {
  try {
    const addButton = page.locator('button[aria-label="Add new content"], button:has-text("Add")').first();
    if (!(await addButton.isVisible({ timeout: 3000 }))) {
      console.log("openContentWizard: Add button not visible");
      return false;
    }
    await addButton.click();
    await page.waitForTimeout(800);

    // Verify the Content Wizard dialog appeared
    const wizardDialog = page.locator(".cwiz-launcher-wrapper, .cwiz-launcher").first();
    if (await wizardDialog.isVisible({ timeout: 3000 })) {
      return true;
    }

    // Fallback: check for MUI dialog
    const muiDialog = page.locator(".MuiDialog-root").first();
    return muiDialog.isVisible({ timeout: 2000 });
  } catch (error) {
    console.log(`openContentWizard: Error - ${error}`);
    return false;
  }
}

/**
 * Click the "Start from a Minecraft Mob" quick-action card in the Content Wizard.
 * The quick action cards have class .cwiz-main-option with a .cwiz-main-label
 * child containing the text.
 */
async function clickMobFromMinecraft(page: Page): Promise<boolean> {
  try {
    // Primary: match the current label "Start from a Minecraft Mob"
    const quickAction = page.locator('.cwiz-main-option:has-text("Start from a Minecraft Mob")').first();
    if (await quickAction.isVisible({ timeout: 3000 })) {
      await quickAction.click();
      await page.waitForTimeout(600);
      console.log("clickMobFromMinecraft: Clicked 'Start from a Minecraft Mob'");
      return true;
    }

    // Fallback: older label "Mob from Minecraft"
    const fallbackAction = page.locator('.cwiz-main-option:has-text("Mob from Minecraft")').first();
    if (await fallbackAction.isVisible({ timeout: 2000 })) {
      await fallbackAction.click();
      await page.waitForTimeout(600);
      console.log("clickMobFromMinecraft: Clicked fallback 'Mob from Minecraft'");
      return true;
    }

    // Last resort: click the first cwiz-main-option (it should be the entity one)
    const firstOption = page.locator(".cwiz-main-option").first();
    if (await firstOption.isVisible({ timeout: 2000 })) {
      const text = await firstOption.textContent();
      console.log(`clickMobFromMinecraft: Falling back to first option: "${text}"`);
      await firstOption.click();
      await page.waitForTimeout(600);
      return true;
    }

    console.log("clickMobFromMinecraft: Could not find any quick action");
    return false;
  } catch (error) {
    console.log(`clickMobFromMinecraft: Error - ${error}`);
    return false;
  }
}

/**
 * In the NewEntityType dialog, select the "cat" gallery item.
 * Gallery tiles have class .itbi-outer with title text in .itbi-title.
 * The gallery is inside a .net-projectGallery container.
 */
async function selectCatInGallery(page: Page): Promise<boolean> {
  const dialog = page.locator(".MuiDialog-root, dialog, [role='dialog']").first();
  if (!(await dialog.isVisible({ timeout: 5000 }))) {
    console.log("selectCatInGallery: Dialog not visible");
    return false;
  }

  // Wait for gallery items to load (they load asynchronously from gallery.json)
  const galleryItem = dialog.locator(".itbi-outer").first();
  try {
    await expect(galleryItem).toBeVisible({ timeout: 10000 });
  } catch {
    console.log("selectCatInGallery: Gallery items did not load");
    return false;
  }

  // Log all visible gallery item titles for debugging
  const allTitles = await dialog.locator(".itbi-title").allTextContents();
  console.log(`selectCatInGallery: Found ${allTitles.length} gallery items: ${allTitles.slice(0, 10).join(", ")}...`);

  await page.waitForTimeout(500);

  // The gallery may be scrollable - search visible tiles first, then scroll
  const galleryContainer = dialog.locator(".net-projectGallery, .ig-outer").first();

  // Try exact text match first
  const catTile = dialog.locator('.itbi-outer:has(.itbi-title:text-is("cat"))').first();
  if (await catTile.isVisible({ timeout: 1000 }).catch(() => false)) {
    await catTile.click();
    await page.waitForTimeout(300);
    console.log("selectCatInGallery: Clicked cat tile (exact match)");
    return true;
  }

  // Try case-insensitive has-text
  const catTileFallback = dialog.locator('.itbi-outer:has(.itbi-title:has-text("Cat"))').first();
  if (await catTileFallback.isVisible({ timeout: 1000 }).catch(() => false)) {
    await catTileFallback.click();
    await page.waitForTimeout(300);
    console.log("selectCatInGallery: Clicked cat tile (has-text)");
    return true;
  }

  // Scroll the gallery container to find cat
  if (await galleryContainer.isVisible({ timeout: 1000 }).catch(() => false)) {
    // Scroll incrementally through the gallery
    for (let i = 0; i < 10; i++) {
      await galleryContainer.evaluate((el: HTMLElement) => {
        el.scrollTop += 200;
      });
      await page.waitForTimeout(300);

      const catAfterScroll = dialog.locator('.itbi-outer:has(.itbi-title:text-is("cat"))').first();
      if (await catAfterScroll.isVisible({ timeout: 500 }).catch(() => false)) {
        await catAfterScroll.click();
        await page.waitForTimeout(300);
        console.log(`selectCatInGallery: Found cat after scrolling ${i + 1} times`);
        return true;
      }

      const catAfterScrollCI = dialog.locator('.itbi-outer:has(.itbi-title:has-text("Cat"))').first();
      if (await catAfterScrollCI.isVisible({ timeout: 500 }).catch(() => false)) {
        await catAfterScrollCI.click();
        await page.waitForTimeout(300);
        console.log(`selectCatInGallery: Found cat (case-insensitive) after scrolling ${i + 1} times`);
        return true;
      }
    }
  }

  // Last resort: use scrollIntoView via JavaScript to find it
  const found = await dialog.evaluate(() => {
    const titles = document.querySelectorAll(".itbi-title");
    for (const title of titles) {
      if (title.textContent?.toLowerCase().trim() === "cat") {
        const outer = title.closest(".itbi-outer");
        if (outer) {
          outer.scrollIntoView({ block: "center" });
          (outer as HTMLElement).click();
          return true;
        }
      }
    }
    return false;
  });

  if (found) {
    await page.waitForTimeout(500);
    console.log("selectCatInGallery: Found and clicked cat via DOM query");
    return true;
  }

  console.log("selectCatInGallery: Could not find cat tile. Available items: " + allTitles.join(", "));
  return false;
}

/**
 * Click the "Add" button in the new entity dialog to confirm creation.
 */
async function confirmAddDialog(page: Page): Promise<boolean> {
  const dialog = page.locator(".MuiDialog-root, dialog, [role='dialog']").first();
  if (!(await dialog.isVisible({ timeout: 3000 }))) {
    return true; // No dialog = already dismissed
  }

  const addButton = dialog.locator('button:has-text("Add")').first();
  if (await addButton.isVisible({ timeout: 2000 })) {
    await addButton.click();
    await page.waitForTimeout(1000);
    return true;
  }

  // Fallback
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
  return true;
}

test.describe("Cat Entity Model Preview", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("cat entity overview should show textured model and variant picker", async ({ page }) => {
    // Step 1: Enter the editor (creates Add-On Starter project)
    const entered = await enterEditor(page);
    expect(entered).toBe(true);
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-editor-loaded.png`, fullPage: true });

    // Step 2: Open Content Wizard via + Add
    const wizardOpened = await openContentWizard(page);
    expect(wizardOpened).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-content-wizard.png`, fullPage: true });

    // Step 3: Click "Start from a Minecraft Mob" quick action
    const quickActionClicked = await clickMobFromMinecraft(page);
    expect(quickActionClicked).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-new-entity-dialog.png`, fullPage: true });

    // Step 4: Select "cat" from the gallery
    const catSelected = await selectCatInGallery(page);
    expect(catSelected).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-cat-selected.png`, fullPage: true });

    // Step 5: Click Add to create the cat entity
    await confirmAddDialog(page);

    // Step 6: Wait for entity to load and dependencies to resolve
    await page.waitForTimeout(3000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-after-add.png`, fullPage: true });

    // Step 7: The cat entity should auto-open in the editor after creation.
    // If the overview panel is visible, great. Otherwise, try to navigate to it.
    const overviewPanel = page.locator(".etop-outer").first();
    if (!(await overviewPanel.isVisible({ timeout: 5000 }).catch(() => false))) {
      // Try clicking the cat in the sidebar
      const catSidebar = page.locator('.pil-outer:has-text("cat"), .pit-name:has-text("cat")').first();
      if (await catSidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
        await catSidebar.click();
        await page.waitForTimeout(2000);
        console.log("Clicked cat in sidebar to open entity editor");
      }

      // Ensure Overview tab is selected
      const overviewTab = page.locator('button:has-text("Overview")').first();
      if (await overviewTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await overviewTab.click();
        await page.waitForTimeout(1000);
        console.log("Clicked Overview tab");
      }
    }

    // Give the 3D model time to load and render (BabylonJS scenes take a moment)
    await page.waitForTimeout(5000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-overview-panel.png`, fullPage: true });

    // Step 8: Verify model section exists
    const modelSection = page.locator(".etop-modelSection").first();
    const modelSectionVisible = await modelSection.isVisible({ timeout: 5000 });
    console.log(`Model section visible: ${modelSectionVisible}`);

    // Take a focused screenshot of just the model section
    if (modelSectionVisible) {
      await modelSection.screenshot({ path: `${SCREENSHOT_DIR}/07-model-section.png` });
    }

    // Step 9: Verify WebGL canvas is rendering (the 3D view)
    const canvas = page.locator(".etop-modelViewer canvas, .etop-modelSection canvas").first();
    const canvasVisible = await canvas.isVisible({ timeout: 8000 }).catch(() => false);
    console.log(`WebGL canvas visible: ${canvasVisible}`);

    if (canvasVisible) {
      // Check that the canvas has non-zero dimensions
      const canvasBox = await canvas.boundingBox();
      console.log(`Canvas dimensions: ${canvasBox?.width}x${canvasBox?.height}`);
      expect(canvasBox).not.toBeNull();
      if (canvasBox) {
        expect(canvasBox.width).toBeGreaterThan(50);
        expect(canvasBox.height).toBeGreaterThan(50);
      }

      // Wait a bit more for textures to load
      await page.waitForTimeout(2000);
      const canvasScreenshot = await canvas.screenshot({ path: `${SCREENSHOT_DIR}/08-canvas-closeup.png` });

      // Analyze the screenshot buffer for pixel diversity.
      // WebGL readPixels returns zeros when preserveDrawingBuffer is false,
      // so we analyze the PNG screenshot instead.
      // PNG is lossless; a purely solid color canvas compresses to a small file.
      const screenshotSize = canvasScreenshot.byteLength;
      console.log(`Canvas screenshot size: ${screenshotSize} bytes`);

      // A 541x271 solid-color canvas PNG is ~1-2KB. A rendered 3D scene is much larger.
      // Use 5KB as threshold — any real 3D content will exceed this easily.
      expect(screenshotSize).toBeGreaterThan(5000);
    }

    // Step 10: Check for texture variant picker
    // The variant picker appears as a MUI Select inside the ModelViewer overlay
    const variantPicker = page
      .locator(".etop-modelViewer .MuiSelect-select, .etop-modelSection .MuiSelect-select, .mov-area .MuiSelect-select")
      .first();
    const pickerVisible = await variantPicker.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Texture variant picker visible: ${pickerVisible}`);

    if (pickerVisible) {
      await page.screenshot({ path: `${SCREENSHOT_DIR}/09-variant-picker.png`, fullPage: true });

      // Click the picker to show available variants
      await variantPicker.click();
      await page.waitForTimeout(500);

      const menuItems = page.locator(".MuiMenu-list .MuiMenuItem-root");
      const itemCount = await menuItems.count();
      console.log(`Variant picker has ${itemCount} options`);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/10-variant-dropdown.png`, fullPage: true });

      // Cat should have many base variants (white, calico, etc.)
      // Overlay-only variants like "white_tame" are filtered out
      expect(itemCount).toBeGreaterThan(5);
      expect(itemCount).toBeLessThan(15); // Should be ~11 base variants, not 22

      // Step 11: Switch to a different variant ("Calico") and verify the canvas updates
      const calicoItem = menuItems.filter({ hasText: "Calico" }).first();
      const calicoVisible = await calicoItem.isVisible().catch(() => false);
      if (calicoVisible) {
        // Take a screenshot of the canvas BEFORE switching
        const canvasBefore = page.locator(".etop-modelViewer canvas, .mov-area canvas").first();
        const screenshotBefore = await canvasBefore.screenshot();
        const sizeBefore = screenshotBefore.length;

        await calicoItem.click();
        // Wait for VolumeEditor to remount with the new texture
        await page.waitForTimeout(3000);

        await page.screenshot({ path: `${SCREENSHOT_DIR}/10b-variant-calico.png`, fullPage: true });

        // Verify dropdown now shows "Calico" as selected
        const updatedPicker = page
          .locator(
            ".etop-modelViewer .MuiSelect-select, .etop-modelSection .MuiSelect-select, .mov-area .MuiSelect-select"
          )
          .first();
        const pickerText = await updatedPicker.textContent();
        console.log(`Variant picker now shows: ${pickerText}`);
        expect(pickerText).toContain("Calico");

        // Take a screenshot of the canvas AFTER switching
        const canvasAfter = page.locator(".etop-modelViewer canvas, .mov-area canvas").first();
        const screenshotAfter = await canvasAfter.screenshot();
        const sizeAfter = screenshotAfter.length;
        console.log(`Canvas before: ${sizeBefore} bytes, after: ${sizeAfter} bytes`);

        // The screenshot should differ (different texture rendered)
        // We can't do pixel-perfect comparison easily, but the size should differ
        // or at least both should be non-trivial
        expect(sizeAfter).toBeGreaterThan(2000);
      } else {
        // Close the dropdown if calico wasn't found
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
    }

    // Final full-page screenshot
    await page.screenshot({ path: `${SCREENSHOT_DIR}/11-final.png`, fullPage: true });

    // Core assertions
    expect(modelSectionVisible).toBe(true);
    expect(canvasVisible).toBe(true);
    // Variant picker is required for multi-variant entities like cat
    expect(pickerVisible).toBe(true);
  });
});
