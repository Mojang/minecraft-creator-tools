/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check
"use strict";

/** @typedef {import('webpack').Configuration} WebpackConfig **/

const path = require("path");
const webpack = require("webpack");

// Read version from package.json
const packageJson = require("./package.json");

/** @type WebpackConfig */
const jsnConfig = {
  mode: "production",
  target: "node",
  // For ESM output, we need webpack to provide __dirname/__filename polyfills
  // since they don't exist natively in ESM. Setting to true makes webpack
  // inject code to compute them from import.meta.url
  node: {
    __dirname: true,
    __filename: true,
  },
  // Enable experiments for ESM support (needed for Ink v5 which uses top-level await)
  // outputModule: enables ESM output format instead of CommonJS
  experiments: {
    topLevelAwait: true,
    outputModule: true,
  },
  // Configure module parsing for better ESM/CJS interop
  // Ink v5 uses `export { default as render }` pattern which needs proper interop
  optimization: {
    // Don't mangle module exports to help with ESM named export resolution
    mangleExports: false,
  },
  entry: {
    "cli/index": "./src/cli/index.ts",
    // TaskWorker needs to be a separate file for worker_threads to load it
    "cli/TaskWorker": "./src/cli/TaskWorker.ts",
  },
  output: {
    filename: "[name].mjs",
    path: path.join(__dirname, "toolbuild", "jsn"),
    // ESM output instead of CommonJS - eliminates ESM->CJS interop issues
    // Ink v5 and React 18 are ESM-only, so this is the proper output format
    library: {
      type: "module",
    },
    devtoolModuleFilenameTemplate: "../../[resource-path]",
    // ESM chunk format for async loading
    chunkFormat: "module",
  },
  resolve: {
    mainFields: ["main", "module"],
    extensions: [".ts", ".tsx", ".js"],
    alias: {},
    // Handle TypeScript path resolution
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js"],
    },
  },
  module: {
    rules: [
      {
        test: /\.node$/,
        use: [
          {
            loader: "ignore-loader",
          },
        ],
      },
      {
        test: /\.ts$/,
        exclude: [
          /node_modules/,
          /[/\\]UX[/\\]/,
          /[/\\]UXex[/\\]/,
          /[/\\]toolbuild[/\\]/,
          /[/\\]debugoutput[/\\]/,
          /[/\\]jsnode[/\\]/,
          /[/\\]test[/\\]/,
          /[/\\]test-ex[/\\]/,
          /[/\\]test-extra[/\\]/,
          /gulp-/,
          /[/\\]scriptlibs[/\\]/,
          /[/\\]results[/\\]/,
          /[/\\]scenarios[/\\]/,
          /[/\\]public[/\\]/,
          /[/\\]out[/\\]/,
          /[/\\]build[/\\]/,
          /[/\\]UX[/\\]world[/\\]/,
          /[/\\]workers[/\\]/,
          /[/\\]testshared[/\\]/,
          /[/\\]testweb[/\\]/,
          /[/\\]testmobile[/\\]/,
          /[/\\]testelectron[/\\]/,
          /[/\\]monaco[/\\]/,
          /[/\\]vscodeweb[/\\]/,
          /[/\\]babylon[/\\]/,
          /[/\\]dataformux[/\\]/,
          /CHANGELOG/,
        ],
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: "tsconfig.jsncore.json",
              onlyCompileBundledFiles: true,
              transpileOnly: false,
            },
          },
        ],
      },
      {
        // Handle TSX files for CLI Ink components
        test: /\.tsx$/,
        include: (filepath) => {
          // Match cli folder on both Windows (backslashes) and Unix (forward slashes)
          return /[/\\]cli[/\\]/.test(filepath);
        },
        exclude: [/node_modules/, /[/\\]test[/\\]?$/],
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: "tsconfig.jsncore.json",
              onlyCompileBundledFiles: true,
              transpileOnly: false,
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      ENABLE_ANALYTICS: JSON.stringify(false),
      BUILD_TARGET: JSON.stringify("nodejs-cli"),
      BUILD_VERSION: JSON.stringify(packageJson.version),
      BUILD_DATE: JSON.stringify(new Date().toISOString()),
    }),
    new webpack.BannerPlugin({
      // Suppress deprecation warnings from third-party dependencies (e.g., url.parse DEP0169)
      // This must run before any other code, so we put it in the shebang banner
      banner: "#!/usr/bin/env node\nprocess.noDeprecation = true;",
      raw: true,
    }),
    // Ignore optional dependencies that we don't need
    // This prevents webpack from trying to bundle or externalize them
    new webpack.IgnorePlugin({
      resourceRegExp: /^react-devtools-core$/,
    }),
  ],
  // For ESM output, externals must use 'module' type instead of 'commonjs'
  // to generate import statements rather than require() calls
  externalsType: "module",
  externals: {
    // Externalize native modules and optional dependencies
    // With externalsType: "module", these become ESM imports
    "esbuild-wasm": "esbuild-wasm",
    playwright: "playwright",
    "playwright-core": "playwright-core",
    inquirer: "inquirer",
    ws: "ws",
    bufferutil: "bufferutil",
    "utf-8-validate": "utf-8-validate",
    "@resvg/resvg-js": "@resvg/resvg-js",
    // Note: react-devtools-core is handled by IgnorePlugin above
    // Ink v5+ and React 18 are ESM-only. Now that we output ESM, externalize them.
    ink: "ink",
    react: "react",
    "react-dom": "react-dom",
    // Node.js built-ins - import syntax works with node: prefix in ESM
    fs: "node:fs",
    zlib: "node:zlib",
    http: "node:http",
    https: "node:https",
    net: "node:net",
    // Externalize exifr to avoid bundling its dynamic require code
    exifr: "exifr",
  },
  performance: {
    hints: false,
  },
  devtool: "source-map",
  infrastructureLogging: {
    level: "log",
  },
};

module.exports = jsnConfig;
