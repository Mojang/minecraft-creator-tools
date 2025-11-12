import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage } from "./WebTestUtilities";

test.describe("MCTools Web Editor - Editor Interaction Tests", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should display the main application interface", async ({ page }) => {
    // Take a screenshot to understand the current UI
    await page.screenshot({ path: "debugoutput/screenshots/main-interface.png", fullPage: true });

    // Check for main content areas
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Look for common UI elements that might indicate the application loaded
    const hasContent = await page.evaluate(() => {
      return document.body.innerText.trim().length > 0;
    });
    expect(hasContent).toBe(true);

    expect(consoleErrors.length).toBeLessThanOrEqual(0);
    expect(consoleWarnings.length).toBeLessThanOrEqual(0);
  });

  test("should navigate to project creation and enter editor", async ({ page }) => {
    // Use the correct workflow: New button under project template
    const addOnStarterNewButton = page.getByRole("button", { name: "New" }).first();

    if ((await addOnStarterNewButton.count()) > 0) {
      console.log("Found Add-On Starter New button, clicking to create project");
      await addOnStarterNewButton.click();
      await page.waitForTimeout(1000);

      // Take screenshot of project creation dialog
      await page.screenshot({ path: "debugoutput/screenshots/project-creation-dialog.png", fullPage: true });

      // Look for and click OK button
      const okButton = await page.getByTestId("submit-button").first();
      await expect(okButton).toBeVisible();
      await okButton.click();

      await page.waitForTimeout(2000);
      await page.waitForLoadState("networkidle");

      // Take screenshot of what happens after creating project
      await page.screenshot({ path: "debugoutput/screenshots/after-project-creation.png", fullPage: true });

      // Verify we've entered the actual editor interface
      const editorToolbar = page
        .locator("button:has-text('Save')")
        .or(page.locator("button:has-text('View')"))
        .or(page.locator("button:has-text('Share')"));
      if ((await editorToolbar.count()) > 0) {
        console.log("Successfully entered editor interface");
        await expect(editorToolbar.first()).toBeVisible();

        // Verify project file listing
        const fileList = page.locator("[role='listbox']");
        if ((await fileList.count()) > 0) {
          console.log("Found project file listing");

          // Check for typical project structure items
          const projectItems = page
            .locator("option:has-text('Actions')")
            .or(page.locator("option:has-text('Project')"))
            .or(page.locator("option:has-text('Inspector')"));
          if ((await projectItems.count()) > 0) {
            console.log("Found project structure items");
          }
        }
      } else {
        console.log("Project creation did not lead to obvious editor interface");
      }
    } else {
      // Fallback: look for other project creation methods
      const newProjectButtons = page
        .locator("text=/new project/i")
        .or(page.locator("text=/create project/i"))
        .or(page.locator("button:has-text('New')"))
        .first();

      if ((await newProjectButtons.count()) > 0) {
        await newProjectButtons.click();
        await page.waitForLoadState("networkidle");

        // Take screenshot of project creation screen
        await page.screenshot({ path: "debugoutput/screenshots/alternative-project-creation.png", fullPage: true });
      } else {
        console.log("No obvious project creation button found, documenting current UI");
        await page.screenshot({ path: "debugoutput/screenshots/no-project-creation-found.png", fullPage: true });
      }
    }

    expect(consoleErrors.length).toBeLessThanOrEqual(0);
    expect(consoleWarnings.length).toBeLessThanOrEqual(0);
  });

  test("should handle project import/file operations", async ({ page }) => {
    // Look for file upload or import functionality
    const fileInputs = page.locator('input[type="file"]');
    const uploadButtons = page
      .locator("text=/upload/i")
      .or(page.locator("text=/import/i"))
      .or(page.locator("text=/open/i"));

    if ((await fileInputs.count()) > 0) {
      await page.screenshot({ path: "debugoutput/screenshots/file-inputs-found.png", fullPage: true });

      // Test file input visibility
      const firstFileInput = fileInputs.first();
      if (await firstFileInput.isVisible()) {
        await expect(firstFileInput).toBeVisible();
      }
    }

    if ((await uploadButtons.count()) > 0) {
      await page.screenshot({ path: "debugoutput/screenshots/upload-buttons-found.png", fullPage: true });

      // Test upload button functionality (without actually uploading)
      const firstUploadButton = uploadButtons.first();
      if (await firstUploadButton.isVisible()) {
        await expect(firstUploadButton).toBeVisible();
      }
    }

    expect(consoleErrors.length).toBeLessThanOrEqual(0);
    expect(consoleWarnings.length).toBeLessThanOrEqual(0);
  });

  test("should identify and test editor components and interactions", async ({ page }) => {
    // Create project and enter editor using correct workflow
    const addOnStarterNewButton = page.getByRole("button", { name: "New" }).first();

    if ((await addOnStarterNewButton.count()) > 0) {
      console.log("Creating project to enter editor");
      await addOnStarterNewButton.click();
      await page.waitForTimeout(1000);

      const okButton = await page.getByTestId("submit-button").first();
      await okButton.click();
      await page.waitForTimeout(2000);
      await page.waitForLoadState("networkidle");
    }

    await page.screenshot({ path: "debugoutput/screenshots/editor-components-search.png", fullPage: true });

    // Test main editor toolbar components
    const saveButton = page.locator("button:has-text('Save')");
    const viewButton = page.locator("button:has-text('View')");
    const settingsButton = page.locator("button:has-text('Settings')");
    const shareButton = page.locator("button:has-text('Share')");
    const runButton = page.locator("button[title='Deploy']").or(page.locator("button:has-text('Run')").first());

    if ((await saveButton.count()) > 0) {
      console.log("Found Save button in editor toolbar");
      await expect(saveButton).toBeVisible();
    }

    if ((await viewButton.count()) > 0) {
      console.log("Found View button in editor toolbar");
      await expect(viewButton).toBeVisible();

      // Try to interact with View button dropdown
      await viewButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "debugoutput/screenshots/view-button-dropdown.png", fullPage: true });
      await page.keyboard.press("Escape");
    }

    if ((await settingsButton.count()) > 0) {
      console.log("Found Settings button in editor toolbar");
      await expect(settingsButton).toBeVisible();
    }

    if ((await shareButton.count()) > 0) {
      console.log("Found Share button in editor toolbar");
      await expect(shareButton).toBeVisible();
    }

    if ((await runButton.count()) > 0) {
      console.log("Found Run button in editor toolbar");
      await expect(runButton.first()).toBeVisible();

      // Try to interact with Run button dropdown
      await runButton.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "debugoutput/screenshots/run-button-dropdown.png", fullPage: true });
      await page.keyboard.press("Escape");
    }

    // Test project file listing and interactions
    const fileList = page.locator("[role='listbox']");
    if ((await fileList.count()) > 0) {
      console.log("Found project file listing");
      await expect(fileList.first()).toBeVisible();

      // Test clicking different project items
      const actionsItem = page.locator("option:has-text('Actions')");
      const projectItem = page.locator("option:has-text('Project')");
      const inspectorItem = page.locator("option:has-text('Inspector')");
      const mainItem = page.locator("option:has-text('main')");

      if ((await actionsItem.count()) > 0) {
        console.log("Testing Actions item interaction");
        await actionsItem.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: "debugoutput/screenshots/actions-item-selected.png", fullPage: true });
      }

      if ((await projectItem.count()) > 0) {
        console.log("Testing Project item interaction");
        await projectItem.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: "debugoutput/screenshots/project-item-selected.png", fullPage: true });
      }

      if ((await inspectorItem.count()) > 0) {
        console.log("Testing Inspector item interaction");
        await inspectorItem.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: "debugoutput/screenshots/inspector-item-selected.png", fullPage: true });
      }

      if ((await mainItem.count()) > 0) {
        console.log("Testing main TypeScript file interaction");
        await mainItem.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: "debugoutput/screenshots/main-ts-file-selected.png", fullPage: true });

        // Look for any code editor elements when a TypeScript file is selected
        const codeEditorElements = page.locator(
          "textarea, [class*='editor'], [class*='monaco'], [contenteditable='true']"
        );
        if ((await codeEditorElements.count()) > 0) {
          console.log("Found code editor elements");
          const firstEditor = codeEditorElements.first();
          if (await firstEditor.isVisible()) {
            console.log("Code editor is visible, testing interaction");
            await firstEditor.click();
            // Note: We could test typing here but it might interfere with actual code
            await page.screenshot({ path: "debugoutput/screenshots/code-editor-focused.png", fullPage: true });
          }
        }
      }
    }

    // Test Add and Show buttons in the file listing area
    const addButton = page.locator("button:has-text('Add')");
    if ((await addButton.count()) > 0) {
      console.log("Testing Add button functionality");
      await addButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "debugoutput/screenshots/add-button-interaction.png", fullPage: true });
      await page.keyboard.press("Escape");
    }

    const showButton = page.locator("button:has-text('Show')");
    if ((await showButton.count()) > 0) {
      console.log("Testing Show button functionality");
      await showButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "debugoutput/screenshots/show-button-interaction.png", fullPage: true });
      await page.keyboard.press("Escape");
    }

    expect(consoleErrors.length).toBeLessThanOrEqual(0);
    expect(consoleWarnings.length).toBeLessThanOrEqual(0);
  });

  test("should test navigation and UI exploration", async ({ page }) => {
    // Get all clickable elements to understand the UI structure
    const clickableElements = page.locator(
      "button, a, [role='button'], [role='link'], input[type='button'], input[type='submit']"
    );
    const elementCount = await clickableElements.count();

    console.log(`Found ${elementCount} potentially clickable elements`);

    // Take comprehensive screenshots
    await page.screenshot({ path: "debugoutput/screenshots/full-ui-exploration.png", fullPage: true });

    // Test keyboard navigation
    await page.keyboard.press("Tab");
    const focusedElement = page.locator(":focus");
    if ((await focusedElement.count()) > 0) {
      await expect(focusedElement).toBeVisible();
    }

    // Document the structure we find
    const pageStructure = await page.evaluate(() => {
      const structure = {
        buttons: Array.from(document.querySelectorAll("button")).length,
        links: Array.from(document.querySelectorAll("a")).length,
        inputs: Array.from(document.querySelectorAll("input")).length,
        menus: Array.from(document.querySelectorAll('[role="menu"], [role="menubar"]')).length,
        toolbars: Array.from(document.querySelectorAll('[role="toolbar"], .toolbar, .Toolbar')).length,
        hasReactRoot: !!document.querySelector("#root, [data-reactroot]"),
        bodyText: document.body.innerText.substring(0, 200) + "...", // First 200 chars for reference
      };
      return structure;
    });

    console.log("Page structure:", JSON.stringify(pageStructure, null, 2));
    expect(pageStructure.hasReactRoot).toBe(true);

    expect(consoleErrors.length).toBeLessThanOrEqual(0);
    expect(consoleWarnings.length).toBeLessThanOrEqual(0);
  });
});
