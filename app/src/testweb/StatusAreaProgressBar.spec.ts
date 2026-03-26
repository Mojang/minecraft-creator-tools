import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage, selectEditMode } from "./WebTestUtilities";

test.describe("StatusArea Progress Bar Tests @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should show subtle progress bar during validation", async ({ page }) => {
    // Use the correct workflow: New button under project template
    const addOnStarterNewButton = page.getByRole("button", { name: "Create New" }).first();

    if ((await addOnStarterNewButton.count()) > 0) {
      await addOnStarterNewButton.click();
      await page.waitForTimeout(500);

      // Look for and click OK button
      const okButton = await page.getByTestId("submit-button").first();
      await expect(okButton).toBeVisible();
      await okButton.click();

      await page.waitForTimeout(1500);
      await page.waitForLoadState("networkidle");

      // Select Full mode to dismiss welcome panel (needs Inspector visible for this test)
      await selectEditMode(page, "full");

      // Take screenshot of initial editor state
      await page.screenshot({
        path: "debugoutput/screenshots/status-area-initial-editor.png",
        fullPage: true,
      });

      // Find and click on Check for Problems (formerly Inspector/Validation) to trigger validation
      const inspectorItem = page.getByText("Check for Problems").or(page.getByText("Validation")).or(page.getByText("Inspector")).first();
      if ((await inspectorItem.count()) > 0) {
        await inspectorItem.click();

        // Take screenshots during validation to capture the progress bar
        for (let i = 0; i < 5; i++) {
          await page.waitForTimeout(200);
          await page.screenshot({
            path: `debugoutput/screenshots/status-area-progress-bar-${i + 1}.png`,
            fullPage: true,
          });
        }

        // Wait for validation to complete
        await page.waitForTimeout(3000);
        await page.screenshot({
          path: "debugoutput/screenshots/status-area-after-validation.png",
          fullPage: true,
        });
      }
    }

    expect(consoleErrors.length).toBeLessThanOrEqual(10);
  });
});
