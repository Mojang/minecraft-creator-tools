/**
 * ==========================================================================================
 * REAL VS CODE EXTENSION TESTS — RUNNER ENTRY POINT
 * ==========================================================================================
 *
 * Why this exists:
 *   We use `@vscode/test-electron`, which downloads a real VS Code desktop binary,
 *   installs our built extension into a disposable test profile, and runs Mocha tests inside
 *   the extension host. This is the same harness every first-party VS Code extension uses.
 *
 * What runs where:
 *   - This file runs in a plain Node.js process. Its only job is to download VS Code, point
 *     it at our built extension (`./toolbuild/vsc/`), tell it which Mocha suite to run
 *     (`./toolbuild/testvsc/suite/index.js`), and hand it a workspace folder to open
 *     (`../samplecontent/diverse_content`).
 *   - The actual tests run inside the extension host (Node) where the `vscode` module is
 *     available. They assert on things the webview-harness tests couldn't see: e.g. whether
 *     the MCT webview emits any runtime errors (surfaced via `showInformationMessage`
 *     notifications, which the vscwebindex.tsx error handlers drive).
 *
 * Build sequence (see npm script `test-vsc`):
 *   1. `npx gulp vscdevbuild` — builds the extension into `./toolbuild/vsc/`.
 *   2. `npx tsc -p tsconfig.testvsc.json` — compiles these test sources.
 *   3. `node toolbuild/testvsc/runTest.js` — what you're looking at.
 * ==========================================================================================
 */

import * as path from "path";
import { runTests } from "@vscode/test-electron";

async function main() {
  try {
    // Paths resolve relative to app/ because the compiler preserves the `src/testvsc/` tree
    // under `toolbuild/testvsc/` and we re-resolve from compiled JS location.
    // __dirname at runtime = app/toolbuild/testvsc (compiled), so ../.. climbs back to app/.
    const appRoot = path.resolve(__dirname, "..", "..");

    const extensionDevelopmentPath = path.resolve(appRoot, "toolbuild", "vsc");
    const extensionTestsPath = path.resolve(__dirname, "suite", "index.js");
    const workspacePath = path.resolve(appRoot, "..", "samplecontent", "diverse_content");

    console.log("[runTest] extensionDevelopmentPath =", extensionDevelopmentPath);
    console.log("[runTest] extensionTestsPath       =", extensionTestsPath);
    console.log("[runTest] workspace                =", workspacePath);

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      // Open the sample workspace so the MCT extension can see Minecraft content
      // and the view contributions actually get a non-empty state to render.
      launchArgs: [
        workspacePath,
        // Disable other extensions to avoid slowdowns and test isolation issues
        "--disable-extensions",
      ],
    });
  } catch (err) {
    console.error("[runTest] Failed to run tests:", err);
    process.exit(1);
  }
}

main();
