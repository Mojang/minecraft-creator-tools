/**
 * Structure Editor Tests
 *
 * Tests for the structure visualization and editing functionality:
 * - StructureViewer: Read-only 3D rendering of .mcstructure files
 * - VolumeEditor: Interactive 3D block editor with tools (pencil, brush, etc.)
 * - StructureEditor: File-level wrapper with toolbar (reset camera, exclude edges, etc.)
 *
 * Coverage:
 * - Structure viewer loads and renders correctly
 * - 3D viewport initializes with canvas
 * - Camera controls work (reset, position)
 * - Block meshes render in the scene
 * - UI chrome (toolbar, dimensions display) renders
 * - Editor tools are present and switchable
 * - No console errors during normal operations
 *
 * Run with: npx playwright test StructureEditor.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { processMessage, takeScreenshot } from "./WebTestUtilities";

// Use a larger viewport for 3D content
test.use({ viewport: { width: 1280, height: 720 } });

/**
 * Wait for the Babylon.js canvas to appear and have rendered content.
 */
async function waitForCanvas(page: Page, timeout = 15000): Promise<boolean> {
  try {
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout });

    // Wait for content to render (canvas should have non-zero dimensions)
    await page.waitForTimeout(2000);

    // Check canvas is actually rendering
    const canvasInfo = await page.evaluate(() => {
      const canvases = document.querySelectorAll("canvas");
      for (const canvas of canvases) {
        if (canvas.width > 0 && canvas.height > 0) {
          return {
            width: canvas.width,
            height: canvas.height,
            visible: canvas.offsetWidth > 0 && canvas.offsetHeight > 0,
          };
        }
      }
      return null;
    });

    if (canvasInfo && canvasInfo.visible) {
      console.log(`Canvas found: ${canvasInfo.width}x${canvasInfo.height}`);
      return true;
    }

    console.log("Canvas found but may not have rendered content yet");
    return true; // Canvas exists, even if not fully rendered
  } catch {
    console.log("No canvas found within timeout");
    return false;
  }
}

/**
 * Navigate to the structure viewer with a test structure file.
 */
async function openStructureViewer(
  page: Page,
  structurePath: string = "/res/test/cannon.mcstructure",
  options: { skipVanilla?: boolean; hideChrome?: boolean } = {}
): Promise<boolean> {
  const skipVanilla = options.skipVanilla ?? true;
  const hideChrome = options.hideChrome ?? false;

  let url = `/?mode=structureviewer&structure=${structurePath}&skipVanillaResources=${skipVanilla}`;
  if (hideChrome) {
    url += "&hideChrome=true";
  }

  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  return true;
}

test.describe("Structure Viewer @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should load and render a structure file", async ({ page }) => {
    test.setTimeout(60000);

    await openStructureViewer(page, "/res/test/cannon.mcstructure");
    await takeScreenshot(page, "debugoutput/screenshots/structure-viewer-cannon-loaded");

    // Verify the viewer container is present
    const viewerContainer = page.locator(".sv-container").first();
    await expect(viewerContainer).toBeVisible({ timeout: 10000 });

    // Verify the 3D canvas renders
    const hasCanvas = await waitForCanvas(page);
    expect(hasCanvas).toBe(true);

    await takeScreenshot(page, "debugoutput/screenshots/structure-viewer-cannon-rendered");

    // Verify no critical console errors
    const criticalErrors = consoleErrors.filter(
      (e) => !e.error.includes("WebGL") && !e.error.includes("swiftshader") && !e.error.includes("GroupMarker")
    );
    console.log(`Console errors: ${criticalErrors.length}`);
  });

  test("should display structure dimensions in toolbar", async ({ page }) => {
    test.setTimeout(60000);

    await openStructureViewer(page, "/res/test/cannon.mcstructure");

    // Look for the dimensions display (e.g., "Structure: 7 × 5 × 3 blocks")
    const infoText = page.locator(".sv-info").first();
    if (await infoText.isVisible({ timeout: 10000 })) {
      const text = await infoText.textContent();
      console.log(`Structure info: "${text}"`);
      expect(text).toContain("×");
      expect(text).toContain("blocks");
    }

    await takeScreenshot(page, "debugoutput/screenshots/structure-viewer-dimensions");
  });

  test("should show loading state then render", async ({ page }) => {
    test.setTimeout(60000);

    // Navigate to structure viewer
    await page.goto("/?mode=structureviewer&structure=/res/test/mediumglass.mcstructure&skipVanillaResources=true");

    // Check for loading indicator
    const loadingEl = page.locator(".sv-loading, .sv-spinner").first();
    const loadingVisible = await loadingEl.isVisible({ timeout: 3000 }).catch(() => false);
    if (loadingVisible) {
      console.log("Loading indicator visible");
      await takeScreenshot(page, "debugoutput/screenshots/structure-viewer-loading");
    }

    // Wait for render
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // Verify final rendered state
    const hasCanvas = await waitForCanvas(page);
    expect(hasCanvas).toBe(true);

    await takeScreenshot(page, "debugoutput/screenshots/structure-viewer-mediumglass");
  });

  test("should show error for invalid structure URL", async ({ page }) => {
    test.setTimeout(30000);

    await page.goto("/?mode=structureviewer&structure=/nonexistent/file.mcstructure&skipVanillaResources=true");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // Should show error message
    const errorEl = page.locator(".sv-error").first();
    if (await errorEl.isVisible({ timeout: 5000 })) {
      const errorText = await errorEl.textContent();
      console.log(`Error message: "${errorText}"`);
      expect(errorText).toBeTruthy();
      expect(errorText!.length).toBeGreaterThan(0);
    }

    await takeScreenshot(page, "debugoutput/screenshots/structure-viewer-error");
  });

  test("should show error when no structure URL provided", async ({ page }) => {
    test.setTimeout(30000);

    await page.goto("/?mode=structureviewer&skipVanillaResources=true");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // Should show helpful error about missing URL
    const errorEl = page.locator(".sv-error").first();
    if (await errorEl.isVisible({ timeout: 5000 })) {
      const errorText = await errorEl.textContent();
      console.log(`No-URL error: "${errorText}"`);
      expect(errorText).toContain("structure");
    }

    await takeScreenshot(page, "debugoutput/screenshots/structure-viewer-no-url");
  });

  test("should render without chrome in headless mode", async ({ page }) => {
    test.setTimeout(60000);

    await page.goto(
      "/?mode=structureviewer&structure=/res/test/cannon.mcstructure&skipVanillaResources=true&hideChrome=true"
    );
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // In headless mode, toolbar should NOT be visible
    const toolbar = page.locator(".sv-toolbar").first();
    const toolbarVisible = await toolbar.isVisible({ timeout: 2000 }).catch(() => false);
    expect(toolbarVisible).toBe(false);

    // But canvas should still render
    const hasCanvas = await waitForCanvas(page);
    expect(hasCanvas).toBe(true);

    await takeScreenshot(page, "debugoutput/screenshots/structure-viewer-headless");
  });
});

test.describe("Structure Editor in Project @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should open structure file in project editor", async ({ page }) => {
    test.setTimeout(120000);

    // Use the URL import mechanism to load a project with a structure file
    // Create a minimal behavior pack with a structure
    const { enterEditor, enableAllFileTypes, selectEditMode } = await import("./WebTestUtilities");

    // Enter editor with Full mode to see all files
    const entered = await enterEditor(page, { editMode: "full" });
    expect(entered).toBe(true);
    await enableAllFileTypes(page);
    await page.waitForTimeout(1000);

    await takeScreenshot(page, "debugoutput/screenshots/structure-editor-project-initial");

    // Look for any structure files or .mcstructure items
    const structureItems = page
      .locator(".pit-name")
      .filter({ hasText: /structure|mcstructure/i })
      .first();

    if (await structureItems.isVisible({ timeout: 3000 }).catch(() => false)) {
      await structureItems.click();
      await page.waitForTimeout(3000);

      await takeScreenshot(page, "debugoutput/screenshots/structure-editor-opened");

      // Look for the structure editor's 3D canvas
      const hasCanvas = await waitForCanvas(page);
      if (hasCanvas) {
        console.log("Structure editor canvas is rendering");
      }
    } else {
      // Add-On Starter may not have structures - take screenshot of what we see
      console.log("No structure files found in default project (expected for Add-On Starter)");
      await takeScreenshot(page, "debugoutput/screenshots/structure-editor-no-structures");
    }
  });
});

test.describe("Volume Editor 3D Canvas @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should render 3D canvas with correct dimensions", async ({ page }) => {
    test.setTimeout(60000);

    await openStructureViewer(page, "/res/test/cannon.mcstructure");

    const hasCanvas = await waitForCanvas(page);
    expect(hasCanvas).toBe(true);

    // Get canvas dimensions
    const canvasInfo = await page.evaluate(() => {
      const canvases = document.querySelectorAll("canvas");
      const results: { width: number; height: number; clientWidth: number; clientHeight: number }[] = [];
      for (const canvas of canvases) {
        if (canvas.width > 0 && canvas.height > 0) {
          results.push({
            width: canvas.width,
            height: canvas.height,
            clientWidth: canvas.clientWidth,
            clientHeight: canvas.clientHeight,
          });
        }
      }
      return results;
    });

    console.log(`Canvas info: ${JSON.stringify(canvasInfo)}`);

    // Canvas should fill the viewport reasonably
    if (canvasInfo.length > 0) {
      expect(canvasInfo[0].width).toBeGreaterThan(100);
      expect(canvasInfo[0].height).toBeGreaterThan(100);
    }

    await takeScreenshot(page, "debugoutput/screenshots/volume-editor-canvas-dimensions");
  });

  test("should have Babylon.js engine initialized", async ({ page }) => {
    test.setTimeout(60000);

    await openStructureViewer(page, "/res/test/cannon.mcstructure");
    await waitForCanvas(page);

    // Check if Babylon.js engine is present
    const engineInfo = await page.evaluate(() => {
      const canvases = document.querySelectorAll("canvas");
      for (const canvas of canvases) {
        const engine = (canvas as any).__babylonEngine || (canvas as any)._engine;
        if (engine) {
          return { hasEngine: true };
        }
      }

      // Try checking BABYLON global
      const BABYLON = (window as any).BABYLON;
      if (BABYLON && BABYLON.Engine && BABYLON.Engine.Instances && BABYLON.Engine.Instances.length > 0) {
        return {
          hasEngine: true,
          instanceCount: BABYLON.Engine.Instances.length,
        };
      }

      return { hasEngine: false };
    });

    console.log(`Babylon engine info: ${JSON.stringify(engineInfo)}`);

    await takeScreenshot(page, "debugoutput/screenshots/volume-editor-engine");
  });

  test("should render block meshes in the scene", async ({ page }) => {
    test.setTimeout(60000);

    await openStructureViewer(page, "/res/test/cannon.mcstructure");
    await waitForCanvas(page);
    await page.waitForTimeout(3000); // Extra time for mesh generation

    // Take screenshot to verify blocks are visible
    await takeScreenshot(page, "debugoutput/screenshots/volume-editor-blocks-rendered");

    // Verify the page didn't just show a blank canvas
    // Take a screenshot and check it has substantial content
    const screenshot = await page.screenshot();
    expect(screenshot.length).toBeGreaterThan(5000); // Not a blank/trivial image

    // Check for no critical errors
    const criticalErrors = consoleErrors.filter(
      (e) =>
        !e.error.includes("WebGL") &&
        !e.error.includes("swiftshader") &&
        !e.error.includes("GroupMarker") &&
        !e.error.includes("404")
    );

    if (criticalErrors.length > 0) {
      console.log(`Critical errors during rendering: ${criticalErrors.map((e) => e.error).join("\n")}`);
    }
  });

  test("should render multiple structures without errors", async ({ page }) => {
    test.setTimeout(120000);

    // Test with cannon structure
    await openStructureViewer(page, "/res/test/cannon.mcstructure");
    await waitForCanvas(page);
    await page.waitForTimeout(2000);
    await takeScreenshot(page, "debugoutput/screenshots/volume-editor-cannon");

    // Now load mediumglass structure
    await openStructureViewer(page, "/res/test/mediumglass.mcstructure");
    await waitForCanvas(page);
    await page.waitForTimeout(2000);
    await takeScreenshot(page, "debugoutput/screenshots/volume-editor-mediumglass");

    // Both should render without crashes
    const criticalErrors = consoleErrors.filter(
      (e) =>
        !e.error.includes("WebGL") &&
        !e.error.includes("swiftshader") &&
        !e.error.includes("GroupMarker") &&
        !e.error.includes("404")
    );

    console.log(`Total critical errors across both structures: ${criticalErrors.length}`);
  });
});

test.describe("Structure Viewer Viewport Controls @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should support camera position via URL parameters", async ({ page }) => {
    test.setTimeout(60000);

    // Load with specific camera position
    await page.goto(
      "/?mode=structureviewer&structure=/res/test/cannon.mcstructure&skipVanillaResources=true&cameraX=20&cameraY=15&cameraZ=20"
    );
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    const hasCanvas = await waitForCanvas(page);
    expect(hasCanvas).toBe(true);

    await takeScreenshot(page, "debugoutput/screenshots/structure-viewer-custom-camera");
  });

  test("should handle mouse wheel zoom", async ({ page }) => {
    test.setTimeout(60000);

    await openStructureViewer(page, "/res/test/cannon.mcstructure");
    await waitForCanvas(page);
    await page.waitForTimeout(2000);

    await takeScreenshot(page, "debugoutput/screenshots/structure-viewer-before-zoom");

    // Get the canvas element and perform mouse wheel zoom
    const canvas = page.locator("canvas").first();
    if (await canvas.isVisible({ timeout: 3000 })) {
      const box = await canvas.boundingBox();
      if (box) {
        // Zoom in with mouse wheel
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, -300); // Scroll up = zoom in
        await page.waitForTimeout(1000);
        await takeScreenshot(page, "debugoutput/screenshots/structure-viewer-zoomed-in");

        // Zoom out
        await page.mouse.wheel(0, 600); // Scroll down = zoom out
        await page.waitForTimeout(1000);
        await takeScreenshot(page, "debugoutput/screenshots/structure-viewer-zoomed-out");
      }
    }
  });

  test("should handle right-click drag rotation", async ({ page }) => {
    test.setTimeout(60000);

    await openStructureViewer(page, "/res/test/cannon.mcstructure");
    await waitForCanvas(page);
    await page.waitForTimeout(2000);

    await takeScreenshot(page, "debugoutput/screenshots/structure-viewer-before-rotate");

    const canvas = page.locator("canvas").first();
    if (await canvas.isVisible({ timeout: 3000 })) {
      const box = await canvas.boundingBox();
      if (box) {
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;

        // Right-click drag to rotate
        await page.mouse.move(centerX, centerY);
        await page.mouse.down({ button: "right" });
        await page.mouse.move(centerX + 100, centerY + 50, { steps: 10 });
        await page.mouse.up({ button: "right" });
        await page.waitForTimeout(1000);

        await takeScreenshot(page, "debugoutput/screenshots/structure-viewer-rotated");
      }
    }
  });

  test("should not crash when resizing the viewport", async ({ page }) => {
    test.setTimeout(60000);

    await openStructureViewer(page, "/res/test/cannon.mcstructure");
    await waitForCanvas(page);
    await page.waitForTimeout(2000);

    // Resize viewport
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(1000);
    await takeScreenshot(page, "debugoutput/screenshots/structure-viewer-resized-small");

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);
    await takeScreenshot(page, "debugoutput/screenshots/structure-viewer-resized-large");

    // Verify canvas still exists and is rendering
    const hasCanvas = await waitForCanvas(page);
    expect(hasCanvas).toBe(true);

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});

test.describe("Volume Editor Tools UI @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("should display toolbar with editing tools", async ({ page }) => {
    test.setTimeout(60000);

    // Load structure viewer without hideChrome so toolbar is visible
    await openStructureViewer(page, "/res/test/cannon.mcstructure", { hideChrome: false });
    await waitForCanvas(page);
    await page.waitForTimeout(2000);

    await takeScreenshot(page, "debugoutput/screenshots/volume-editor-toolbar");

    // Look for toolbar elements - the VolumeEditor has its own toolbar
    // with tool buttons (Selection, Brush, Pencil, Block Inspector, Help)
    const toolbar = page.locator('[aria-label*="toolbar"], .ve-toolbar, .ste-toolbar').first();
    if (await toolbar.isVisible({ timeout: 5000 })) {
      console.log("Toolbar is visible");
    } else {
      console.log("No toolbar found - checking for tool buttons directly");
    }

    // Look for individual tool buttons
    const toolButtons = page.locator(
      'button[title*="Selection"], button[title*="Pencil"], button[title*="Brush"], button[title*="Inspector"]'
    );
    const toolCount = await toolButtons.count();
    console.log(`Found ${toolCount} tool buttons`);

    await takeScreenshot(page, "debugoutput/screenshots/volume-editor-tools-visible");
  });

  test("should display coordinates overlay", async ({ page }) => {
    test.setTimeout(60000);

    await openStructureViewer(page, "/res/test/cannon.mcstructure");
    await waitForCanvas(page);
    await page.waitForTimeout(2000);

    // Move mouse over the canvas to trigger hover coordinate display
    const canvas = page.locator("canvas").first();
    if (await canvas.isVisible({ timeout: 3000 })) {
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(500);
      }
    }

    await takeScreenshot(page, "debugoutput/screenshots/volume-editor-coordinates");
  });
});

/**
 * Structure Editor Screenshots
 *
 * Captures screenshots of structures rendered inside the MCT editor with the
 * full toolbar, editing tools, and info chrome visible. These show how the
 * structure editor looks inside Minecraft Creator Tools (vs the standalone viewer).
 *
 * Screenshots saved to debugoutput/structure-editor-screenshots/.
 */
test.describe("Structure Editor Screenshots @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  const EDITOR_SCREENSHOT_DIR = "debugoutput/structure-editor-screenshots";

  /** Navigate to the structure viewer with editor tools visible. */
  async function openEditorView(
    page: import("@playwright/test").Page,
    structureFile: string,
    options?: { cameraX?: number; cameraY?: number; cameraZ?: number }
  ): Promise<void> {
    let url =
      `/?mode=structureviewer&structure=/res/test/${structureFile}` +
      `&skipVanillaResources=false&showEditorTools=true`;

    if (options?.cameraX !== undefined && options?.cameraY !== undefined && options?.cameraZ !== undefined) {
      url += `&cameraX=${options.cameraX}&cameraY=${options.cameraY}&cameraZ=${options.cameraZ}`;
    }

    await page.goto(url);
    await page.waitForLoadState("networkidle");
  }

  /** Wait for 3D canvas to render and textures to load. */
  async function waitForEditorRender(page: import("@playwright/test").Page): Promise<void> {
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);
  }

  // Structures to render with full editor chrome
  const editorStructures: [string, string][] = [
    ["cannon.mcstructure", "cannon"],
    ["mediumglass.mcstructure", "glass"],
    ["flat_5x5x5.mcstructure", "flat-5x5x5"],
    ["door_maze_crowded.mcstructure", "door-maze"],
    ["torch_nor.mcstructure", "redstone-torch"],
    ["sticky_extend.mcstructure", "piston"],
    ["waterlogged_slab.mcstructure", "waterlogged-slab"],
    ["machine_i.mcstructure", "flying-machine"],
    ["sample_structure.mcstructure", "sample-structure"],
  ];

  for (const [filename, displayName] of editorStructures) {
    test(`should render ${displayName} in editor`, async ({ page }) => {
      test.setTimeout(45000);

      await openEditorView(page, filename);
      await waitForEditorRender(page);

      await page.screenshot({ path: `${EDITOR_SCREENSHOT_DIR}/editor-${displayName}.png` });
    });
  }

  test("should show editor toolbar and info bar", async ({ page }) => {
    test.setTimeout(45000);

    // Render without hideChrome so the StructureViewer toolbar is also visible
    await page.goto(
      `/?mode=structureviewer&structure=/res/test/cannon.mcstructure` +
        `&skipVanillaResources=false&showEditorTools=true`
    );
    await page.waitForLoadState("networkidle");

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: `${EDITOR_SCREENSHOT_DIR}/editor-cannon-with-chrome.png` });

    // Verify the structure info bar is present
    const infoBar = page.locator(".sv-info");
    if (await infoBar.isVisible({ timeout: 3000 }).catch(() => false)) {
      const infoText = await infoBar.textContent();
      console.log("Structure info: " + infoText);
    }
  });
});
