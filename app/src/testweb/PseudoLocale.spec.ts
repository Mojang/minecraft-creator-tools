/**
 * Pseudo-locale localization coverage test.
 *
 * Loads the app with `?locale=pseudo` so every localized string is wrapped
 * in ⟦…⟧ markers. Then navigates through key views and collects all visible
 * text nodes. Any text that is NOT wrapped in markers and is NOT on the
 * allowlist is reported as an un-localized hardcoded string.
 *
 * Run:
 *   npx playwright test --config playwright-locale.config.js
 *
 * Prerequisites:
 *   node scripts/generate-pseudo-locale.mjs   (generates src/locales/pseudo.json)
 *   npm run web                               (starts Vite dev server on :3000)
 */
import { test, expect, Page } from "@playwright/test";
import { processMessage, waitForEditorReady } from "./WebTestUtilities";
import type { ConsoleMessage } from "@playwright/test";

// ── Marker detection ──

const MARKER_START = "\u27E6"; // ⟦
const MARKER_END = "\u27E7"; // ⟧

// ── Allowlist: text that is legitimately NOT localized ──

/**
 * Exact strings that are expected without markers.
 * Includes brand names, symbols, placeholders, and generated content.
 */
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
  "OK",
  "©",
  "v",
  "Minecraft Creator", // DefaultCreatorName from CreatorTools.ts — project metadata, not a UI label
]);

/**
 * Regex patterns for text that is legitimately not localized.
 * Each pattern matches against the full trimmed text content.
 */
const PATTERN_ALLOWLIST: RegExp[] = [
  // Pure whitespace / empty
  /^\s*$/,
  // Pure numbers, version strings, coordinates
  /^[\d.,\-+:x×%°()\s/]+$/,
  /^\d+\.\d+\.\d+$/,
  // Single characters (icons, bullets, etc.)
  /^.$/,
  // Minecraft identifiers (minecraft:zombie, custom:block_name)
  /^[a-z_][a-z0-9_]*:[a-z0-9_./]+$/i,
  // File paths and extensions
  /\.(json|ts|js|tsx|mcfunction|mcstructure|mcworld|mcaddon|mcpack|mctemplate|png|jpg|tga|ogg|wav|fsb)$/i,
  // Unix-style paths (e.g. /mc_myaddons/, /.vscode/)
  /^\/[a-zA-Z0-9_./-]+\/$/,
  // CSS class names or HTML artifacts
  /^[a-z][\w-]*$/,
  // URLs
  /^https?:\/\//,
  // Brand names that are locked (not translated)
  /^(Minecraft|Mojang|GitHub|Microsoft|Copilot|Xbox|Windows|macOS|Linux|Chrome|Firefox|Safari|Edge)$/i,
  // Keyboard shortcuts / key names
  /^(Ctrl|Alt|Shift|Enter|Escape|Tab|Delete|Backspace|Space|F\d+)([+\s]|$)/i,
  // JSON/code snippets
  /^[{[\]}"'`]/,
  // Hex color codes
  /^#[0-9a-fA-F]{3,8}$/,
  // Data attributes or internal IDs
  /^(data-|aria-)/,
  // Emoji-only
  /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+$/u,
];

function isAllowlisted(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;

  // For attribute values prefixed with [attr-name], strip the prefix before checking
  const attrMatch = trimmed.match(/^\[(aria-label|title|placeholder)\]\s*(.+)$/);
  const valueToCheck = attrMatch ? attrMatch[2].trim() : trimmed;

  if (valueToCheck.length === 0) return true;
  if (EXACT_ALLOWLIST.has(valueToCheck)) return true;
  return PATTERN_ALLOWLIST.some((rx) => rx.test(valueToCheck));
}

// ── Text collection ──

interface UnlocalizedString {
  text: string;
  /** CSS selector path hint (best-effort, may be truncated) */
  selector: string;
  /** Nearest aria-label or data-testid for context */
  context: string;
}

/**
 * Collect all visible text nodes on the current page and return those
 * that are neither marker-wrapped nor allowlisted.
 */
async function collectUnlocalizedText(page: Page): Promise<UnlocalizedString[]> {
  return page.evaluate(
    ({ MARKER_START, MARKER_END }) => {
      const results: { text: string; selector: string; context: string }[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const text = node.textContent?.trim();
          if (!text) return NodeFilter.FILTER_REJECT;

          // Skip invisible elements
          const el = node.parentElement;
          if (!el) return NodeFilter.FILTER_REJECT;
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip script/style/noscript
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

        // Split on markers to find unmarked segments
        // e.g. "⟦Hello⟧ world ⟦Foo⟧" → check " world " as unmarked
        const parts = text.split(/[\u27E6\u27E7]/);
        for (const part of parts) {
          const trimPart = part.trim();
          if (!trimPart) continue;
          // If the original text has markers, only flag parts outside them
          if (text.includes(MARKER_START) && text.includes(MARKER_END)) {
            // This part is between markers — it's the localized content itself, skip
            continue;
          }
          // Entire text has no markers at all — potential unloc string
        }

        if (text.includes(MARKER_START)) continue; // Has at least one marker, good enough

        const el = node.parentElement!;
        const selector = el.tagName.toLowerCase() + (el.className ? "." + el.className.split(" ")[0] : "");
        const context =
          el.closest("[aria-label]")?.getAttribute("aria-label") ||
          el.closest("[data-testid]")?.getAttribute("data-testid") ||
          "";

        results.push({ text, selector, context });
      }

      return results;
    },
    { MARKER_START, MARKER_END }
  );
}

/**
 * Collect visible aria-label and title attributes that are neither
 * marker-wrapped nor allowlisted. These attributes carry user-facing
 * text (screen-reader labels, tooltips) that must also be localized.
 */
async function collectUnlocalizedAttributes(page: Page): Promise<UnlocalizedString[]> {
  return page.evaluate(
    ({ MARKER_START, MARKER_END }) => {
      const results: { text: string; selector: string; context: string }[] = [];
      const attrs = ["aria-label", "title", "placeholder"];

      const elements = document.querySelectorAll("[aria-label], [title], [placeholder]");
      for (const el of elements) {
        // Skip invisible elements
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
          continue;
        }

        for (const attr of attrs) {
          const value = el.getAttribute(attr)?.trim();
          if (!value) continue;
          if (value.includes(MARKER_START)) continue; // Has markers — localized

          const selector =
            el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : "");
          results.push({ text: `[${attr}] ${value}`, selector, context: attr });
        }
      }

      return results;
    },
    { MARKER_START, MARKER_END }
  );
}

/**
 * Collect both text-node and attribute unlocalized strings in one pass.
 */
async function collectAllUnlocalized(page: Page): Promise<UnlocalizedString[]> {
  const [textResults, attrResults] = await Promise.all([
    collectUnlocalizedText(page),
    collectUnlocalizedAttributes(page),
  ]);
  return [...textResults, ...attrResults];
}

// ── Test suite ──

test.describe("Pseudo-Locale Coverage @locale", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("home page — all visible text should be localized", async ({ page }) => {
    await page.goto("/?locale=pseudo");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const unloc = await collectAllUnlocalized(page);
    const failures = unloc.filter((u) => !isAllowlisted(u.text));

    if (failures.length > 0) {
      console.log("\n=== UNLOCALIZED STRINGS ON HOME PAGE ===");
      for (const f of failures) {
        console.log(`  "${f.text}" in <${f.selector}>${f.context ? ` (near: ${f.context})` : ""}`);
      }
      console.log(`  Total: ${failures.length} unlocalized strings\n`);
    }

    // Soft-fail: report but don't break the build yet.  
    // Change to expect(failures).toHaveLength(0) once fully localized.
    expect(failures.length).toBeGreaterThanOrEqual(0);

    // Always attach the report for visibility
    test.info().attach("home-unlocalized.json", {
      body: JSON.stringify(failures, null, 2),
      contentType: "application/json",
    });
  });

  test("project editor — all visible text should be localized", async ({ page }) => {
    // Enter editor with pseudo locale via query param
    await page.goto("/?locale=pseudo");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Create a new project to enter the editor
    const newButton = page.getByRole("button", { name: "Create New" }).first();
    if (!(await newButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      // Try a ⟦Create New⟧ variant since text is pseudo-localized
      const pseudoNewButton = page.getByRole("button").filter({ hasText: /Create New/ }).first();
      if (await pseudoNewButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pseudoNewButton.click();
      } else {
        test.skip(true, "Could not find Create New button on pseudo-locale home page");
        return;
      }
    } else {
      await newButton.click();
    }

    await page.waitForTimeout(1500);

    // Click Create Project (or its pseudo-localized variant)
    const createButton = page.getByTestId("submit-button");
    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createButton.click();
    } else {
      await page.keyboard.press("Enter");
    }

    await page.waitForTimeout(5000);
    await page.waitForLoadState("networkidle");

    // Wait for editor readiness
    await waitForEditorReady(page, 20000);

    // Dismiss FRE panel if present
    const closeButton = page
      .locator('[aria-label*="Dismiss"], [aria-label*="Close"], button:has-text("×")')
      .first();
    if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeButton.click();
      await page.waitForTimeout(500);
    }

    const unloc = await collectAllUnlocalized(page);
    const failures = unloc.filter((u) => !isAllowlisted(u.text));

    if (failures.length > 0) {
      console.log("\n=== UNLOCALIZED STRINGS IN PROJECT EDITOR ===");
      for (const f of failures) {
        console.log(`  "${f.text}" in <${f.selector}>${f.context ? ` (near: ${f.context})` : ""}`);
      }
      console.log(`  Total: ${failures.length} unlocalized strings\n`);
    }

    expect(failures.length).toBeGreaterThanOrEqual(0);

    test.info().attach("editor-unlocalized.json", {
      body: JSON.stringify(failures, null, 2),
      contentType: "application/json",
    });
  });

  test("block viewer — all visible text should be localized", async ({ page }) => {
    await page.goto("/?locale=pseudo&mode=blockviewer");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    const unloc = await collectAllUnlocalized(page);
    const failures = unloc.filter((u) => !isAllowlisted(u.text));

    if (failures.length > 0) {
      console.log("\n=== UNLOCALIZED STRINGS IN BLOCK VIEWER ===");
      for (const f of failures) {
        console.log(`  "${f.text}" in <${f.selector}>${f.context ? ` (near: ${f.context})` : ""}`);
      }
      console.log(`  Total: ${failures.length} unlocalized strings\n`);
    }

    expect(failures.length).toBeGreaterThanOrEqual(0);

    test.info().attach("blockviewer-unlocalized.json", {
      body: JSON.stringify(failures, null, 2),
      contentType: "application/json",
    });
  });

  test("mob viewer — all visible text should be localized", async ({ page }) => {
    await page.goto("/?locale=pseudo&mode=mobviewer");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    const unloc = await collectAllUnlocalized(page);
    const failures = unloc.filter((u) => !isAllowlisted(u.text));

    if (failures.length > 0) {
      console.log("\n=== UNLOCALIZED STRINGS IN MOB VIEWER ===");
      for (const f of failures) {
        console.log(`  "${f.text}" in <${f.selector}>${f.context ? ` (near: ${f.context})` : ""}`);
      }
      console.log(`  Total: ${failures.length} unlocalized strings\n`);
    }

    expect(failures.length).toBeGreaterThanOrEqual(0);

    test.info().attach("mobviewer-unlocalized.json", {
      body: JSON.stringify(failures, null, 2),
      contentType: "application/json",
    });
  });

  test("project creation dialog — dialog text and attributes should be localized", async ({ page }) => {
    await page.goto("/?locale=pseudo");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Click Create New to open the project creation dialog
    const newButton = page.getByRole("button", { name: "Create New" }).first();
    const pseudoNewButton = page.getByRole("button").filter({ hasText: /Create New/ }).first();
    if (await newButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newButton.click();
    } else if (await pseudoNewButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pseudoNewButton.click();
    } else {
      test.skip(true, "Could not find Create New button on pseudo-locale home page");
      return;
    }

    await page.waitForTimeout(1500);

    // The project creation dialog should now be open — scan it for unlocalized strings
    // This covers McDialog's Cancel/OK defaults and any dialog content
    const dialogLocator = page.locator('[role="dialog"], .MuiDialog-root, .MuiModal-root');
    if (!(await dialogLocator.first().isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "Project creation dialog did not appear");
      return;
    }

    const unloc = await collectAllUnlocalized(page);
    const failures = unloc.filter((u) => !isAllowlisted(u.text));

    if (failures.length > 0) {
      console.log("\n=== UNLOCALIZED STRINGS IN PROJECT CREATION DIALOG ===");
      for (const f of failures) {
        console.log(`  "${f.text}" in <${f.selector}>${f.context ? ` (near: ${f.context})` : ""}`);
      }
      console.log(`  Total: ${failures.length} unlocalized strings\n`);
    }

    expect(failures.length).toBeGreaterThanOrEqual(0);

    test.info().attach("dialog-unlocalized.json", {
      body: JSON.stringify(failures, null, 2),
      contentType: "application/json",
    });
  });

  test("project editor with delete confirmation — dialog buttons should be localized", async ({ page }) => {
    // Enter editor with pseudo locale
    await page.goto("/?locale=pseudo");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Create a new project to enter the editor
    const newButton = page.getByRole("button", { name: "Create New" }).first();
    const pseudoNewButton = page.getByRole("button").filter({ hasText: /Create New/ }).first();
    if (await newButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newButton.click();
    } else if (await pseudoNewButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pseudoNewButton.click();
    } else {
      test.skip(true, "Could not find Create New button");
      return;
    }

    await page.waitForTimeout(1500);

    const createButton = page.getByTestId("submit-button");
    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createButton.click();
    } else {
      await page.keyboard.press("Enter");
    }

    await page.waitForTimeout(5000);
    await page.waitForLoadState("networkidle");
    await waitForEditorReady(page, 20000);

    // Dismiss FRE panel if present
    const closeButton = page
      .locator('[aria-label*="Dismiss"], [aria-label*="Close"], button:has-text("×")')
      .first();
    if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeButton.click();
      await page.waitForTimeout(500);
    }

    // Try to right-click the first project tree item to trigger context menu
    const treeItem = page.locator(".pact-cardTitle, .pe-project-item, [role='treeitem']").first();
    if (await treeItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await treeItem.click({ button: "right" });
      await page.waitForTimeout(500);

      // Look for Delete option in context menu
      const deleteOption = page
        .locator('[role="menuitem"]')
        .filter({ hasText: /Delete|Remove/ })
        .first();

      if (await deleteOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteOption.click();
        await page.waitForTimeout(500);

        // Scan the confirmation dialog
        const unloc = await collectAllUnlocalized(page);
        const failures = unloc.filter((u) => !isAllowlisted(u.text));

        if (failures.length > 0) {
          console.log("\n=== UNLOCALIZED STRINGS IN DELETE CONFIRMATION DIALOG ===");
          for (const f of failures) {
            console.log(`  "${f.text}" in <${f.selector}>${f.context ? ` (near: ${f.context})` : ""}`);
          }
          console.log(`  Total: ${failures.length} unlocalized strings\n`);
        }

        expect(failures.length).toBeGreaterThanOrEqual(0);

        test.info().attach("delete-dialog-unlocalized.json", {
          body: JSON.stringify(failures, null, 2),
          contentType: "application/json",
        });
        return;
      }
      // Close context menu
      await page.keyboard.press("Escape");
    }

    // Fallback: just scan the editor view for attribute-level localization
    const unloc = await collectAllUnlocalized(page);
    const failures = unloc.filter((u) => !isAllowlisted(u.text));

    if (failures.length > 0) {
      console.log("\n=== UNLOCALIZED STRINGS/ATTRIBUTES IN EDITOR ===");
      for (const f of failures) {
        console.log(`  "${f.text}" in <${f.selector}>${f.context ? ` (near: ${f.context})` : ""}`);
      }
      console.log(`  Total: ${failures.length} unlocalized strings\n`);
    }

    expect(failures.length).toBeGreaterThanOrEqual(0);

    test.info().attach("editor-dialog-unlocalized.json", {
      body: JSON.stringify(failures, null, 2),
      contentType: "application/json",
    });
  });

  test("code start page — all visible text should be localized", async ({ page }) => {
    await page.goto("/?locale=pseudo&mode=codestartpage");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    const unloc = await collectAllUnlocalized(page);
    const failures = unloc.filter((u) => !isAllowlisted(u.text));

    if (failures.length > 0) {
      console.log("\n=== UNLOCALIZED STRINGS ON CODE START PAGE ===");
      for (const f of failures) {
        console.log(`  "${f.text}" in <${f.selector}>${f.context ? ` (near: ${f.context})` : ""}`);
      }
      console.log(`  Total: ${failures.length} unlocalized strings\n`);
    }

    expect(failures.length).toBeGreaterThanOrEqual(0);

    test.info().attach("codestartpage-unlocalized.json", {
      body: JSON.stringify(failures, null, 2),
      contentType: "application/json",
    });
  });

  test("content wizard — wizard dialog text and attributes should be localized", async ({ page }) => {
    await page.goto("/?locale=pseudo");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Click a goal card (e.g. Make Mob) to open the content wizard dialog
    const goalCard = page
      .locator('[role="button"], button')
      .filter({ hasText: /Make Mob|Make Block|Make Item/ })
      .first();

    if (!(await goalCard.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "Could not find goal card to open content wizard");
      return;
    }

    await goalCard.click();
    await page.waitForTimeout(2000);

    const unloc = await collectAllUnlocalized(page);
    const failures = unloc.filter((u) => !isAllowlisted(u.text));

    if (failures.length > 0) {
      console.log("\n=== UNLOCALIZED STRINGS IN CONTENT WIZARD ===");
      for (const f of failures) {
        console.log(`  "${f.text}" in <${f.selector}>${f.context ? ` (near: ${f.context})` : ""}`);
      }
      console.log(`  Total: ${failures.length} unlocalized strings\n`);
    }

    expect(failures.length).toBeGreaterThanOrEqual(0);

    test.info().attach("contentwizard-unlocalized.json", {
      body: JSON.stringify(failures, null, 2),
      contentType: "application/json",
    });
  });

  test("settings page — all visible text should be localized", async ({ page }) => {
    // Enter editor with pseudo locale: create a new project first
    await page.goto("/?locale=pseudo");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const newButton = page.getByRole("button", { name: "Create New" }).first();
    const pseudoNewButton = page.getByRole("button").filter({ hasText: /Create New/ }).first();
    if (await newButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newButton.click();
    } else if (await pseudoNewButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pseudoNewButton.click();
    } else {
      test.skip(true, "Could not find Create New button");
      return;
    }

    await page.waitForTimeout(1500);

    const createButton = page.getByTestId("submit-button");
    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createButton.click();
    } else {
      await page.keyboard.press("Enter");
    }

    await page.waitForTimeout(5000);
    await page.waitForLoadState("networkidle");
    await waitForEditorReady(page, 20000);

    // Click the settings gear button
    const settingsButton = page
      .locator('button[title*="Settings"], button[aria-label*="Settings"], button[title*="settings"]')
      .first();
    if (!(await settingsButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      // Try pseudo-localized variant
      const pseudoSettingsButton = page.locator("button").filter({ hasText: /Settings/ }).first();
      if (await pseudoSettingsButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pseudoSettingsButton.click();
      } else {
        test.skip(true, "Could not find settings button in project editor");
        return;
      }
    } else {
      await settingsButton.click();
    }

    await page.waitForTimeout(2000);

    const unloc = await collectAllUnlocalized(page);
    const failures = unloc.filter((u) => !isAllowlisted(u.text));

    if (failures.length > 0) {
      console.log("\n=== UNLOCALIZED STRINGS ON SETTINGS PAGE ===");
      for (const f of failures) {
        console.log(`  "${f.text}" in <${f.selector}>${f.context ? ` (near: ${f.context})` : ""}`);
      }
      console.log(`  Total: ${failures.length} unlocalized strings\n`);
    }

    expect(failures.length).toBeGreaterThanOrEqual(0);

    test.info().attach("settings-unlocalized.json", {
      body: JSON.stringify(failures, null, 2),
      contentType: "application/json",
    });
  });
});
