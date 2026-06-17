import { test, expect } from "@playwright/test";

const SHOT_DIR = "debugoutput/screenshots/adhoc";

test.describe("RC Adhoc Quality Checks @focused", () => {
  test("home: capture Docs and footer hrefs @focused", async ({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        console.log(`[console.${msg.type()}]`, msg.text());
      }
    });
    page.on("pageerror", (err) => console.log(`[pageerror]`, err.message));

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    const links = await page.$$eval("a", (as) =>
      as.map((a) => ({
        text: (a.textContent || "").trim(),
        href: a.getAttribute("href"),
        target: a.getAttribute("target"),
      }))
    );
    console.log("ALL_HOME_LINKS:", JSON.stringify(links, null, 2));

    await page.screenshot({ path: `${SHOT_DIR}/home-baseline.png`, fullPage: false });
  });

  test("docs route loads with no 404 @focused", async ({ page }) => {
    await page.goto("/docs", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOT_DIR}/docs-route-render.png`, fullPage: true });
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("404");
  });

  test("home: click each header link, observe destination @focused", async ({ page, context }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Find docs/cli/github link href values
    const headerLinks = await page.$$eval("header a, [class*=AppHeader] a, [class*=appHeader] a, nav a", (as) =>
      as.map((a) => ({ text: (a.textContent || "").trim(), href: a.getAttribute("href") }))
    );
    console.log("HEADER_LINKS:", JSON.stringify(headerLinks, null, 2));
  });

  test("explore: home keyboard focus tour @focused", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
    }
    await page.screenshot({ path: `${SHOT_DIR}/home-after-8-tabs.png`, fullPage: false });
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      return {
        tag: el.tagName,
        text: (el.textContent || "").trim().slice(0, 80),
        aria: el.getAttribute("aria-label"),
        href: el.getAttribute("href"),
      };
    });
    console.log("FOCUSED_AFTER_8_TABS:", JSON.stringify(focused));
  });

  test("explore: open Settings from header, look for raw text and theme/feature labels @focused", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOT_DIR}/before-settings.png`, fullPage: false });
    const gear = page.locator('[aria-label*="ettings" i], button:has-text("Settings")').first();
    if (await gear.count()) {
      await gear.click({ trial: false }).catch(() => {});
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${SHOT_DIR}/home-settings-open.png`, fullPage: true });
    } else {
      console.log("NO_GEAR_FOUND");
    }
  });

  test("explore: scroll home page and capture full content @focused", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SHOT_DIR}/home-fullpage.png`, fullPage: true });
  });
});
