/**
 * Global setup for Electron tests
 *
 * This script runs BEFORE any Electron tests execute.
 * It validates that build prerequisites are in place and provides clear error
 * messages if they're missing, instead of letting tests fail with cryptic errors.
 *
 * Also ensures the screenshot output directory exists.
 */

import fs from "fs";
import path from "path";

async function globalSetup(): Promise<void> {
  const appDir = process.cwd();
  const isForceProduction = process.env.ELECTRON_FORCE_PROD === "true";
  const isDevMode = !isForceProduction && process.env.ELECTRON_FORCE_PROD !== "true";

  console.log("[Global Setup] Electron test prerequisites check...");
  console.log(`[Global Setup] App directory: ${appDir}`);
  console.log(
    `[Global Setup] Mode: ${isDevMode ? "DEVELOPMENT (Vite at localhost:3000)" : "PRODUCTION (build/ assets)"}`
  );

  // 1. Check for the Electron main process bundle
  const electronMainPath = path.join(appDir, "toolbuild/jsn/electron/main.mjs");
  if (!fs.existsSync(electronMainPath)) {
    throw new Error(
      `[Global Setup] MISSING PREREQUISITE: Electron main bundle not found at:\n` +
        `  ${electronMainPath}\n\n` +
        `  Fix: Run 'npm run jsncorebuild' to build the Electron main process.\n` +
        `  Or use 'npm run test-electron-full' to build everything and run tests.\n`
    );
  }
  console.log("[Global Setup] ✓ Electron main bundle found");

  // 2. If running in production mode, check for built web assets
  if (isForceProduction) {
    const indexHtmlPath = path.join(appDir, "build/index.html");
    if (!fs.existsSync(indexHtmlPath)) {
      throw new Error(
        `[Global Setup] MISSING PREREQUISITE: Built web assets not found at:\n` +
          `  ${indexHtmlPath}\n\n` +
          `  ELECTRON_FORCE_PROD is set to 'true', which means the Electron app\n` +
          `  will load from build/ instead of the Vite dev server.\n\n` +
          `  Fix: Run 'npm run webbuild' to build web assets.\n` +
          `  Or use 'npm run test-electron-full' to build everything and run tests.\n` +
          `  Or use 'npm run test-electron-dev' to test against the Vite dev server instead.\n`
      );
    }
    console.log("[Global Setup] ✓ Built web assets found (build/index.html)");
  } else {
    console.log("[Global Setup] ⓘ Dev mode: Electron will load from Vite at localhost:3000");
    console.log("[Global Setup]   Make sure the Vite dev server is running: npm run web");
  }

  // 3. Ensure the screenshots output directory exists
  const screenshotDir = path.join(appDir, "debugoutput/screenshots");
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
    console.log(`[Global Setup] Created screenshot directory: ${screenshotDir}`);
  } else {
    console.log("[Global Setup] ✓ Screenshot directory exists");
  }

  console.log("[Global Setup] All prerequisites verified. Starting tests...\n");
}

export default globalSetup;
