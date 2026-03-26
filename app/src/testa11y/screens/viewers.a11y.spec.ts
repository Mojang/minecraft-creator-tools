/**
 * Accessibility scans for 3D viewer modes: block, mob, model, structure, item.
 *
 * Tests each viewer in the full theme × high-contrast matrix:
 * - light, dark, light + high contrast, dark + high contrast
 *
 * Babylon.js canvas elements are excluded from axe scans (not accessible to
 * automated tooling), but the surrounding UI controls must pass.
 *
 * Tags: @comprehensive-a11y
 */

import { test } from "../fixtures";
import { assertNoCriticalViolations, THEME_MATRIX, applyThemeVariant } from "../a11yTestUtils";

const viewers = [
  { mode: "blockviewer", name: "BlockViewer", extraParams: "" },
  { mode: "mobviewer", name: "MobViewer", extraParams: "" },
  { mode: "modelviewer", name: "ModelViewer", extraParams: "" },
  { mode: "structureviewer", name: "StructureViewer", extraParams: "&structure=/res/test/sample_structure.mcstructure" },
  { mode: "itemviewer", name: "ItemViewer", extraParams: "" },
] as const;

for (const viewer of viewers) {
  test.describe(`${viewer.name} Accessibility @comprehensive-a11y`, () => {
    for (const tv of THEME_MATRIX) {
      test(`${viewer.name} — ${tv.label} — UI controls accessible`, async ({ page }) => {
        await applyThemeVariant(page, tv, `/?mode=${viewer.mode}${viewer.extraParams}`);

        // Wait for 3D viewer to finish loading before running a11y audit.
        // Babylon.js needs time to initialize; without this the audit runs
        // against the "Loading model…" spinner instead of the real controls.
        try {
          await page.waitForSelector("canvas", { state: "visible", timeout: 15000 });
          await page.waitForTimeout(2000);
        } catch {
          // If canvas never appears (e.g. WebGL unavailable), still run the audit
          // against whatever UI rendered after a generous wait.
          await page.waitForTimeout(5000);
        }

        await assertNoCriticalViolations(page, `${viewer.name} (${tv.label})`, {
          excludeSelector: "canvas",
          screenshotPath: `debugoutput/screenshots/a11y-${viewer.mode}-${tv.variant}.png`,
        });
      });
    }
  });
}
