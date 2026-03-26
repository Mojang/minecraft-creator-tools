/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check
"use strict";

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const path = require("path");
const webpack = require("webpack");

// Read version from package.json
const packageJson = require("./package.json");

/** @type WebpackConfig */
const webExtensionConfig = {
  mode: "none", // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
  target: "webworker", // VSCode web extensions run in a webworker context, not node
  entry: {
    extension: "./src/vscode/webextension.ts",
  },
  output: {
    filename: "core/webextension.js",
    path: path.join(__dirname, "toolbuild", "vsc"),
    libraryTarget: "commonjs",
    devtoolModuleFilenameTemplate: "../../[resource-path]",
  },
  resolve: {
    mainFields: ["browser", "module", "main"], // Prefer browser/ESM builds over UMD/CommonJS
    extensions: [".ts", ".js"], // support ts-files and js-files
    alias: {},
    // Provide empty fallbacks for Node.js built-in modules that aren't available in web context
    fallback: {
      crypto: false, // Use Web Crypto API via CreatorToolsHost abstraction
      fs: false,
      path: false,
      os: false,
      stream: false,
      buffer: false,
      util: false,
      assert: false,
      http: false,
      https: false,
      url: false,
      zlib: false,
      child_process: false,
      worker_threads: false,
      net: false,
      tls: false,
      dns: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: [
          /\/node_modules\//,
          /\/toolbuild\//,
          /\/debugoutput\//,
          /\/out\//,
          /\/build\//,
          /\/scriptlibs\//,
          /\/localserver\//,
          /\/local\//, // Exclude local/ folder - contains Node.js specific code with crypto
          /\/cli\//, // Exclude cli/ folder - Node.js specific
          /\/mcp\//, // Exclude mcp/ folder - Node.js specific
          /\/results\//,
          /\/scenarios\//,
          /\/ux\//,
          /\/uxex\//,
          /\/workers\//,
          /\/UX\/world\//,
          /\/testshared\//,
          /\/testweb\//,
          /\/testmobile\//,
          /\/testelectron\//,
          /\/testperf\//,
          /\/testreflow\//,
          /\/testviewers\//,
          /\/testvscweb\//,
          /\/testa11y\//,
          /\/test\//,
          /\/test-ex\//,
          /\/test-extra\//,
          /\/test-longhaul\//,
          /CHANGELOG/,
        ],
      },
      {
        test: /\.ts$/,
        exclude: [
          /\/node_modules\//,
          /\/toolbuild\//,
          /\/debugoutput\//,
          /\/out\//,
          /\/build\//,
          /\/scriptlibs\//,
          /\/results\//,
          /\/scenarios\//,
          /\/localserver\//,
          /\/local\//, // Exclude local/ folder - contains Node.js specific code with crypto
          /\/cli\//, // Exclude cli/ folder - Node.js specific
          /\/mcp\//, // Exclude mcp/ folder - Node.js specific
          /\/dataformux\//,
          /\/ux\//,
          /\/uxex\//,
          /\/workers\//,
          /\/UX\/world\//,
          /\/testshared\//,
          /\/testweb\//,
          /\/testmobile\//,
          /\/testelectron\//,
          /\/testperf\//,
          /\/testreflow\//,
          /\/testviewers\//,
          /\/testvscweb\//,
          /\/testa11y\//,
          /\/test\//,
          /\/test-ex\//,
          /\/test-extra\//,
          /\/test-longhaul\//,
          /\.tsx$/,
          /CHANGELOG/,
        ],
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: "tsconfig.vsccoreweb.json",
              transpileOnly: true, // Skip type checking for faster builds and to avoid pulling in excluded modules
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({
      //process: "process/browser", // provide a shim for the global `process` variable
    }),
    new webpack.DefinePlugin({
      ENABLE_ANALYTICS: JSON.stringify(false),
      BUILD_TARGET: JSON.stringify("vscode-web-extension"),
      BUILD_VERSION: JSON.stringify(packageJson.version),
      BUILD_DATE: JSON.stringify(new Date().toISOString()),
    }),
  ],
  externals: {
    vscode: "commonjs vscode",
    // Note: esbuild-wasm is designed for browser/web contexts and should be bundled, not marked external
    // Marking it external causes "Cannot load module 'esbuild-wasm'" in webworker context
  },
  performance: {
    hints: false,
  },
  devtool: "nosources-source-map", // create a source map that points to the original source file
  infrastructureLogging: {
    level: "log", // enables logging required for problem matchers
  },
};

module.exports = webExtensionConfig;
