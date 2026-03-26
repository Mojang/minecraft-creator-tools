/**
 * Accessibility scans for secondary screens: code pages, server modes.
 *
 * Tests each screen in the full theme × high-contrast matrix:
 * - light, dark, light + high contrast, dark + high contrast
 *
 * Some modes require specific server-side setup (webServer,
 * remoteServerManager) and may not fully render in a standalone Vite test environment.
 * Tests gracefully skip when the screen doesn't load.
 *
 * Tags: @comprehensive-a11y
 */

import { test } from "../fixtures";
import { assertNoCriticalViolations, THEME_MATRIX, applyThemeVariant } from "../a11yTestUtils";

const screens = [
  { mode: "codestartpage", name: "CodeStartPage" },
  { mode: "codetoolbox", name: "CodeToolbox" },
  { mode: "webserver", name: "WebServer" },
  { mode: "remoteservermanager", name: "RemoteServerManager" },
] as const;

for (const screen of screens) {
  test.describe(`${screen.name} Accessibility @comprehensive-a11y`, () => {
    for (const tv of THEME_MATRIX) {
      test(`${screen.name} — ${tv.label} — no critical violations`, async ({ page }) => {
        await applyThemeVariant(page, tv, `/?mode=${screen.mode}`);
        await page.waitForTimeout(1000);

        await assertNoCriticalViolations(page, `${screen.name} (${tv.label})`, {
          screenshotPath: `debugoutput/screenshots/a11y-${screen.mode}-${tv.variant}.png`,
        });
      });
    }
  });
}
