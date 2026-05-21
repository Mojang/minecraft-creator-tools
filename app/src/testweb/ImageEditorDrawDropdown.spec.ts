/**
 * ImageEditorDrawDropdown.spec.ts
 *
 * Regression test for the Image Editor "Draw" tool-picker dropdown.
 *
 * Bug: opening the Draw dropdown in the Image Editor showed the currently
 * selected tool (e.g. "Pencil") as a near-solid green row — the icon and
 * label were nearly indistinguishable from the green background, so users
 * could not tell which tool was active without picking a different one.
 *
 * Root cause was in `CustomSelectableDropdownLabel` (in
 * UX/shared/components/feedback/labels/Labels.tsx): selected items were
 * styled with white text on bright Minecraft green (#52a535) — about 3.5:1
 * contrast, below WCAG AA — and the thin FontAwesome icon strokes plus an
 * underline made the row look effectively monochrome green.
 *
 * Repro flow this test exercises:
 *   1. Create an Add-On Starter project.
 *   2. Open `pack_icon.png` (an image item shipped with the starter project)
 *      to surface the Image Editor.
 *   3. Click the Draw tool button to open the dropdown.
 *   4. Assert that the currently selected MenuItem has a foreground (text +
 *      icon) that is clearly distinguishable from its background — i.e. a
 *      contrast ratio meeting at least WCAG AA for normal text (>= 4.5:1).
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { enterEditor, enableAllFileTypes, processMessage } from "./WebTestUtilities";

const DIR = "debugoutput/screenshots/image-editor-draw-dropdown";

/**
 * Parse a color in either #rrggbb or rgb()/rgba() form into [r, g, b].
 * Returns null if the value cannot be parsed.
 */
function parseColor(value: string): [number, number, number] | null {
  if (!value) return null;
  const hex = value.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }
  const rgb = value.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    return [parseInt(rgb[1], 10), parseInt(rgb[2], 10), parseInt(rgb[3], 10)];
  }
  return null;
}

/** WCAG 2.x relative luminance. */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG contrast ratio (always >= 1). */
function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

test.describe("Image Editor Draw dropdown @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("selected tool in Draw dropdown is visually distinguishable", async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);

    const ok = await enterEditor(page, { theme: "dark", editMode: "full" });
    test.skip(!ok, "Could not enter editor");

    await enableAllFileTypes(page);
    await page.waitForTimeout(500);

    // Find an image (PNG) item to open. The Add-On Starter project ships
    // pack_icon.png files; in @full mode the sidebar groups them under an
    // "Icons" collapsible section. Some tree implementations don't render
    // child items until the section is expanded, so we try several
    // strategies to surface and open a PNG.
    let imageOpened = false;

    // Helper: try a sequence of expansion strategies, then look for any PNG.
    // The sidebar shows image items by their basename (e.g. "pack_icon") with
    // no extension, so we match on basename patterns OR a literal ".png".
    const pngSelector = "text=/^(pack_icon|.*\\.png)$/i";
    const expandAndOpenPng = async (): Promise<boolean> => {
      // Already-visible PNG?
      const visiblePng = page.locator(pngSelector).first();
      if (await visiblePng.isVisible({ timeout: 1500 }).catch(() => false)) {
        await visiblePng.dblclick();
        await page.waitForTimeout(2000);
        return true;
      }

      // Try expanding any of the likely collapsible parents.
      for (const label of ["Icons", "Textures", "Resource pack manifests"]) {
        const row = page.locator(`text=${label}`).first();
        if (!(await row.isVisible({ timeout: 1000 }).catch(() => false))) continue;
        // Click the row twice (collapse-toggle implementations vary on first click)
        await row.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(300);
        const png = page.locator(pngSelector).first();
        if (await png.isVisible({ timeout: 1500 }).catch(() => false)) {
          await png.dblclick();
          await page.waitForTimeout(2000);
          return true;
        }
        // Try clicking the parent element (often the actual toggle target)
        await row
          .locator("xpath=..")
          .click({ force: true })
          .catch(() => undefined);
        await page.waitForTimeout(300);
        const png2 = page.locator(pngSelector).first();
        if (await png2.isVisible({ timeout: 1500 }).catch(() => false)) {
          await png2.dblclick();
          await page.waitForTimeout(2000);
          return true;
        }
      }
      return false;
    };

    imageOpened = await expandAndOpenPng();

    await page.screenshot({ path: `${DIR}/01-after-attempt-open.png`, fullPage: false });
    expect(imageOpened, "Could not surface any *.png item in the project sidebar to open the Image Editor").toBe(true);

    // Image opens in read-only preview mode. Toggle into edit mode so the
    // ImageEditor toolbar (with the Draw button) renders.
    const editToggle = page.getByRole("button", { name: /edit image/i }).first();
    await expect(editToggle, "ImageManager should show an 'Edit image' toggle button").toBeVisible({
      timeout: 5000,
    });
    await editToggle.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${DIR}/02-edit-mode.png`, fullPage: false });

    // Locate the Draw tool button by its accessible title.
    const drawButton = page.getByRole("button", { name: /^Draw$/ }).first();
    await expect(drawButton, "Draw tool button should be visible in the image editor toolbar").toBeVisible({
      timeout: 5000,
    });
    await drawButton.click();
    await page.waitForTimeout(400);

    await page.screenshot({ path: `${DIR}/03-draw-dropdown-open.png`, fullPage: false });

    // The MUI Menu renders as role=menu with role=menuitem children. The
    // selected item carries the .Mui-selected class.
    const menu = page.locator('[role="menu"]').last();
    await expect(menu).toBeVisible({ timeout: 3000 });

    const selectedItem = menu.locator(".Mui-selected").first();
    await expect(selectedItem, "Draw dropdown should have a currently-selected tool (Pencil by default)").toBeVisible({
      timeout: 3000,
    });

    // Pull the selected item's label text + the foreground (text) color of
    // its inner ".label-text" span, plus the effective background of the
    // menu row. We then compute WCAG contrast and assert legibility.
    const fgColor = await selectedItem.evaluate((row) => {
      const span = row.querySelector(".label-text") ?? row;
      return window.getComputedStyle(span as Element).color;
    });

    const labelText = (await selectedItem.locator(".label-text").first().textContent())?.trim() ?? "";
    expect(labelText.length, "Selected dropdown row should render visible label text").toBeGreaterThan(0);

    // Background may be set on an inner label-dropdown span, on the menu row
    // itself, or inherited — walk up the ancestor chain composing every
    // semi-transparent layer onto the next so we end up with the actual
    // pixel color the user sees behind the text.
    const bgColor = await page.evaluate(() => {
      const row = document.querySelector('[role="menu"] .Mui-selected');
      if (!row) return "rgb(255, 255, 255)";
      const start = (row.querySelector(".label-dropdown") as Element | null) ?? row;
      const parse = (s: string): [number, number, number, number] | null => {
        const m = s.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)/);
        if (!m) return null;
        return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10), m[4] === undefined ? 1 : parseFloat(m[4])];
      };
      const layers: [number, number, number, number][] = [];
      let el: Element | null = start;
      while (el) {
        const bg = window.getComputedStyle(el as Element).backgroundColor;
        const c = parse(bg);
        if (c && c[3] > 0) {
          layers.push(c);
          if (c[3] >= 1) break; // fully opaque — nothing beneath shows through
        }
        el = (el as HTMLElement).parentElement;
      }
      // Default backdrop: white (browser default body bg).
      let r = 255,
        g = 255,
        b = 255;
      // Compose from bottom layer up: each layer paints over what's beneath.
      for (let i = layers.length - 1; i >= 0; i--) {
        const [lr, lg, lb, la] = layers[i];
        r = Math.round(lr * la + r * (1 - la));
        g = Math.round(lg * la + g * (1 - la));
        b = Math.round(lb * la + b * (1 - la));
      }
      return `rgb(${r}, ${g}, ${b})`;
    });

    const fg = parseColor(fgColor);
    const bg = parseColor(bgColor);
    expect(fg, `Could not parse foreground color '${fgColor}'`).not.toBeNull();
    expect(bg, `Could not parse background color '${bgColor}'`).not.toBeNull();

    const ratio = contrastRatio(fg!, bg!);
    console.log(
      `Draw dropdown selected item ('${labelText}'): fg=${fgColor} bg=${bgColor} contrast=${ratio.toFixed(2)}:1`
    );

    expect(
      ratio,
      `Selected Draw dropdown item is not legible: contrast ratio ${ratio.toFixed(2)}:1 ` +
        `(WCAG AA requires >= 4.5:1 for normal text). fg=${fgColor} bg=${bgColor}`
    ).toBeGreaterThanOrEqual(4.5);
  });

  // Regression test: previously the Circle and Triangle shape tools were
  // listed in the Draw dropdown but the pointer handlers in ImageEditor
  // didn't handle their ImageEditsToolType values, so selecting them and
  // dragging on the canvas produced no visible drawing.
  test("Circle and Triangle shape tools actually draw on the canvas", async ({ page }, testInfo) => {
    testInfo.setTimeout(120000);

    const ok = await enterEditor(page, { theme: "dark", editMode: "full" });
    test.skip(!ok, "Could not enter editor");

    await enableAllFileTypes(page);
    await page.waitForTimeout(500);

    // Open a PNG (re-uses the same expansion strategy as the dropdown test).
    const pngSelector = "text=/^(pack_icon|.*\\.png)$/i";
    const openPng = async (): Promise<boolean> => {
      const visiblePng = page.locator(pngSelector).first();
      if (await visiblePng.isVisible({ timeout: 1500 }).catch(() => false)) {
        await visiblePng.dblclick();
        await page.waitForTimeout(2000);
        return true;
      }
      for (const label of ["Icons", "Textures", "Resource pack manifests"]) {
        const row = page.locator(`text=${label}`).first();
        if (!(await row.isVisible({ timeout: 1000 }).catch(() => false))) continue;
        await row.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(300);
        const png = page.locator(pngSelector).first();
        if (await png.isVisible({ timeout: 1500 }).catch(() => false)) {
          await png.dblclick();
          await page.waitForTimeout(2000);
          return true;
        }
        await row
          .locator("xpath=..")
          .click({ force: true })
          .catch(() => undefined);
        await page.waitForTimeout(300);
        const png2 = page.locator(pngSelector).first();
        if (await png2.isVisible({ timeout: 1500 }).catch(() => false)) {
          await png2.dblclick();
          await page.waitForTimeout(2000);
          return true;
        }
      }
      return false;
    };

    expect(await openPng(), "Could not surface any PNG to open the Image Editor").toBe(true);

    // Toggle into edit mode.
    await page
      .getByRole("button", { name: /edit image/i })
      .first()
      .click();
    await page.waitForTimeout(1000);

    const canvas = page.locator("canvas.ie-image").first();
    await expect(canvas, "ImageEditor canvas should be visible").toBeVisible({ timeout: 5000 });

    // Default draw color is #000000 and the canvas background is also
    // black — drawing black on black would leave the pixel hash unchanged
    // and produce a false negative. Set bright red via the color input.
    // React's synthetic-event system tracks input values internally; setting
    // `.value` directly bypasses its change detection, so we have to use the
    // prototype setter + dispatch the input/change events that React listens
    // for via root-level delegation.
    const colorInput = page.locator('input[type="color"]').first();
    await expect(colorInput, "ImageEditor should expose a color input").toBeVisible({ timeout: 3000 });
    // Playwright's fill() on a color input dispatches a real change event
    // through the browser, which React's synthetic event system picks up
    // and routes to our onChange handler. Manually dispatching synthetic
    // Events via the HTMLInputElement prototype setter trick does NOT
    // trigger React's onChange for color inputs in headless Chromium, so
    // the visible color swatch stays black and we end up drawing
    // black-on-black (invisible) pixels.
    await colorInput.fill("#ff0000");
    await page.waitForTimeout(200);
    const liveColor = await colorInput.evaluate((el: HTMLInputElement) => el.value.toLowerCase());
    expect(liveColor, "Color input should have updated to #ff0000").toBe("#ff0000");

    // Helper: open Draw dropdown and pick a tool by accessible name.
    const selectDrawTool = async (toolName: RegExp) => {
      await page
        .getByRole("button", { name: /^Draw$/ })
        .first()
        .click();
      await page.waitForTimeout(300);
      const menu = page.locator('[role="menu"]').last();
      await expect(menu).toBeVisible({ timeout: 3000 });
      await menu.getByRole("menuitem", { name: toolName }).first().click();
      await page.waitForTimeout(300);
    };

    // Helper: count red-ish pixels (R high, G/B low) — we draw with #ff0000,
    // and the canvas background is solid black, so any red pixel is unambiguously
    // from our triangle/circle draw. Also returns a coarse fingerprint of the
    // full canvas so we can log changes.
    const canvasRedPixels = async (): Promise<{
      red: number;
      nonBlack: number;
      total: number;
      w: number;
      h: number;
      bbox: { x: number; y: number; w: number; h: number } | null;
    }> => {
      const bbox = await canvas.boundingBox();
      return await page.evaluate((info) => {
        const c = document.querySelector("canvas.ie-image") as HTMLCanvasElement | null;
        if (!c) return { red: -1, nonBlack: 0, total: 0, w: 0, h: 0, bbox: info };
        const ctx = c.getContext("2d");
        if (!ctx) return { red: -1, nonBlack: 0, total: 0, w: 0, h: 0, bbox: info };
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        let red = 0;
        let nonBlack = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i],
            g = data[i + 1],
            b = data[i + 2];
          if (r > 200 && g < 80 && b < 80) red++;
          if (r > 5 || g > 5 || b > 5) nonBlack++;
        }
        return { red, nonBlack, total: data.length / 4, w: c.width, h: c.height, bbox: info };
      }, bbox);
    };

    // Helper: drag from one fractional point on the canvas to another.
    // The canvas wires its handlers via `canvas.onmousedown = ...` (direct
    // property assignment, not React's event-delegation) so we dispatch
    // native MouseEvents directly to the canvas element. Going through
    // page.mouse.* worked in some configurations but in headless full mode
    // the events occasionally landed on a wrapping container instead.
    const dragOnCanvas = async (from: { fx: number; fy: number }, to: { fx: number; fy: number }) => {
      // Fire mousedown, mousemove, mouseup as SEPARATE Playwright evaluate
      // calls so React has a chance to commit the `setState({isDrawing:true})`
      // from mousedown before mousemove reads `this.state.isDrawing`. When
      // all three events are fired inside a single synchronous evaluate
      // block, React batches and `isDrawing` is still false during the
      // mousemoves, so the drawingItem coordinates never get updated and
      // mouseup sees isDrawing=false and skips addNewDrawingItem entirely.
      const point = async (fx: number, fy: number) =>
        await canvas.evaluate(
          (c: HTMLCanvasElement, f: { fx: number; fy: number }) => {
            const r = c.getBoundingClientRect();
            return { x: r.left + r.width * f.fx, y: r.top + r.height * f.fy };
          },
          { fx, fy }
        );
      const fireOn = async (type: string, x: number, y: number) =>
        await canvas.evaluate(
          (c: HTMLCanvasElement, args: { type: string; x: number; y: number }) => {
            c.dispatchEvent(
              new MouseEvent(args.type, {
                bubbles: true,
                cancelable: true,
                clientX: args.x,
                clientY: args.y,
                button: 0,
              })
            );
          },
          { type, x, y }
        );
      const start = await point(from.fx, from.fy);
      const end = await point(to.fx, to.fy);
      await fireOn("mousedown", start.x, start.y);
      await page.waitForTimeout(40);
      const steps = 6;
      for (let i = 1; i <= steps; i++) {
        await fireOn("mousemove", start.x + ((end.x - start.x) * i) / steps, start.y + ((end.y - start.y) * i) / steps);
        await page.waitForTimeout(20);
      }
      await fireOn("mouseup", end.x, end.y);
      await page.waitForTimeout(400);
    };

    // Baseline: no red pixels (we set the color to #ff0000 but haven't drawn yet).
    const baseStats = await canvasRedPixels();
    console.log(
      `Canvas baseline: w=${baseStats.w} h=${baseStats.h} totalPx=${baseStats.total} redPx=${baseStats.red} nonBlackPx=${baseStats.nonBlack} bbox=${JSON.stringify(baseStats.bbox)}`
    );
    expect(baseStats.w, "Canvas should have non-zero width").toBeGreaterThan(0);

    // --- Triangle (Solid) ---
    // The canvas is rendered at 8x logical scale (256x256 image = 2048x2048
    // canvas), so only the top-left portion is in the viewport. Stay well
    // inside the first ~100 CSS pixels of the canvas so the drag lands on a
    // visible region that's also within the source image's logical bounds.
    await selectDrawTool(/^Triangle \(Solid\)$/);
    await dragOnCanvas({ fx: 0.02, fy: 0.02 }, { fx: 0.04, fy: 0.04 });
    await page.screenshot({ path: `${DIR}/04-after-triangle.png`, fullPage: false });
    const afterTriangle = await canvasRedPixels();
    console.log(
      `Triangle draw: redPx before=${baseStats.red} after=${afterTriangle.red} nonBlackPx before=${baseStats.nonBlack} after=${afterTriangle.nonBlack}`
    );
    expect(
      afterTriangle.red,
      `Drawing a solid red triangle should produce red pixels on the canvas (got ${afterTriangle.red}). ` +
        `If 0, the triangle tool is a no-op.`
    ).toBeGreaterThan(baseStats.red);

    // --- Circle (Solid) ---
    await selectDrawTool(/^Circle \(Solid\)$/);
    await dragOnCanvas({ fx: 0.005, fy: 0.005 }, { fx: 0.018, fy: 0.018 });
    await page.screenshot({ path: `${DIR}/05-after-circle.png`, fullPage: false });
    const afterCircle = await canvasRedPixels();
    console.log(`Circle draw: redPx before=${afterTriangle.red} after=${afterCircle.red}`);
    expect(
      afterCircle.red,
      `Drawing a solid red circle should add more red pixels (before=${afterTriangle.red}, after=${afterCircle.red}). ` +
        `If equal, the circle tool is a no-op.`
    ).toBeGreaterThan(afterTriangle.red);
  });
});
