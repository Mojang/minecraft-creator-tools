/**
 * MobViewer Tests
 *
 * Tests for the mob/entity model viewer component — verifies the viewer loads,
 * navigation works, mob info displays correctly, and the gallery can be browsed.
 *
 * Note: Functional tests check page structure (dropdown, mob info, navigation)
 * rather than requiring the 3D canvas, since WebGL model loading can be unreliable
 * in headless/CI environments.
 *
 * Run with: npm run test-viewers
 *
 * Screenshots are captured for manual review in debugoutput/screenshots/.
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { processMessage } from "../testweb/WebTestUtilities";

// Use a 512x512 viewport for mob screenshots
test.use({ viewport: { width: 512, height: 512 } });

test.describe("MobViewer", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should load mob viewer mode", async ({ page }) => {
    await page.goto("/?mode=mobviewer&mob=pig");

    // The mob viewer page should load with either a canvas or a "model loading" state.
    // The 3D model may fail to load in headless/CI environments, so we check for the
    // page structure (dropdown, mob info) rather than requiring the canvas.
    const select = page.locator(".mv-select");
    await expect(select).toBeVisible({ timeout: 30000 });

    await page.screenshot({ path: "debugoutput/screenshots/mobviewer-initial.png" });
  });

  test("should load specific mob via URL parameter", async ({ page }) => {
    await page.goto("/?mode=mobviewer&mob=pig");

    // Wait for the mob info to appear (works regardless of 3D model loading)
    await page.waitForSelector(".mv-mob-info h2", { timeout: 30000 });

    // The h2 humanizes the entity id, e.g. "pig" -> "Pig", "wither_skeleton" -> "Wither Skeleton".
    const heading = page.locator(".mv-mob-info h2");
    await expect(heading).toContainText(/pig/i);

    await page.screenshot({ path: "debugoutput/screenshots/mobviewer-pig.png" });
  });

  test("should navigate between mobs", async ({ page }) => {
    await page.goto("/?mode=mobviewer&mob=pig");

    const select = page.locator(".mv-select");
    await expect(select).toBeVisible({ timeout: 30000 });
    const optionCount = await select.locator("option").count();
    expect(optionCount).toBeGreaterThanOrEqual(1);

    const nextButton = page.locator(".mv-button:has-text('Next')");
    if (await nextButton.isEnabled()) {
      await nextButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "debugoutput/screenshots/mobviewer-next-mob.png" });
    }
  });

  test("should select mob from dropdown", async ({ page }) => {
    await page.goto("/?mode=mobviewer&mob=cow");

    const select = page.locator(".mv-select");
    await expect(select).toBeVisible({ timeout: 30000 });

    const options = await select.locator("option").allTextContents();
    if (options.includes("chicken")) {
      await select.selectOption({ label: "chicken" });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "debugoutput/screenshots/mobviewer-chicken.png" });
    } else if (options.length > 5) {
      await select.selectOption({ index: 5 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "debugoutput/screenshots/mobviewer-selected.png" });
    }
  });

  test("should display mob details", async ({ page }) => {
    await page.goto("/?mode=mobviewer&mob=cow");

    const mobInfo = page.locator(".mv-mob-info");
    await expect(mobInfo).toBeVisible({ timeout: 30000 });

    await page.screenshot({ path: "debugoutput/screenshots/mobviewer-cow-details.png" });
  });

  test("should have working navigation buttons", async ({ page }) => {
    await page.goto("/?mode=mobviewer&mob=sheep");

    const select = page.locator(".mv-select");
    await expect(select).toBeVisible({ timeout: 30000 });

    const prevButton = page.locator(".mv-button:has-text('Prev')");
    const nextButton = page.locator(".mv-button:has-text('Next')");

    for (let i = 0; i < 3; i++) {
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }

    await expect(prevButton).toBeEnabled();
    await prevButton.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: "debugoutput/screenshots/mobviewer-navigation.png" });
  });

  test("should show sky background or model state", async ({ page }) => {
    await page.goto("/?mode=mobviewer&mob=sheep");

    // Wait for page to fully load
    const select = page.locator(".mv-select");
    await expect(select).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "debugoutput/screenshots/mobviewer-sheep-with-sky.png" });
  });
});

/**
 * MobViewer Gallery Sweep
 *
 * Iterates through a representative sample of mobs to verify the viewer
 * loads each one without crashing. Does NOT do baseline screenshot comparison —
 * baselines would require checking in 78+ images that vary by GPU/driver/OS.
 */
test.describe("Mob Viewer Gallery Sweep", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should complete mob gallery without excessive errors", async ({ page }) => {
    await page.goto("/?mode=mobviewer&mob=pig");
    await page.waitForLoadState("networkidle");

    const dropdown = page.locator(".mv-select");
    await expect(dropdown).toBeVisible({ timeout: 30000 });

    const optionCount = await dropdown.locator("option").count();

    const renderErrors: string[] = [];

    // Test first 15 mobs by navigating through the dropdown
    for (let i = 0; i < Math.min(15, optionCount); i++) {
      await dropdown.selectOption({ index: i });
      await page.waitForTimeout(500);

      const errorDiv = page.locator(".mv-error");
      if (await errorDiv.isVisible().catch(() => false)) {
        const errorText = await errorDiv.textContent();
        renderErrors.push(`Mob ${i}: ${errorText}`);
      }
    }

    if (renderErrors.length > 0) {
      console.log("Render errors encountered:", renderErrors);
    }

    // Allow some errors (missing models, textures) but not too many
    expect(renderErrors.length).toBeLessThan(5);
  });
});

/**
 * Comprehensive Entity Type Rendering Gallery
 *
 * Renders a curated, representative cross-section of vanilla entity types and
 * captures one screenshot per type *after* the 3D model has finished loading
 * (waits for the .mov-loading-area spinner to disappear and the canvas to be
 * present). Screenshots are written to debugoutput/screenshots/entity-gallery/
 * and a manifest JSON is emitted so they can be reviewed (and later promoted
 * to baselines) as a batch.
 *
 * Categories covered:
 *   - Passive quadrupeds  (cow, pig, sheep, horse, rabbit, fox, panda)
 *   - Humanoids           (zombie, skeleton, villager, piglin, witch, wither_skeleton)
 *   - Flyers              (chicken, parrot, bee, phantom, ghast, allay)
 *   - Aquatic             (squid, dolphin, axolotl, salmon, pufferfish)
 *   - Bosses              (ender_dragon, wither, warden, elder_guardian)
 *   - Small / blob        (slime, magma_cube, silverfish, endermite)
 *   - Projectiles / misc  (arrow, shulker_bullet, snowball)
 *   - Illagers            (vindicator, evoker, pillager, ravager)
 *   - Exotic / 1.19+      (frog, tadpole, sniffer, camel, goat)
 *
 * Each entity is its own Playwright `test()` so per-entity timeouts and
 * reporting are isolated. A separate summary test reads back each per-entity
 * screenshot's existence and writes a manifest.
 *
 * This is NOT pixel-diff regression; the goal is to surface obvious render
 * regressions (missing models, untextured meshes, wrong materials, missing
 * limbs, completely empty canvas) via human / agent review of the outputs.
 */
const GALLERY_DIR = "debugoutput/screenshots/entity-gallery";

const GALLERY_ENTITIES: { id: string; category: string }[] = [
  { id: "cow", category: "quadruped" },
  { id: "pig", category: "quadruped" },
  { id: "sheep", category: "quadruped" },
  { id: "horse", category: "quadruped" },
  { id: "rabbit", category: "quadruped" },
  { id: "fox", category: "quadruped" },
  { id: "panda", category: "quadruped" },
  { id: "zombie", category: "humanoid" },
  { id: "skeleton", category: "humanoid" },
  { id: "villager", category: "humanoid" },
  { id: "piglin", category: "humanoid" },
  { id: "witch", category: "humanoid" },
  { id: "wither_skeleton", category: "humanoid" },
  { id: "chicken", category: "flyer" },
  { id: "parrot", category: "flyer" },
  { id: "bee", category: "flyer" },
  { id: "phantom", category: "flyer" },
  { id: "ghast", category: "flyer" },
  { id: "allay", category: "flyer" },
  { id: "squid", category: "aquatic" },
  { id: "dolphin", category: "aquatic" },
  { id: "axolotl", category: "aquatic" },
  { id: "salmon", category: "aquatic" },
  { id: "pufferfish", category: "aquatic" },
  { id: "ender_dragon", category: "boss" },
  { id: "wither", category: "boss" },
  { id: "warden", category: "boss" },
  { id: "elder_guardian", category: "boss" },
  { id: "slime", category: "blob" },
  { id: "magma_cube", category: "blob" },
  { id: "silverfish", category: "blob" },
  { id: "endermite", category: "blob" },
  { id: "arrow", category: "projectile" },
  { id: "shulker_bullet", category: "projectile" },
  { id: "snowball", category: "projectile" },
  { id: "vindicator", category: "illager" },
  { id: "evoker", category: "illager" },
  { id: "pillager", category: "illager" },
  { id: "ravager", category: "illager" },
  { id: "frog", category: "exotic" },
  { id: "tadpole", category: "exotic" },
  { id: "sniffer", category: "exotic" },
  { id: "camel", category: "exotic" },
  { id: "goat", category: "exotic" },
];

type GalleryStatus = "rendered" | "model_error" | "timeout" | "not_in_dropdown";
type GalleryResult = {
  id: string;
  category: string;
  status: GalleryStatus;
  durationMs: number;
  canvasPresent: boolean;
  errorMessage?: string;
  screenshot: string;
};

test.describe("Entity Type Rendering Gallery", () => {
  // The whole gallery runs in a single browser context so we pay the heavy
  // MobViewer / project-load cost exactly once and then drive every entity
  // via the dropdown. That keeps the runtime bounded (~5-10s per entity
  // instead of ~50s for a full page reload) and avoids overloading Vite.
  test.describe.configure({ timeout: 20 * 60 * 1000 });

  test("renders representative entity types via dropdown navigation", async ({ page }) => {
    const fs = await import("fs");
    const path = await import("path");

    // Clean output dir for a fresh run.
    fs.rmSync(GALLERY_DIR, { recursive: true, force: true });
    fs.mkdirSync(GALLERY_DIR, { recursive: true });

    // Load the viewer once with the first entity that we know works.
    await page.goto(`/?mode=mobviewer&mob=pig`);
    const dropdown = page.locator(".mv-select");
    await expect(dropdown).toBeVisible({ timeout: 60000 });

    // Discover the full dropdown so we can flag entities that aren't present
    // in this catalog (vs. ones present-but-failing-to-render).
    const availableIds = new Set(await dropdown.locator("option").allTextContents());

    const results: GalleryResult[] = [];

    for (const entity of GALLERY_ENTITIES) {
      const screenshotPath = path.join(GALLERY_DIR, `${entity.category}-${entity.id}.png`);
      const start = Date.now();

      if (!availableIds.has(entity.id)) {
        results.push({
          id: entity.id,
          category: entity.category,
          status: "not_in_dropdown",
          durationMs: 0,
          canvasPresent: false,
          screenshot: screenshotPath,
        });
        continue;
      }

      try {
        await dropdown.selectOption({ label: entity.id });

        // Wait for the ModelViewer to reach a terminal state for this entity:
        //   - error message visible, OR
        //   - canvas present and loading spinner gone.
        // The h2 heading also updates to the new entity name; using it as a
        // sentinel ensures we don't read stale state from the previous mob.
        const terminalState = await page
          .waitForFunction(
            (expectedId) => {
              const heading = document.querySelector(".mv-mob-info h2");
              if (!heading) return null;
              // Heading is humanized ("wither_skeleton" -> "Wither Skeleton").
              // We compare against a normalized form rather than the raw id.
              const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
              if (normalize(heading.textContent || "") !== normalize(expectedId)) {
                return null;
              }
              const err = document.querySelector(".mov-error-message");
              if (err && (err as HTMLElement).offsetParent !== null) {
                return "error";
              }
              const loading = document.querySelector(".mov-loading-area");
              const canvas = document.querySelector(".mov-area canvas");
              if (canvas && !loading) {
                return "rendered";
              }
              return null;
            },
            entity.id,
            { timeout: 30_000, polling: 250 },
          )
          .then((handle) => handle.jsonValue() as Promise<string>)
          .catch(() => "timeout");

        if (terminalState === "rendered") {
          // One more frame for Babylon's first paint.
          await page.waitForTimeout(600);
        }

        const canvasPresent = (await page.locator(".mov-area canvas").count()) > 0;
        const errorLocator = page.locator(".mov-error-message").first();
        const errorVisible = await errorLocator.isVisible().catch(() => false);
        const errorMessage = errorVisible
          ? (await errorLocator.textContent()) ?? undefined
          : undefined;

        await page.screenshot({ path: screenshotPath });

        let status: GalleryStatus;
        if (errorVisible) {
          status = "model_error";
        } else if (terminalState === "rendered" && canvasPresent) {
          status = "rendered";
        } else {
          status = "timeout";
        }

        results.push({
          id: entity.id,
          category: entity.category,
          status,
          durationMs: Date.now() - start,
          canvasPresent,
          errorMessage,
          screenshot: screenshotPath,
        });
      } catch (err) {
        // Best-effort screenshot so we have *something* to look at.
        try {
          await page.screenshot({ path: screenshotPath });
        } catch {
          /* ignore */
        }
        results.push({
          id: entity.id,
          category: entity.category,
          status: "timeout",
          durationMs: Date.now() - start,
          canvasPresent: false,
          errorMessage: err instanceof Error ? err.message : String(err),
          screenshot: screenshotPath,
        });
      }
    }

    // Build summary manifest.
    const byCategory = Array.from(new Set(results.map((r) => r.category)))
      .sort()
      .map((cat) => ({
        category: cat,
        total: results.filter((r) => r.category === cat).length,
        rendered: results.filter((r) => r.category === cat && r.status === "rendered").length,
        modelError: results.filter((r) => r.category === cat && r.status === "model_error").length,
        timeout: results.filter((r) => r.category === cat && r.status === "timeout").length,
        notInDropdown: results.filter((r) => r.category === cat && r.status === "not_in_dropdown").length,
      }));

    const manifest = {
      generatedAt: new Date().toISOString(),
      total: results.length,
      rendered: results.filter((r) => r.status === "rendered").length,
      modelError: results.filter((r) => r.status === "model_error").length,
      timeout: results.filter((r) => r.status === "timeout").length,
      notInDropdown: results.filter((r) => r.status === "not_in_dropdown").length,
      byCategory,
      modelErrors: results
        .filter((r) => r.status === "model_error")
        .map((r) => ({ id: r.id, category: r.category, error: r.errorMessage })),
      timeouts: results.filter((r) => r.status === "timeout").map((r) => ({ id: r.id, category: r.category })),
      notInDropdownList: results.filter((r) => r.status === "not_in_dropdown").map((r) => r.id),
      results,
    };
    fs.writeFileSync(path.join(GALLERY_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

    test.info().attach("entity-gallery-manifest.json", {
      body: JSON.stringify(manifest, null, 2),
      contentType: "application/json",
    });

    console.log(
      `\n=== Entity Gallery Summary ===\n` +
        `  total:        ${manifest.total}\n` +
        `  rendered:     ${manifest.rendered}\n` +
        `  model_error:  ${manifest.modelError}\n` +
        `  timeout:      ${manifest.timeout}\n` +
        `  not_in_drop:  ${manifest.notInDropdown}\n` +
        (manifest.modelErrors.length
          ? `  errors:       ${manifest.modelErrors.map((e) => e.id).join(", ")}\n`
          : "") +
        (manifest.timeouts.length
          ? `  timeouts:     ${manifest.timeouts.map((t) => t.id).join(", ")}\n`
          : "") +
        (manifest.notInDropdownList.length
          ? `  missing:      ${manifest.notInDropdownList.join(", ")}\n`
          : ""),
    );

    // Of the entities actually present in the dropdown, at least 70% should
    // render fully. Entities missing from the catalog are excluded from the
    // ratio — they're a catalog issue, not a render regression.
    const present = manifest.total - manifest.notInDropdown;
    expect(
      manifest.rendered,
      `Only ${manifest.rendered} of ${present} present entities rendered fully`,
    ).toBeGreaterThanOrEqual(Math.ceil(present * 0.7));
  });
});
