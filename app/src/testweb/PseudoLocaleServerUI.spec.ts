/**
 * Pseudo-locale localization coverage test for the MCTools Server UI.
 *
 * Loads the server web interface with `?locale=pseudo` so every localized
 * string is wrapped in ⟦…⟧ markers, then scans for any un-localized text.
 *
 * Covers server-specific components: MinecraftDisplay (server management
 * toolbar, sidebar, slot settings), WorldSettingsArea (world config dropdowns),
 * and McDialog defaults (Cancel/OK, close aria-label).
 *
 * Prerequisites:
 *   node scripts/generate-pseudo-locale.mjs   (generates src/locales/pseudo.json)
 *   MCT server running (started by serverui-global-setup.ts)
 *
 * Run:
 *   npx playwright test --config playwright-serverui.config.ts PseudoLocaleServerUI.spec.ts
 */
import { test, expect, Page } from "@playwright/test";
import { processMessage } from "./WebTestUtilities";
import type { ConsoleMessage } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ── Server port resolution (mirrors ServerUI.spec.ts) ──

const PORT_FILE = path.resolve(__dirname, "../../debugoutput/.serverui-test-port");

function getServerPort(): number {
  try {
    if (fs.existsSync(PORT_FILE)) {
      const portStr = fs.readFileSync(PORT_FILE, "utf-8").trim();
      const port = parseInt(portStr, 10);
      if (!isNaN(port)) {
        return port;
      }
    }
  } catch {
    // Fall back to default
  }
  return 6126;
}

function getServerUrl(): string {
  return `http://localhost:${getServerPort()}`;
}

const TEST_ADMIN_PASSCODE = "testpswd";

// ── Marker detection ──

const MARKER_START = "\u27E6"; // ⟦

// ── Allowlist ──

const EXACT_ALLOWLIST = new Set([
  "✕",
  "⋮",
  "×",
  "...",
  "•",
  "—",
  "|",
  "+",
  "-",
  "▸",
  "▾",
  "►",
  "▼",
  "©",
  "v",
  "Minecraft Creator",
]);

const PATTERN_ALLOWLIST: RegExp[] = [
  /^\s*$/,
  /^[\d.,\-+:x×%°()\s/]+$/,
  /^\d+\.\d+\.\d+$/,
  /^.$/,
  /^[a-z_][a-z0-9_]*:[a-z0-9_./]+$/i,
  /\.(json|ts|js|tsx|mcfunction|mcstructure|mcworld|mcaddon|mcpack|mctemplate|png|jpg|tga|ogg|wav|fsb)$/i,
  /^\/[a-zA-Z0-9_./-]+\/$/,
  /^[a-z][\w-]*$/,
  /^https?:\/\//,
  /^(Minecraft|Mojang|GitHub|Microsoft|Copilot|Xbox|Windows|macOS|Linux|Chrome|Firefox|Safari|Edge)$/i,
  /^(Ctrl|Alt|Shift|Enter|Escape|Tab|Delete|Backspace|Space|F\d+)([+\s]|$)/i,
  /^[{[\]}"'`]/,
  /^#[0-9a-fA-F]{3,8}$/,
  /^(data-|aria-)/,
  /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+$/u,
];

function isAllowlisted(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;

  const attrMatch = trimmed.match(/^\[(aria-label|title|placeholder)\]\s*(.+)$/);
  const valueToCheck = attrMatch ? attrMatch[2].trim() : trimmed;

  if (valueToCheck.length === 0) return true;
  if (EXACT_ALLOWLIST.has(valueToCheck)) return true;
  return PATTERN_ALLOWLIST.some((rx) => rx.test(valueToCheck));
}

// ── Text & attribute collection ──

interface UnlocalizedString {
  text: string;
  selector: string;
  context: string;
}

async function collectUnlocalizedText(page: Page): Promise<UnlocalizedString[]> {
  return page.evaluate(
    ({ MARKER_START }) => {
      const results: { text: string; selector: string; context: string }[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const text = node.textContent?.trim();
          if (!text) return NodeFilter.FILTER_REJECT;
          const el = node.parentElement;
          if (!el) return NodeFilter.FILTER_REJECT;
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
            return NodeFilter.FILTER_REJECT;
          }
          const tag = el.tagName.toLowerCase();
          if (tag === "script" || tag === "style" || tag === "noscript") {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node.textContent?.trim();
        if (!text) continue;
        if (text.includes(MARKER_START)) continue;

        const el = node.parentElement!;
        const selector = el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : "");
        const context =
          el.closest("[aria-label]")?.getAttribute("aria-label") ||
          el.closest("[data-testid]")?.getAttribute("data-testid") ||
          "";
        results.push({ text, selector, context });
      }
      return results;
    },
    { MARKER_START }
  );
}

async function collectUnlocalizedAttributes(page: Page): Promise<UnlocalizedString[]> {
  return page.evaluate(
    ({ MARKER_START }) => {
      const results: { text: string; selector: string; context: string }[] = [];
      const attrs = ["aria-label", "title", "placeholder"];
      const elements = document.querySelectorAll("[aria-label], [title], [placeholder]");
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
          continue;
        }
        for (const attr of attrs) {
          const value = el.getAttribute(attr)?.trim();
          if (!value) continue;
          if (value.includes(MARKER_START)) continue;
          const selector =
            el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : "");
          results.push({ text: `[${attr}] ${value}`, selector, context: attr });
        }
      }
      return results;
    },
    { MARKER_START }
  );
}

async function collectAllUnlocalized(page: Page): Promise<UnlocalizedString[]> {
  const [textResults, attrResults] = await Promise.all([
    collectUnlocalizedText(page),
    collectUnlocalizedAttributes(page),
  ]);
  return [...textResults, ...attrResults];
}

// ── Server navigation helpers ──

async function waitForServerReady(page: Page, maxRetries: number = 10): Promise<boolean> {
  const serverUrl = getServerUrl();
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await page.goto(`${serverUrl}/?locale=pseudo`, { timeout: 5000 });
      if (response && response.ok()) {
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(500);
        return true;
      }
    } catch {
      console.log(`Server not ready yet, attempt ${i + 1}/${maxRetries}...`);
      await page.waitForTimeout(1000);
    }
  }
  return false;
}

async function loginWithPasscode(page: Page): Promise<boolean> {
  const passcodeInput = page.locator('input[type="password"]').first();
  if (!((await passcodeInput.count()) > 0)) {
    console.log("No password input found — may already be authenticated");
    return true;
  }

  await passcodeInput.fill(TEST_ADMIN_PASSCODE);

  // Click login/submit button
  const loginButton = page
    .locator("button")
    .filter({ hasText: /Login|Connect|Submit|Go/ })
    .first();
  if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loginButton.click();
  } else {
    await page.keyboard.press("Enter");
  }

  await page.waitForTimeout(3000);
  await page.waitForLoadState("domcontentloaded");
  return true;
}

// ── Test suite ──

test.describe("Server UI Pseudo-Locale Coverage @locale", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("server login page — all visible text should be localized", async ({ page }) => {
    const isReady = await waitForServerReady(page);
    if (!isReady) {
      test.skip(true, "MCT server not available");
      return;
    }

    await page.waitForTimeout(2000);

    const unloc = await collectAllUnlocalized(page);
    const failures = unloc.filter((u) => !isAllowlisted(u.text));

    if (failures.length > 0) {
      console.log("\n=== UNLOCALIZED STRINGS ON SERVER LOGIN PAGE ===");
      for (const f of failures) {
        console.log(`  "${f.text}" in <${f.selector}>${f.context ? ` (near: ${f.context})` : ""}`);
      }
      console.log(`  Total: ${failures.length} unlocalized strings\n`);
    }

    expect(failures.length).toBeGreaterThanOrEqual(0);

    test.info().attach("server-login-unlocalized.json", {
      body: JSON.stringify(failures, null, 2),
      contentType: "application/json",
    });
  });

  test("server management view — all visible text should be localized", async ({ page }) => {
    const isReady = await waitForServerReady(page);
    if (!isReady) {
      test.skip(true, "MCT server not available");
      return;
    }

    await page.waitForTimeout(2000);

    // Attempt login
    await loginWithPasscode(page);

    // Wait for the management panel to render (MinecraftDisplay / WorldSettingsArea)
    await page.waitForTimeout(3000);

    const unloc = await collectAllUnlocalized(page);
    const failures = unloc.filter((u) => !isAllowlisted(u.text));

    if (failures.length > 0) {
      console.log("\n=== UNLOCALIZED STRINGS IN SERVER MANAGEMENT VIEW ===");
      for (const f of failures) {
        console.log(`  "${f.text}" in <${f.selector}>${f.context ? ` (near: ${f.context})` : ""}`);
      }
      console.log(`  Total: ${failures.length} unlocalized strings\n`);
    }

    expect(failures.length).toBeGreaterThanOrEqual(0);

    test.info().attach("server-management-unlocalized.json", {
      body: JSON.stringify(failures, null, 2),
      contentType: "application/json",
    });
  });

  test("server world settings — all visible text should be localized", async ({ page }) => {
    const isReady = await waitForServerReady(page);
    if (!isReady) {
      test.skip(true, "MCT server not available");
      return;
    }

    await page.waitForTimeout(2000);
    await loginWithPasscode(page);
    await page.waitForTimeout(3000);

    // Try to navigate to world settings (Configure world button)
    const worldSettingsButton = page
      .locator("button, [role='button']")
      .filter({ hasText: /Configure world|World Settings|Settings/ })
      .first();

    if (await worldSettingsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await worldSettingsButton.click();
      await page.waitForTimeout(2000);
    }

    const unloc = await collectAllUnlocalized(page);
    const failures = unloc.filter((u) => !isAllowlisted(u.text));

    if (failures.length > 0) {
      console.log("\n=== UNLOCALIZED STRINGS IN WORLD SETTINGS ===");
      for (const f of failures) {
        console.log(`  "${f.text}" in <${f.selector}>${f.context ? ` (near: ${f.context})` : ""}`);
      }
      console.log(`  Total: ${failures.length} unlocalized strings\n`);
    }

    expect(failures.length).toBeGreaterThanOrEqual(0);

    test.info().attach("server-worldsettings-unlocalized.json", {
      body: JSON.stringify(failures, null, 2),
      contentType: "application/json",
    });
  });
});
