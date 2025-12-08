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
  mode: "development", // Changed from "production" to "development" for debugging
  target: "web",
  entry: {
    extension: "./src/jsnwebindex.tsx",
  },
  output: {
    filename: "web.js",
    path: path.join(__dirname, "toolbuild", "jsn", "web"),
    devtoolModuleFilenameTemplate: "../[resource-path]",
    pathinfo: true, // Include comments with path info for debugging
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".css"],
    alias: {
      "react/jsx-dev-runtime": "react/jsx-dev-runtime.js",
      "react/jsx-runtime": "react/jsx-runtime.js",
    },
  },
  optimization: {
    minimize: false, // Disable minification for debugging
    concatenateModules: false, // Disable module concatenation for better debugging
    runtimeChunk: false,
    splitChunks: false, // Disable chunk splitting for simpler debugging
  },
  plugins: [
    new MiniCssExtractPlugin({ filename: "web.css" }),
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify("development"), // Ensure React runs in development mode
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
          /\/localserver\//,
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
        test: /\.ts$/,
        exclude: [
          /\/node_modules\//,
          /\/toolbuild\//,
          /\/debugoutput\//,
          /\/localserver\//,
          /\/out\//,
          /\/build\//,
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
              transpileOnly: false, // Enable type checking for better debugging
              compilerOptions: {
                removeComments: false, // Keep comments for debugging
                sourceMap: true,
              },
            },
          },
        ],
      },
    ],
  },
  performance: {
    hints: false,
  },
  devtool: "eval-source-map", // Best source map for debugging - creates separate source map for each module
  infrastructureLogging: {
    level: "verbose", // More verbose logging for debugging
  },
};

module.exports = webExtensionConfig;
