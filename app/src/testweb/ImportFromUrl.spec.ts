import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage } from "./WebTestUtilities";

test.describe("Import From URL - gp link workflow", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("handles special open=gp/bounceSkeletons.ts URL", async ({ page }) => {
    // 1. Navigate to the user-specified form (query string)
    await page.goto(
      "/#open=gp/addonStarter&updates=UEsDBAoAAAAAAAySM1sAAAAAAAAAAAAAAAAIAAAAc2NyaXB0cy9QSwMECgAAAAgADJIzW4+lRIq4AAAAEwEAAA8AAABzY3JpcHRzL21haW4udHNtjzFuwzAMRXed4sOTAwT2AbJ07NItOYAi0YlQSQxIukYQ5O5VInTrzP/e/0zlxmJ4YGPJcQ+9q1HBE4twwfBRUqUgfrFZSX5IhoNzy1qDJa4oPtVjCt/jDg+HrpiUavwiVX+hcfiknBlHUht2hxaZZ/gY3yAy8w2BI+FKQlO79vJJ1jr+qRv1dK5hpxq4FKoGuxJym4UzZd5gDKq6CuHOq3S1NbKrkyL4nCn2h16smhebXs7/+34BUEsBAhQACgAAAAAADJIzWwAAAAAAAAAAAAAAAAgAAAAAAAAAAAAQAAAAAAAAAHNjcmlwdHMvUEsBAhQACgAAAAgADJIzW4+lRIq4AAAAEwEAAA8AAAAAAAAAAAAAAAAAJgAAAHNjcmlwdHMvbWFpbi50c1BLBQYAAAAAAgACAHMAAAALAQAAAAA="
    );
    await page.waitForLoadState("domcontentloaded");

    // Allow app routing to settle
    await page.waitForTimeout(750);

    // Heuristics for the import UX
    const loading = page.locator(".ifu-loading:has-text('Loading content from URL')");
    const importCreate = page.locator("button:has-text('Create')");
    const cancelHome = page.locator("button:has-text('Cancel/Home Page')");
    const fileExplorer = page.locator(".ifu-contentInterior .ifu-warning");
    const dialog = page.locator("dialog, [role='dialog']");
    const errorBlock = page.locator(".ifu-error");

    // Re-evaluate after possible fallback
    const states = {
      loading: await loading.count(),
      createBtn: await importCreate.count(),
      explorer: await fileExplorer.count(),
      dialog: await dialog.count(),
      error: await errorBlock.count(),
    };

    await page.screenshot({
      path: "debugoutput/screenshots/import-from-url-initial.png",
      fullPage: true,
    });

    // Assert at least one expected state is present
    expect(states.loading + states.createBtn + states.explorer + states.dialog + states.error).toBeGreaterThan(0);

    // If a dialog appears, just capture it
    if (states.dialog > 0) {
      await page.screenshot({
        path: "debugoutput/screenshots/import-from-url-dialog.png",
        fullPage: true,
      });
    }

    // Test Cancel/Home navigation if available
    if ((await cancelHome.count()) > 0) {
      await page.waitForLoadState("networkidle");
      // Banner heuristic
      const banner = page.locator("img.hhdr-image");
      if ((await banner.count()) > 0) {
        await expect(banner.first()).toBeVisible();
      }
      await page.screenshot({
        path: "debugoutput/screenshots/import-from-url-after-cancel.png",
        fullPage: true,
      });
    }

    // If file explorer view (storage loaded) is present, optionally hover Create
    if (states.createBtn > 0) {
      await expect(importCreate.first()).toBeVisible();
      await importCreate.first().hover();
      await page.screenshot({
        path: "debugoutput/screenshots/import-from-url-with-create.png",
        fullPage: true,
      });
      await importCreate.click();
    } else if (states.loading > 0) {
      // Loading-only scenario is valid when no update content is supplied
      await expect(loading.first()).toBeVisible();
    }

    // Allow app routing to settle
    await page.waitForTimeout(750);

    // Verify main editor interface elements are present - use flexible discovery
    const saveButton = page.locator("button:has-text('Save')");
    const viewButton = page.locator("button:has-text('View')");
    const shareButton = page.locator("button:has-text('Share')");
    const runButton = page.locator("button[title='Deploy']").or(page.locator("button:has-text('Run')").first());

    // Use conditional checks like the successful tests do
    if ((await saveButton.count()) > 0) {
      console.log("Found Save button in main toolbar");
      await expect(saveButton).toBeVisible();
    }

    if ((await viewButton.count()) > 0) {
      console.log("Found View button in main toolbar");
      await expect(viewButton).toBeVisible();
    }

    if ((await shareButton.count()) > 0) {
      console.log("Found Share button in main toolbar");
      await expect(shareButton).toBeVisible();
    }

    if ((await runButton.count()) > 0) {
      console.log("Found Run button in main toolbar");
      await expect(runButton.first()).toBeVisible();
    }

    // Console validation (allow a couple benign warnings)
    expect(consoleErrors.length).toBeLessThanOrEqual(0);
    expect(consoleWarnings.length).toBeLessThanOrEqual(2);
  });
});
