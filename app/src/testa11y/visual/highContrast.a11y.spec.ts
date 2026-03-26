/**
 * High contrast mode accessibility tests.
 *
 * Verifies UI remains usable when `forced-colors: active` is emulated.
 * Ensures no information is conveyed solely through color.
 *
 * MAS / WCAG criteria: 1.4.1 (Use of Color), 1.4.11 (Non-text Contrast).
 *
 * Tags: @comprehensive-a11y @high-contrast @visual-a11y
 */

import { test, expect } from "../fixtures";
import { assertNoCriticalViolations, setMediaEmulation } from "../a11yTestUtils";
import { enterEditor } from "../../testweb/WebTestUtilities";

test.describe("High Contrast Mode — Home Page @comprehensive-a11y @high-contrast @visual-a11y", () => {
  test("home page in forced-colors mode — no critical violations", async ({ page }) => {
    await page.goto("/");
    await setMediaEmulation(page, { forcedColors: "active" });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await assertNoCriticalViolations(page, "Home (forced-colors)", {
      screenshotPath: "debugoutput/screenshots/a11y-highcontrast-home.png",
    });
  });

  test("interactive elements remain visible in forced-colors mode", async ({ page }) => {
    await page.goto("/");
    await setMediaEmulation(page, { forcedColors: "active" });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // All buttons should still be visible
    const buttons = page.getByRole("button");
    const buttonCount = await buttons.count();

    console.log(`Buttons visible in forced-colors mode: ${buttonCount}`);
    expect(buttonCount, "Should have at least one visible button in high contrast mode").toBeGreaterThan(0);

    // Take screenshot for visual verification
    await page.screenshot({
      path: "debugoutput/screenshots/a11y-highcontrast-buttons.png",
      fullPage: true,
    });
  });
});

test.describe("High Contrast Mode — Editor @comprehensive-a11y @high-contrast @visual-a11y", () => {
  test("editor in forced-colors mode — no critical violations", async ({ page }) => {
    const entered = await enterEditor(page);
    if (!entered) {
      test.skip();
      return;
    }

    await setMediaEmulation(page, { forcedColors: "active" });
    await page.waitForTimeout(500);

    await assertNoCriticalViolations(page, "Editor (forced-colors)", {
      screenshotPath: "debugoutput/screenshots/a11y-highcontrast-editor.png",
    });
  });
});

test.describe("High Contrast Mode — Use of Color @comprehensive-a11y @high-contrast @visual-a11y", () => {
  test("status indicators should not rely solely on color", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Check that status/error indicators have text or icons, not just color
    const statusElements = page.locator(
      '[class*="status"], [class*="error"], [class*="warning"], [class*="success"], [role="status"], [role="alert"]'
    );

    const statusCount = await statusElements.count();
    if (statusCount === 0) {
      console.log("No status indicators found on home page — OK for landing page");
      return;
    }

    for (let i = 0; i < Math.min(statusCount, 5); i++) {
      const el = statusElements.nth(i);
      const text = await el.textContent();
      const ariaLabel = await el.getAttribute("aria-label");
      const hasIcon = (await el.locator("svg, img, [class*='icon']").count()) > 0;

      // Status should convey meaning beyond color: via text, aria-label, or icon
      const hasNonColorIndicator = (text && text.trim().length > 0) || ariaLabel || hasIcon;
      expect(hasNonColorIndicator, "Status elements should convey meaning without relying solely on color").toBe(true);
    }
  });
});
