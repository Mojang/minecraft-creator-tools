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

/** @type WebpackConfig */
const webExtensionConfig = {
  mode: "production",
  target: "web",
  output: {
    filename: "mct.js",
    path: path.join(__dirname, "jsmin", "web"),
    devtoolModuleFilenameTemplate: "../[resource-path]",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
  optimization: {
    runtimeChunk: false,
    splitChunks: false,
  },
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
        test: /\.d\.ts$/,
        use: [
          {
            loader: "ignore-loader",
          },
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
          /\/results\//,
          /\/scenarios\//,
          /\/webpack\//,
          /\/config-overrides\//,
          /\.d\.ts$/,
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
