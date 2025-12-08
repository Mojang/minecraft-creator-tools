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
    extension: "./src/jsnwebindex.tsx",
  },
  output: {
    filename: "web.js",
    path: path.join(__dirname, "toolbuild", "jsn", "web"),
    devtoolModuleFilenameTemplate: "../[resource-path]",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".css"],
    alias: {
      "react/jsx-dev-runtime": "react/jsx-dev-runtime.js",
      "react/jsx-runtime": "react/jsx-runtime.js",
    },
  },
  optimization: {
    runtimeChunk: false,
    splitChunks: {
      chunks: "async",
      minSize: 2000000,
      minRemainingSize: 0,
      minChunks: 1,
      maxAsyncRequests: 30,
      maxInitialRequests: 30,
      enforceSizeThreshold: 50000,
      cacheGroups: {
        default: false,
      },
    },
  },
  plugins: [
    new MiniCssExtractPlugin({ filename: "web.css" }),
    new webpack.DefinePlugin({
      ENABLE_ANALYTICS: JSON.stringify(process.env.NODE_ENV === "production"),
      BUILD_TARGET: JSON.stringify("cli-web"),
      BUILD_VERSION: JSON.stringify(packageJson.version),
      BUILD_DATE: JSON.stringify(new Date().toISOString()),
    }),
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: [
          /node_modules/,
          /\/toolbuild\//,
          /\/debugoutput\//,
          /\/out\//,
          /\/build\//,
          /\/localserver\//,
          /\/scriptlibs\//,
          /\/results\//,
          /\/scenarios\//,
          /\/res\//,
          /\/ux\//,
          /\/uxex\//,
          /\/worldux\//,
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
          /\/localserver\//,
          /\/scriptlibs\//,
          /\/results\//,
          /\/scenarios\//,
          /\/ux\//,
          /\/uxex\//,
          /\/worldux\//,
          /\/testshared\//,
          /\/testweb\//,
          /\/testelectron\//,
          /\/test\//,
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
          /\/localserver\//,
          /\/webpack\//,
          /\/scriptlibs\//,
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
          /\/localserver\//,
          /\/build\//,
          /\/scriptlibs\//,
          /\/results\//,
          /\/scenarios\//,
          /\/webpack\//,
          /\/config-overrides\//,
          /\/testshared\//,
          /\/testweb\//,
          /\/testelectron\//,
          /\/test\//,
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
