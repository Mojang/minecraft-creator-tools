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

/** @type WebpackConfig */
const webExtensionConfig = {
  mode: "production",
  target: "web",
  entry: {
    extension: "./src/jsnwebindex.tsx",
  },
  output: {
    filename: "web.js",
    path: path.join(__dirname, "vscode", "web"),
    devtoolModuleFilenameTemplate: "../[resource-path]",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".css"],
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
  plugins: [new MiniCssExtractPlugin({ filename: "web.css" })],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: [/node_modules/, /toolbuild/, /out/, /build/, /ux/, /uxex/, /worldux/, /CHANGELOG/],
      },
      {
        test: /\.ts$/,
        exclude: [/node_modules/, /toolbuild/, /out/, /build/, /ux/, /uxex/, /worldux/, /CHANGELOG/],
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
        exclude: [/out/, /build/, /toolbuild/, /webpack/, /config-overrides/, /CHANGELOG/],
      },
      {
        test: /\.tsx?$/,
        exclude: [/node_modules/, /out/, /toolbuild/, /build/, /webpack/, /config-overrides/, /CHANGELOG/],
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
