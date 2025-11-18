/**
 * DO NOT ASSIGN TO THESE - they are replaced at build time!
 *
 * Global constants injected by webpack DefinePlugin at build time.
 *
 * @see webpack.vsccore.config.js
 * @see webpack.vscweb.config.js
 * @see webpack.jsnweb.config.js
 */

/**
 * Whether analytics/telemetry should be enabled for this build.
 */
declare const ENABLE_ANALYTICS: boolean;

/**
 * The target platform for this build.
 */
declare const BUILD_TARGET: "vscode-node" | "vscode-web-extension" | "vscode-webview" | "cli-web" | "web" | "electron";

/**
 * The version string from package.json.
 */
declare const BUILD_VERSION: string;

/**
 * Timestamp of when this build was created.
 */
declare const BUILD_DATE: string;
