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
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

// Read version from package.json
const packageJson = require("./package.json");

/** @type WebpackConfig */
const webExtensionConfig = {
  mode: "production",
  target: "web",
  entry: {
    extension: "./src/vscwebindex.tsx",
  },
  output: {
    filename: "web.js",
    chunkFilename: "chunks/[name].[contenthash:8].js",
    cssChunkFilename: "chunks/[name].[contenthash:8].css",
    path: path.join(__dirname, "toolbuild", "vsc", "web"),
    devtoolModuleFilenameTemplate: "../[resource-path]",
    // publicPath is set dynamically at runtime via __webpack_public_path__ in vscwebindex.tsx
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".css"],
    fallback: {
      // Node.js core modules - not available in browser, provide false to ignore
      zlib: false,
      stream: false,
      buffer: false,
      util: false,
      fs: false,
      path: false,
      crypto: false,
      os: false,
      assert: false,
    },
  },
  optimization: {
    runtimeChunk: false,
    splitChunks: {
      chunks: "async",
      minSize: 20000,
      minRemainingSize: 0,
      minChunks: 1,
      maxAsyncRequests: 30,
      maxInitialRequests: 30,
      enforceSizeThreshold: 50000,
      cacheGroups: {
        // Babylon.js - 3D rendering engine (~8MB)
        babylon: {
          test: /[\\/]node_modules[\\/](babylonjs|@babylonjs)[\\/]/,
          name: "vendor-babylon",
          chunks: "async",
          priority: 30,
          reuseExistingChunk: true,
        },
        // Blockly - visual programming (~1MB)
        blockly: {
          test: /[\\/]node_modules[\\/](blockly|react-blockly)[\\/]/,
          name: "vendor-blockly",
          chunks: "async",
          priority: 25,
          reuseExistingChunk: true,
        },
        // FluentUI - UI components
        fluentui: {
          test: /[\\/]node_modules[\\/]@fluentui[\\/]/,
          name: "vendor-fluentui",
          chunks: "async",
          priority: 20,
          reuseExistingChunk: true,
        },
        // MUI/Emotion - Material UI
        mui: {
          test: /[\\/]node_modules[\\/](@mui|@emotion)[\\/]/,
          name: "vendor-mui",
          chunks: "async",
          priority: 20,
          reuseExistingChunk: true,
        },
        // React ecosystem
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
          name: "vendor-react",
          chunks: "async",
          priority: 15,
          reuseExistingChunk: true,
        },
        // Other vendor modules
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendor-misc",
          chunks: "async",
          priority: 10,
          reuseExistingChunk: true,
        },
        default: false,
      },
    },
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "web.css",
      chunkFilename: "chunks/[name].[contenthash:8].css",
    }),
    new webpack.DefinePlugin({
      ENABLE_ANALYTICS: JSON.stringify(false),
      BUILD_TARGET: JSON.stringify("vscode-webview"),
      BUILD_VERSION: JSON.stringify(packageJson.version),
      BUILD_DATE: JSON.stringify(new Date().toISOString()),
    }),
  ],
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
          /\/results\//,
          /\/scenarios\//,
          /\/localserver\//,
          /\/ux\//,
          /\/uxex\//,
          /\/workers\//,
          /\/UX\/world\//,
          /\/testshared\//,
          /\/testweb\//,
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
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
        exclude: [
          /\/out\//,
          /\/build\//,
          /\/toolbuild\//,
          /\/debugoutput\//,
          /\/webpack\//,
          /\/scriptlibs\//,
          /\/localserver\//,
          /\/results\//,
          /\/scenarios\//,
          /\/config-overrides\//,
          /CHANGELOG/,
        ],
      },
      {
        test: /\.tsx?$/,
        exclude: [
          /\/node_modules\//,
          /\/out\//,
          /\/toolbuild\//,
          /\/debugoutput\//,
          /\/build\//,
          /\/scriptlibs\//,
          /\/localserver\//,
          /\/results\//,
          /\/scenarios\//,
          /\/webpack\//,
          /\/config-overrides\//,
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
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: "tsconfig.vscweb.json",
            },
          },
        ],
      },
    ],
  },
  performance: {
    hints: false,
  },
  // devtool: "nosources-source-map", // create a source map that points to the original source file
  // infrastructureLogging: {
  //   level: "log", // enables logging required for problem matchers
  // },
};

module.exports = webExtensionConfig;
