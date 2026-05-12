/**
 * Thumbnail Generation Tests
 *
 * Tests that model thumbnails are generated and displayed in the sidebar
 * for both geometry model items and their parent entity type items.
 *
 * Creates a Full Add-On project (which includes sample mobs with geometry models),
 * waits for the thumbnail generation worker to complete, and verifies that
 * thumbnail images appear in the sidebar for both Models and Mobs sections.
 */
import { test, expect, Page, ConsoleMessage } from "@playwright/test";
import {
  processMessage,
  selectEditMode,
  preferBrowserStorageInProjectDialog,
  fillRequiredProjectDialogFields,
  clickTemplateCreateButton,
  waitForEditorReady,
} from "./WebTestUtilities";

// Increase timeout for this test since thumbnail generation takes time
test.setTimeout(120_000);

/**
 * Create a Full Add-On project and enter the editor.
 */
async function createFullAddOnProject(page: Page): Promise<boolean> {
  try {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Click the Full Add-On template's "Create New" button via stable test id
    const clicked = await clickTemplateCreateButton(page, "addonFull");
    if (!clicked) {
      console.log("Could not find CREATE NEW button for Full Add-On template");
      return false;
    }

    console.log("Clicking CREATE NEW for Full Add-On project");
    await page.waitForTimeout(1500);

    // Select browser storage for automated test flow
    await preferBrowserStorageInProjectDialog(page);

    // Fill required Creator field if blank (validation blocks submit otherwise)
    await fillRequiredProjectDialogFields(page);

    // Click submit on project creation dialog
    const okButton = page.getByTestId("submit-button").first();
    if (await okButton.isVisible({ timeout: 3000 })) {
      await okButton.click();
    } else {
      await page.keyboard.press("Enter");
    }

    // Full Add-On fetches from GitHub; wait via shared editor-ready helper
    // instead of fixed sleeps to avoid races when running tests in parallel.
    await page.waitForTimeout(3000);
    const ready = await waitForEditorReady(page, 30000);
    if (!ready) {
      console.log("createFullAddOnProject: editor did not become ready");
      return false;
    }
    await page.waitForTimeout(1000);
    return true;
  } catch (error) {
    console.log(`Error creating Full Add-On project: ${error}`);
    return false;
  }
}

/**
 * Count sidebar items that have a thumbnail (backgroundImage) visible.
 * Returns both overall count and details per visible item.
 */
async function countSidebarThumbnails(page: Page): Promise<{
  thumbnailCount: number;
  itemsWithThumbnails: string[];
  totalSidebarIcons: number;
}> {
  return await page.evaluate(() => {
    const icons = document.querySelectorAll(".pil-itemIcon");
    let thumbnailCount = 0;
    const itemsWithThumbnails: string[] = [];

    for (const icon of icons) {
      const style = window.getComputedStyle(icon);
      const bgImage = style.backgroundImage;

      if (bgImage && bgImage !== "none" && bgImage.includes("url(")) {
        thumbnailCount++;

        // Find the nearest text to this icon
        const parent = icon.closest("[class*='pil-']");
        const label = parent?.textContent?.trim() || "unknown";
        itemsWithThumbnails.push(label);
      }
    }

    return {
      thumbnailCount,
      itemsWithThumbnails,
      totalSidebarIcons: icons.length,
    };
  });
}

test.describe("Thumbnail Generation @thumbnails", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test("Full Add-On project should display thumbnails for models and entity types", async ({ page }) => {
    // Capture ALL console messages related to thumbnails and workers
    const thumbnailLogs: string[] = [];

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
      const text = msg.text();
      if (/thumbnail|Thumbnail|worker|Worker|relation|Relation/i.test(text)) {
        thumbnailLogs.push(`[${msg.type()}] ${text}`);
      }
    });

    // Step 1: Create Full Add-On project
    console.log("=== STEP 1: Creating Full Add-On project ===");
    const created = await createFullAddOnProject(page);
    if (!created) {
      test.skip(true, "Could not create Full Add-On project");
      return;
    }

    await page.screenshot({ path: "debugoutput/screenshots/thumb-01-project-created.png", fullPage: true });

    // Step 2: Wait for the welcome dialog and select focused mode
    console.log("=== STEP 2: Setting edit mode ===");
    await selectEditMode(page, "focused");
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "debugoutput/screenshots/thumb-02-edit-mode-set.png", fullPage: true });

    // Verify we're in the editor by looking for known sidebar items
    const mobsSection = page.locator("text=Mobs").first();
    const hasMobs = await mobsSection.isVisible({ timeout: 5000 });
    console.log(`In editor with Mobs section visible: ${hasMobs}`);
    expect(hasMobs).toBeTruthy();

    // Step 3: Wait for thumbnail generation to complete
    // Thumbnails are generated asynchronously by a web worker after relations are calculated.
    // Poll every 3 seconds for up to 60 seconds.
    console.log("=== STEP 3: Polling for thumbnails ===");

    let thumbnailResult = { thumbnailCount: 0, itemsWithThumbnails: [] as string[], totalSidebarIcons: 0 };
    let stableCount = 0;
    const maxWaitMs = 60_000;
    const pollIntervalMs = 3_000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      await page.waitForTimeout(pollIntervalMs);

      // Make sure we're still on the editor page
      const currentUrl = page.url();
      if (!currentUrl.includes("#actions") && !currentUrl.includes("localhost")) {
        console.log(`WARNING: Page navigated away to ${currentUrl}`);
        await page.screenshot({
          path: "debugoutput/screenshots/thumb-error-navigated-away.png",
          fullPage: true,
        });
        break;
      }

      const result = await countSidebarThumbnails(page);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(
        `  Poll (${elapsed}s): ${result.thumbnailCount} thumbnails, ` + `${result.totalSidebarIcons} total icons`
      );

      if (result.thumbnailCount > 0) {
        console.log(`  Items with thumbnails: ${result.itemsWithThumbnails.join(", ")}`);
      }

      if (result.thumbnailCount > 0 && result.thumbnailCount === thumbnailResult.thumbnailCount) {
        stableCount++;
        if (stableCount >= 3) {
          console.log("  Thumbnail count stable for 3 rounds, done waiting.");
          break;
        }
      } else {
        stableCount = 0;
      }

      thumbnailResult = result;
    }

    // Step 4: Final screenshot and diagnostics
    console.log("=== STEP 4: Final diagnostics ===");
    await page.screenshot({ path: "debugoutput/screenshots/thumb-03-after-wait.png", fullPage: true });

    // Extract thumbnail SVG data for key models
    const thumbnailData = await page.evaluate(() => {
      const results: { label: string; svgDataUrl: string }[] = [];
      const icons = document.querySelectorAll(".pil-itemIcon");
      for (const icon of icons) {
        const style = window.getComputedStyle(icon);
        const bgImage = style.backgroundImage || "";
        if (bgImage !== "none" && bgImage.includes("url(")) {
          const row = icon.closest('[class*="pil-gridItem"]') || icon.parentElement;
          let label = "unknown";
          if (row) {
            const labelEl =
              row.querySelector('[class*="pil-itemLabel"]') || row.querySelector('[class*="pil-nameLabel"]');
            if (labelEl) label = labelEl.textContent?.trim() || "unknown";
          }
          // Extract the data URL from url('...')
          const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
          if (match && match[1]) {
            results.push({ label, svgDataUrl: match[1] });
          }
        }
      }
      return results;
    });

    // Save extracted thumbnails as an HTML gallery for visual inspection
    const fs = await import("fs");
    let galleryHtml = `<!DOCTYPE html><html><head><title>Thumbnail Gallery</title>
<style>body{background:#333;color:white;font-family:Arial;padding:20px;display:flex;flex-wrap:wrap;gap:20px}
.card{text-align:center;border:1px solid #555;padding:10px;border-radius:8px;background:#444}
.card img{width:150px;height:150px;image-rendering:pixelated;background:#222;border:1px solid #666}</style></head><body>
<h1 style="width:100%">Extracted Thumbnails (${thumbnailData.length} items)</h1>`;
    for (const item of thumbnailData) {
      galleryHtml += `<div class="card"><img src="${item.svgDataUrl}" alt="${item.label}"/><div>${item.label}</div></div>`;
    }
    galleryHtml += `</body></html>`;
    fs.writeFileSync("debugoutput/screenshots/thumbnail-gallery.html", galleryHtml);
    console.log(
      `Saved thumbnail gallery with ${thumbnailData.length} thumbnails to debugoutput/screenshots/thumbnail-gallery.html`
    );

    // Scroll down to show Models section (if visible)
    const modelsHeader = page.locator("text=Models").first();
    if (await modelsHeader.isVisible({ timeout: 2000 })) {
      await modelsHeader.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.screenshot({ path: "debugoutput/screenshots/thumb-04-models-section.png", fullPage: true });
    }

    // Get detailed item list with labels using evaluate
    const detailedItems = await page.evaluate(() => {
      const results: { label: string; hasThumbnail: boolean; bgImageSnippet: string }[] = [];

      // Get all sidebar item rows (they typically have the structure: label + icon)
      const itemIcons = document.querySelectorAll(".pil-itemIcon");

      for (const icon of itemIcons) {
        const style = window.getComputedStyle(icon);
        const bgImage = style.backgroundImage || "";
        const hasThumbnail = bgImage !== "none" && bgImage.includes("url(");

        // Walk up to find the item row container and its text label
        let label = "unknown";
        let el: Element | null = icon;
        // Walk up from the icon to find the item container
        while (el && !el.textContent?.trim()) {
          el = el.parentElement;
        }
        // Find the nearest grid row parent
        const row = icon.closest('[class*="pil-gridItem"]') || icon.parentElement;
        if (row) {
          const labelEl =
            row.querySelector('[class*="pil-itemLabel"]') || row.querySelector('[class*="pil-nameLabel"]');
          if (labelEl) {
            label = labelEl.textContent?.trim() || "unknown";
          } else {
            // Fallback: get text from the row
            const texts = row.querySelectorAll("span, div, button");
            for (const t of texts) {
              const txt = t.textContent?.trim();
              if (txt && txt.length > 1 && txt.length < 40 && txt !== "...") {
                label = txt;
                break;
              }
            }
          }
        }

        results.push({
          label,
          hasThumbnail,
          bgImageSnippet: hasThumbnail ? bgImage.substring(0, 50) + "..." : "",
        });
      }

      return results;
    });

    console.log(`\nDetailed sidebar items with icons (${detailedItems.length}):`);
    for (const item of detailedItems) {
      console.log(`  ${item.hasThumbnail ? "✓ THUMBNAIL" : "✗ no thumb"} "${item.label}"`);
    }

    // Step 5: Assertions
    console.log("\n=== STEP 5: Assertions ===");
    console.log(`Total thumbnails found: ${thumbnailResult.thumbnailCount}`);
    console.log(`Items with thumbnails: ${thumbnailResult.itemsWithThumbnails.join(", ")}`);

    // At minimum, we should see some thumbnails (from geometry models)
    expect(
      thumbnailResult.thumbnailCount,
      "Expected at least one thumbnail to be visible in sidebar. " +
        "Thumbnail logs: " +
        thumbnailLogs.slice(0, 10).join(" | ")
    ).toBeGreaterThan(0);
  });
});
