/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * ESBuild configuration for bundled Electron main process
 *
 * This produces self-contained bundles for the Electron main process and preload script,
 * eliminating the need for individual CJS modules.
 *
 * Benefits over individual CJS modules:
 * - ~50x fewer files (2 bundles vs ~3000 individual modules)
 * - Faster Electron app startup (fewer file reads)
 * - Simpler build pipeline
 * - Better tree-shaking
 *
 * Entry points:
 * - src/electron/main.ts → toolbuild/jsn/electron/main.js
 * - src/electron/preload.ts → toolbuild/jsn/electron/preload.js
 */

import * as esbuild from "esbuild";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf-8"));

// Check if we're in watch mode
const isWatch = process.argv.includes("--watch");

/**
 * Shared externals for Electron builds
 * These are either:
 * 1. Electron-specific modules (must be external)
 * 2. Native modules (can't be bundled)
 * 3. Optional dependencies that may not be installed
 */
const electronExternals = [
  // Electron core - MUST be external
  "electron",
  "electron-devtools-installer",

  // Native modules - can't be bundled (contain .node binaries)
  "@resvg/resvg-js",

  // Optional/dev dependencies - not needed at runtime
  "playwright",
  "playwright-core",
  "react-devtools-core",

  // Minecraft stub - never actually loaded in Electron
  "@minecraft/server",
];

/**
 * Main process bundle configuration
 */
const mainBuildOptions = {
  entryPoints: ["src/electron/main.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm", // ESM for modern Electron
  outfile: "toolbuild/jsn/electron/main.mjs",
  sourcemap: true,

  external: electronExternals,

  // Define compile-time constants
  define: {
    ENABLE_ANALYTICS: "false",
    BUILD_TARGET: JSON.stringify("electron-main"),
    BUILD_VERSION: JSON.stringify(packageJson.version),
    BUILD_DATE: JSON.stringify(new Date().toISOString()),
  },

  // Banner for __dirname/__filename compatibility in ESM
  banner: {
    js: `import { createRequire as __createRequire } from 'node:module';
import { fileURLToPath as __fileURLToPath } from 'node:url';
import { dirname as __pathDirname } from 'node:path';
const require = __createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __pathDirname(__filename);`,
  },

  // Improve error messages
  logLevel: "info",

  // Generate metafile for bundle analysis
  metafile: true,
};

/**
 * Preload script bundle configuration
 *
 * The preload script runs in a special context between main and renderer.
 * NOTE: Preload must use CJS - Electron's contextBridge doesn't support ESM preload.
 */
const preloadBuildOptions = {
  entryPoints: ["src/electron/preload.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs", // Preload scripts MUST use CJS (Electron limitation)
  outfile: "toolbuild/jsn/electron/preload.js",
  sourcemap: true,

  // Preload only needs electron externalized
  external: ["electron"],

  // Define compile-time constants
  define: {
    ENABLE_ANALYTICS: "false",
    BUILD_TARGET: JSON.stringify("electron-preload"),
    BUILD_VERSION: JSON.stringify(packageJson.version),
    BUILD_DATE: JSON.stringify(new Date().toISOString()),
  },

  logLevel: "info",
  metafile: true,
};

async function build() {
  const startTime = Date.now();

  try {
    // Clean up electron output folder - keep only our bundled outputs
    const electronOutDir = path.join(__dirname, "toolbuild/jsn/electron");
    if (fs.existsSync(electronOutDir)) {
      const files = fs.readdirSync(electronOutDir);
      for (const file of files) {
        // Keep only main.mjs and preload.js (and their maps)
        const isMainBundle = file.startsWith("main.mjs");
        const isPreloadBundle = file.startsWith("preload.js");
        if (!isMainBundle && !isPreloadBundle) {
          fs.unlinkSync(path.join(electronOutDir, file));
        }
      }
    }

    if (isWatch) {
      // Watch mode - create contexts for both entry points
      const mainCtx = await esbuild.context(mainBuildOptions);
      const preloadCtx = await esbuild.context(preloadBuildOptions);

      await Promise.all([mainCtx.watch(), preloadCtx.watch()]);
      console.log("Watching Electron files for changes...");
    } else {
      // Build both entry points in parallel
      const [mainResult, preloadResult] = await Promise.all([
        esbuild.build(mainBuildOptions),
        esbuild.build(preloadBuildOptions),
      ]);

      const elapsed = Date.now() - startTime;
      console.log(`\n✓ Electron bundles built in ${elapsed}ms`);

      // Print bundle sizes
      if (mainResult.metafile) {
        for (const [file, info] of Object.entries(mainResult.metafile.outputs)) {
          if (file.endsWith(".js")) {
            const sizeKB = (info.bytes / 1024).toFixed(1);
            console.log(`  ${path.basename(file)}: ${sizeKB} KB`);
          }
        }
      }
      if (preloadResult.metafile) {
        for (const [file, info] of Object.entries(preloadResult.metafile.outputs)) {
          if (file.endsWith(".js")) {
            const sizeKB = (info.bytes / 1024).toFixed(1);
            console.log(`  ${path.basename(file)}: ${sizeKB} KB`);
          }
        }
      }
    }
  } catch (error) {
    console.error("Electron build failed:", error);
    process.exit(1);
  }
}

build();
