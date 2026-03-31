/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * ESBuild configuration for the NodeJS CLI (replaces webpack.jsn.config.js)
 *
 * Benefits over webpack:
 * - ~50-100x faster builds (500ms vs 30+ seconds)
 * - Native ESM support without complex externals configuration
 * - Built-in TypeScript and JSX/TSX support
 * - Simpler configuration (~60 lines vs 200+ lines)
 * - Better tree-shaking and smaller bundles
 *
 * ARCHITECTURE NOTE — Externals and Electron Packaging
 * ====================================================
 * The CLI bundle produced here serves TWO contexts:
 *   1. Standalone CLI: `npx mct <command>` — has full node_modules nearby
 *
 * The Forge config (forge.config.js) unpacks toolbuild/jsn/**
 * from asar, but node_modules stays inside asar. So packages like commander,
 * js-md5, uuid, ws, inquirer, exifr, and open are bundled here to ensure
 * the MCP server works from the packaged Electron app.
 *
 * Only packages that are genuinely optional (playwright, native bindings) or
 * lazily imported (ink/react for TUI) should remain external.
 *
 * Related files:
 * - app/forge.config.js — Electron Forge packaging config
 * - app/src/cli/commands/server/McpCommand.ts — MCP command entry point
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

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: ["src/cli/index.ts", "src/cli/TaskWorker.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outdir: "toolbuild/jsn/cli",
  outExtension: { ".js": ".mjs" },
  sourcemap: true,

  // Externalize dependencies that shouldn't be bundled.
  //
  // IMPORTANT: Only truly native/optional packages should be external here.
  // When the Electron app spawns the MCP server as a child process, it runs
  // plain Node.js (not Electron), so it CANNOT read from .asar archives.
  // Any externalized package must either:
  //   1. Be in the asar-unpacked folder, OR
  //   2. Be truly optional (gracefully handled if missing)
  //
  // Packages like commander, js-md5, uuid, ws, inquirer, exifr, and open
  // are bundled because they're needed at startup or in the MCP code path,
  // and esbuild handles them correctly with platform: "node".
  external: [
    // Native/optional dependencies — these are truly optional and have
    // graceful fallbacks (try/catch or dynamic import) when not available
    "playwright",
    "playwright-core",
    "esbuild-wasm",
    "bufferutil",
    "utf-8-validate",
    "@resvg/resvg-js",
    "react-devtools-core",
    // Ink TUI framework — only dynamically imported by ServeCommand,
    // so missing ink/react/react-dom won't crash the CLI at startup
    "ink",
    "react",
    "react-dom",
  ],

  // Inject createRequire for CJS compatibility - allows bundled CJS code to require Node builtins
  inject: [],

  // Define compile-time constants (replaces webpack.DefinePlugin)
  define: {
    ENABLE_ANALYTICS: "false",
    BUILD_TARGET: JSON.stringify("nodejs-cli"),
    BUILD_VERSION: JSON.stringify(packageJson.version),
    BUILD_DATE: JSON.stringify(new Date().toISOString()),
  },

  // Banner for shebang, deprecation suppression, and CJS compatibility
  banner: {
    js: `#!/usr/bin/env node
process.noDeprecation = true;
import { createRequire as __createRequire } from 'node:module';
import { fileURLToPath as __fileURLToPath } from 'node:url';
import { dirname as __pathDirname } from 'node:path';
const require = __createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __pathDirname(__filename);`,
  },

  // JSX configuration for Ink UI components
  jsx: "automatic",

  // Improve error messages
  logLevel: "info",

  // Ensure clean builds
  metafile: true,
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
      console.log(`\n✓ ESBuild completed in ${elapsed}ms`);

      // Print bundle sizes
      if (result.metafile) {
        const outputs = Object.entries(result.metafile.outputs);
        for (const [file, info] of outputs) {
          if (file.endsWith(".mjs")) {
            const sizeKB = (info.bytes / 1024).toFixed(1);
            console.log(`  ${path.basename(file)}: ${sizeKB} KB`);
          }
        }
      }
    }
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();
