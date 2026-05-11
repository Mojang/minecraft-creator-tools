/**
 * Asserts the MCT main view (sidebar webview) can mount without the webview
 * emitting any runtime errors.
 *
 * Why this test exists:
 *   This test installs a stub for `showInformationMessage` BEFORE opening the view,
 *   triggers the view via the real `mctools.showMinecraftPane` command, waits long
 *   enough for React to mount + any async initAsync failure to surface, then
 *   asserts no "Webview: " notification fired.
 *
 *   Run against real VS Code desktop via `@vscode/test-electron` (see runTest.ts)
 *   because `@vscode/test-web` is currently broken upstream.
 */

import * as assert from "assert";
import * as vscode from "vscode";

const EXTENSION_ID = "mojang.mctools-int-vsc";
const VIEW_COMMAND = "mctools.showMinecraftPane";

// Anything sent through our webview error pipeline starts with this prefix (set
// in ExtensionManager.ts line 2031: `this.logAsAlert("Webview: " + args.data)`).
const WEBVIEW_ERROR_PREFIX = "Webview:";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("MCT main view (real VS Code)", function () {
  this.timeout(60000);

  it("activates the extension", async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `Extension ${EXTENSION_ID} not found. Did vscdevbuild run?`);
    await ext!.activate();
    assert.strictEqual(ext!.isActive, true, "Extension failed to activate");
  });

  it("opens the MCT main view without emitting any webview runtime errors", async () => {
    // Intercept the three notification APIs our webview error handlers might reach.
    // `logAsAlert` only calls `showInformationMessage`, but we stub all three to be
    // safe against future refactors that promote severity.
    const captured: { level: "info" | "warn" | "error"; message: string }[] = [];

    const origInfo = vscode.window.showInformationMessage;
    const origWarn = vscode.window.showWarningMessage;
    const origError = vscode.window.showErrorMessage;

    // We only care about the "Webview: " prefix our extension emits. Anything
    // else (e.g. VS Code's own welcome info) is passed through untouched so
    // real user-visible behaviour is unchanged during the test.
    const wrap =
      (level: "info" | "warn" | "error", orig: any) =>
      (message: string, ...rest: any[]) => {
        if (typeof message === "string" && message.startsWith(WEBVIEW_ERROR_PREFIX)) {
          captured.push({ level, message });
        }
        return orig.call(vscode.window, message, ...rest);
      };

    (vscode.window as any).showInformationMessage = wrap("info", origInfo);
    (vscode.window as any).showWarningMessage = wrap("warn", origWarn);
    (vscode.window as any).showErrorMessage = wrap("error", origError);

    try {
      // Trigger the same code path the "Minecraft: Show Minecraft View" command
      // does, which reveals the MainViewProvider sidebar webview. This causes
      // the webview HTML to load and our `vscwebindex.tsx` bundle to execute.
      await vscode.commands.executeCommand(VIEW_COMMAND);

      // Give React a generous window to mount AND for any async init failure
      // (`initAsync().catch(...)`) to surface. The original bug unmounted at
      // ~4-5s, so 10s gives headroom while keeping total test time reasonable.
      await wait(10000);
    } finally {
      (vscode.window as any).showInformationMessage = origInfo;
      (vscode.window as any).showWarningMessage = origWarn;
      (vscode.window as any).showErrorMessage = origError;
    }

    if (captured.length > 0) {
      const report = captured.map((c, i) => `  ${i + 1}. [${c.level}] ${c.message}`).join("\n");
      assert.fail(
        `MCT webview emitted ${captured.length} runtime error notification(s) after opening the main view:\n${report}`
      );
    }
  });
});
