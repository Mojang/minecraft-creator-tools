/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * ESBuild configuration for CommonJS modules.
 *
 * This produces individual CommonJS modules in toolbuild/jsn/ that are required
 * by the Electron main process and other CJS consumers.
 *
 * The Electron main process files (main.ts, preload.ts, etc.) are now in src/electron/
 * and are compiled to toolbuild/jsn/electron/. The package.json "main" entry points
 * to toolbuild/jsn/electron/main.js.
 *
 * ARCHITECTURE:
 * - Scans ALL directories under src/ (including src/electron/)
 * - Excludes only browser-specific (React/Babylon/Monaco) and test directories
 * - Produces individual CJS files preserving the src/ directory structure
 * - Electron entry point: toolbuild/jsn/electron/main.js
 * - Preload script: toolbuild/jsn/electron/preload.js
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

// Recursively find all .ts files in a directory, excluding specified directories
function findTsFiles(dir, excludeDirs) {
  const files = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip excluded directories
      if (excludeDirs.includes(entry.name)) {
        continue;
      }
      files.push(...findTsFiles(fullPath, excludeDirs));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".tsx") && // Skip React components
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".spec.ts")
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

// Directories to EXCLUDE - these are browser-only or test directories
// Everything else in src/ will be compiled
const excludeDirs = [
  // React/Browser UI components
  "UX",
  "UXex",
  "dataformux",

  // Electron client-side proxies (renderer process, not main process)
  "electronclient",

  // 3D rendering (Babylon.js - browser only)
  "babylon",

  // Monaco editor (browser only)
  "monaco",

  // Web workers (browser only)
  "workers",

  // VS Code extension (separate build)
  "vscode",
  "vscodeweb",

  // Test directories
  "test",
  "test-ex",
  "test-extra",
  "test-longhaul",
  "testweb",
  "testmobile",
  "testelectron",
  "testshared",
  "testvscweb",

  // MCP server (uses different runtime)
  "mcp",

  // CLI UI components (uses Ink which is terminal-only, not Electron)
  "ui",

  // Node modules (should never be in src but just in case)
  "node_modules",
];

// Start from src/ directory
const srcDir = path.join(__dirname, "src");
const entryPoints = findTsFiles(srcDir, excludeDirs);

console.log(`Found ${entryPoints.length} TypeScript files to compile as CJS modules`);

// Log which directories we're compiling from
const dirsFound = new Set();
for (const file of entryPoints) {
  const relPath = path.relative(srcDir, file);
  const topDir = relPath.split(path.sep)[0];
  dirsFound.add(topDir);
}
console.log(`Compiling from directories: ${Array.from(dirsFound).sort().join(", ")}`);

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: entryPoints,
  bundle: false, // Don't bundle - we want individual files
  platform: "node",
  target: "node22",
  format: "cjs", // CommonJS for require() compatibility
  outdir: "toolbuild/jsn",
  outbase: "src", // Preserve directory structure from src/
  sourcemap: true,

  // Define compile-time constants
  define: {
    ENABLE_ANALYTICS: "false",
    BUILD_TARGET: JSON.stringify("electron"),
    BUILD_VERSION: JSON.stringify(packageJson.version),
    BUILD_DATE: JSON.stringify(new Date().toISOString()),
  },

  // Improve error messages
  logLevel: "info",
};

async function build() {
  const startTime = Date.now();

  try {
    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log("Watching for changes...");
    } else {
      const result = await esbuild.build(buildOptions);

      const elapsed = Date.now() - startTime;
      console.log(`✓ CJS modules built in ${elapsed}ms`);
    }
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();
