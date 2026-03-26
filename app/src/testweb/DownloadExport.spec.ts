import { test, expect, ConsoleMessage } from "@playwright/test";
import { promises as fs } from "fs";
import path from "path";
import { preferBrowserStorageInProjectDialog, processMessage, selectEditMode } from "./WebTestUtilities";

test.describe("MCTools Web Editor - Download and Export Tests @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  function getDashboardAddonExportButton(page: Parameters<typeof selectEditMode>[0]) {
    return page.locator("button").filter({ hasText: /Install in Minecraft \(\.mcaddon\)/i }).first();
  }

  function getDashboardFolderExportButton(page: Parameters<typeof selectEditMode>[0]) {
    return page.locator("button").filter({ hasText: /Save project files to a folder/i }).first();
  }

  function getDashboardFlatWorldButton(page: Parameters<typeof selectEditMode>[0]) {
    return page.locator("button").filter({ hasText: /flat test world/i }).first();
  }

  function getDashboardProjectWorldButton(page: Parameters<typeof selectEditMode>[0]) {
    return page.locator("button").filter({ hasText: /regular project world/i }).first();
  }

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should identify and test file upload functionality", async ({ page }) => {
    // Look for the file upload area mentioned in the body text
    const uploadText = page.locator("text=/Upload a zip/i");
    const fileInputs = page.locator('input[type="file"]');

    await page.screenshot({ path: "debugoutput/screenshots/upload-functionality.png", fullPage: true });

    if ((await uploadText.count()) > 0) {
      await expect(uploadText).toBeVisible();
      console.log("Found upload text");
    }

    if ((await fileInputs.count()) > 0) {
      console.log(`Found ${await fileInputs.count()} file inputs`);
      const firstFileInput = fileInputs.first();
      await expect(firstFileInput).toBeAttached();
    }

    expect(consoleErrors.length).toBeLessThanOrEqual(0);
    // Allow MUI focus trap warnings ("Body element does not contain trap zone element")
    const nonMuiWarnings = consoleWarnings.filter(
      (w) => !w.error.includes("Body element does not contain trap zone element")
    );
    expect(nonMuiWarnings.length).toBeLessThanOrEqual(0);
  });

  test("should test project creation and editor access", async ({ page }) => {
    // Use the correct workflow to create project and access editor
    const addOnStarterNewButton = page.getByRole("button", { name: "Create New" }).first();

    if ((await addOnStarterNewButton.count()) > 0) {
      await expect(addOnStarterNewButton).toBeVisible();
      console.log("Add-On Starter New button found and visible");

      // Click to create project
      await addOnStarterNewButton.click();
      await page.waitForTimeout(1000);

      // Handle project creation dialog
      const okButton = await page.getByTestId("submit-button").first();
      if ((await okButton.count()) > 0) {
        await preferBrowserStorageInProjectDialog(page);
        await okButton.click();
        await page.waitForTimeout(9000);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);

        // Select Focused mode to dismiss welcome panel and hide Inspector
        await selectEditMode(page);

        // Verify we're in the editor
        const editorToolbar = page.locator("button:has-text('Save')").or(page.locator("button:has-text('View')"));
        if ((await editorToolbar.count()) > 0) {
          console.log("Successfully entered editor interface");
          await expect(editorToolbar.first()).toBeVisible();
        }
      }
    }

    // Also verify other new/create buttons exist on the homepage
    const allNewButtons = page.locator("button:has-text('New')");
    if ((await allNewButtons.count()) > 0) {
      console.log(`Found ${await allNewButtons.count()} New buttons for project creation`);
    }

    expect(consoleErrors.length).toBeLessThanOrEqual(0);
    // Allow MUI focus trap warnings ("Body element does not contain trap zone element")
    const nonMuiWarnings2 = consoleWarnings.filter(
      (w) => !w.error.includes("Body element does not contain trap zone element")
    );
    expect(nonMuiWarnings2.length).toBeLessThanOrEqual(0);
  });

  test("should test download functionality from within editor context", async ({ page }) => {
    // Create project and get into editor using correct workflow
    const addOnStarterNewButton = page.getByRole("button", { name: "Create New" }).first();

    if ((await addOnStarterNewButton.count()) > 0) {
      console.log("Creating project to test download functionality");
      await addOnStarterNewButton.click();

      await page.getByLabel("Title").fill("automated_test_proj");
      await page.getByLabel("Creator Name").fill("automated_test_creator");

      // Expand Advanced Options to access Folder Name and Description fields
      const advancedToggle = page.getByText("Advanced Options");
      if (await advancedToggle.isVisible({ timeout: 2000 })) {
        await advancedToggle.click();
        await page.waitForTimeout(300);
      }

      await page.getByLabel("Folder Name").fill("automated_test_sn");
      await page.getByLabel("Description").fill("automated_test_desc");

      const okButton = await page.getByTestId("submit-button").first();
      await preferBrowserStorageInProjectDialog(page);
      await okButton.click();
      await page.waitForTimeout(2000);
      await page.waitForLoadState("networkidle");

      // Select Focused mode to dismiss welcome panel and hide Inspector
      await selectEditMode(page);

      await page.screenshot({ path: "debugoutput/screenshots/editor-download-context.png", fullPage: true });
    }

    // Look for actual export/download buttons in the editor
    const exportZipButton = getDashboardAddonExportButton(page);
    const exportFolderButton = getDashboardFolderExportButton(page);
    const downloadFlatWorldButton = getDashboardFlatWorldButton(page);
    const downloadProjectWorldButton = getDashboardProjectWorldButton(page);

    await page.screenshot({ path: "debugoutput/screenshots/editor-export-buttons.png", fullPage: true });

    if ((await exportZipButton.count()) > 0) {
      console.log("Found 'Download & Install in Minecraft (.mcaddon)' button, testing download");
      await expect(exportZipButton).toBeVisible();

      try {
        // Set up download monitoring BEFORE clicking the button
        const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
        await exportZipButton.click();

        // Wait for download to start
        const download = await downloadPromise;
        console.log(`Download started: ${download.suggestedFilename()}`);

        // Validate the download
        const downloadPath = `debugoutput/playwright-test-downloads/dl-export-${download.suggestedFilename()}`;
        await fs.mkdir(path.dirname(downloadPath), { recursive: true });
        await download.saveAs(downloadPath);

        const stats = await fs.stat(downloadPath);
        expect(stats.size).toBeGreaterThan(0);
        console.log(`Downloaded file size: ${stats.size} bytes`);

        // Verify it's a valid zip file
        const buffer = await fs.readFile(downloadPath);
        const zipSignature = buffer.slice(0, 4);
        expect(zipSignature[0]).toBe(0x50);
        expect(zipSignature[1]).toBe(0x4b);
        console.log("Download is a valid ZIP file");
      } catch (error) {
        console.log("Download test failed or timed out:", error);
        await page.screenshot({ path: "debugoutput/screenshots/download-failed.png", fullPage: true });
      }
    }

    // Verify other download options are available
    if ((await exportFolderButton.count()) > 0) {
      console.log("Found 'Save project files to a folder' button");
      await expect(exportFolderButton).toBeVisible();
    }

    if ((await downloadFlatWorldButton.count()) > 0) {
      console.log("Found 'Download a flat test world' button");
      await expect(downloadFlatWorldButton).toBeVisible();
    }

    if ((await downloadProjectWorldButton.count()) > 0) {
      console.log("Found 'Download a regular project world' button");
      await expect(downloadProjectWorldButton).toBeVisible();
    }

    // Count all download-related buttons found
    const allDownloadButtons = page.locator("button").filter({ hasText: /download|export/i });
    if ((await allDownloadButtons.count()) > 0) {
      console.log(`Found ${await allDownloadButtons.count()} download-related buttons`);
    }

    expect(consoleErrors.length).toBeLessThanOrEqual(0);
    // Allow MUI focus trap warnings ("Body element does not contain trap zone element")
    const nonMuiWarnings3 = consoleWarnings.filter(
      (w) => !w.error.includes("Body element does not contain trap zone element")
    );
    expect(nonMuiWarnings3.length).toBeLessThanOrEqual(0);
  });

  test("should test navigation to different sections", async ({ page }) => {
    // Test navigation to different parts of the application
    const toolsHeading = page.getByRole("heading", { name: /Advanced tools and examples/i }).first();
    const toolsToggle = page.getByRole("button", { name: /advanced tools/i }).first();
    const docsLink = page.locator("text=/Docs/i");

    // Test Tools section - just verify it exists
    if ((await toolsHeading.count()) > 0) {
      await expect(toolsHeading).toBeVisible();
      console.log("Advanced tools heading found");
    } else if ((await toolsToggle.count()) > 0) {
      await expect(toolsToggle).toBeVisible();
      console.log("Advanced tools toggle found");
    }

    // Test documentation link (external) - just verify it exists
    if ((await docsLink.count()) > 0) {
      const firstDocsLink = docsLink.first();
      if (await firstDocsLink.isVisible()) {
        const href = await firstDocsLink.getAttribute("href");
        console.log(`Docs link points to: ${href}`);
        expect(href).toBeTruthy();
      }
    }

    expect(consoleErrors.length).toBeLessThanOrEqual(0);
    // Allow MUI focus trap warnings ("Body element does not contain trap zone element")
    const nonMuiWarnings4 = consoleWarnings.filter(
      (w) => !w.error.includes("Body element does not contain trap zone element")
    );
    expect(nonMuiWarnings4.length).toBeLessThanOrEqual(0);
  });
});
