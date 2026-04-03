/**
 * ============================================================================
 * VITE PRODUCTION BUILD CONFIGURATION
 * ============================================================================
 *
 * Last Updated: January 2025
 *
 * This configuration contains critical fixes for production bundle compatibility.
 * The production build (`npm run webbuild`) encountered 8 distinct initialization
 * errors that were fixed through custom plugins, resolve aliases, and chunk
 * configuration.
 *
 * ============================================================================
 * ISSUE SUMMARY
 * ============================================================================
 *
 * Issue 1: JSZip "Cannot access 'lt' before initialization"
 * ---------------------------------------------------------
 * Root Cause: JSZip has internal circular dependencies. When split into a
 * separate chunk, execution order leaves variables uninitialized.
 * Fix: Route JSZip to vendor-misc chunk + enable strictRequires: true
 *
 * Issue 2: React "Cannot read properties of undefined (reading 'Component')"
 * --------------------------------------------------------------------------
 * Root Cause: React in separate chunk from code needing React exports at init.
 * Fix: Merge React, React-DOM into vendor-misc chunk + dedupe config.
 *
 * Issue 3: Monaco "Cannot access 'gt' before initialization"
 * ----------------------------------------------------------
 * Root Cause: Monaco language services have interdependencies that break
 * when split into separate chunks.
 * Fix: Merge all Monaco packages into vendor-monaco-core chunk.
 *
 * Issue 4: MUI "s.default is not a function"
 * ------------------------------------------
 * Root Cause: MUI and Emotion in different chunks causing CJS/ESM interop
 * issues where default exports weren't properly resolved.
 * Fix: Merge MUI/Emotion into vendor-misc + dedupe + styled-engine alias.
 *
 * Issue 5: MUI "(0, a.internal_processStyles) is not a function"
 * --------------------------------------------------------------
 * Root Cause: @mui/material imports '@mui/system/createStyled' which resolves
 * to CJS version (no exports field for subpaths in package.json). CJS uses
 * _interopRequireWildcard creating namespace wrapper that doesn't work with
 * bundled ESM named exports.
 * Fix: Custom redirectMuiSystemToEsm() plugin redirects to ESM versions.
 *
 * Issue 6: "r.inherits is not a function"
 * ---------------------------------------
 * Root Cause: The 'inherits' package has Node.js and browser versions. Node
 * version uses try { require('util') } fallback that doesn't work in browser.
 * Fix: Alias to inherits/inherits_browser.js
 *
 * Issue 7: esbuild-wasm "Cannot read properties of undefined (reading 'split')"
 * -----------------------------------------------------------------------------
 * Root Cause: esbuild-wasm accesses process.versions.node.split('.') to check
 * Node version. Browser polyfill sets process.versions = {} leaving .node undefined.
 * Fix: Custom patchEsbuildProcessVersions() plugin patches the code.
 *
 * Issue 8: axios/zlib "Cannot read properties of undefined (reading 'Z_SYNC_FLUSH')"
 * ----------------------------------------------------------------------------------
 * Root Cause: axios has "browser" field mapping Node adapters to browser alternatives.
 * Without "browser" in mainFields, Node HTTP adapter was bundled requiring zlib.constants.
 * Fix: Add "browser" first in resolve.mainFields.
 *
 * ============================================================================
 * PROBLEMATIC DEPENDENCIES
 * ============================================================================
 *
 * HIGH RISK: @mui/material + @mui/system
 * - Missing ESM exports for subpath imports in package.json
 * - Required custom redirectMuiSystemToEsm() plugin
 * - Consider: Migrating to @fluentui (already partially in use) if issues persist
 *
 * MEDIUM RISK: esbuild-wasm
 * - Assumes Node.js environment with process.versions.node
 * - Required custom patchEsbuildProcessVersions() plugin
 * - Consider: Lazy loading or web worker isolation
 *
 * LOW RISK: axios, inherits
 * - Simple configuration fixes (mainFields, alias)
 * - Unlikely to regress
 *
 * ============================================================================
 * KEY CONFIGURATION SETTINGS
 * ============================================================================
 *
 * resolve.mainFields: ['browser', 'module', 'main']
 *   - CRITICAL: "browser" must be first for axios and similar packages
 *   - Ensures package.json browser field mappings are respected
 *
 * resolve.dedupe: [react, react-dom, @emotion/*, @mui/*]
 *   - Prevents duplicate package instances causing interop issues
 *
 * commonjsOptions.strictRequires: true
 *   - Fixes circular dependency initialization order
 *
 * commonjsOptions.transformMixedEsModules: true
 *   - Handles packages with mixed CJS/ESM exports
 *
 * manualChunks strategy:
 *   - vendor-misc: React, MUI, Emotion, JSZip, utilities (MUST stay together)
 *   - vendor-monaco-core: All Monaco packages (language services interdependent)
 *   - vendor-babylon: Babylon.js 3D engine
 *   - vendor-axios: axios HTTP client (separate due to browser field handling)
 *
 * ============================================================================
 * TESTING PRODUCTION BUILDS
 * ============================================================================
 *
 * Build:   npm run webbuild
 * Test:    node test-scripts/test-production.js
 *
 * The test checks: page loads, no JS errors, body visible, #root has content.
 *
 * ============================================================================
 * DEBUGGING TIPS
 * ============================================================================
 *
 * Find error in bundle:
 *   Get-Content build/assets/*.js | Select-String "error_text"
 *
 * Find function definition:
 *   Get-Content build/assets/vendor-misc*.js | Select-String "funcName\s*[:=]"
 *
 * Common error patterns:
 *   "Cannot access 'X' before initialization" → Circular dependency, merge chunks
 *   "X.default is not a function" → CJS/ESM interop, check dedupe and aliases
 *   "Cannot read properties of undefined" → Missing polyfill or wrong module version
 *   Namespace pattern "a.something" → CJS wrapper, need ESM redirect
 *
 * ============================================================================
 * MAINTENANCE CHECKLIST (when adding dependencies)
 * ============================================================================
 *
 * 1. Run: npm run webbuild && node test-scripts/test-production.js
 * 2. If errors, check if package has:
 *    - Proper ESM exports in package.json
 *    - Browser field mappings
 *    - Mixed CJS/ESM structure
 * 3. Add to manualChunks if chunk splitting causes issues
 * 4. Add to dedupe if multiple versions might bundle
 * 5. Add alias if browser-specific version needed
 *
 * ============================================================================
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

// Serve @minecraft/bedrock-schemas forms and schemas directly from node_modules.
// In dev mode, intercepts HTTP requests for /data/forms/ and /schemas/ and serves
// files from the package. In production build, copies package files into the output.
// This avoids maintaining checked-in copies in public/ and ensures version consistency.
function serveBedrockSchemas() {
  const pkgRoot = path.resolve("node_modules/@minecraft/bedrock-schemas");

  return {
    name: "serve-bedrock-schemas",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Serve forms: /data/forms/** -> node_modules/@minecraft/bedrock-schemas/forms/**
        if (req.url && req.url.startsWith("/data/forms/")) {
          const relPath = req.url.slice("/data/forms/".length);
          const filePath = path.join(pkgRoot, "forms", relPath);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            res.setHeader("Content-Type", "application/json");
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }
        // Serve schemas: /schemas/** -> node_modules/@minecraft/bedrock-schemas/schemas/**
        if (req.url && req.url.startsWith("/schemas/")) {
          const relPath = req.url.slice("/schemas/".length);
          const filePath = path.join(pkgRoot, "schemas", relPath);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            res.setHeader("Content-Type", "application/json");
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }
        next();
      });
    },
    // Production build: copy forms and schemas into the build output directory
    // so they are available at runtime via HTTP fetch.
    writeBundle(options) {
      const outDir = options.dir || path.resolve("build");

      function copyDirSync(src, dest) {
        if (!fs.existsSync(src)) return;
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      }

      const formsSource = path.join(pkgRoot, "forms");
      const formsDest = path.join(outDir, "data", "forms");
      copyDirSync(formsSource, formsDest);

      const schemasSource = path.join(pkgRoot, "schemas");
      const schemasDest = path.join(outDir, "schemas");
      copyDirSync(schemasSource, schemasDest);
    },
  };
}

// Custom Rollup plugin to fix esbuild-wasm process.versions.node access
// esbuild-wasm checks process.versions.node.split(".") to detect Node.js version
// The browser polyfill sets process.versions = {} leaving .node undefined
function patchEsbuildProcessVersions() {
  return {
    name: "patch-esbuild-process-versions",
    transform(code, id) {
      // Only transform esbuild-wasm main.js
      if (id.includes("esbuild-wasm") && id.includes("main.js")) {
        // Replace the pattern that accesses process.versions.node.split
        // Original: process.versions.node.split(".")
        // We need to make it defensive: (process.versions.node || "20.0.0").split(".")
        const patched = code.replace(
          /process\.versions\.node\.split\s*\(\s*["']\.["']\s*\)/g,
          '(process.versions.node || "20.0.0").split(".")'
        );
        if (patched !== code) {
          return { code: patched, map: null };
        }
      }
      return null;
    },
  };
}

// Custom plugin to redirect @mui/system subpath imports to ESM versions
// Problem: @mui/material imports like '@mui/system/createStyled' resolve to
// the CJS version (node_modules/@mui/system/createStyled.js) instead of ESM
// (node_modules/@mui/system/esm/createStyled.js) because there's no exports
// field in @mui/system/package.json for subpath exports.
//
// The CJS version uses _interopRequireWildcard(require('@mui/styled-engine'))
// which creates a namespace wrapper. But when the styled-engine ESM is bundled,
// the namespace wrapper doesn't have the named exports attached, causing
// a.internal_processStyles to be undefined at runtime.
//
// Solution: Redirect all @mui/system/* imports to @mui/system/esm/* versions
// which use proper ESM named imports that work correctly with tree-shaking.
function redirectMuiSystemToEsm() {
  return {
    name: "redirect-mui-system-to-esm",
    enforce: "pre",
    resolveId(source, importer) {
      // Match @mui/system/something but not @mui/system (bare) or @mui/system/esm/*
      if (source.startsWith("@mui/system/") && !source.includes("/esm/")) {
        // Extract the subpath after @mui/system/
        const subpath = source.slice("@mui/system/".length);
        // Redirect to ESM version
        const esmPath = `@mui/system/esm/${subpath}`;
        return this.resolve(esmPath, importer, { skipSelf: true });
      }
      return null;
    },
  };
}

export default defineConfig(({ command }) => {
  return {
    plugins: [
      react(),
      serveBedrockSchemas(),
      patchEsbuildProcessVersions(),
      redirectMuiSystemToEsm(),
      nodePolyfills({
        // Exclude vm polyfill - vm-browserify uses eval which is not recommended
        // and triggers CSP violations. The vm module is only used by node_modules
        // (monaco-editor loader, blockly jsdom) in Node.js contexts, not browser.
        exclude: ["vm"],
        // Use custom zlib shim that adds `constants` object for compatibility
        // browserify-zlib exports Z_* constants directly on module (zlib.Z_SYNC_FLUSH)
        // but modern packages like axios expect zlib.constants.Z_SYNC_FLUSH
        // The plugin strips node: prefix internally, so we only need 'zlib'
        overrides: {
          zlib: "./src/shims/zlib-browser.js",
        },
      }),
    ],
    base: "./",
    server: {
      port: 3000,
      // Proxy WebSocket and API requests to the MCT server (npx mct serve).
      // Default MCT serve port is 80; override with MCT_PORT env variable.
      // This enables the 3D Bedrock client, notifications, and API calls
      // to work transparently through Vite's dev server.
      proxy: {
        "/ws": {
          target: `ws://localhost:${process.env.MCT_PORT || 80}`,
          ws: true,
        },
        "/api": {
          target: `http://localhost:${process.env.MCT_PORT || 80}`,
        },
        "/res": {
          target: `http://localhost:${process.env.MCT_PORT || 80}`,
        },
      },
    },
    // Ensure React packages are resolved to a single instance
    // This prevents duplication and initialization order issues
    resolve: {
      dedupe: [
        "react",
        "react-dom",
        "react-is",
        "scheduler",
        // Emotion packages used by MUI
        "@emotion/react",
        "@emotion/styled",
        "@emotion/cache",
        // MUI packages - ensure single instance for proper interop
        "@mui/system",
        "@mui/material",
        "@mui/styled-engine",
        "@mui/private-theming",
        "@mui/utils",
      ],
      // Force resolution to ESM versions for MUI packages
      // The styled-engine "main" field points to node/index.js (CJS) which
      // has a delayed export assignment pattern that Rollup's namespace helper
      // doesn't handle correctly. The "module" field points to
      // index.js (ESM) which has proper named exports.
      alias: {
        // Must use absolute path for alias to take effect in production build
        // Use fileURLToPath to properly convert URL to path on Windows
        "@mui/styled-engine": fileURLToPath(new URL("./node_modules/@mui/styled-engine/index.js", import.meta.url)),
        // Force inherits to resolve to the browser version which exports a function
        // The util polyfill re-exports: exports.inherits = require('inherits')
        // But bundling can wrap this incorrectly. Force direct resolution.
        inherits: fileURLToPath(new URL("./node_modules/inherits/inherits_browser.js", import.meta.url)),
        // Note: zlib override is handled in nodePolyfills({ overrides: { zlib: ... } })
        // because the plugin handles zlib resolution before Vite's resolve.alias
      },
      // Prefer browser field first (for packages like axios that have browser-specific
      // versions), then ESM module over main (CJS) field in package.json
      // This ensures browser-safe code is used and MUI packages use their ESM entry points
      mainFields: ["browser", "module", "main"],
    },
    optimizeDeps: {
      // Include Monaco's ESM modules for proper pre-bundling
      include: [
        "monaco-editor/esm/vs/editor/editor.worker",
        "monaco-editor/esm/vs/language/json/json.worker",
        "monaco-editor/esm/vs/language/typescript/ts.worker",
        // Pre-bundle React and ReactDOM to ensure proper initialization order
        // The CommonJS-to-ESM conversion can break function hoisting semantics
        "react",
        "react-dom",
        // MUI packages have mixed CommonJS/ESM that needs proper pre-bundling
        "@mui/material",
        "@mui/system",
        "@mui/styled-engine",
        "@emotion/react",
        "@emotion/styled",
      ],
      // Force esbuild to process these packages during dev
      esbuildOptions: {
        target: "esnext",
        // Keep function names for better debugging
        keepNames: true,
      },
    },
    build: {
      outDir: "build", // CRA's default build output
      // Generate source maps for production debugging (optional - remove for smaller builds)
      sourcemap: false,
      // Target modern browsers with native ESM support
      // This ensures proper handling of module initialization order
      target: "es2020",
      // CommonJS handling for packages with circular dependencies
      commonjsOptions: {
        // Transform CommonJS modules more carefully to handle circular deps
        strictRequires: true,
        // Include these problematic packages in the transformation
        include: [/node_modules/],
        // Don't try to resolve these as external
        ignoreDynamicRequires: false,
        // Use "preferred" to return .default when available (better for MUI interop)
        // This handles the case where CJS re-exports ESM default exports
        requireReturnsDefault: "preferred",
        // Transform mixed ES/CommonJS modules (React uses this pattern)
        transformMixedEsModules: true,
        // Do not hoist dynamic requires - can cause initialization issues
        dynamicRequireTargets: [],
      },
      rollupOptions: {
        input: {
          main: "./index.html",
        },
        output: {
          // Add __esModule marker to generated chunks
          // This is required for CommonJS interop helpers (interopRequireDefault)
          // to correctly recognize ES module namespace objects.
          // Without this, CJS code that imports ESM may wrap namespaces incorrectly.
          esModule: true,
          // Interop mode for mixing ESM and CommonJS
          // "auto" lets Rollup choose the best strategy for each module
          interop: "auto",
          // Generated code settings for ES module namespaces
          // This controls how Rollup creates namespace objects for imports
          generatedCode: {
            // Use const bindings for better initialization order
            constBindings: true,
            // Create proper ES module symbols for interop
            symbols: true,
          },
          // Manual chunking to split large vendor libraries
          manualChunks: (id) => {
            // Babylon.js - 3D rendering engine (~4-5MB)
            // Only loaded when 3D views are used
            if (id.includes("babylonjs")) {
              return "vendor-babylon";
            }

            // Monaco Editor - code editor
            // CRITICAL: Do NOT split language services into separate chunks!
            // The language services (json, typescript) have circular dependencies
            // with the core editor that cause "Cannot access before initialization"
            // errors when they're in separate chunks.
            // Only workers can safely be in separate chunks.
            if (id.includes("monaco-editor")) {
              // Worker files get their own chunks - they're loaded separately
              if (id.includes(".worker")) {
                if (id.includes("json.worker")) {
                  return "monaco-worker-json";
                }
                if (id.includes("ts.worker")) {
                  return "monaco-worker-ts";
                }
                return "monaco-worker-editor";
              }
              // ALL non-worker Monaco code goes into the same chunk
              // This includes core, language services (json, typescript), etc.
              return "vendor-monaco-core";
            }

            // Monaco loader package
            if (id.includes("@monaco-editor")) {
              return "vendor-monaco-core";
            }

            // Blockly - visual programming (~1-2MB)
            // Only loaded for ActionSetEditor
            if (id.includes("blockly") || id.includes("react-blockly")) {
              return "vendor-blockly";
            }

            // FluentUI - UI components (~1-2MB)
            // Used throughout the app, but can be split
            if (id.includes("@fluentui")) {
              return "vendor-fluentui";
            }

            // MUI/Emotion - Material UI components
            // NOTE: Do NOT chunk MUI separately - it has complex CommonJS interop
            // dependencies that cause "Cannot access before initialization" errors.
            // The interopRequireDefault helper expects module bindings to be initialized
            // in a specific order that breaks when split across chunks.
            // Let MUI go to vendor-misc where Rollup can order initialization correctly.
            // if (id.includes("@mui") || id.includes("@emotion")) {
            //   return "vendor-mui";
            // }

            // React ecosystem - must be in same chunk for proper initialization order
            // CRITICAL: The circular dependency issue between React and other packages
            // is caused by ES module hoisting. When chunks import from each other,
            // the import bindings exist but may not be initialized yet.
            //
            // Solution: Don't manually chunk React - let it go to vendor-misc with
            // everything else so Rollup can properly order module initialization.
            // This avoids circular imports between chunks entirely.
            //
            // The trade-off is that vendor-misc is larger, but it initializes correctly.

            // Other large node_modules - group remaining dependencies
            if (id.includes("node_modules")) {
              // Normalize path separators for cross-platform compatibility
              const normalizedId = id.replace(/\\/g, "/");
              // Extract package name from path
              const parts = normalizedId.split("node_modules/");
              if (parts.length > 1) {
                const packagePath = parts[parts.length - 1];
                const packageName = packagePath.split("/")[0];

                // Group scoped packages by scope
                if (packageName.startsWith("@")) {
                  const scope = packageName;
                  const name = packagePath.split("/")[1];

                  // Babel runtime must go to vendor-misc - it has complex initialization
                  // that can cause "Cannot access before initialization" errors
                  if (scope === "@babel") {
                    return "vendor-misc";
                  }

                  // MUI and Emotion must go to vendor-misc - they have complex CommonJS
                  // interop dependencies that cause initialization errors when chunked
                  if (scope === "@mui" || scope === "@emotion") {
                    return "vendor-misc";
                  }

                  // formatjs packages (@formatjs/intl, @formatjs/ecma402-abstract, etc.)
                  // must go to vendor-misc with react-intl. react-intl (non-scoped) lands
                  // in vendor-misc, but its transitive @formatjs/* deps each got their own
                  // chunk via the scoped-package rule. The cross-chunk boundary causes
                  // "Gk is not a function" initialization errors at runtime because
                  // formatjs internals have tightly coupled circular references.
                  if (scope === "@formatjs") {
                    return "vendor-misc";
                  }

                  return `vendor-${scope.replace("@", "")}-${name}`;
                }

                // JSZip, readable-stream, and crypto polyfills have complex internal
                // circular dependencies that cause "Cannot access before initialization"
                // errors when chunked separately.
                // Do NOT manually chunk these - let them go to vendor-misc where Rollup
                // can properly order module initialization.
                const noManualChunk = [
                  // JSZip chain
                  "jszip",
                  "readable-stream",
                  "pako",
                  // Buffer polyfills
                  "buffer",
                  "base64-js",
                  "ieee754",
                  // Stream utilities
                  "inherits",
                  "util-deprecate",
                  "safe-buffer",
                  "string_decoder",
                  "core-util-is",
                  "isarray",
                  // Crypto polyfills (bn.js has .gt() method that fails if loaded wrong order)
                  "bn.js",
                  "browserify-aes",
                  "browserify-cipher",
                  "browserify-des",
                  "browserify-rsa",
                  "browserify-sign",
                  "create-ecdh",
                  "create-hash",
                  "create-hmac",
                  "crypto-browserify",
                  "des.js",
                  "diffie-hellman",
                  "elliptic",
                  "evp_bytestokey",
                  "hash-base",
                  "hash.js",
                  "hmac-drbg",
                  "md5.js",
                  "miller-rabin",
                  "minimalistic-assert",
                  "minimalistic-crypto-utils",
                  "parse-asn1",
                  "pbkdf2",
                  "public-encrypt",
                  "randombytes",
                  "randomfill",
                  "ripemd160",
                  "sha.js",
                  "asn1.js",
                  // Babel runtime - keep with other polyfills
                  "@babel",
                ];
                if (noManualChunk.some((pkg) => packageName === pkg || packageName.startsWith(pkg))) {
                  return "vendor-misc"; // Let these all go together in vendor-misc
                }

                // Large known packages get their own chunk
                const largePackages = ["leaflet", "prismarine", "three", "lodash", "moment", "axios", "uuid"];
                if (largePackages.some((pkg) => packageName.includes(pkg))) {
                  return `vendor-${packageName}`;
                }
              }
              // Remaining node_modules go into a general vendor chunk
              return "vendor-misc";
            }

            // App code chunks - split by major feature area
            if (id.includes("/UX/world/")) {
              return "app-3d"; // 3D rendering code
            }
            if (id.includes("/UXex/")) {
              return "app-extended"; // Extended editors
            }
            if (id.includes("/minecraft/")) {
              return "app-minecraft"; // Minecraft data handling
            }

            // Default: let Rollup decide (will go into main chunk)
            return undefined;
          },
        },
      },
    },
    // Worker configuration for proper bundling
    worker: {
      format: "es",
      // Don't use nodePolyfills in workers - they inject code that references window
      // Workers have their own polyfills in worker-polyfills.ts
      plugins: () => [],
      rollupOptions: {
        output: {
          // Ensure worker has a predictable name
          entryFileNames: "assets/[name]-worker.[hash].js",
        },
      },
    },
    define: {
      // Use globalThis instead of window for workers compatibility
      // globalThis works in both browser main thread and workers
      global: "globalThis",
      ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS === "true",
      BUILD_TARGET: JSON.stringify("web"),
      BUILD_VERSION: JSON.stringify(process.env.npm_package_version || "0.0.1-dev"),
      BUILD_DATE: JSON.stringify(new Date().toISOString()),
    },
    ...(command === "serve" && {
      root: ".",
      server: {
        ...this?.server,
        port: 3000,
        open: "/index.html",
      },
    }),
  };
});
