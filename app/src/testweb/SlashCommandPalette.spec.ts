import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import { processMessage, enterEditor } from "./WebTestUtilities";

/**
 * Slash command palette coverage test.
 *
 * Asserts that typing "/" into the editor's command bar surfaces the full
 * registered command set, including the commands added by the
 * expand-slash-commands work (`/validate`, `/info`, `/mode`, `/reload`,
 * `/format`, `/settings`) alongside the pre-existing core commands
 * (`/help`, `/create`, `/add`, `/open`).
 *
 * This is a one-shot palette-presence check — it does not invoke any of the
 * commands. It exists so that an accidental removal from the registry index
 * (src/app/toolcommands/commands/index.ts) is caught immediately, instead of
 * surfacing later as a missing-feature bug report from a pro user.
 *
 * Pattern follows ToolCommandBar.spec.ts.
 */

const REQUIRED_COMMANDS = [
  "validate",
  "info",
  "mode",
  "reload",
  "format",
  "settings",
  "help",
  "create",
  "add",
  "open",
];

async function activateEditorCommandBar(page: Page): Promise<void> {
  const existingInput = editorCommandBar(page);
  if (await existingInput.isVisible({ timeout: 500 }).catch(() => false)) {
    return;
  }

  const statusMessageArea = page.locator(".sa-messageOuter").first();
  if (await statusMessageArea.isVisible({ timeout: 2000 }).catch(() => false)) {
    await statusMessageArea.click();
    await page.waitForTimeout(500);
    if (await existingInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      return;
    }
  }

  await page.keyboard.press("Control+e");
  await page.waitForTimeout(500);
}

function editorCommandBar(page: Page) {
  return page
    .locator(
      '#sceed-forminput, #sceed-forminput input, input[aria-label="Search or enter command"], .sa-inputEditor input'
    )
    .first();
}

function editorSuggestions(page: Page) {
  return page.locator(".sceed-floatBox .sceed-floatListItem, .sceed-floatBox .ui-list__item");
}

test.describe("Slash command palette — full coverage @full", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("typing '/' in the editor should surface all expected commands", async ({ page }) => {
    test.setTimeout(180000);

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const enteredEditor = await enterEditor(page, { editMode: "full" });
    expect(enteredEditor).toBe(true);

    await page.waitForTimeout(2000);

    await activateEditorCommandBar(page);
    const input = editorCommandBar(page);
    await expect(input).toBeVisible({ timeout: 5000 });

    await input.click();
    await input.fill("/");
    await page.waitForTimeout(500);

    await page.screenshot({
      path: "debugoutput/screenshots/slash-palette-01-suggestions.png",
      fullPage: true,
    });

    // Read the popup contents. The float box renders one entry per command
    // and includes the command name in its visible text. We also check the
    // overall popup container as a fallback for layouts that don't expose
    // each entry as a discrete item.
    let popupText = "";
    try {
      await page.waitForSelector(".sceed-floatBox", { timeout: 5000 });
      popupText = ((await page.locator(".sceed-floatBox").first().textContent()) || "").toLowerCase();
    } catch {
      // float box didn't render — collect from items directly
    }

    if (!popupText) {
      const items = editorSuggestions(page);
      const texts = await items.allTextContents();
      popupText = texts.join("\n").toLowerCase();
    }

    expect(popupText.length, "Slash-command popup should not be empty").toBeGreaterThan(0);

    const missing: string[] = [];
    for (const cmd of REQUIRED_COMMANDS) {
      if (!popupText.includes(cmd.toLowerCase())) {
        missing.push("/" + cmd);
      }
    }

    expect(missing, `Missing slash commands from palette: ${missing.join(", ")}`).toEqual([]);
  });
});
