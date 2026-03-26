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
  mode: "production",
  target: "node",
  entry: {
    extension: "./src/vscode/extension.ts",
  },
  output: {
    filename: "core/extension.js",
    path: path.join(__dirname, "toolbuild", "vsc"),
    libraryTarget: "commonjs",
    devtoolModuleFilenameTemplate: "../../[resource-path]",
  },
  resolve: {
    mainFields: ["main", "module", "browser"],
    extensions: [".ts", ".js"], // support ts-files and js-files
    alias: {
      // provides alternate implementation for node module and source files
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
        test: /\.js$/,
        exclude: [
          /node_modules/,
          /\/toolbuild\//,
          /\/debugoutput\//,
          /\/jsnode\//,
          /\/test\//,
          /\/test-ex\//,
          /\/test-extra\//,
          /gulp-/,
          /\/out\//,
          /\/image-js\//,
          /\/build\//,
          /\/scriptlibs\//,
          /\/results\//,
          /\/scenarios\//,
          /\/res\//,
          /\/public\//,
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
          /\/test-ex\//,
          /\/test-extra\//,
          /\/test-longhaul\//,
          /CHANGELOG/,
        ],
      },
      {
        test: /\.ts$/,
        exclude: [
          /node_modules/,
          /\/ux\//,
          /\/uxex\//,
          /\/toolbuild\//,
          /\/debugoutput\//,
          /\/jsnode\//,
          /\/test\//,
          /\/test-ex\//,
          /\/test-extra\//,
          /gulp-/,
          /\/scriptlibs\//,
          /\/results\//,
          /\/scenarios\//,
          /\/public\//,
          /\/dataformux\//,
          /\/out\//,
          /\/build\//,
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
          /\/test-longhaul\//,
          /\.tsx$/,
          /CHANGELOG/,
        ],
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: "tsconfig.vsccore.json",
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
      BUILD_TARGET: JSON.stringify("vscode-node"),
      BUILD_VERSION: JSON.stringify(packageJson.version),
      BUILD_DATE: JSON.stringify(new Date().toISOString()),
    }),
  ],
  externals: {
    vscode: "commonjs vscode",
    playwright: "commonjs playwright",
    "playwright-core": "commonjs playwright-core",
    "esbuild-wasm": "commonjs esbuild-wasm",
    "@resvg/resvg-js": "commonjs @resvg/resvg-js",
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
