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
    chunkFilename: "chunks/[name].[contenthash:8].js",
    path: path.join(__dirname, "toolbuild", "jsn", "web"),
    devtoolModuleFilenameTemplate: "../[resource-path]",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".css"],
    alias: {
      // Map jsx-runtime imports to the actual file paths in node_modules
      // This is needed because webpack can have issues with React's package.json exports field
      "react/jsx-dev-runtime.js": path.resolve(__dirname, "node_modules/react/jsx-dev-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(__dirname, "node_modules/react/jsx-dev-runtime.js"),
      "react/jsx-runtime.js": path.resolve(__dirname, "node_modules/react/jsx-runtime.js"),
      "react/jsx-runtime": path.resolve(__dirname, "node_modules/react/jsx-runtime.js"),
    },
    // Fallbacks for Node.js core modules - set to false to exclude from browser bundle
    // These are used by pngjs and ImageCodecNode which are Node.js-only
    fallback: {
      stream: false,
      zlib: false,
      buffer: false,
      fs: false,
      path: false,
      crypto: false,
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
    new MiniCssExtractPlugin({ filename: "web.css" }),
    new webpack.DefinePlugin({
      ENABLE_ANALYTICS: JSON.stringify(false),
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
          /\/local\//,
          /\/localserver\//,
          /\/scriptlibs\//,
          /\/results\//,
          /\/scenarios\//,
          /\/res\//,
          /\/ux\//,
          /\/uxex\//,
          /\/UX\/world\//,
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
          /\/local\//,
          /\/localserver\//,
          /\/scriptlibs\//,
          /\/results\//,
          /\/scenarios\//,
          /\/ux\//,
          /\/uxex\//,
          /\/UX\/world\//,
          /\/testshared\//,
          /\/testweb\//,
          /\/testmobile\//,
          /\/testviewers\//,
          /\/testelectron\//,
          /\/test\//,
          /\/test-ex\//,
          /\/test-extra\//,
          /\/test-longhaul\//,
          /CHANGELOG/,
        ],
      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        type: "asset/resource",
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: "asset/resource",
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
          /\/local\//,
          /\/localserver\//,
          /\/build\//,
          /\/scriptlibs\//,
          /\/results\//,
          /\/scenarios\//,
          /\/webpack\//,
          /\/config-overrides\//,
          /\/testshared\//,
          /\/testweb\//,
          /\/testmobile\//,
          /\/testviewers\//,
          /\/testelectron\//,
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
  cache: {
    type: "filesystem",
    cacheDirectory: path.join(__dirname, "node_modules", ".cache", "webpack-jsnweb"),
    buildDependencies: {
      config: [__filename],
    },
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
