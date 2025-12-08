/// <reference types="vite-plugin-svgr/client" />

/**
 * Global constants injected by Vite at build time.
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
