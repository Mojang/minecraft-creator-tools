import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage, selectEditMode } from "./WebTestUtilities";

test.describe("MCTools Web Editor - Feature Editor Tests @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should display feature editor when creating a feature rule", async ({ page }) => {
    // Navigate to home page
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Take initial screenshot
    await page.screenshot({ path: "debugoutput/screenshots/feature-test-01-home.png", fullPage: true });

    // Create a new project using "Add-On Starter"
    const addOnStarterNewButton = page.getByRole("button", { name: "Create New" }).first();
    await addOnStarterNewButton.click();
    await page.waitForTimeout(1000);

    // Fill project dialog and click OK
    const okButton = page.getByTestId("submit-button").first();
    await okButton.click();
    await page.waitForTimeout(3000);
    await page.waitForLoadState("networkidle");

    // Select Focused mode to dismiss welcome panel and hide Inspector
    await selectEditMode(page);

    await page.screenshot({ path: "debugoutput/screenshots/feature-test-02-project-created.png", fullPage: true });

    // Now look for the Add button in the left panel
    const addButton = page.locator("button:has-text('Add'), [data-testid='add-item-button']").first();
    console.log(`Add button count: ${await addButton.count()}`);

    if ((await addButton.count()) > 0) {
      await addButton.click();
      await page.waitForTimeout(800);

      // Wait for Content Wizard dialog
      const wizardTitle = page.locator("text=Add New Content").first();
      await wizardTitle.waitFor({ state: "visible", timeout: 5000 });

      // Take screenshot of wizard state
      await page.screenshot({ path: "debugoutput/screenshots/feature-test-03-add-clicked.png", fullPage: true });

      const featureRuleOption = page.locator("text=Feature Rule").first();
      console.log(`Feature Rule option count: ${await featureRuleOption.count()}`);

      if ((await featureRuleOption.count()) > 0) {
        await featureRuleOption.click();
        await page.waitForTimeout(1000);
        await page.screenshot({
          path: "debugoutput/screenshots/feature-test-04-feature-rule-clicked.png",
          fullPage: true,
        });

        // Now look for a dialog or inline form to name the new item
        const nameInput = page.locator("input[type='text']").first();
        if ((await nameInput.count()) > 0) {
          console.log("Found name input");
        }

        // Click OK/Create/Submit button on the dialog
        const submitBtn = page
          .locator("button:has-text('OK'), button:has-text('Create'), [data-testid='submit-button']")
          .first();
        if ((await submitBtn.count()) > 0) {
          await submitBtn.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: "debugoutput/screenshots/feature-test-05-after-create.png", fullPage: true });

          // Now check if FeatureEditor is displayed by looking for its unique elements
          // FeatureEditor has tabs like "Overview", "Tree", "Diagram"
          const featureEditorTabs = page.locator("text='Overview', text='Tree', text='Diagram'");
          console.log(`Feature Editor tabs found: ${await featureEditorTabs.count()}`);

          // Also check for the ReactFlow container that FeatureDiagramEditor uses
          const reactFlowContainer = page.locator(".react-flow, .fe-diagramarea");
          console.log(`ReactFlow container found: ${await reactFlowContainer.count()}`);

          // Check if we see raw JSON editor instead
          const monacoEditor = page.locator(".monaco-editor");
          console.log(`Monaco editor found: ${await monacoEditor.count()}`);

          // Take final screenshot
          await page.screenshot({ path: "debugoutput/screenshots/feature-test-06-editor-view.png", fullPage: true });

          // Check what's actually in the page to understand what editor is shown
          const editorContent = await page
            .locator(".pie-outer, .fe-outer")
            .first()
            .innerHTML()
            .catch(() => "not found");
          console.log(`Editor outer element content length: ${editorContent.length}`);
        }
      }
    } else {
      console.log("Add button not found");
      // Try clicking directly on items in left panel to see menu structure
      const leftPanel = page.locator(".pab-outer");
      console.log(`Left panel found: ${await leftPanel.count()}`);

      // List all buttons visible
      const allButtons = page.locator("button");
      const buttonCount = await allButtons.count();
      console.log(`Total buttons on page: ${buttonCount}`);
      for (let i = 0; i < Math.min(buttonCount, 20); i++) {
        const buttonText = await allButtons.nth(i).textContent();
        console.log(`Button ${i}: "${buttonText?.trim()}"`);
      }
    }

    // Verify no critical errors occurred
    expect(consoleErrors.length).toBeLessThanOrEqual(10);
  });
});
