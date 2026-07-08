/**
 * In Windows High Contrast (forced-colors) mode the selected entity-editor tab
 * must (a) stay distinguishable from the unselected tabs and (b) keep its label
 * readable. The selected state is otherwise conveyed only with author colors (a
 * tinted background, a green underline, an inset shadow), all of which
 * forced-colors strips (MAS 4.3.1).
 *
 * The fix re-asserts the selected state with the system Highlight pairing. It also
 * gives the label-text span an opaque Highlight surface: a transparent text span
 * lets the forced-colors UA paint a Canvas (white) backplate behind the white
 * HighlightText, rendering the label white-on-white. Because `getComputedStyle`
 * resolves system-color keywords, these tests probe the emulated Highlight value
 * and the label-text background.
 *
 * Run (from app/): npx playwright test EditorTabHighContrastSelection.spec.ts --project=chromium
 */

import { test, expect, Page } from "@playwright/test";

/** Walk the "Make a Mob" wizard until the entity editor (with its tab bar) opens. */
async function makeMobAndOpenEditor(page: Page) {
  await page.goto("/", { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await page.getByRole("heading", { name: "Make a Mob" }).click();
  await page.waitForTimeout(1500);

  const tab = page.locator(".editor-header-tabs-container .label-tab").first();
  for (let i = 0; i < 10; i++) {
    if (await tab.isVisible().catch(() => false)) break;
    const next = page.getByRole("button", { name: "Next" }).first();
    if ((await next.isVisible({ timeout: 1500 }).catch(() => false)) && (await next.isEnabled().catch(() => false))) {
      await next.click();
    } else {
      const finish = page.getByRole("button", { name: /^(Create|Create Project|Finish|Done)$/i }).first();
      if (await finish.isVisible({ timeout: 1500 }).catch(() => false)) await finish.click();
    }
    await page.waitForTimeout(2000);
  }
  await expect(tab).toBeVisible({ timeout: 30000 });
}

test.describe("Entity editor selected tab survives high contrast", () => {
  test("selected tab uses a system Highlight cue in forced-colors mode", async ({ page }) => {
    test.setTimeout(120000);

    await makeMobAndOpenEditor(page);

    await page.emulateMedia({ forcedColors: "active", colorScheme: "dark" });
    await page.waitForTimeout(600);

    const result = await page.evaluate(() => {
      // Resolve the emulated system Highlight color via a probe element.
      const probe = document.createElement("div");
      probe.style.backgroundColor = "Highlight";
      document.body.appendChild(probe);
      const highlight = getComputedStyle(probe).backgroundColor;
      probe.remove();

      const sel = document.querySelector(".editor-header-tabs-container .label-tab");
      const desel = document.querySelector(".editor-header-tabs-container .label-deseltab");
      return {
        highlight,
        selBg: sel ? getComputedStyle(sel).backgroundColor : null,
        deselBg: desel ? getComputedStyle(desel).backgroundColor : null,
      };
    });

    expect(result.selBg, "selected tab must use the system Highlight background in forced-colors").toBe(
      result.highlight
    );
    expect(result.deselBg, "unselected tabs must not use Highlight").not.toBe(result.highlight);
  });

  test("selected tab label text stays readable in forced-colors mode", async ({ page }) => {
    test.setTimeout(120000);

    await makeMobAndOpenEditor(page);

    await page.emulateMedia({ forcedColors: "active", colorScheme: "dark" });
    await page.waitForTimeout(600);

    const result = await page.evaluate(() => {
      const text = document.querySelector(".editor-header-tabs-container .label-tab .label-text") as HTMLElement | null;
      if (!text) return null;
      const cs = getComputedStyle(text);
      const parse = (c: string) => {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(",").map((x) => parseFloat(x.trim()));
        return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
      };
      return { colorParsed: parse(cs.color), bgParsed: parse(cs.backgroundColor) };
    });

    expect(result, "selected tab should have a label-text span").not.toBeNull();
    // The label text must sit on an OPAQUE surface. With a transparent background the
    // forced-colors UA paints a Canvas (white) backplate behind the HighlightText
    // (white) text, rendering the label white-on-white and unreadable.
    expect(result!.bgParsed, "label text must have a resolvable background").not.toBeNull();
    expect(result!.bgParsed!.a, "selected tab text needs an opaque background in forced-colors").toBe(1);
    // ...and that surface must differ from the text color so the label is legible.
    expect(
      `${result!.bgParsed!.r},${result!.bgParsed!.g},${result!.bgParsed!.b}`,
      "selected tab text color must differ from its background"
    ).not.toBe(`${result!.colorParsed!.r},${result!.colorParsed!.g},${result!.colorParsed!.b}`);
  });
});
